'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useProducts, matchProduct, type ProductRow } from '@/hooks/useProducts';
import { calculatePricePerItemFromCanvasState } from '@/lib/customerPriceFromCanvasState';
import { useSavedDesigns, type SavedDesignRow } from '@/hooks/useSavedDesigns';
import DesignEditorModal from '@/components/DesignEditorModal';
import { Card, Icon } from '@/components/ui';

interface Props {
  open: boolean;
  teamId: string | null;
  /** 단체(파트너몰) 이름 — 디자인 제목 default 생성에 사용 */
  mallName?: string | null;
  /** 단체에 등록된 로고 — 새 디자인 에디터에서 바로 배치할 수 있게 전달 */
  teamLogos?: Array<{ url: string; name?: string | null }>;
  onClose: () => void;
  onCreated?: () => void;
}

type Step = 'choice' | 'product-pick' | 'design-pick';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;
const RECOMMENDED_PRODUCT_RULES = [
  { label: '기본 티셔츠', terms: ['베이직', '라운드', '티셔츠', '00085', 'cvt'] },
  { label: '매장 유니폼', terms: ['폴로', '카라', '셔츠', '드라이'] },
  { label: '행사 스태프', terms: ['드라이', '라운드', '쿨', '기능성'] },
  { label: '후드·맨투맨', terms: ['후드', '맨투맨', '스웨트'] },
];

