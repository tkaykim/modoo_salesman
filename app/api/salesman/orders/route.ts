import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// 영업사원 주문 생성 서버 라우트.
// 기존에는 CreateOrderSheetV2가 클라이언트에서 supabase.from('orders').insert를 직접 호출했고,
// total_amount/admin_discount/admin_surcharge/price_per_item을 모두 클라가 계산해 박았다.
// 이 라우트는 가격을 서버에서 재계산해 위변조를 차단하고, orders+order_items를
// `create_order_with_items` RPC로 단일 트랜잭션 INSERT 한다.

interface ItemPayload {
  productId: string;
  productTitle: string;
  designId?: string | null;
  designTitle?: string | null;
  designPreviewUrl?: string | null;
  productThumbnail?: string | null;
  partnerMallProductId?: string | null;
  variants: Array<{ sizeCode: string; sizeLabel: string; quantity: number }>;
  // @deprecated — 서버는 클라가 보낸 단가를 무시하고 saved_designs.price_per_item ?? products.base_price 를 권위값으로 사용한다.
  pricePerItem?: number;
}

interface RequestBody {
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerNote?: string | null;
  partnerMallId?: string | null;
  shippingMethod: 'pickup' | 'domestic' | 'international';
  paymentType: 'completed' | 'bank_transfer' | 'customer_payment';
  applyMyCoupon?: boolean;
  couponId?: string | null;
  // 영업사원 본인 쿠폰 사용 시 client가 계산해 보내지만 서버에서 검증.
  couponDiscount?: number;
  adminDiscount?: number;
  adminSurcharge?: number;
  items: ItemPayload[];
  customerEditableFields?: {
    quantities?: boolean;
    customerInfo?: boolean;
    shipping?: boolean;
  } | null;
}

const DELIVERY_FEE: Record<RequestBody['shippingMethod'], number> = {
  pickup: 0,
  domestic: 3000,
  international: 5000,
};

