'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Minus, Trash2, Search, ShoppingCart, Tag, Check, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useProducts, matchProduct, type ProductRow } from '@/hooks/useProducts';
import { usePrintMethods } from '@/hooks/usePrintMethods';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import { useMyTeams } from '@/hooks/useMyTeams';
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

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId: string) => void;
  preselectedTeamId?: string | null;
}

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

const PRINT_SIZE_OPTIONS: PrintSize[] = ['10x10', 'A4', 'A3'];
const PRINT_METHOD_OPTIONS: PrintMethod[] = ['dtf', 'dtg', 'screen_printing', 'embroidery', 'applique'];

interface DraftItem extends OrderItemDraft {
  uid: string; // local key
}

function newUid() {
  return Math.random().toString(36).slice(2, 9);
}

function buildOrderId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SR-${ymd}-${rand}`;
}

export default function CreateOrderSheet({ open, onClose, onCreated, preselectedTeamId }: Props) {
  const { user } = useSalesmanStore();
  const { products, isLoading: productsLoading } = useProducts();
  const { config: printConfig, isLoading: printsLoading } = usePrintMethods();
  const { primary: primaryCoupon } = useMyCoupons();
  const { teams } = useMyTeams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // 고객/단체
  const [partnerMallId, setPartnerMallId] = useState<string | null>(preselectedTeamId ?? null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // 결제/할인
  const [useCoupon, setUseCoupon] = useState(true);
  const [adminDiscount, setAdminDiscount] = useState<string>('');
  const [adminDiscountMode, setAdminDiscountMode] = useState<'total' | 'per_unit'>('total');
  const [adminSurcharge, setAdminSurcharge] = useState<string>('');
  const [adminSurchargeMode, setAdminSurchargeMode] = useState<'total' | 'per_unit'>('total');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'domestic'>('pickup');
  const [paymentType, setPaymentType] = useState<'bank_transfer' | 'customer_payment' | 'completed'>('bank_transfer');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setItems([]);
      setPartnerMallId(preselectedTeamId ?? null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setUseCoupon(true);
      setAdminDiscount('');
      setAdminDiscountMode('total');
      setAdminSurcharge('');
      setAdminSurchargeMode('total');
      setDeliveryMethod('pickup');
      setPaymentType('bank_transfer');
      setNotes('');
      setError(null);
    }
  }, [open, preselectedTeamId]);

  // 견적 합계 계산
  const deliveryFee = deliveryMethod === 'domestic' ? 3000 : 0;
  // 총 수량 (per_unit 모드 환산용)
  const totalQty = useMemo(
    () => items.reduce((s, it) => s + it.variants.reduce((q, v) => q + (Number(v.quantity) || 0), 0), 0),
    [items]
  );
  const adminDiscountInput = Math.max(0, Number(adminDiscount) || 0);
  const adminSurchargeInput = Math.max(0, Number(adminSurcharge) || 0);
  // per_unit 모드면 입력값 × 총수량 = 절대값. 절대값을 calcOrderPricing 및 DB 저장에 사용.
  const adminDiscountAbs =
    adminDiscountMode === 'per_unit' ? adminDiscountInput * totalQty : adminDiscountInput;
  const adminSurchargeAbs =
    adminSurchargeMode === 'per_unit' ? adminSurchargeInput * totalQty : adminSurchargeInput;

  const pricingNoCoupon = useMemo(
    () => calcOrderPricing(items, printConfig, {
      deliveryFee,
      adminDiscount: adminDiscountAbs,
      adminSurcharge: adminSurchargeAbs,
    }),
    [items, printConfig, deliveryFee, adminDiscountAbs, adminSurchargeAbs]
  );
  const couponDiscount = useCoupon ? calcCouponDiscount(primaryCoupon, pricingNoCoupon.originalAmount) : 0;
  const pricing = useMemo(
    () => calcOrderPricing(items, printConfig, {
      deliveryFee,
      couponDiscount,
      adminDiscount: adminDiscountAbs,
      adminSurcharge: adminSurchargeAbs,
    }),
    [items, printConfig, deliveryFee, couponDiscount, adminDiscountAbs, adminSurchargeAbs]
  );

  const commissionRate = (() => {
    // grade에서 추정 — fallback 5%
    const map: Record<string, number> = {
      LV0: 0.020, LV1: 0.050, LV2: 0.080, LV3: 0.100, LV4: 0.120, LV5: 0.140,
      LV6: 0.160, LV7: 0.180, LV8: 0.200, LV9: 0.220, LV10: 0.250,
    };
    return map[user?.grade ?? 'LV0'] ?? 0.05;
  })();

  const filteredProducts = products.filter((p) => matchProduct(p, productSearch));

  const addItemFromProduct = (p: ProductRow) => {
    const sizes: OrderVariant[] = (p.size_options ?? []).map((s) => ({
      sizeLabel: s.label,
      sizeCode: s.size_code,
      quantity: 0,
    }));
    if (sizes.length === 0) {
      sizes.push({ sizeLabel: 'FREE', sizeCode: 'FREE', quantity: 0 });
    }
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

  const handleSubmit = async () => {
    setError(null);
    if (!user?.id || !user?.salesman_profile_id) {
      setError('로그인 정보 누락. 다시 로그인해주세요.');
      return;
    }
    if (items.length === 0) {
      setError('품목을 1개 이상 추가해주세요.');
      return;
    }
    if (pricing.totalQuantity <= 0) {
      setError('수량을 입력해주세요.');
      return;
    }
    if (!customerName.trim() && !partnerMallId) {
      setError('고객명 또는 단체 중 하나는 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const orderId = buildOrderId();

      // payment_status / order_status / payment_method
      const paymentStatus = paymentType === 'completed' ? 'paid' : 'pending';
      const orderStatus = paymentType === 'completed' ? 'payment_completed' : 'payment_pending';
      const paymentMethod = paymentType === 'bank_transfer' ? 'bank_transfer' : paymentType === 'customer_payment' ? 'toss' : 'manual';

      const orderRow = {
        id: orderId,
        user_id: user.id,
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        total_amount: pricing.totalAmount,
        original_amount: pricing.originalAmount,
        delivery_fee: deliveryFee,
        coupon_discount: couponDiscount,
        admin_discount: adminDiscountAbs,
        admin_surcharge: adminSurchargeAbs,
        applied_coupon_id: useCoupon && primaryCoupon ? primaryCoupon.id : null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        shipping_method: deliveryMethod,
        partner_mall_id: partnerMallId,
        attributed_salesman_id: user.salesman_profile_id,
        notes: notes.trim() || null,
        order_category: 'salesman_direct',
      };

      const { error: orderErr } = await supabase.from('orders').insert(orderRow);
      if (orderErr) throw new Error(`주문 등록 실패: ${orderErr.message}`);

      // order_items
      const itemRows = items.map((it) => {
        const qty = it.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
        const product = items.find((x) => x.uid === it.uid);
        // per-piece blended unit price (제품 단가 + 인쇄 단가 평균)
        const unit = product
          ? (() => {
              const productSub = it.basePrice * qty;
              const printSub = it.prints.reduce((s, p) => {
                // re-call calc for each print
                const conf = printConfig[p.method];
                if (!conf) return s;
                if (p.method === 'dtf' || p.method === 'dtg') {
                  return s + ((conf as { sizes: Record<PrintSize, number> }).sizes[p.size] ?? 0) * qty;
                }
                const sp = (conf as { sizes: Record<PrintSize, { basePrice: number; baseQuantity: number; additionalPricePerPiece: number }> }).sizes[p.size];
                if (!sp) return s;
                if (qty <= sp.baseQuantity) return s + sp.basePrice;
                return s + sp.basePrice + (qty - sp.baseQuantity) * sp.additionalPricePerPiece;
              }, 0);
              return qty > 0 ? Math.round((productSub + printSub) / qty) : it.basePrice;
            })()
          : it.basePrice;

        return {
          order_id: orderId,
          product_id: it.productId,
          product_title: it.productTitle,
          quantity: qty,
          price_per_item: unit,
          canvas_state: {},
          color_selections: {},
          item_options: {
            variants: it.variants.filter((v) => v.quantity > 0).map((v) => ({
              size_id: v.sizeCode,
              size_name: v.sizeLabel,
              quantity: v.quantity,
            })),
            prints: it.prints.map((p) => ({
              method: p.method,
              size: p.size,
              position: p.position ?? null,
              method_label: getPrintMethodLabel(p.method),
              size_label: getPrintSizeLabel(p.size),
            })),
            base_price: it.basePrice,
            print_count: it.prints.length,
            source: 'salesman_app',
          },
          purchase_order_status: 'pending',
          design_status: 'pending',
        };
      });

      const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
      if (itemsErr) {
        // best-effort: 롤백 시도
        await supabase.from('orders').delete().eq('id', orderId);
        throw new Error(`품목 등록 실패: ${itemsErr.message}`);
      }

      onCreated(orderId);
      onClose();
    } catch (e) {
      console.error('[CreateOrderSheet] submit error:', e);
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const stepValid = (() => {
    if (step === 1) return items.length > 0 && pricing.totalQuantity > 0;
    if (step === 2) return Boolean(customerName.trim() || partnerMallId);
    return true;
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      {/* Sheet */}
      <div className="relative mt-auto bg-white rounded-t-2xl shadow-2xl h-[92vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-bold text-gray-900">새 주문 생성</h2>
            <span className="text-[11px] text-gray-500">Step {step}/3</span>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1 -mr-1 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {step === 1 && (
            <Step1Items
              items={items}
              productConfig={printConfig}
              onAddProduct={() => setProductPickerOpen(true)}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
            />
          )}
          {step === 2 && (
            <Step2Customer
              teams={teams}
              partnerMallId={partnerMallId}
              setPartnerMallId={setPartnerMallId}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
            />
          )}
          {step === 3 && (
            <Step3Payment
              primaryCoupon={primaryCoupon}
              useCoupon={useCoupon}
              setUseCoupon={setUseCoupon}
              adminDiscount={adminDiscount}
              setAdminDiscount={setAdminDiscount}
              adminSurcharge={adminSurcharge}
              setAdminSurcharge={setAdminSurcharge}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
              paymentType={paymentType}
              setPaymentType={setPaymentType}
              notes={notes}
              setNotes={setNotes}
              pricing={pricing}
              couponDiscount={couponDiscount}
              commissionRate={commissionRate}
            />
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
        </div>

        {/* Live total bar */}
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 flex justify-between items-center text-xs">
          <div className="text-gray-600">
            품목 {items.length} · 수량 {pricing.totalQuantity}
            {couponDiscount > 0 && <span className="ml-1 text-brand-600 font-bold">· 쿠폰 -{fmt(couponDiscount)}</span>}
          </div>
          <div className="font-bold text-base font-mono text-gray-900">{fmt(pricing.totalAmount)}</div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={submitting} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg">
              이전
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={!stepValid}
              className="flex-[2] bg-brand-500 text-white font-bold py-3 rounded-lg disabled:opacity-40 flex items-center justify-center gap-1"
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-[2] bg-brand-500 text-white font-bold py-3 rounded-lg disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {submitting ? '등록 중...' : <><Check className="w-4 h-4" /> 주문 등록</>}
            </button>
          )}
        </div>

        {/* Product picker overlay */}
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

        {(productsLoading || printsLoading) && step === 1 && items.length === 0 && (
          <div className="absolute inset-x-0 bottom-24 text-center text-xs text-gray-500">제품 정보 불러오는 중...</div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Step 1 — 품목
// =====================================================================
function Step1Items({
  items,
  productConfig,
  onAddProduct,
  onUpdateItem,
  onRemoveItem,
}: {
  items: DraftItem[];
  productConfig: ReturnType<typeof usePrintMethods>['config'];
  onAddProduct: () => void;
  onUpdateItem: (uid: string, patch: Partial<DraftItem>) => void;
  onRemoveItem: (uid: string) => void;
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={onAddProduct}
        className="w-full border-2 border-dashed border-brand-300 bg-brand-50 text-brand-700 font-bold py-3 rounded-lg flex items-center justify-center gap-1.5 active:bg-brand-100"
      >
        <Plus className="w-4 h-4" /> 제품 선택
      </button>

      {items.length === 0 && (
        <div className="text-center text-xs text-gray-500 py-6">
          제품을 선택해 사이즈별 수량 + 인쇄 옵션을 추가하세요.
        </div>
      )}

      {items.map((item) => (
        <ItemEditor
          key={item.uid}
          item={item}
          config={productConfig}
          onUpdate={(patch) => onUpdateItem(item.uid, patch)}
          onRemove={() => onRemoveItem(item.uid)}
        />
      ))}
    </div>
  );
}

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
    const next = item.variants.map((v, i) => (i === idx ? { ...v, quantity: Math.max(0, qty) } : v));
    onUpdate({ variants: next });
  };

  const addPrint = () => {
    onUpdate({ prints: [...item.prints, { method: 'dtf', size: '10x10' }] });
  };
  const updatePrint = (idx: number, patch: Partial<OrderPrint>) => {
    const next = item.prints.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onUpdate({ prints: next });
  };
  const removePrint = (idx: number) => {
    onUpdate({ prints: item.prints.filter((_, i) => i !== idx) });
  };

  const itemPricing = (() => {
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
    return { productSub, printSub, total: productSub + printSub };
  })();

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-3 space-y-3">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-900 truncate">{item.productTitle}</div>
          <div className="text-[11px] text-gray-500 font-mono">기본 단가 {fmt(item.basePrice)}</div>
        </div>
        <button onClick={onRemove} className="p-1 text-red-500 active:bg-red-50 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 사이즈별 수량 */}
      <div>
        <div className="text-[11px] font-bold text-gray-700 mb-1.5">사이즈별 수량</div>
        <div className="grid grid-cols-2 gap-1.5">
          {item.variants.map((v, idx) => (
            <div key={v.sizeCode + idx} className="flex items-center bg-gray-50 rounded-lg px-2 py-1.5 gap-1.5">
              <span className="text-xs font-bold text-gray-700 w-8">{v.sizeLabel}</span>
              <button
                onClick={() => updateVariant(idx, v.quantity - 1)}
                className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={v.quantity || ''}
                onChange={(e) => updateVariant(idx, Number(e.target.value) || 0)}
                placeholder="0"
                className="flex-1 text-center text-sm bg-white border border-gray-200 rounded py-1 outline-none focus:border-brand-500 min-w-0"
              />
              <button
                onClick={() => updateVariant(idx, v.quantity + 1)}
                className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-gray-500 mt-1.5 text-right">총 {totalQty}장</div>
      </div>

      {/* 인쇄 */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <div className="text-[11px] font-bold text-gray-700">인쇄 ({item.prints.length})</div>
          <button onClick={addPrint} className="text-[11px] text-brand-600 font-bold flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> 인쇄 추가
          </button>
        </div>
        {item.prints.length === 0 ? (
          <div className="text-[11px] text-gray-400 bg-gray-50 rounded p-2 text-center">인쇄 없음</div>
        ) : (
          <div className="space-y-1.5">
            {item.prints.map((p, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-2 grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                <select
                  value={p.method}
                  onChange={(e) => updatePrint(idx, { method: e.target.value as PrintMethod })}
                  className="text-xs bg-white border border-gray-200 rounded px-1.5 py-1.5 outline-none"
                >
                  {PRINT_METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{getPrintMethodLabel(m)}</option>
                  ))}
                </select>
                <select
                  value={p.size}
                  onChange={(e) => updatePrint(idx, { size: e.target.value as PrintSize })}
                  className="text-xs bg-white border border-gray-200 rounded px-1.5 py-1.5 outline-none"
                >
                  {PRINT_SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{getPrintSizeLabel(s)}</option>
                  ))}
                </select>
                <button onClick={() => removePrint(idx)} className="p-1 text-red-500 active:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 합계 */}
      <div className="bg-gray-50 rounded-lg p-2 text-xs space-y-0.5">
        <div className="flex justify-between text-gray-600">
          <span>제품 소계</span>
          <span className="font-mono">{fmt(itemPricing.productSub)}</span>
        </div>
        {itemPricing.printSub > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>인쇄 소계</span>
            <span className="font-mono">{fmt(itemPricing.printSub)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200 mt-1">
          <span>품목 합계</span>
          <span className="font-mono">{fmt(itemPricing.total)}</span>
        </div>
      </div>
    </div>
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
    <div className="absolute inset-0 bg-white z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-base font-bold text-gray-900">제품 선택</h3>
        <button onClick={onClose} className="text-gray-500 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="bg-gray-100 rounded-lg flex items-center px-3 py-2 gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="제품명 · 제조사 · 코드 검색..."
            className="flex-1 bg-transparent outline-none text-sm"
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-gray-500">제품 불러오는 중...</div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">검색 결과 없음</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {p.thumbnail_image_link?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail_image_link[0]} alt={p.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{p.title}</div>
                  {(p.manufacturer_name || p.product_code) && (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {p.manufacturer_name && (
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {p.manufacturer_name}
                        </span>
                      )}
                      {p.product_code && (
                        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {p.product_code}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">{fmt(Number(p.base_price) || 0)}</div>
                  {p.size_options && p.size_options.length > 0 && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      사이즈 {p.size_options.map((s) => s.label).join(', ')}
                    </div>
                  )}
                  {p.keywords && p.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700"
                        >
                          #{kw}
                        </span>
                      ))}
                      {p.keywords.length > 4 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          +{p.keywords.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Step 2 — 고객/단체
// =====================================================================
function Step2Customer({
  teams,
  partnerMallId,
  setPartnerMallId,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
}: {
  teams: ReturnType<typeof useMyTeams>['teams'];
  partnerMallId: string | null;
  setPartnerMallId: (v: string | null) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-bold text-gray-700 mb-1.5">단체 연결 (선택)</div>
        <div className="text-[11px] text-gray-500 mb-2">기존 단체에 주문을 연결하면 단체별 매출/이력이 자동 집계됩니다.</div>
        <select
          value={partnerMallId ?? ''}
          onChange={(e) => setPartnerMallId(e.target.value || null)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white"
        >
          <option value="">단체 미연결 (개별 고객 주문)</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="text-[10px] text-gray-400 mt-1">단체가 없다면 [내 단체] 탭에서 먼저 등록 가능</div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="text-xs font-bold text-gray-700 mb-2">고객 정보</div>
        <div className="space-y-2.5">
          <Field label="고객명">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="예: 박지영"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="연락처">
            <input
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="이메일">
            <input
              type="email"
              inputMode="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:border-brand-500"
            />
          </Field>
        </div>
        <div className="text-[10px] text-gray-400 mt-2">단체와 고객 둘 다 입력해도 됩니다 (예: 단체 결정권자 정보)</div>
      </div>
    </div>
  );
}

// =====================================================================
// Step 3 — 결제·할인
// =====================================================================
function Step3Payment({
  primaryCoupon,
  useCoupon,
  setUseCoupon,
  adminDiscount,
  setAdminDiscount,
  adminSurcharge,
  setAdminSurcharge,
  deliveryMethod,
  setDeliveryMethod,
  paymentType,
  setPaymentType,
  notes,
  setNotes,
  pricing,
  couponDiscount,
  commissionRate,
}: {
  primaryCoupon: ReturnType<typeof useMyCoupons>['primary'];
  useCoupon: boolean;
  setUseCoupon: (v: boolean) => void;
  adminDiscount: string;
  setAdminDiscount: (v: string) => void;
  adminSurcharge: string;
  setAdminSurcharge: (v: string) => void;
  deliveryMethod: 'pickup' | 'domestic';
  setDeliveryMethod: (v: 'pickup' | 'domestic') => void;
  paymentType: 'bank_transfer' | 'customer_payment' | 'completed';
  setPaymentType: (v: 'bank_transfer' | 'customer_payment' | 'completed') => void;
  notes: string;
  setNotes: (v: string) => void;
  pricing: ReturnType<typeof calcOrderPricing>;
  couponDiscount: number;
  commissionRate: number;
}) {
  return (
    <div className="space-y-4">
      {/* 영업사원 할인코드 */}
      {primaryCoupon && (
        <div className={`rounded-xl border-2 p-3 ${useCoupon ? 'bg-brand-50 border-brand-300' : 'bg-gray-50 border-gray-200'}`}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCoupon}
              onChange={(e) => setUseCoupon(e.target.checked)}
              className="mt-0.5 accent-brand-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Tag className="w-3.5 h-3.5 text-brand-600" />
                <span className="text-xs font-bold text-gray-900">내 할인코드 적용</span>
              </div>
              <div className="text-[11px] text-gray-700 font-mono">{primaryCoupon.code}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {primaryCoupon.discount_type === 'percentage'
                  ? `${primaryCoupon.discount_value}% 할인`
                  : `${fmt(primaryCoupon.discount_value)} 할인`}
                {couponDiscount > 0 && <span className="ml-1 text-brand-600 font-bold">→ -{fmt(couponDiscount)}</span>}
              </div>
            </div>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="임의 할인 (₩)">
          <input
            type="number"
            inputMode="numeric"
            value={adminDiscount}
            onChange={(e) => setAdminDiscount(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          />
        </Field>
        <Field label="추가 금액 (₩)">
          <input
            type="number"
            inputMode="numeric"
            value={adminSurcharge}
            onChange={(e) => setAdminSurcharge(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          />
        </Field>
      </div>

      <Field label="배송 방식">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { v: 'pickup' as const, label: '직접 수령' },
            { v: 'domestic' as const, label: '택배 (+3,000원)' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setDeliveryMethod(opt.v)}
              className={`py-2 rounded-lg text-xs font-bold ${deliveryMethod === opt.v ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="결제 방식">
        <div className="space-y-1.5">
          {[
            { v: 'bank_transfer' as const, label: '계좌 이체 대기', desc: '입금 확인 후 본사 처리' },
            { v: 'customer_payment' as const, label: '고객 결제 링크', desc: '고객에게 결제 링크 발송' },
            { v: 'completed' as const, label: '결제 완료 처리', desc: '오프라인 결제 받음' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setPaymentType(opt.v)}
              className={`w-full text-left p-2.5 rounded-lg border-2 ${paymentType === opt.v ? 'bg-brand-50 border-brand-400' : 'bg-white border-gray-200'}`}
            >
              <div className="text-xs font-bold text-gray-900">{opt.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="메모 (선택)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="배송 요청, 인쇄 위치 등 특이사항"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 resize-none"
        />
      </Field>

      {/* 견적 합계 */}
      <div className="bg-slate-900 text-white rounded-xl p-4 space-y-1.5">
        <Row label="제품 + 인쇄 소계" value={fmt(pricing.originalAmount)} />
        {pricing.deliveryFee > 0 && <Row label="배송비" value={`+${fmt(pricing.deliveryFee)}`} />}
        {pricing.couponDiscount > 0 && <Row label="쿠폰" value={`-${fmt(pricing.couponDiscount)}`} accent="text-brand-300" />}
        {pricing.adminDiscount > 0 && <Row label="임의 할인" value={`-${fmt(pricing.adminDiscount)}`} accent="text-orange-300" />}
        {pricing.adminSurcharge > 0 && <Row label="추가 금액" value={`+${fmt(pricing.adminSurcharge)}`} accent="text-orange-300" />}
        <div className="h-px bg-slate-700 my-2" />
        <Row label="고객 청구 총액" value={fmt(pricing.totalAmount)} bold large />
        <Row label={`내 예상 정산 (${Math.round(commissionRate * 100)}%)`} value={fmt(Math.round(pricing.totalAmount * commissionRate))} accent="text-yellow-400" />
      </div>
    </div>
  );
}

function Row({ label, value, bold, large, accent }: { label: string; value: string; bold?: boolean; large?: boolean; accent?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${large ? 'text-base' : 'text-xs'}`}>
      <span className={accent ?? 'text-slate-300'}>{label}</span>
      <span className={`font-mono ${accent ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
