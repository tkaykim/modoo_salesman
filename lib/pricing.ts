// 인쇄 가격 산출 로직 — modoo_admin lib/printPricingConfig.ts 포팅
// dtf/dtg = 사이즈별 정액 (per-piece)
// screen_printing/embroidery/applique = 기본가 + 추가 단가 (수량 기준)

export type PrintMethod = 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique';
export type PrintSize = '10x10' | 'A4' | 'A3';

export interface TransferPricing {
  method: 'dtf' | 'dtg';
  sizes: Record<PrintSize, number>;
}
export interface BulkSizePricing {
  basePrice: number;
  baseQuantity: number;
  additionalPricePerPiece: number;
}
export interface BulkPricing {
  method: 'screen_printing' | 'embroidery' | 'applique';
  sizes: Record<PrintSize, BulkSizePricing>;
}
export type AnyPrintPricing = TransferPricing | BulkPricing;
export type PrintPricingConfig = Record<PrintMethod, AnyPrintPricing>;

export interface PrintMethodRecord {
  id: string;
  key: string;
  name: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  pricing: Record<string, unknown> | null;
}

const LEGACY_METHOD_MAP: Record<string, PrintMethod> = {
  printing: 'dtf',
  dtf: 'dtf',
  dtg: 'dtg',
  screen_printing: 'screen_printing',
  embroidery: 'embroidery',
  applique: 'applique',
};

export function normalizePrintMethod(method: string | undefined | null): PrintMethod | null {
  if (!method) return null;
  return LEGACY_METHOD_MAP[method] ?? null;
}

export const DEFAULT_PRINT_PRICING: PrintPricingConfig = {
  dtf: { method: 'dtf', sizes: { '10x10': 4000, A4: 5000, A3: 7000 } },
  dtg: { method: 'dtg', sizes: { '10x10': 6000, A4: 7000, A3: 9000 } },
  screen_printing: {
    method: 'screen_printing',
    sizes: {
      '10x10': { basePrice: 60000, baseQuantity: 100, additionalPricePerPiece: 600 },
      A4:      { basePrice: 80000, baseQuantity: 100, additionalPricePerPiece: 800 },
      A3:      { basePrice: 100000, baseQuantity: 100, additionalPricePerPiece: 1000 },
    },
  },
  embroidery: {
    method: 'embroidery',
    sizes: {
      '10x10': { basePrice: 60000, baseQuantity: 100, additionalPricePerPiece: 600 },
      A4:      { basePrice: 80000, baseQuantity: 100, additionalPricePerPiece: 800 },
      A3:      { basePrice: 100000, baseQuantity: 100, additionalPricePerPiece: 1000 },
    },
  },
  applique: {
    method: 'applique',
    sizes: {
      '10x10': { basePrice: 60000, baseQuantity: 100, additionalPricePerPiece: 600 },
      A4:      { basePrice: 80000, baseQuantity: 100, additionalPricePerPiece: 800 },
      A3:      { basePrice: 100000, baseQuantity: 100, additionalPricePerPiece: 1000 },
    },
  },
};

export function buildPrintPricingFromDb(methods: PrintMethodRecord[]): PrintPricingConfig {
  const config: PrintPricingConfig = JSON.parse(JSON.stringify(DEFAULT_PRINT_PRICING));
  for (const m of methods) {
    if (!m.pricing || !m.key) continue;
    const norm = normalizePrintMethod(m.key);
    if (!norm) continue;
    if (norm === 'dtf' || norm === 'dtg') {
      config[norm] = { method: norm, sizes: m.pricing as unknown as TransferPricing['sizes'] };
    } else {
      config[norm] = { method: norm, sizes: m.pricing as unknown as BulkPricing['sizes'] };
    }
  }
  return config;
}

export function getPrintMethodLabel(method: string): string {
  const m: Record<string, string> = {
    dtf: 'DTF 전사',
    dtg: 'DTG 전사',
    screen_printing: '나염',
    embroidery: '자수',
    applique: '아플리케',
  };
  return m[method] ?? method;
}

export function getPrintSizeLabel(size: string): string {
  if (size === '10x10') return '10×10cm';
  return size;
}

