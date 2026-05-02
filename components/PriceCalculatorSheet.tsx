'use client';

// 빠른 단가 계산기 — 디자인 없이 제품/인쇄/수량으로 즉시 견적 산출
// 영업사원이 외근 중 고객 문의에 빠르게 응답하기 위한 도구

import { useMemo, useState } from 'react';
import { Icon, Card, Section, HairLine, CTA, Chip } from '@/components/ui';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useProducts, matchProduct, type ProductRow } from '@/hooks/useProducts';
import { usePrintMethods } from '@/hooks/usePrintMethods';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import {
  calcOrderPricing,
  calcCouponDiscount,
  getPrintMethodLabel,
  getPrintSizeLabel,
  type OrderItemDraft,
  type OrderPrint,
  type OrderVariant,
  type PrintMethod,
  type PrintSize,
} from '@/lib/pricing';
import { getGrade } from '@/lib/grades';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;
const PRINT_SIZE_OPTIONS: PrintSize[] = ['10x10', 'A4', 'A3'];
const PRINT_METHOD_OPTIONS: PrintMethod[] = ['dtf', 'dtg', 'screen_printing', 'embroidery', 'applique'];

interface DraftItem extends OrderItemDraft {
  uid: string;
}
function newUid() {
  return Math.random().toString(36).slice(2, 9);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PriceCalculatorSheet({ open, onClose }: Props) {
  const { user } = useSalesmanStore();
  const { products, isLoading: productsLoading } = useProducts();
  const { config: printConfig } = usePrintMethods();
  const { primary: primaryCoupon } = useMyCoupons();

  const [items, setItems] = useState<DraftItem[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [applyMyCoupon, setApplyMyCoupon] = useState(true);

  const grade = getGrade(user?.grade);

  const pricingNoCoupon = useMemo(
    () => calcOrderPricing(items, printConfig, {}),
    [items, printConfig]
  );
  const couponDiscount = applyMyCoupon ? calcCouponDiscount(primaryCoupon, pricingNoCoupon.originalAmount) : 0;
  const pricing = useMemo(
    () => calcOrderPricing(items, printConfig, { couponDiscount }),
    [items, printConfig, couponDiscount]
  );

  const filteredProducts = products.filter((p) => matchProduct(p, productSearch));

  const addItemFromProduct = (p: ProductRow) => {
    const sizes: OrderVariant[] = (p.size_options ?? []).map((s) => ({
      sizeLabel: s.label,
      sizeCode: s.size_code,
      quantity: 0,
    }));
    if (sizes.length === 0) sizes.push({ sizeLabel: 'FREE', sizeCode: 'FREE', quantity: 0 });
    setItems((prev) => [
      ...prev,
      {
        uid: newUid(),
        productId: p.id,
        productTitle: p.title,
        basePrice: Number(p.base_price) || 0,
        variants: sizes,
        prints: [],
      },
    ]);
    setProductPickerOpen(false);
    setProductSearch('');
  };

  const updateItem = (uid: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  };
  const removeItem = (uid: string) => setItems((prev) => prev.filter((it) => it.uid !== uid));
  const reset = () => {
    setItems([]);
    setProductSearch('');
    setApplyMyCoupon(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl h-[94vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          <button onClick={onClose} className="p-2 -ml-1 text-[var(--color-muted)]">
            <Icon name="close" size={20} />
          </button>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center">단가 계산기</h2>
          <button onClick={reset} className="text-[12px] text-[var(--color-muted)] font-bold mr-2">
            초기화
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
            ⓘ 빠른 견적용 도구입니다. 실제 주문 생성은 [+ 새 주문] 버튼을 사용하세요.
          </p>

          <button
            onClick={() => setProductPickerOpen(true)}
            className="w-full border-2 border-dashed border-[var(--color-brand-300)] bg-[var(--color-brand-100)]/40 text-[var(--color-brand-700)] font-bold py-3 rounded-[12px] flex items-center justify-center gap-1.5 active:bg-[var(--color-brand-100)]"
          >
            <Icon name="plus" size={16} color="var(--color-brand-700)" /> 제품 추가
          </button>

          {items.length === 0 && (
            <div className="text-center text-[12px] text-[var(--color-muted)] py-4">
              제품을 추가하면 견적이 실시간으로 계산됩니다.
            </div>
          )}

          {items.map((item) => (
            <ItemEditor
              key={item.uid}
              item={item}
              config={printConfig}
              onUpdate={(patch) => updateItem(item.uid, patch)}
              onRemove={() => removeItem(item.uid)}
            />
          ))}

          {/* 쿠폰 토글 */}
          {primaryCoupon && items.length > 0 && (
            <Card padding="sm" className={applyMyCoupon ? 'border-[var(--color-brand-300)] bg-[var(--color-brand-100)]/30' : ''}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyMyCoupon}
                  onChange={(e) => setApplyMyCoupon(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-brand-500)]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon name="tag" size={14} color="var(--color-brand-500)" />
                    <span className="text-[12px] font-bold text-[var(--color-ink)]">
                      내 할인코드 적용 ({primaryCoupon.code})
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                    {primaryCoupon.discount_type === 'percentage'
                      ? `${primaryCoupon.discount_value}%`
                      : fmt(primaryCoupon.discount_value)}{' '}
                    할인
                    {couponDiscount > 0 && <> · 절감 {fmt(couponDiscount)}</>}
                  </p>
                </div>
              </label>
            </Card>
          )}
        </div>

        {/* Result */}
        {items.length > 0 && (
          <div className="border-t border-[var(--color-hairline-soft)] bg-[var(--color-ink)] text-white p-4 space-y-1.5">
            {pricing.couponDiscount > 0 && (
              <Row label="쿠폰 할인" value={`-${fmt(pricing.couponDiscount)}`} accent="text-[var(--color-brand-300)]" />
            )}
            <Row label="고객 청구가" value={fmt(pricing.totalAmount)} bold large />
            <Row
              label={`내 예상 정산 (${Math.round(grade.commissionRate * 100)}%)`}
              value={fmt(Math.round(pricing.totalAmount * grade.commissionRate))}
              accent="text-yellow-400"
            />
            <p className="text-[10px] text-white/50 text-right pt-1">
              총 수량 {pricing.totalQuantity}개 · 평균 단가{' '}
              {pricing.totalQuantity > 0 ? fmt(pricing.totalAmount / pricing.totalQuantity) : '-'}
            </p>
          </div>
        )}

        {productPickerOpen && (
          <ProductPicker
            products={filteredProducts}
            search={productSearch}
            onSearchChange={setProductSearch}
            onPick={addItemFromProduct}
            onClose={() => setProductPickerOpen(false)}
            isLoading={productsLoading}
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, large, accent }: { label: string; value: string; bold?: boolean; large?: boolean; accent?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${large ? 'text-[16px]' : 'text-[12px]'}`}>
      <span className={accent ?? 'text-white/70'}>{label}</span>
      <span className={`font-mono num ${accent ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

// =====================================================================
function ItemEditor({
  item,
  config,
  onUpdate,
  onRemove,
}: {
  item: DraftItem;
  config: ReturnType<typeof usePrintMethods>['config'];
  onUpdate: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const totalQty = item.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);

  const updateVariant = (idx: number, qty: number) => {
    onUpdate({ variants: item.variants.map((v, i) => (i === idx ? { ...v, quantity: Math.max(0, qty) } : v)) });
  };
  const addPrint = () => onUpdate({ prints: [...item.prints, { method: 'dtf', size: '10x10' }] });
  const updatePrint = (idx: number, patch: Partial<OrderPrint>) => {
    onUpdate({ prints: item.prints.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  };
  const removePrint = (idx: number) => onUpdate({ prints: item.prints.filter((_, i) => i !== idx) });

  // Item 합계 (간이)
  const productSub = item.basePrice * totalQty;
  let printSub = 0;
  for (const p of item.prints) {
    const conf = config[p.method];
    if (!conf) continue;
    if (p.method === 'dtf' || p.method === 'dtg') {
      printSub += ((conf as { sizes: Record<PrintSize, number> }).sizes[p.size] ?? 0) * totalQty;
    } else {
      const sp = (conf as { sizes: Record<PrintSize, { basePrice: number; baseQuantity: number; additionalPricePerPiece: number }> }).sizes[p.size];
      if (!sp) continue;
      printSub += totalQty <= sp.baseQuantity ? sp.basePrice : sp.basePrice + (totalQty - sp.baseQuantity) * sp.additionalPricePerPiece;
    }
  }
  const itemTotal = productSub + printSub;

  return (
    <Card padding="sm" className="space-y-2">
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[var(--color-ink)] truncate">{item.productTitle}</p>
          <p className="text-[10px] text-[var(--color-muted)] font-mono">기본 {fmt(item.basePrice)}</p>
        </div>
        <button onClick={onRemove} className="p-1 text-[var(--color-err)]">
          <Icon name="trash" size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {item.variants.map((v, idx) => (
          <div key={v.sizeCode + idx} className="flex items-center bg-[var(--color-surface-alt)] rounded-[8px] px-2 py-1 gap-1">
            <span className="text-[11px] font-bold text-[var(--color-body)] w-7">{v.sizeLabel}</span>
            <button
              onClick={() => updateVariant(idx, v.quantity - 1)}
              className="w-5 h-5 rounded bg-white border border-[var(--color-hairline)] flex items-center justify-center"
            >
              <Icon name="minus" size={10} />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={v.quantity || ''}
              onChange={(e) => updateVariant(idx, Number(e.target.value) || 0)}
              placeholder="0"
              className="flex-1 text-center text-[12px] bg-white border border-[var(--color-hairline)] rounded px-0.5 py-0.5 outline-none focus:border-[var(--color-brand-500)] min-w-0"
            />
            <button
              onClick={() => updateVariant(idx, v.quantity + 1)}
              className="w-5 h-5 rounded bg-white border border-[var(--color-hairline)] flex items-center justify-center"
            >
              <Icon name="plus" size={10} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[11px] text-[var(--color-muted)]">인쇄 ({item.prints.length})</span>
        <button onClick={addPrint} className="text-[11px] text-[var(--color-brand-500)] font-bold flex items-center gap-0.5">
          <Icon name="plus" size={11} color="var(--color-brand-500)" /> 추가
        </button>
      </div>
      {item.prints.length > 0 && (
        <div className="space-y-1">
          {item.prints.map((p, idx) => (
            <div key={idx} className="bg-[var(--color-surface-alt)] rounded-[8px] p-1.5 grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
              <select
                value={p.method}
                onChange={(e) => updatePrint(idx, { method: e.target.value as PrintMethod })}
                className="text-[11px] bg-white border border-[var(--color-hairline)] rounded px-1 py-1 outline-none"
              >
                {PRINT_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>{getPrintMethodLabel(m)}</option>
                ))}
              </select>
              <select
                value={p.size}
                onChange={(e) => updatePrint(idx, { size: e.target.value as PrintSize })}
                className="text-[11px] bg-white border border-[var(--color-hairline)] rounded px-1 py-1 outline-none"
              >
                {PRINT_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{getPrintSizeLabel(s)}</option>
                ))}
              </select>
              <button onClick={() => removePrint(idx)} className="p-1 text-[var(--color-err)]">
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <HairLine />
      <div className="flex justify-between items-center text-[12px]">
        <span className="text-[var(--color-muted)]">{totalQty}장</span>
        <span className="font-bold font-mono num text-[var(--color-ink)]">{fmt(itemTotal)}</span>
      </div>
    </Card>
  );
}

function ProductPicker({
  products,
  search,
  onSearchChange,
  onPick,
  onClose,
  isLoading,
}: {
  products: ProductRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onPick: (p: ProductRow) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-[var(--color-surface)] z-10 flex flex-col rounded-t-[20px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline-soft)]">
        <h3 className="text-[15px] font-bold text-[var(--color-ink)]">제품 선택</h3>
        <button onClick={onClose} className="p-1 text-[var(--color-muted)]">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="px-4 py-2 border-b border-[var(--color-hairline-soft)]">
        <Card padding="sm" className="flex items-center gap-2">
          <Icon name="search" size={14} color="var(--color-faint)" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="제품명 · 제조사 · 코드 검색..."
            className="flex-1 outline-none text-[13px] bg-transparent"
            autoFocus
          />
        </Card>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">검색 결과 없음</div>
        ) : (
          <div className="divide-y divide-[var(--color-hairline-soft)]">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-[var(--color-surface-alt)]"
              >
                <div className="w-12 h-12 bg-[var(--color-surface-alt)] rounded-[10px] overflow-hidden flex-shrink-0">
                  {p.thumbnail_image_link?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail_image_link[0]} alt={p.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[var(--color-ink)] truncate">{p.title}</div>
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
                  <div className="text-[11px] text-[var(--color-muted)] font-mono mt-0.5 num">
                    {fmt(Number(p.base_price) || 0)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
