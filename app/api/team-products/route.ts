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
}

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
      price: null,
      created_at: now,
      updated_at: now,
    })
    .select(`
      id, partner_mall_id, product_id,
      display_name, color_hex, color_name, color_code,
      preview_url, price, created_at,
      product:products ( id, title, base_price, thumbnail_image_link )
    `)
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