/**
 * 단일 인쇄가 — 1피스당 기여하는 인쇄 단가 계산
 * dtf/dtg: 정액 * qty
 * bulk: basePrice + (qty - baseQty) * additionalPricePerPiece (음수면 basePrice만)
 * 결과: 인쇄 항목의 총 가격(전체 수량에 대해)
 */
export function calcPrintTotal(
  config: PrintPricingConfig,
  method: PrintMethod,
  size: PrintSize,
  totalQty: number
): number {
  if (totalQty <= 0) return 0;
  const conf = config[method];
  if (!conf) return 0;
  if (method === 'dtf' || method === 'dtg') {
    const perPiece = (conf as TransferPricing).sizes[size] ?? 0;
    return perPiece * totalQty;
  }
  const sp = (conf as BulkPricing).sizes[size];
  if (!sp) return 0;
  if (totalQty <= sp.baseQuantity) return sp.basePrice;
  return sp.basePrice + (totalQty - sp.baseQuantity) * sp.additionalPricePerPiece;
}

// =====================================================================
// 견적/주문 라인 가격 계산
// =====================================================================
export interface OrderVariant {
  sizeLabel: string;
  sizeCode: string;
  quantity: number;
}
export interface OrderPrint {
  method: PrintMethod;
  size: PrintSize;
  position?: string; // 가슴, 등판 등 (메모용)
}
export interface OrderItemDraft {
  productId: string;
  productTitle: string;
  basePrice: number;
  variants: OrderVariant[];
  prints: OrderPrint[];
}

export interface ItemPricing {
  totalQty: number;
  productSubtotal: number;   // basePrice * totalQty
  printSubtotal: number;     // sum of all prints
  itemTotal: number;
}

export function calcItemPricing(item: OrderItemDraft, config: PrintPricingConfig): ItemPricing {
  const totalQty = item.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
  const productSubtotal = item.basePrice * totalQty;
  const printSubtotal = item.prints.reduce((s, p) => s + calcPrintTotal(config, p.method, p.size, totalQty), 0);
  return {
    totalQty,
    productSubtotal,
    printSubtotal,
    itemTotal: productSubtotal + printSubtotal,
  };
}

export interface OrderPricing {
  originalAmount: number;
  deliveryFee: number;
  couponDiscount: number;
  adminDiscount: number;
  adminSurcharge: number;
  totalAmount: number;
  totalQuantity: number;
}

export function calcOrderPricing(
  items: OrderItemDraft[],
  config: PrintPricingConfig,
  opts: {
    deliveryFee?: number;
    couponDiscount?: number;
    adminDiscount?: number;
    adminSurcharge?: number;
  } = {}
): OrderPricing {
  let originalAmount = 0;
  let totalQuantity = 0;
  for (const it of items) {
    const p = calcItemPricing(it, config);
    originalAmount += p.itemTotal;
    totalQuantity += p.totalQty;
  }
  const deliveryFee = opts.deliveryFee ?? 0;
  const couponDiscount = Math.max(0, opts.couponDiscount ?? 0);
  const adminDiscount = Math.max(0, opts.adminDiscount ?? 0);
  const adminSurcharge = Math.max(0, opts.adminSurcharge ?? 0);
  const totalAmount = Math.max(0, originalAmount + deliveryFee - couponDiscount - adminDiscount + adminSurcharge);
  return { originalAmount, deliveryFee, couponDiscount, adminDiscount, adminSurcharge, totalAmount, totalQuantity };
}

// =====================================================================
// 쿠폰 할인 적용 — modoo_admin coupons.discount_type 매칭
// =====================================================================
export interface CouponLite {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  is_active: boolean | null;
}

export function calcCouponDiscount(coupon: CouponLite | null | undefined, originalAmount: number): number {
  if (!coupon || !coupon.is_active) return 0;
  if ((coupon.min_order_amount ?? 0) > originalAmount) return 0;
  let amt = 0;
  if (coupon.discount_type === 'percentage') {
    amt = Math.floor(originalAmount * (coupon.discount_value / 100));
  } else {
    amt = coupon.discount_value;
  }
  if (coupon.max_discount_amount && coupon.max_discount_amount > 0) {
    amt = Math.min(amt, coupon.max_discount_amount);
  }
  return Math.max(0, Math.floor(amt));
}
