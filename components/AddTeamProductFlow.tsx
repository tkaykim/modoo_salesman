'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useProducts, matchProduct, type ProductRow } from '@/hooks/useProducts';
import DesignEditorModal from '@/components/DesignEditorModal';
import { Card, CTA, Icon } from '@/components/ui';
import type { SavedDesignRow } from '@/hooks/useSavedDesigns';

interface ColorRow {
  id: string;
  manufacturer_color_id: string | null;
  manufacturer_colors: {
    id: string;
    name: string | null;
    hex: string | null;
    color_code: string | null;
  } | null;
}

interface Props {
  open: boolean;
  teamId: string | null;
  /** 단체(파트너몰) 이름 — 디자인 제목 default 생성에 사용 */
  mallName?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}

type Step = 'product' | 'color' | 'design';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export default function AddTeamProductFlow({
  open,
  teamId,
  mallName,
  onClose,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>('product');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  const [colors, setColors] = useState<ColorRow[]>([]);
  const [colorsLoading, setColorsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorRow | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 디자인 제목 입력 모달 — Promise resolver로 onBeforeSave와 연결
  type TitlePrompt = {
    defaultValue: string;
    resolve: (value: string | null) => void;
  };
  const [titlePrompt, setTitlePrompt] = useState<TitlePrompt | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [titleSavedName, setTitleSavedName] = useState<string | null>(null);

  const { products, isLoading: productsLoading } = useProducts();

  const filtered = useMemo(
    () => products.filter((p) => matchProduct(p, search)),
    [products, search],
  );

  const reset = () => {
    setStep('product');
    setSearch('');
    setSelectedProduct(null);
    setColors([]);
    setSelectedColor(null);
    setSubmitting(false);
    setError(null);
    setTitlePrompt(null);
    setTitleInput('');
    setTitleSavedName(null);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // 제품 선택 → 색상 fetch
  const pickProduct = async (p: ProductRow) => {
    setSelectedProduct(p);
    setStep('color');
    setColorsLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('product_colors')
        .select('id, manufacturer_color_id, manufacturer_colors(id, name, hex, color_code)')
        .eq('product_id', p.id)
        .eq('is_active', true)
        .order('sort_order');
      const rows = (data ?? []) as unknown as ColorRow[];
      setColors(rows);
      if (rows.length > 0) setSelectedColor(rows[0]);
    } catch {
      setColors([]);
    } finally {
      setColorsLoading(false);
    }
  };

  const goDesign = () => {
    if (!selectedProduct) return;
    setStep('design');
  };

  const buildDefaultTitle = () => {
    const mall = (mallName ?? '').trim();
    const product = (selectedProduct?.title ?? '').trim();
    return [mall, product].filter(Boolean).join(' ');
  };

  // DesignEditorModal에서 저장 직전에 호출. 제목 입력 모달을 띄우고 사용자 응답까지 대기.
  const promptForTitle = (): Promise<{ title: string } | null> => {
    return new Promise((resolve) => {
      const defaultValue = buildDefaultTitle();
      setTitleInput(defaultValue);
      setTitlePrompt({
        defaultValue,
        resolve: (value) => resolve(value === null ? null : { title: value }),
      });
    });
  };

  const confirmTitle = () => {
    const trimmed = titleInput.trim();
    if (!trimmed) return; // 빈 제목은 거부
    setTitleSavedName(trimmed);
    titlePrompt?.resolve(trimmed);
    setTitlePrompt(null);
  };

  const cancelTitle = () => {
    titlePrompt?.resolve(null);
    setTitlePrompt(null);
  };

  const handleSavedDesign = async (design: SavedDesignRow, meta?: { title: string }) => {
    if (!teamId || !selectedProduct) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: full, error: fetchError } = await supabase
        .from('saved_designs')
        .select('canvas_state, preview_url, color_selections')
        .eq('id', design.id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const mc = selectedColor?.manufacturer_colors ?? null;
      const finalTitle = meta?.title ?? titleSavedName ?? buildDefaultTitle() ?? selectedProduct.title;
      const res = await fetch('/api/team-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          product_id: selectedProduct.id,
          display_name: finalTitle,
          manufacturer_color_id: selectedColor?.manufacturer_color_id ?? null,
          color_hex: mc?.hex ?? null,
          color_name: mc?.name ?? null,
          color_code: mc?.color_code ?? null,
          logo_placements: {},
          canvas_state: full?.canvas_state ?? {},
          preview_url: full?.preview_url ?? design.preview_url ?? null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error('[AddTeamProductFlow] /api/team-products failed:', j);
        const detail = [j?.error, j?.code, j?.details, j?.hint].filter(Boolean).join(' | ');
        throw new Error(detail || `저장 실패 (${res.status})`);
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

  // 디자인 에디터 모달은 자체 풀스크린 — 여기서는 그대로 전달
  if (step === 'design' && selectedProduct) {
    return (
      <>
        <DesignEditorModal
          productId={selectedProduct.id}
          initialColor={selectedColor?.manufacturer_colors?.hex ?? undefined}
          onClose={() => setStep('color')}
          onSaveComplete={handleSavedDesign}
          onBeforeSave={promptForTitle}
        />

        {/* 제목 입력 모달 — DesignEditorModal 위에 띄움 (z-index 더 높게) */}
        {titlePrompt && (
          <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/50 px-5">
            <div className="w-full max-w-sm rounded-[18px] bg-white p-5 shadow-2xl">
              <h3 className="text-[15px] font-bold text-[var(--color-ink)]">디자인 이름</h3>
              <p className="mt-1 text-[12px] text-[var(--color-muted)] leading-relaxed">
                나중에 이 디자인을 다시 찾을 때 쓰는 이름이에요. 기본값을 그대로 써도 됩니다.
              </p>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmTitle();
                  else if (e.key === 'Escape') cancelTitle();
                }}
                autoFocus
                placeholder={titlePrompt.defaultValue}
                className="mt-3 w-full rounded-[12px] bg-[var(--color-surface-alt)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
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

  // product/color 단계 — 바텀 시트
  return (
    <div className="fixed inset-0 z-[8500] flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl h-[88vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          {step === 'color' ? (
            <button
              onClick={() => setStep('product')}
              className="p-2 -ml-1 text-[var(--color-muted)]"
              aria-label="뒤로"
            >
              <Icon name="chevron-l" size={20} />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center truncate px-2">
            {step === 'product' ? '제품 선택' : '색상 선택'}
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
          {step === 'product' ? (
            <div className="p-3">
              <div className="mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="제품명·코드·제조사 검색"
                  className="w-full rounded-[12px] bg-[var(--color-surface-alt)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>
              {productsLoading ? (
                <div className="py-10 text-center text-[12px] text-[var(--color-muted)]">
                  불러오는 중...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-[var(--color-muted)]">
                  검색 결과가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickProduct(p)}
                      className="text-left rounded-[14px] bg-[var(--color-surface)] ring-1 ring-[var(--color-hairline-soft)] overflow-hidden active:scale-[0.99]"
                    >
                      <div className="aspect-square bg-[var(--color-surface-alt)]">
                        {p.thumbnail_image_link?.[0] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.thumbnail_image_link[0]}
                            alt={p.title}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon name="image" size={24} color="var(--color-faint)" />
                          </div>
                        )}
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-[12px] font-bold text-[var(--color-ink)] line-clamp-2 leading-tight">
                          {p.title}
                        </p>
                        <p className="text-[11px] text-[var(--color-muted)] mt-0.5 num">
                          {fmt(p.base_price)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {selectedProduct && (
                <Card padding="md">
                  <div className="flex items-center gap-3">
                    {selectedProduct.thumbnail_image_link?.[0] && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedProduct.thumbnail_image_link[0]}
                        alt={selectedProduct.title}
                        className="w-14 h-14 rounded-[10px] object-contain bg-[var(--color-surface-alt)]"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[var(--color-ink)] truncate">
                        {selectedProduct.title}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)] num">
                        {fmt(selectedProduct.base_price)}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {colorsLoading ? (
                <div className="py-10 text-center text-[12px] text-[var(--color-muted)]">
                  색상 불러오는 중...
                </div>
              ) : colors.length === 0 ? (
                <Card padding="md" variant="flat">
                  <p className="text-[12px] text-[var(--color-muted)] text-center">
                    이 제품에는 색상 옵션이 없어요. 그대로 디자인을 시작해 주세요.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-5 gap-3">
                  {colors.map((c) => {
                    const hex = c.manufacturer_colors?.hex ?? '#FFFFFF';
                    const isSelected = selectedColor?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedColor(c)}
                        className="flex flex-col items-center gap-1"
                        title={c.manufacturer_colors?.name ?? ''}
                      >
                        <div
                          className={`w-11 h-11 rounded-full transition-all ${
                            isSelected
                              ? 'ring-2 ring-[var(--color-ink)] scale-110 shadow-md'
                              : 'ring-1 ring-[var(--color-hairline)] hover:ring-[var(--color-muted)]'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                        <span className={`text-[10px] leading-tight text-center truncate w-12 ${
                          isSelected ? 'font-bold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'
                        }`}>
                          {c.manufacturer_colors?.name ?? ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {step === 'color' && (
          <div className="border-t border-[var(--color-hairline-soft)] px-3 py-3">
            <CTA onClick={goDesign} variant="solid">
              <Icon name="palette" size={16} color="white" /> 디자인 시작하기
            </CTA>
            <p className="mt-2 text-[10px] text-[var(--color-faint)] text-center leading-relaxed">
              디자인 저장 시 단체 mall 카탈로그에 즉시 게시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
