'use client';

// 풀 주문 생성기 — modoo_admin AdminOrderCreator 와 동일 구조
// 다품목, 새디자인(외부 editor 핸드오프), 기존디자인(saved_designs 검색),
// 사이즈 매트릭스, 가격 모드(auto/custom_unit_price), 결제 옵션(완료/계좌이체/고객결제링크)

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Card, Section, HairLine, Chip } from '@/components/ui';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useProducts, matchProduct, type ProductRow, type ProductSizeOption } from '@/hooks/useProducts';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import { useMyTeams } from '@/hooks/useMyTeams';
import { useSavedDesigns, type SavedDesignRow } from '@/hooks/useSavedDesigns';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;
const ADMIN_BASE = (process.env.NEXT_PUBLIC_ADMIN_BASE_URL || 'https://admin.modoogoods.com').replace(/\/$/, '');
const APP_BASE = (process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://modoouniform.com').replace(/\/$/, '');

interface OrderVariant {
  sizeLabel: string;
  sizeCode: string;
  quantity: number;
}
interface OrderItemDraft {
  uid: string;
  productId: string;
  productTitle: string;
  productThumbnail: string | null;
  designId: string | null;            // null = 디자인 미연결 (새 디자인 작업 중 또는 placeholder)
  designTitle: string | null;
  designPreviewUrl: string | null;
  basePrice: number;
  sizeOptions: ProductSizeOption[];
  variants: OrderVariant[];
  pricingMode: 'auto' | 'custom_unit_price';
  customUnitPrice: string;
  designPricePerItem: number | null;
}

type Step = 'items' | 'product-pick-new' | 'product-pick-existing' | 'design-pick' | 'details';
type PaymentType = 'completed' | 'bank_transfer' | 'customer_payment';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId: string, paymentLinkUrl: string | null) => void;
  preselectedTeamId?: string | null;
}

function newUid() {
  return `it_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function buildOrderId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SR-${ymd}-${rand}`;
}
function getItemUnit(item: OrderItemDraft): number {
  if (item.pricingMode === 'custom_unit_price') {
    const n = parseFloat(item.customUnitPrice);
    return n > 0 ? n : 0;
  }
  return item.designPricePerItem ?? item.basePrice;
}
function getItemQty(item: OrderItemDraft): number {
  return item.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
}
function getItemSubtotal(item: OrderItemDraft): number {
  return getItemUnit(item) * getItemQty(item);
}