const productText = (p: ProductRow) =>
  [
    p.title,
    p.manufacturer_name,
    p.product_code,
    p.category,
    ...(p.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const recommendationFor = (p: ProductRow) => {
  const text = productText(p);
  let best: { label: string; score: number } | null = null;
  for (const rule of RECOMMENDED_PRODUCT_RULES) {
    const score = rule.terms.reduce((sum, term) => (
      text.includes(term.toLowerCase()) ? sum + 1 : sum
    ), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { label: rule.label, score };
    }
  }
  return best;
};

export default function AddTeamProductFlow({
  open,
  teamId,
  mallName,
  teamLogos = [],
  onClose,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>('choice');
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 새 디자인 저장 직전 제목·가격 입력 모달
  type SaveMeta = { title: string; price: number | null };
  type TitlePrompt = {
    defaultValue: string;
    resolve: (value: SaveMeta | null) => void;
  };
  const [titlePrompt, setTitlePrompt] = useState<TitlePrompt | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [titleSavedName, setTitleSavedName] = useState<string | null>(null);
  const [savedPrice, setSavedPrice] = useState<number | null>(null);

  const { products, isLoading: productsLoading } = useProducts();

  const filteredProducts = useMemo(
    () => products.filter((p) => matchProduct(p, productSearch)),
    [products, productSearch],
  );

  const reset = useCallback(() => {
    setStep('choice');
    setProductSearch('');
    setEditingProduct(null);
    setSubmitting(false);
    setError(null);
    setTitlePrompt(null);
    setTitleInput('');
    setPriceInput('');
    setTitleSavedName(null);
    setSavedPrice(null);
  }, []);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(reset, 0);
    return () => window.clearTimeout(timer);
  }, [open, reset]);

  const buildDefaultTitle = (product: ProductRow | null) => {
    const mall = (mallName ?? '').trim();
    const productTitle = (product?.title ?? '').trim();
    return [mall, productTitle].filter(Boolean).join(' ');
  };

  // DesignEditorModal에서 저장 직전에 호출 — 제목·가격 모달 띄우고 응답 대기.
  // ctx.pricePerItem: modoo_app 정본 방식의 제품 기본가 + 고객 단가표 기반 인쇄 추가가.
  const promptForTitle = (ctx: { printAddon: number; pricePerItem?: number }): Promise<SaveMeta | null> => {
    return new Promise((resolve) => {
      const defaultValue = buildDefaultTitle(editingProduct);
      const base = Math.round(Number(editingProduct?.base_price) || 0);
      const suggested = Math.round(Number(ctx?.pricePerItem) || 0) || base + Math.max(0, Math.round(ctx?.printAddon || 0));
      setTitleInput(defaultValue);
      setPriceInput(suggested > 0 ? String(suggested) : '');
      setTitlePrompt({ defaultValue, resolve });
    });
  };

  const confirmTitle = () => {
    const trimmed = titleInput.trim();
    if (!trimmed) return;
    // 판매가는 항상 확정: 비우거나 잘못 입력하면 제품 기본가로 폴백(절대 null 아님).
    const base = Math.round(Number(editingProduct?.base_price) || 0);
    const parsed = Number(priceInput);
    const price = priceInput.trim() && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : base;
    setTitleSavedName(trimmed);
    setSavedPrice(price);
    titlePrompt?.resolve({ title: trimmed, price });
    setTitlePrompt(null);
  };

  const cancelTitle = () => {
    titlePrompt?.resolve(null);
    setTitlePrompt(null);
  };

  // 단체 mall에 제품 한 건 등록 (색상 필드 없음 — 모두 null)
  const placeOne = async (params: {
    productId: string;
    displayName: string;
    canvasState: Record<string, unknown>;
    previewUrl: string | null;
    price: number | null;
  }) => {
    if (!teamId) throw new Error('teamId 누락');
    const res = await fetch('/api/team-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        product_id: params.productId,
        display_name: params.displayName,
        manufacturer_color_id: null,
        color_hex: null,
        color_name: null,
        color_code: null,
        logo_placements: {},
        canvas_state: params.canvasState,
        preview_url: params.previewUrl,
        price: params.price,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const detail = [j?.error, j?.code, j?.details, j?.hint].filter(Boolean).join(' | ');
      throw new Error(detail || `저장 실패 (${res.status})`);
    }
  };

  // 새 디자인: 에디터 저장 완료 후 단체 mall에 배치
  const handleNewDesignSaved = async (
    design: SavedDesignRow,
    meta?: { title: string; price?: number | null },
  ) => {
    if (!editingProduct) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: full, error: fetchError } = await supabase
        .from('saved_designs')
        .select('canvas_state, preview_url')
        .eq('id', design.id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const finalTitle =
        meta?.title ?? titleSavedName ?? buildDefaultTitle(editingProduct) ?? editingProduct.title;
      // 판매가 항상 확정: 미입력 시 제품 기본가로 폴백.
      const baseFallback = Math.round(Number(editingProduct.base_price) || 0);
      const finalPrice = meta?.price ?? savedPrice ?? baseFallback;

      await placeOne({
        productId: editingProduct.id,
        displayName: finalTitle,
        canvasState: (full?.canvas_state as Record<string, unknown> | null) ?? {},
        previewUrl: full?.preview_url ?? design.preview_url ?? null,
        price: finalPrice,
      });

      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // 기존 디자인: 선택한 saved_design들을 단체 mall에 일괄 배치
  const handleExistingDesignsPicked = async (designs: SavedDesignRow[]) => {
    const targets = designs.filter((d) => d.product_id);
    if (targets.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const d of targets) {
        const { data: full } = await supabase
          .from('saved_designs')
          .select('canvas_state, preview_url')
          .eq('id', d.id)
          .maybeSingle();
        const canvasState = (full?.canvas_state as Record<string, unknown> | null) ?? {};
        // 판매가 항상 확정: 저장된 정본 단가 우선, 없으면 modoo_app 방식으로 복구.
        const prod = products.find((p) => p.id === d.product_id);
        const base = Math.round(Number(prod?.base_price) || 0);
        const price =
          d.price_per_item && d.price_per_item > 0
            ? Math.round(d.price_per_item)
            : await calculatePricePerItemFromCanvasState(canvasState, base);
        await placeOne({
          productId: d.product_id!,
          displayName: d.title ?? buildDefaultTitle(null) ?? '디자인',
          canvasState,
          previewUrl: full?.preview_url ?? d.preview_url ?? null,
          price,
        });
      }
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !teamId) return null;

  // 새 디자인 — 인앱 에디터 풀스크린
  if (editingProduct) {
    return (
      <>
        <DesignEditorModal
          productId={editingProduct.id}
          teamLogos={teamLogos}
          onClose={() => setEditingProduct(null)}
          onSaveComplete={handleNewDesignSaved}
          onBeforeSave={promptForTitle}
        />

        {titlePrompt && (
          <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/50 px-5">
            <div className="w-full max-w-sm rounded-[18px] bg-white p-5 shadow-2xl">
              <h3 className="text-[15px] font-bold text-[var(--color-ink)]">제품 이름 · 판매가</h3>
              <p className="mt-1 text-[12px] text-[var(--color-muted)] leading-relaxed">
                단체 전용몰에 진열될 이름과 고객 판매가(개당)예요. 기본값은 <b>제품가 + 예상 인쇄가</b>이며,
                마진을 더해 실제 판매가로 조정하세요. (비우면 제품 기본가로 확정)
              </p>
              <label className="mt-3 block text-[11px] font-bold text-[var(--color-muted)]">제품 이름</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelTitle();
                }}
                autoFocus
                placeholder={titlePrompt.defaultValue}
                className="mt-1 w-full rounded-[12px] bg-[var(--color-surface-alt)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              />
              <label className="mt-3 block text-[11px] font-bold text-[var(--color-muted)]">고객 판매가 (개당, 원)</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmTitle();
                  else if (e.key === 'Escape') cancelTitle();
                }}
                placeholder="예: 18000 (비우면 기본가)"
                className="mt-1 w-full rounded-[12px] bg-[var(--color-surface-alt)] px-3 py-2.5 text-[13px] font-mono text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={cancelTitle}
                  className="flex-1 rounded-[12px] bg-[var(--color-surface-alt)] py-2.5 text-[13px] font-bold text-[var(--color-muted)] active:bg-[var(--color-hairline)]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmTitle}
                  disabled={titleInput.trim().length === 0}
                  className="flex-[1.4] rounded-[12px] bg-[var(--color-brand-500)] py-2.5 text-[13px] font-bold text-white active:bg-[var(--color-brand-600)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {(submitting || error) && (
          <div className="fixed inset-x-4 bottom-6 z-[10000] rounded-[14px] bg-[var(--color-ink)] text-white px-4 py-3 shadow-2xl">
            {submitting ? (
              <span className="flex items-center gap-2 text-[13px]">
                <Loader2 className="size-4 animate-spin" /> 단체 mall에 등록 중…
              </span>
            ) : (
              <span className="text-[12px] text-[var(--color-warn)]">{error}</span>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[8500] flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          {step !== 'choice' ? (
            <button
              onClick={() => setStep('choice')}
              className="p-2 -ml-1 text-[var(--color-muted)]"
              aria-label="뒤로"
            >
              <Icon name="chevron-l" size={20} />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center truncate px-2">
            {step === 'choice' && '제품 추가'}
            {step === 'product-pick' && '새 디자인 — 제품 선택'}
            {step === 'design-pick' && '기존 디자인 가져오기'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-1 text-[var(--color-muted)]"
            aria-label="닫기"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'choice' && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <ActionTile
                  icon="palette"
                  label="새 디자인"
                  desc="에디터로 작업"
                  onClick={() => {
                    setProductSearch('');
                    setStep('product-pick');
                  }}
                />
                <ActionTile
                  icon="image"
                  label="기존 디자인"
                  desc="저장된 작업 검색"
                  onClick={() => setStep('design-pick')}
                />
              </div>
              <Card padding="lg">
                <p className="text-[12px] text-[var(--color-muted)] leading-relaxed text-center">
                  새 디자인을 만들거나 기존 디자인을 선택해 단체 mall에 제품을 배치하세요.
                  바로 주문으로 이어지지 않습니다.
                </p>
              </Card>
            </div>
          )}

          {step === 'product-pick' && (
            <ProductPicker
              products={filteredProducts}
              search={productSearch}
              onSearchChange={setProductSearch}
              onPick={(p) => setEditingProduct(p)}
              isLoading={productsLoading}
            />
          )}

          {step === 'design-pick' && (
            <DesignPicker
              products={products}
              onPick={handleExistingDesignsPicked}
            />
          )}

          {error && (
            <div className="mx-4 my-3 rounded-[10px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
              {error}
            </div>
          )}
        </div>

        {submitting && (
          <div className="border-t border-[var(--color-hairline-soft)] px-3 py-3 flex items-center justify-center gap-2 text-[12px] text-[var(--color-muted)]">
            <Loader2 className="size-4 animate-spin" /> 단체 mall에 등록 중…
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 새 디자인용 제품 picker
// =====================================================================
function ProductPicker({
  products,
  search,
  onSearchChange,
  onPick,
  isLoading,
}: {
  products: ProductRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onPick: (p: ProductRow) => void;
  isLoading: boolean;
}) {
  const showRecommendations = search.trim().length === 0;
  const recommendedProducts = useMemo(() => {
    if (!showRecommendations) return [];
    const ranked = products
      .map((product) => ({ product, recommendation: recommendationFor(product) }))
      .filter((item): item is { product: ProductRow; recommendation: { label: string; score: number } } => !!item.recommendation)
      .sort((a, b) => {
        if (b.recommendation.score !== a.recommendation.score) {
          return b.recommendation.score - a.recommendation.score;
        }
        return (Number(a.product.base_price) || 0) - (Number(b.product.base_price) || 0);
      })
      .slice(0, 6);
    return ranked.length > 0
      ? ranked
      : products.slice(0, 6).map((product) => ({
          product,
          recommendation: { label: '빠른 시작', score: 0 },
        }));
  }, [products, showRecommendations]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[var(--color-hairline-soft)]">
        <Card padding="sm" className="flex items-center gap-2">
          <Icon name="search" size={14} color="var(--color-faint)" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="제품명 · 제조사 · 코드 검색"
            className="flex-1 outline-none text-[13px] bg-transparent"
            autoFocus
          />
        </Card>
        <p className="text-[10px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
          제품을 선택하면 인앱 에디터로 바로 디자인을 시작합니다. 저장하면 단체 mall에 등록됩니다.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">검색 결과 없음</div>
        ) : (
          <div>
            {recommendedProducts.length > 0 && (
              <section className="border-b border-[var(--color-hairline-soft)] px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-extrabold text-[var(--color-ink)]">현장 추천</h3>
                  <span className="text-[10px] text-[var(--color-muted)]">바로 시안 만들기</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {recommendedProducts.map(({ product: p, recommendation }) => (
                    <button
                      key={p.id}
                      onClick={() => onPick(p)}
                      className="min-w-[166px] max-w-[166px] rounded-[14px] border border-[var(--color-hairline)] bg-white p-2 text-left active:bg-[var(--color-surface-alt)]"
                    >
                      <div className="h-[92px] rounded-[10px] bg-[var(--color-surface-alt)] overflow-hidden flex items-center justify-center">
                        {p.thumbnail_image_link?.[0] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.thumbnail_image_link[0]}
                            alt={p.title}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Icon name="package" size={24} color="var(--color-faint)" />
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="rounded-full bg-[var(--color-brand-100)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-brand-700)]">
                          {recommendation.label}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-muted)]">
                          {fmt(Number(p.base_price) || 0)}
                        </span>
                      </div>
                      <div className="mt-1 h-[32px] text-[11px] font-bold leading-[16px] text-[var(--color-ink)] line-clamp-2">
                        {p.title}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-[var(--color-muted)]">
              전체 제품
            </div>
            <div className="divide-y divide-[var(--color-hairline-soft)]">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="w-full px-4 py-3 flex items-center gap-3 active:bg-[var(--color-surface-alt)] text-left"
              >
                <div className="w-12 h-12 bg-[var(--color-surface-alt)] rounded-[10px] overflow-hidden flex-shrink-0">
                  {p.thumbnail_image_link?.[0] && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.thumbnail_image_link[0]}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[var(--color-ink)] truncate">
                    {p.title}
                  </div>
                  {(p.manufacturer_name || p.product_code) && (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {p.manufacturer_name && (
                        <span className="text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-muted)] px-1.5 py-0.5 rounded">
                          {p.manufacturer_name}
                        </span>
                      )}
                      {p.product_code && (
                        <span className="text-[10px] font-mono bg-[var(--color-brand-100)] text-[var(--color-brand-700)] px-1.5 py-0.5 rounded">
                          {p.product_code}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] text-[var(--color-muted)] font-mono mt-0.5">
                    {fmt(Number(p.base_price) || 0)}
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[var(--color-brand-500)] flex items-center gap-0.5 flex-shrink-0">
                  <Icon name="arrow-up-r" size={12} color="var(--color-brand-500)" />
                  디자인 시작
                </span>
              </button>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 기존 디자인 picker
// =====================================================================
function DesignPicker({
  products,
  onPick,
}: {
  products: ProductRow[];
  onPick: (designs: SavedDesignRow[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { designs, total, totalPages, isLoading } = useSavedDesigns({ search, page, limit: 12 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = designs.filter((d) => selectedIds.has(d.id) && d.product_id);
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[var(--color-hairline-soft)]">
        <Card padding="sm" className="flex items-center gap-2">
          <Icon name="search" size={14} color="var(--color-faint)" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="디자인 제목 검색"
            className="flex-1 outline-none text-[13px] bg-transparent"
            autoFocus
          />
        </Card>
        <p className="text-[10px] text-[var(--color-muted)] mt-1.5">
          총 {total}개 · {selectedIds.size}개 선택됨
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>
        ) : designs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">디자인 없음</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {designs.map((d) => {
              const product = d.product_id ? productMap.get(d.product_id) : null;
              const checked = selectedIds.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`text-left rounded-[10px] border-2 overflow-hidden ${
                    checked
                      ? 'border-[var(--color-brand-500)]'
                      : 'border-[var(--color-hairline)]'
                  }`}
                >
                  <div className="aspect-square bg-[var(--color-surface-alt)] relative flex items-center justify-center">
                    {d.preview_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.preview_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Icon name="image" size={28} color="var(--color-faint)" />
                    )}
                    {checked && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--color-brand-500)] flex items-center justify-center">
                        <Icon name="check" size={12} color="white" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-[var(--color-ink)] truncate">
                      {d.title || '제목 없음'}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)] truncate">
                      {product?.title ?? '제품 미연결'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center disabled:opacity-40"
            >
              <Icon name="chevron-l" size={14} />
            </button>
            <span className="text-[12px] text-[var(--color-muted)]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center disabled:opacity-40"
            >
              <Icon name="chevron-r" size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-hairline-soft)] p-3">
        <button
          onClick={() => onPick(selected)}
          disabled={selected.length === 0}
          className="w-full bg-[var(--color-brand-500)] text-white font-bold py-3 rounded-[14px] disabled:opacity-40 active:bg-[var(--color-brand-600)] flex items-center justify-center gap-1"
        >
          <Icon name="plus" size={16} color="white" />
          {selected.length === 0 ? '디자인을 선택해주세요' : `${selected.length}개 배치`}
        </button>
      </div>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: 'palette' | 'image' | 'package';
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-[var(--color-hairline)] rounded-[12px] p-3 flex flex-col items-center text-center active:bg-[var(--color-surface-alt)]"
    >
      <div className="w-9 h-9 rounded-full bg-[var(--color-brand-100)] flex items-center justify-center mb-1.5">
        <Icon name={icon} size={18} color="var(--color-brand-500)" />
      </div>
      <span className="text-[12px] font-bold text-[var(--color-ink)]">{label}</span>
      <span className="text-[10px] text-[var(--color-muted)] mt-0.5">{desc}</span>
    </button>
  );
}
