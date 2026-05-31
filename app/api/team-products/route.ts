import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

interface CreatePayload {
  team_id: string;
  product_id: string;
  display_name?: string | null;
  manufacturer_color_id?: string | null;
  color_hex?: string | null;
  color_name?: string | null;
  color_code?: string | null;
  logo_placements?: Record<string, unknown>;
  canvas_state?: Record<string, unknown>;
  preview_url?: string | null;
  /** 영업사원이 정한 고객 노출가(개당). null이면 제품 기본가로 노출. */
  price?: number | null;
}

interface UpdatePayload {
  id: string;
  display_name?: string | null;
  price?: number | null;
}

const SELECT = `
  id, partner_mall_id, product_id,
  display_name, color_hex, color_name, color_code,
  preview_url, price, created_at,
  product:products ( id, title, base_price, thumbnail_image_link )
`;

async function requireSalesman() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  const { data: profile, error } = await supabase
    .from('salesman_profiles')
    .select('id, status')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error || !profile) {
    return { error: NextResponse.json({ error: '영업사원 자격이 없습니다.' }, { status: 403 }) };
  }
  return { salesmanId: profile.id as string };
}

// 가격 정규화: 0 이상의 정수만 허용, 그 외(null/음수/NaN)는 null(기본가 노출).
function normalizePrice(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// 진열 상품의 소유 검증: partner_mall_products.id → partner_mall.salesman_id 가 본인인지.
async function assertOwnsMallProduct(
  admin: ReturnType<typeof createAdminClient>,
  mallProductId: string,
  salesmanId: string,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const { data, error } = await admin
    .from('partner_mall_products')
    .select('id, partner_mall:partner_malls!inner ( salesman_id )')
    .eq('id', mallProductId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, res: NextResponse.json({ error: '진열 상품을 찾을 수 없습니다.' }, { status: 404 }) };
  }
  const owner = (data as { partner_mall?: { salesman_id?: string | null } }).partner_mall?.salesman_id;
  if (owner !== salesmanId) {
    return { ok: false, res: NextResponse.json({ error: '본인이 담당하는 단체만 수정할 수 있습니다.' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const payload = (await request.json().catch(() => null)) as CreatePayload | null;
  if (!payload?.team_id || !payload?.product_id) {
    return NextResponse.json({ error: 'team_id와 product_id가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 본인 소유 mall인지 검증
  const { data: mall, error: mallError } = await admin
    .from('partner_malls')
    .select('id, salesman_id, is_active')
    .eq('id', payload.team_id)
    .maybeSingle();
  if (mallError || !mall) {
    return NextResponse.json({ error: '단체를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (mall.salesman_id !== auth.salesmanId) {
    return NextResponse.json({ error: '본인이 담당하는 단체만 수정할 수 있습니다.' }, { status: 403 });
  }

  // 판매가 항상 확정: 미지정이면 제품 기본가로 폴백(고객 몰/주문 단가 일관성).
  let price = normalizePrice(payload.price);
  if (price == null) {
    const { data: prod } = await admin
      .from('products')
      .select('base_price')
      .eq('id', payload.product_id)
      .maybeSingle();
    price = normalizePrice(prod?.base_price as number | null | undefined);
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('partner_mall_products')
    .insert({
      partner_mall_id: mall.id,
      product_id: payload.product_id,
      display_name: payload.display_name ?? null,
      manufacturer_color_id: payload.manufacturer_color_id ?? null,
      color_hex: payload.color_hex ?? null,
      color_name: payload.color_name ?? null,
      color_code: payload.color_code ?? null,
      logo_placements: payload.logo_placements ?? {},
      canvas_state: payload.canvas_state ?? {},
      preview_url: payload.preview_url ?? null,
      price,
      created_at: now,
      updated_at: now,
    })
    .select(SELECT)
    .single();

  if (error) {
    console.error('[team-products POST] insert error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details, hint: error.hint },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

// 진열 상품 수정 — 가격/표시명 변경
export async function PATCH(request: Request) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const payload = (await request.json().catch(() => null)) as UpdatePayload | null;
  if (!payload?.id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const owns = await assertOwnsMallProduct(admin, payload.id, auth.salesmanId);
  if (!owns.ok) return owns.res;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('price' in payload) {
    let price = normalizePrice(payload.price);
    if (price == null) {
      // 판매가 항상 확정: 비우면 해당 제품 기본가로 폴백.
      const { data: row } = await admin
        .from('partner_mall_products')
        .select('product:products ( base_price )')
        .eq('id', payload.id)
        .maybeSingle();
      const base = (row as { product?: { base_price?: number | null } } | null)?.product?.base_price;
      price = normalizePrice(base);
    }
    patch.price = price;
  }
  if ('display_name' in payload) patch.display_name = payload.display_name?.trim() || null;

  const { data, error } = await admin
    .from('partner_mall_products')
    .update(patch)
    .eq('id', payload.id)
    .select(SELECT)
    .single();

  if (error) {
    console.error('[team-products PATCH] update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// 진열 상품 제거
export async function DELETE(request: Request) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const bodyId = await request
    .json()
    .then((b) => (b as { id?: string })?.id)
    .catch(() => undefined);
  const id = bodyId ?? searchParams.get('id') ?? undefined;
  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const owns = await assertOwnsMallProduct(admin, id, auth.salesmanId);
  if (!owns.ok) return owns.res;

  const { error } = await admin.from('partner_mall_products').delete().eq('id', id);
  if (error) {
    console.error('[team-products DELETE] delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { id } });
}