export default function CreateOrderSheetV2({ open, onClose, onCreated, preselectedTeamId }: Props) {
  const { user } = useSalesmanStore();
  const { products, isLoading: productsLoading } = useProducts();
  const { primary: primaryCoupon } = useMyCoupons();
  const { teams } = useMyTeams();

  const [step, setStep] = useState<Step>('items');
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  // Detail step state
  const [partnerMallId, setPartnerMallId] = useState<string | null>(preselectedTeamId ?? null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [shippingMethod, setShippingMethod] = useState<'pickup' | 'domestic' | 'international'>('pickup');
  const [paymentType, setPaymentType] = useState<PaymentType>('customer_payment');
  const [adminDiscount, setAdminDiscount] = useState('');
  const [adminSurcharge, setAdminSurcharge] = useState('');
  const [applyMyCoupon, setApplyMyCoupon] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset on open
  useEffect(() => {
    if (open) {
      setStep('items');
      setItems([]);
      setExpandedUid(null);
      setProductSearch('');
      setPartnerMallId(preselectedTeamId ?? null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerNote('');
      setShippingMethod('pickup');
      setPaymentType('customer_payment');
      setAdminDiscount('');
      setAdminSurcharge('');
      setApplyMyCoupon(true);
      setError(null);
    }
  }, [open, preselectedTeamId]);

  // 가격 계산
  const orderSubtotal = useMemo(() => items.reduce((s, it) => s + getItemSubtotal(it), 0), [items]);
  const totalQty = useMemo(() => items.reduce((s, it) => s + getItemQty(it), 0), [items]);
  const deliveryFee = shippingMethod === 'pickup' ? 0 : shippingMethod === 'domestic' ? 3000 : 5000;
  const adminDiscountNum = Math.max(0, Number(adminDiscount) || 0);
  const adminSurchargeNum = Math.max(0, Number(adminSurcharge) || 0);
  const couponDiscount = applyMyCoupon && primaryCoupon
    ? (() => {
        if ((primaryCoupon.min_order_amount ?? 0) > orderSubtotal) return 0;
        if (primaryCoupon.discount_type === 'percentage') {
          const amt = Math.floor(orderSubtotal * (Number(primaryCoupon.discount_value) / 100));
          return Math.min(amt, primaryCoupon.max_discount_amount ?? amt);
        }
        return Number(primaryCoupon.discount_value) || 0;
      })()
    : 0;
  const totalAmount = Math.max(0, orderSubtotal + deliveryFee - couponDiscount - adminDiscountNum + adminSurchargeNum);

  const filteredProducts = products.filter((p) => matchProduct(p, productSearch));

  // 새 디자인: 제품 선택 → 외부 에디터 새창 (modoo_admin/editor) + 안내
  const goNewDesign = () => {
    setProductSearch('');
    setStep('product-pick-new');
  };
  const goExistingDesign = () => {
    setStep('design-pick');
  };
  const goAddProductOnly = () => {
    setProductSearch('');
    setStep('product-pick-existing');
  };

  const addProductWithoutDesign = (p: ProductRow) => {
    const sizeOpts = p.size_options ?? [];
    const item: OrderItemDraft = {
      uid: newUid(),
      productId: p.id,
      productTitle: p.title,
      productThumbnail: p.thumbnail_image_link?.[0] ?? null,
      designId: null,
      designTitle: null,
      designPreviewUrl: null,
      basePrice: Number(p.base_price) || 0,
      sizeOptions: sizeOpts,
      variants: sizeOpts.length > 0
        ? sizeOpts.map((s) => ({ sizeLabel: s.label, sizeCode: s.size_code, quantity: 0 }))
        : [{ sizeLabel: 'FREE', sizeCode: 'FREE', quantity: 0 }],
      pricingMode: 'auto',
      customUnitPrice: '',
      designPricePerItem: null,
    };
    setItems((prev) => [...prev, item]);
    setExpandedUid(item.uid);
    setStep('items');
  };

  const openExternalEditor = (p: ProductRow) => {
    // modoo_admin /editor/<productId> 새 창. 디자인 작업 후 admin 의 saved_designs 에 저장됨.
    // 영업사원은 작업 완료 후 [기존 디자인 가져오기] 로 본인 design 을 다시 import.
    const url = `${ADMIN_BASE}/editor/${p.id}?mode=design&fromSalesman=1`;
    window.open(url, '_blank', 'noopener');
    // UI 안내: 새 창에서 작업 후 [기존 디자인 가져오기] 로 가져와주세요
    alert(
      '새 창에서 디자인을 진행하세요.\n' +
      '디자인 저장 후 이 화면으로 돌아와 [기존 디자인 가져오기]에서 방금 저장한 디자인을 선택해주세요.\n\n' +
      '※ admin.modoogoods.com 로그인이 필요합니다 (영업사원 계정으로 로그인).'
    );
  };

  const addItemFromDesign = async (designs: SavedDesignRow[]) => {
    const targets = designs.filter((d) => d.product_id);
    if (targets.length === 0) return;
    const newItems: OrderItemDraft[] = [];
    for (const d of targets) {
      const product = products.find((p) => p.id === d.product_id);
      if (!product) continue;
      const sizeOpts = product.size_options ?? [];
      newItems.push({
        uid: newUid(),
        productId: product.id,
        productTitle: product.title,
        productThumbnail: product.thumbnail_image_link?.[0] ?? null,
        designId: d.id,
        designTitle: d.title,
        designPreviewUrl: d.preview_url,
        basePrice: Number(product.base_price) || 0,
        sizeOptions: sizeOpts,
        variants: sizeOpts.length > 0
          ? sizeOpts.map((s) => ({ sizeLabel: s.label, sizeCode: s.size_code, quantity: 0 }))
          : [{ sizeLabel: 'FREE', sizeCode: 'FREE', quantity: 0 }],
        pricingMode: 'auto',
        customUnitPrice: '',
        designPricePerItem: d.price_per_item && d.price_per_item > 0 ? d.price_per_item : null,
      });
    }
    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setExpandedUid(newItems[0].uid);
    }
    setStep('items');
  };

  const updateItem = (uid: string, patch: Partial<OrderItemDraft>) => {
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
    if (totalQty <= 0) {
      setError('수량을 입력해주세요.');
      return;
    }
    if (!customerName.trim() && !partnerMallId) {
      setError('고객명 또는 단체를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const orderId = buildOrderId();

      // payment status mapping
      const paymentStatus =
        paymentType === 'completed' ? 'paid' :
        paymentType === 'bank_transfer' ? 'pending' :
        'pending';
      const orderStatus =
        paymentType === 'completed' ? 'payment_completed' : 'payment_pending';
      const paymentMethod =
        paymentType === 'bank_transfer' ? 'bank_transfer' :
        paymentType === 'customer_payment' ? 'toss' :
        'manual';

      // payment_link_token (customer_payment 일 때만 생성)
      const paymentLinkToken = paymentType === 'customer_payment'
        ? Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, '0')).join('')
        : null;

      const orderRow = {
        id: orderId,
        user_id: user.id,
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        original_amount: orderSubtotal,
        delivery_fee: deliveryFee,
        coupon_discount: 0, // 일반 쿠폰 자리는 비움 (영업사원 쿠폰만 적용)
        salesman_coupon_id: applyMyCoupon && primaryCoupon ? primaryCoupon.id : null,
        salesman_discount_amount: couponDiscount,
        admin_discount: adminDiscountNum,
        admin_surcharge: adminSurchargeNum,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        shipping_method: shippingMethod,
        partner_mall_id: partnerMallId,
        attributed_salesman_id: user.salesman_profile_id,
        payment_link_token: paymentLinkToken,
        customer_note: customerNote.trim() || null,
        order_category: 'salesman_direct',
      };

      const { error: orderErr } = await supabase.from('orders').insert(orderRow);
      if (orderErr) throw new Error(`주문 등록 실패: ${orderErr.message}`);

      const itemRows = items.map((it) => {
        const qty = getItemQty(it);
        const unit = getItemUnit(it);
        const variants = it.variants
          .filter((v) => v.quantity > 0)
          .map((v) => ({ size_id: v.sizeCode, size_name: v.sizeLabel, quantity: v.quantity }));
        return {
          order_id: orderId,
          product_id: it.productId,
          product_title: it.productTitle,
          design_id: it.designId,
          design_title: it.designTitle,
          quantity: qty,
          price_per_item: unit,
          canvas_state: {},
          color_selections: {},
          item_options: { variants, source: 'salesman_app_v2' },
          thumbnail_url: it.designPreviewUrl ?? it.productThumbnail,
          purchase_order_status: 'pending',
          design_status: it.designId ? 'pending' : 'design_required',
        };
      });

      const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
      if (itemsErr) {
        await supabase.from('orders').delete().eq('id', orderId);
        throw new Error(`품목 등록 실패: ${itemsErr.message}`);
      }

      const linkUrl = paymentLinkToken ? `${APP_BASE}/order/custom/${paymentLinkToken}` : null;
      onCreated(orderId, linkUrl);
      onClose();
    } catch (e) {
      console.error('[CreateOrderSheetV2] submit error:', e);
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const stepValid = (() => {
    if (step === 'items') return items.length > 0 && totalQty > 0;
    if (step === 'details') return Boolean(customerName.trim() || partnerMallId);
    return false;
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl h-[96vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          {step !== 'items' ? (
            <button onClick={() => setStep('items')} className="p-2 -ml-1 text-[var(--color-muted)]">
              <Icon name="arrow-l" size={20} />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center">
            {step === 'items' && '주문 생성'}
            {step === 'product-pick-new' && '새 디자인 — 제품 선택'}
            {step === 'product-pick-existing' && '제품만 추가'}
            {step === 'design-pick' && '기존 디자인 가져오기'}
            {step === 'details' && '결제 · 고객 정보'}
          </h2>
          <button onClick={onClose} disabled={submitting} className="p-2 -mr-1 text-[var(--color-muted)]">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {step === 'items' && (
            <ItemsStep
              items={items}
              expandedUid={expandedUid}
              setExpandedUid={setExpandedUid}
              updateItem={updateItem}
              removeItem={removeItem}
              onNewDesign={goNewDesign}
              onExistingDesign={goExistingDesign}
              onAddProductOnly={goAddProductOnly}
            />
          )}
          {step === 'product-pick-new' && (
            <ProductPicker
              products={filteredProducts}
              search={productSearch}
              onSearchChange={setProductSearch}
              onPick={openExternalEditor}
              isLoading={productsLoading}
              hint="새 창의 에디터로 디자인 작업 후 [기존 디자인 가져오기]로 다시 가져옵니다."
              actionLabel="에디터 열기"
              actionIcon="arrow-up-r"
            />
          )}
          {step === 'product-pick-existing' && (
            <ProductPicker
              products={filteredProducts}
              search={productSearch}
              onSearchChange={setProductSearch}
              onPick={addProductWithoutDesign}
              isLoading={productsLoading}
              hint="디자인 없이 제품/사이즈/수량으로만 등록 (디자인은 추후 보강 가능)."
              actionLabel="추가"
              actionIcon="plus"
            />
          )}
          {step === 'design-pick' && (
            <DesignPicker
              products={products}
              onPick={addItemFromDesign}
            />
          )}
          {step === 'details' && (
            <DetailsStep
              teams={teams}
              partnerMallId={partnerMallId}
              setPartnerMallId={setPartnerMallId}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              customerNote={customerNote}
              setCustomerNote={setCustomerNote}
              shippingMethod={shippingMethod}
              setShippingMethod={setShippingMethod}
              paymentType={paymentType}
              setPaymentType={setPaymentType}
              applyMyCoupon={applyMyCoupon}
              setApplyMyCoupon={setApplyMyCoupon}
              primaryCouponCode={primaryCoupon?.code ?? null}
              primaryCouponLabel={
                primaryCoupon
                  ? primaryCoupon.discount_type === 'percentage'
                    ? `${primaryCoupon.discount_value}%`
                    : fmt(Number(primaryCoupon.discount_value))
                  : null
              }
              adminDiscount={adminDiscount}
              setAdminDiscount={setAdminDiscount}
              adminSurcharge={adminSurcharge}
              setAdminSurcharge={setAdminSurcharge}
              orderSubtotal={orderSubtotal}
              deliveryFee={deliveryFee}
              couponDiscount={couponDiscount}
              totalAmount={totalAmount}
              totalQty={totalQty}
            />
          )}

          {error && (
            <div className="mx-4 my-3 rounded-[10px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
              {error}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--color-hairline-soft)] px-3 py-2.5 bg-[var(--color-surface)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[var(--color-muted)]">
              품목 {items.length} · 수량 {totalQty}
            </span>
            <span className="text-[15px] font-bold font-mono num text-[var(--color-ink)]">{fmt(totalAmount)}</span>
          </div>
          {step === 'items' && (
            <button
              onClick={() => setStep('details')}
              disabled={!stepValid}
              className="w-full bg-[var(--color-brand-500)] text-white font-bold py-3 rounded-[14px] disabled:opacity-40 active:bg-[var(--color-brand-600)] flex items-center justify-center gap-1"
              style={{ boxShadow: 'var(--shadow-cta)' }}
            >
              다음 <Icon name="chevron-r" size={16} color="white" />
            </button>
          )}
          {step === 'details' && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !stepValid}
              className="w-full bg-[var(--color-brand-500)] text-white font-bold py-3 rounded-[14px] disabled:opacity-40 active:bg-[var(--color-brand-600)] flex items-center justify-center gap-1"
              style={{ boxShadow: 'var(--shadow-cta)' }}
            >
              {submitting ? '등록 중...' : <><Icon name="check" size={16} color="white" /> 주문 등록</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Step: Items
// =====================================================================
function ItemsStep({
  items,
  expandedUid,
  setExpandedUid,
  updateItem,
  removeItem,
  onNewDesign,
  onExistingDesign,
  onAddProductOnly,
}: {
  items: OrderItemDraft[];
  expandedUid: string | null;
  setExpandedUid: (id: string | null) => void;
  updateItem: (uid: string, patch: Partial<OrderItemDraft>) => void;
  removeItem: (uid: string) => void;
  onNewDesign: () => void;
  onExistingDesign: () => void;
  onAddProductOnly: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <ActionTile icon="palette" label="새 디자인" desc="에디터로 작업" onClick={onNewDesign} />
        <ActionTile icon="image" label="기존 디자인" desc="저장된 작업 검색" onClick={onExistingDesign} />
        <ActionTile icon="package" label="제품만" desc="디자인 없이" onClick={onAddProductOnly} />
      </div>

      {items.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
              <Icon name="cart" size={22} color="var(--color-faint)" />
            </div>
            <p className="text-[13px] font-bold text-[var(--color-ink)] mb-1">품목을 추가해주세요</p>
            <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
              위 3가지 방법 중 선택해 다품목을 추가할 수 있습니다.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <ItemEditor
              key={it.uid}
              item={it}
              expanded={expandedUid === it.uid}
              onToggle={() => setExpandedUid(expandedUid === it.uid ? null : it.uid)}
              onUpdate={(patch) => updateItem(it.uid, patch)}
              onRemove={() => removeItem(it.uid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionTile({ icon, label, desc, onClick }: { icon: 'palette' | 'image' | 'package'; label: string; desc: string; onClick: () => void }) {
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

function ItemEditor({
  item,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: OrderItemDraft;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<OrderItemDraft>) => void;
  onRemove: () => void;
}) {
  const qty = getItemQty(item);
  const unit = getItemUnit(item);
  const sub = getItemSubtotal(item);

  const updateVariant = (idx: number, q: number) => {
    onUpdate({
      variants: item.variants.map((v, i) => (i === idx ? { ...v, quantity: Math.max(0, q) } : v)),
    });
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 active:bg-[var(--color-surface-alt)] text-left">
        <div className="w-12 h-12 rounded-[8px] bg-[var(--color-surface-alt)] flex-shrink-0 overflow-hidden flex items-center justify-center">
          {item.designPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.designPreviewUrl} alt="" className="w-full h-full object-contain" />
          ) : item.productThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.productThumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon name="package" size={20} color="var(--color-faint)" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[var(--color-ink)] truncate">{item.productTitle}</p>
          <p className="text-[11px] text-[var(--color-muted)] truncate">
            {item.designId ? (item.designTitle ?? '디자인 적용') : <span className="text-[var(--color-warn)]">디자인 미연결</span>}
          </p>
          <p className="text-[10px] text-[var(--color-faint)] font-mono mt-0.5">
            {qty}개 × {fmt(unit)} = {fmt(sub)}
          </p>
        </div>
        <Icon name={expanded ? 'chevron-u' : 'chevron-d'} size={16} color="var(--color-faint)" />
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-hairline-soft)] p-3 space-y-3 bg-[var(--color-surface-alt)]">
          {/* 사이즈 매트릭스 */}
          <Section title={`사이즈별 수량 (${qty})`}>
            <div className="grid grid-cols-2 gap-1.5">
              {item.variants.map((v, idx) => (
                <div key={v.sizeCode + idx} className="flex items-center bg-white border border-[var(--color-hairline)] rounded-[8px] px-2 py-1.5 gap-1.5">
                  <span className="text-[12px] font-bold text-[var(--color-body)] w-8">{v.sizeLabel}</span>
                  <button
                    onClick={() => updateVariant(idx, v.quantity - 1)}
                    className="w-6 h-6 rounded bg-[var(--color-surface-alt)] flex items-center justify-center"
                  >
                    <Icon name="minus" size={11} />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={v.quantity || ''}
                    onChange={(e) => updateVariant(idx, Number(e.target.value) || 0)}
                    placeholder="0"
                    className="flex-1 text-center text-[13px] bg-transparent border border-[var(--color-hairline)] rounded px-1 py-0.5 outline-none focus:border-[var(--color-brand-500)] min-w-0"
                  />
                  <button
                    onClick={() => updateVariant(idx, v.quantity + 1)}
                    className="w-6 h-6 rounded bg-[var(--color-surface-alt)] flex items-center justify-center"
                  >
                    <Icon name="plus" size={11} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {/* 가격 모드 */}
          <Section title="단가 모드">
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <Chip
                active={item.pricingMode === 'auto'}
                onClick={() => onUpdate({ pricingMode: 'auto' })}
              >
                자동 ({fmt(item.designPricePerItem ?? item.basePrice)})
              </Chip>
              <Chip
                active={item.pricingMode === 'custom_unit_price'}
                onClick={() => onUpdate({ pricingMode: 'custom_unit_price' })}
              >
                직접 입력
              </Chip>
            </div>
            {item.pricingMode === 'custom_unit_price' && (
              <input
                type="number"
                inputMode="numeric"
                value={item.customUnitPrice}
                onChange={(e) => onUpdate({ customUnitPrice: e.target.value })}
                placeholder="개당 단가 (원)"
                className="w-full rounded-[8px] border border-[var(--color-hairline)] px-3 py-2 text-[14px] bg-white focus:outline-none focus:border-[var(--color-brand-500)] font-mono"
              />
            )}
          </Section>

          <button
            onClick={onRemove}
            className="w-full text-[12px] text-[var(--color-err)] py-2 flex items-center justify-center gap-1 active:bg-[var(--color-err)]/10 rounded-[8px]"
          >
            <Icon name="trash" size={14} color="var(--color-err)" /> 이 품목 제거
          </button>
        </div>
      )}
    </Card>
  );
}

// =====================================================================
// Step: Product Picker
// =====================================================================
function ProductPicker({
  products,
  search,
  onSearchChange,
  onPick,
  isLoading,
  hint,
  actionLabel,
  actionIcon,
}: {
  products: ProductRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onPick: (p: ProductRow) => void;
  isLoading: boolean;
  hint: string;
  actionLabel: string;
  actionIcon: 'plus' | 'arrow-up-r';
}) {
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
        <p className="text-[10px] text-[var(--color-muted)] mt-1.5 leading-relaxed">{hint}</p>
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
                className="w-full px-4 py-3 flex items-center gap-3 active:bg-[var(--color-surface-alt)] text-left"
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
                  <div className="text-[11px] text-[var(--color-muted)] font-mono mt-0.5">{fmt(Number(p.base_price) || 0)}</div>
                </div>
                <span className="text-[11px] font-bold text-[var(--color-brand-500)] flex items-center gap-0.5 flex-shrink-0">
                  <Icon name={actionIcon} size={12} color="var(--color-brand-500)" />
                  {actionLabel}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Step: Design Picker (saved_designs)
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
        <p className="text-[10px] text-[var(--color-muted)] mt-1.5">총 {total}개 · {selectedIds.size}개 선택됨</p>
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
                  className={`text-left rounded-[10px] border-2 overflow-hidden ${checked ? 'border-[var(--color-brand-500)]' : 'border-[var(--color-hairline)]'}`}
                >
                  <div className="aspect-square bg-[var(--color-surface-alt)] relative flex items-center justify-center">
                    {d.preview_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
                    <p className="text-[10px] text-[var(--color-muted)] truncate">{product?.title ?? '제품 미연결'}</p>
                    {d.price_per_item && d.price_per_item > 0 && (
                      <p className="text-[10px] text-[var(--color-brand-500)] font-mono mt-0.5">{fmt(d.price_per_item)}</p>
                    )}
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
            <span className="text-[12px] text-[var(--color-muted)]">{page} / {totalPages}</span>
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
          {selected.length === 0 ? '디자인을 선택해주세요' : `${selected.length}개 추가`}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Step: Details
// =====================================================================
interface DetailsStepProps {
  teams: ReturnType<typeof useMyTeams>['teams'];
  partnerMallId: string | null;
  setPartnerMallId: (v: string | null) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  customerNote: string;
  setCustomerNote: (v: string) => void;
  shippingMethod: 'pickup' | 'domestic' | 'international';
  setShippingMethod: (v: 'pickup' | 'domestic' | 'international') => void;
  paymentType: PaymentType;
  setPaymentType: (v: PaymentType) => void;
  applyMyCoupon: boolean;
  setApplyMyCoupon: (v: boolean) => void;
  primaryCouponCode: string | null;
  primaryCouponLabel: string | null;
  adminDiscount: string;
  setAdminDiscount: (v: string) => void;
  adminSurcharge: string;
  setAdminSurcharge: (v: string) => void;
  orderSubtotal: number;
  deliveryFee: number;
  couponDiscount: number;
  totalAmount: number;
  totalQty: number;
}

function DetailsStep(props: DetailsStepProps) {
  const {
    teams, partnerMallId, setPartnerMallId,
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail, customerNote, setCustomerNote,
    shippingMethod, setShippingMethod,
    paymentType, setPaymentType,
    applyMyCoupon, setApplyMyCoupon, primaryCouponCode, primaryCouponLabel,
    adminDiscount, setAdminDiscount, adminSurcharge, setAdminSurcharge,
    orderSubtotal, deliveryFee, couponDiscount, totalAmount,
  } = props;

  return (
    <div className="p-4 space-y-4">
      <Section title="단체 연결 (선택)">
        <select
          value={partnerMallId ?? ''}
          onChange={(e) => setPartnerMallId(e.target.value || null)}
          className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[14px] bg-white"
        >
          <option value="">단체 미연결</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Section>

      <Section title="고객 정보">
        <input
          type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
          placeholder="고객명"
          className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[14px] mb-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="tel" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[14px]"
          />
          <input
            type="email" inputMode="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="email@…"
            className="rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[14px]"
          />
        </div>
      </Section>

      <Section title="배송">
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { v: 'pickup' as const, label: '직접 수령' },
            { v: 'domestic' as const, label: '국내 +3,000' },
            { v: 'international' as const, label: '해외 +5,000' },
          ]).map((opt) => (
            <Chip key={opt.v} active={shippingMethod === opt.v} onClick={() => setShippingMethod(opt.v)}>
              {opt.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="결제 방식">
        <div className="space-y-1.5">
          {([
            { v: 'customer_payment' as const, label: '고객 결제 링크', desc: '결제 URL을 고객에게 전달 (admin과 동일 흐름)' },
            { v: 'bank_transfer' as const, label: '계좌 이체 대기', desc: '입금 확인 후 본사 처리' },
            { v: 'completed' as const, label: '결제 완료 처리', desc: '오프라인 수령 완료' },
          ]).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setPaymentType(opt.v)}
              className={`w-full text-left p-2.5 rounded-[10px] border-2 ${paymentType === opt.v ? 'bg-[var(--color-brand-100)]/40 border-[var(--color-brand-400)]' : 'bg-white border-[var(--color-hairline)]'}`}
            >
              <div className="text-[13px] font-bold text-[var(--color-ink)]">{opt.label}</div>
              <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {primaryCouponCode && (
        <Section title="내 영업 할인코드">
          <Card padding="sm" className={applyMyCoupon ? 'border-[var(--color-brand-300)] bg-[var(--color-brand-100)]/30' : ''}>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox" checked={applyMyCoupon}
                onChange={(e) => setApplyMyCoupon(e.target.checked)}
                className="mt-0.5 accent-[var(--color-brand-500)]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon name="tag" size={14} color="var(--color-brand-500)" />
                  <span className="text-[12px] font-bold text-[var(--color-ink)]">{primaryCouponCode}</span>
                  <span className="text-[10px] text-[var(--color-muted)]">{primaryCouponLabel}</span>
                </div>
                {couponDiscount > 0 && (
                  <p className="text-[11px] text-[var(--color-brand-500)] mt-0.5 font-mono">절감 {fmt(couponDiscount)}</p>
                )}
              </div>
            </label>
          </Card>
        </Section>
      )}

      <Section title="추가 조정 (선택)">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-muted)] mb-1">임의 할인 (원)</label>
            <input
              type="number" inputMode="numeric" value={adminDiscount}
              onChange={(e) => setAdminDiscount(e.target.value)}
              placeholder="0"
              className="w-full rounded-[8px] border border-[var(--color-hairline)] px-2 py-2 text-[13px] font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-muted)] mb-1">추가 금액 (원)</label>
            <input
              type="number" inputMode="numeric" value={adminSurcharge}
              onChange={(e) => setAdminSurcharge(e.target.value)}
              placeholder="0"
              className="w-full rounded-[8px] border border-[var(--color-hairline)] px-2 py-2 text-[13px] font-mono"
            />
          </div>
        </div>
      </Section>

      <Section title="메모 (선택)">
        <textarea
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value)}
          rows={2}
          placeholder="배송 요청, 특이사항"
          className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[13px] resize-none"
        />
      </Section>

      {/* 견적 합계 */}
      <Card variant="inverted" padding="md">
        <Row label="제품 합계" value={fmt(orderSubtotal)} />
        {deliveryFee > 0 && <Row label="배송비" value={`+${fmt(deliveryFee)}`} />}
        {couponDiscount > 0 && <Row label="영업 할인" value={`-${fmt(couponDiscount)}`} accent="text-yellow-300" />}
        <HairLine className="my-2 bg-white/15" />
        <Row label="고객 청구 총액" value={fmt(totalAmount)} bold large />
      </Card>
    </div>
  );
}

function Row({ label, value, bold, large, accent }: { label: string; value: string; bold?: boolean; large?: boolean; accent?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${large ? 'text-[15px]' : 'text-[12px]'}`}>
      <span className={accent ?? 'text-white/70'}>{label}</span>
      <span className={`font-mono num ${accent ?? 'text-white'}`}>{value}</span>
    </div>
  );
}