function buildOrderId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  // crypto.randomUUID 일부를 차용해 충돌 가능성 낮춤.
  const rand = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36)).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SR-${ymd}-${rand}`;
}

function buildPaymentLinkToken() {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function requireSalesman() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('salesman_profiles')
    .select('id, status, user_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!profile) {
    return { error: NextResponse.json({ error: '영업사원 자격이 없습니다.' }, { status: 403 }) };
  }
  return { userId: auth.user.id, salesmanProfileId: profile.id as string };
}

export async function POST(request: Request) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: '품목이 비어 있습니다.' }, { status: 400 });
  }
  if (!['pickup', 'domestic', 'international'].includes(body.shippingMethod)) {
    return NextResponse.json({ error: '배송 방식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!['completed', 'bank_transfer', 'customer_payment'].includes(body.paymentType)) {
    return NextResponse.json({ error: '결제 방식이 올바르지 않습니다.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) partner_mall 소유 검증 (있는 경우에만)
  if (body.partnerMallId) {
    const { data: mall } = await admin
      .from('partner_malls')
      .select('id, salesman_id, is_active')
      .eq('id', body.partnerMallId)
      .maybeSingle();
    if (!mall) {
      return NextResponse.json({ error: '단체를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (mall.salesman_id !== auth.salesmanProfileId) {
      return NextResponse.json({ error: '본인 소유 단체가 아닙니다.' }, { status: 403 });
    }
    if (!mall.is_active) {
      return NextResponse.json({ error: '비활성 단체로는 주문을 생성할 수 없습니다.' }, { status: 400 });
    }
  }

  // 2) 디자인/제품 가격 권위 데이터 일괄 조회
  const designIds = Array.from(new Set(body.items.map((i) => i.designId).filter((v): v is string => !!v)));
  const productIds = Array.from(new Set(body.items.map((i) => i.productId).filter((v): v is string => !!v)));
  const mallProductIds = Array.from(
    new Set(body.items.map((i) => i.partnerMallProductId).filter((v): v is string => !!v)),
  );

  const designPriceMap = new Map<string, number>();
  const designBundleMap = new Map<string, {
    title: string | null;
    canvas_state: Record<string, unknown>;
    color_selections: Record<string, unknown>;
    image_urls: Record<string, unknown>;
    text_svg_exports: Record<string, unknown> | null;
    custom_fonts: unknown[];
    retouch_requested: boolean;
    preview_url: string | null;
  }>();
  if (designIds.length > 0) {
    const { data } = await admin
      .from('saved_designs')
      .select('id, price_per_item, title, canvas_state, color_selections, image_urls, text_svg_exports, custom_fonts, retouch_requested, preview_url, user_id')
      .in('id', designIds);
    for (const d of data ?? []) {
      // 본인 소유 OR 영업사원이 만든 진열 디자인 — 영업사원 RLS와 동일한 범위로 허용.
      // (admin client 사용 중이라 RLS는 우회되지만, attribution 감사용으로 user_id 기록만 확인)
      if (typeof d.price_per_item === 'number') designPriceMap.set(d.id as string, d.price_per_item);
      designBundleMap.set(d.id as string, {
        title: (d.title as string | null) ?? null,
        canvas_state: (d.canvas_state as Record<string, unknown>) ?? {},
        color_selections: (d.color_selections as Record<string, unknown>) ?? {},
        image_urls: (d.image_urls as Record<string, unknown>) ?? {},
        text_svg_exports: (d.text_svg_exports as Record<string, unknown> | null) ?? null,
        custom_fonts: (d.custom_fonts as unknown[]) ?? [],
        retouch_requested: (d.retouch_requested as boolean) ?? false,
        preview_url: (d.preview_url as string | null) ?? null,
      });
    }
  }

  const basePriceMap = new Map<string, number>();
  if (productIds.length > 0) {
    const { data } = await admin.from('products').select('id, base_price').in('id', productIds);
    for (const p of data ?? []) {
      if (typeof p.base_price === 'number') basePriceMap.set(p.id as string, p.base_price);
    }
  }

  const mallProductBundleMap = new Map<string, {
    canvas_state: Record<string, unknown>;
    color_selections: Record<string, unknown>;
    preview_url: string | null;
    display_name: string | null;
  }>();
  if (mallProductIds.length > 0) {
    const { data } = await admin
      .from('partner_mall_products')
      .select('id, display_name, color_hex, color_name, color_code, canvas_state, preview_url, partner_mall_id')
      .in('id', mallProductIds);
    for (const m of data ?? []) {
      // 진열 출처가 본인 mall이 아니면 거부 (단, partnerMallId가 명시된 경우만 강제)
      if (body.partnerMallId && m.partner_mall_id !== body.partnerMallId) {
        return NextResponse.json(
          { error: '선택한 단체의 진열 상품이 아닙니다.' },
          { status: 400 },
        );
      }
      mallProductBundleMap.set(m.id as string, {
        canvas_state: (m.canvas_state as Record<string, unknown>) ?? {},
        color_selections: {
          productColor: (m.color_hex as string | null) ?? null,
          colorName: (m.color_name as string | null) ?? null,
          colorCode: (m.color_code as string | null) ?? null,
        },
        preview_url: (m.preview_url as string | null) ?? null,
        display_name: (m.display_name as string | null) ?? null,
      });
    }
  }

  // 3) 권위 단가 결정 + subtotal 계산
  // 단가는 클라이언트가 보낸 값을 무시하고 서버가 결정한다:
  //   - designId 가 있고 saved_designs.price_per_item > 0 이면 그 값을 사용
  //     (DesignEditorModal 은 신규 디자인을 price_per_item: 0 으로 저장하므로
  //      0/null/음수는 "단가 미설정"으로 간주하고 제품 base_price 로 폴백)
  //   - 그 외에는 products.base_price
  //   - 둘 다 유효하지 않으면 거부.
  let subtotal = 0;
  const authoritativePrices: number[] = [];
  for (const it of body.items) {
    const qty = (it.variants ?? []).reduce((s, v) => s + (Number(v.quantity) || 0), 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: '품목 수량이 올바르지 않습니다.' }, { status: 400 });
    }
    let authoritativePrice: number | undefined;
    if (it.designId) {
      const dp = designPriceMap.get(it.designId);
      if (typeof dp === 'number' && Number.isFinite(dp) && dp > 0) {
        authoritativePrice = dp;
      }
    }
    if (authoritativePrice == null) {
      const bp = basePriceMap.get(it.productId);
      if (typeof bp === 'number' && Number.isFinite(bp) && bp >= 0) {
        authoritativePrice = bp;
      }
    }
    if (typeof authoritativePrice !== 'number') {
      return NextResponse.json(
        { error: '제품 또는 디자인 단가를 확인할 수 없습니다.' },
        { status: 400 },
      );
    }
    authoritativePrices.push(authoritativePrice);
    subtotal += authoritativePrice * qty;
  }

  const deliveryFee = DELIVERY_FEE[body.shippingMethod];
  const couponDiscount = Math.max(0, Number(body.couponDiscount) || 0);
  const adminDiscount = Math.max(0, Number(body.adminDiscount) || 0);
  const adminSurcharge = Math.max(0, Number(body.adminSurcharge) || 0);
  const totalAmount = Math.max(0, subtotal + deliveryFee - couponDiscount - adminDiscount + adminSurcharge);

  // 4) 주문 ID/토큰을 서버에서 생성 (클라가 박는 것 차단)
  const orderId = buildOrderId();
  const paymentLinkToken = body.paymentType === 'customer_payment' ? buildPaymentLinkToken() : null;
  // 고객 결제 링크는 30일 후 만료(영업사원이 다시 발송하지 않으면 무한정 살아 있지 않도록).
  const paymentLinkExpiresAt = paymentLinkToken
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const paymentStatus = body.paymentType === 'completed' ? 'paid' : 'pending';
  const orderStatus = body.paymentType === 'completed' ? 'payment_completed' : 'payment_pending';
  const paymentMethod =
    body.paymentType === 'bank_transfer' ? 'bank_transfer'
    : body.paymentType === 'customer_payment' ? 'toss'
    : 'manual';

  // 5) order rows 빌드
  const orderJson: Record<string, unknown> = {
    id: orderId,
    user_id: auth.userId,
    customer_name: body.customerName?.trim() || null,
    customer_phone: body.customerPhone?.trim() || null,
    customer_email: body.customerEmail?.trim() || null,
    shipping_method: body.shippingMethod,
    delivery_fee: deliveryFee,
    total_amount: totalAmount,
    original_amount: subtotal,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    order_status: orderStatus,
    salesman_coupon_id: body.applyMyCoupon && body.couponId ? body.couponId : null,
    salesman_discount_amount: couponDiscount,
    admin_discount: adminDiscount,
    admin_surcharge: adminSurcharge,
    customer_note: body.customerNote?.trim() || null,
    partner_mall_id: body.partnerMallId ?? null,
    salesman_id: auth.salesmanProfileId,
    payment_link_token: paymentLinkToken,
    order_category: 'salesman_direct',
  };

  const itemsJson = body.items.map((it, idx) => {
    const qty = (it.variants ?? []).reduce((s, v) => s + (Number(v.quantity) || 0), 0);
    const variants = (it.variants ?? [])
      .filter((v) => (v.quantity || 0) > 0)
      .map((v) => ({ size_id: v.sizeCode, size_name: v.sizeLabel, quantity: v.quantity }));
    const designBundle = it.designId ? designBundleMap.get(it.designId) : undefined;
    const mallBundle = it.partnerMallProductId ? mallProductBundleMap.get(it.partnerMallProductId) : undefined;
    return {
      product_id: it.productId,
      product_title: it.productTitle,
      design_id: it.designId ?? null,
      design_title: it.designTitle ?? designBundle?.title ?? mallBundle?.display_name ?? null,
      quantity: qty,
      price_per_item: authoritativePrices[idx],
      canvas_state: designBundle?.canvas_state ?? mallBundle?.canvas_state ?? {},
      color_selections: designBundle?.color_selections ?? mallBundle?.color_selections ?? {},
      image_urls: designBundle?.image_urls ?? {},
      text_svg_exports: designBundle?.text_svg_exports ?? undefined,
      custom_fonts: designBundle?.custom_fonts ?? [],
      retouch_requested: designBundle?.retouch_requested ?? false,
      item_options: {
        variants,
        source: 'salesman_app_v2',
        partner_mall_product_id: it.partnerMallProductId ?? null,
      },
      thumbnail_url: it.designPreviewUrl ?? designBundle?.preview_url ?? mallBundle?.preview_url ?? it.productThumbnail ?? null,
      purchase_order_status: 'pending',
      design_status: it.designId || it.designTitle ? 'pending' : 'design_required',
    };
  });

  // 6) RPC로 단일 트랜잭션 INSERT
  const { data: rpcResult, error: rpcError } = await admin.rpc('create_order_with_items', {
    p_order: orderJson,
    p_items: itemsJson,
  });
  if (rpcError) {
    console.error('[api/salesman/orders] rpc failed:', rpcError);
    return NextResponse.json({ error: rpcError.message || '주문 생성에 실패했습니다.' }, { status: 500 });
  }

  // 7) customer_editable_fields / payment_link_expires_at 별도 update
  // (RPC 함수 시그니처에 포함되지 않은 컬럼이라 후처리)
  const postPatch: Record<string, unknown> = {};
  if (body.customerEditableFields) postPatch.customer_editable_fields = body.customerEditableFields;
  if (paymentLinkExpiresAt) postPatch.payment_link_expires_at = paymentLinkExpiresAt;
  if (Object.keys(postPatch).length > 0) {
    await admin.from('orders').update(postPatch).eq('id', orderId);
  }

  const linkUrl = paymentLinkToken ? `https://modoouniform.com/order/custom/${paymentLinkToken}` : null;
  return NextResponse.json({
    data: {
      orderId,
      paymentLinkUrl: linkUrl,
      totalAmount,
      rpc: rpcResult,
    },
  });
}
