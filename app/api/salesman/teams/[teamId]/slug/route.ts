import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// 영업사원이 본인 mall의 slug(공유 URL)을 직접 설정한다.
// modoouniform.com/mall/{share_token_32hex} 처럼 길고 외우기 어려운 URL을
// /mall/{my-team} 같이 짧게 만들기 위함.

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
// 시스템 경로/관리자 경로와 겹쳐 라우팅을 망가뜨릴 수 있는 단어는 사용 금지.
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'cart', 'checkout', 'cobuy', 'editor',
  'inquiries', 'login', 'logout', 'mall', 'order', 'payment', 'policies',
  'product', 'profile', 'register', 'reset-password', 'reviews', 'shop',
  'signin', 'signup', 'support', 'terms', 'privacy', 'help', 'home',
  'dashboard', 'settings', 'about', 'contact', 'faq', 'static', 'public',
  'undefined', 'null', 'true', 'false', 'modoo', 'modoogoods', 'modoouniform',
]);

async function requireSalesman() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('salesman_profiles')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!profile) {
    return { error: NextResponse.json({ error: '영업사원 자격이 없습니다.' }, { status: 403 }) };
  }
  return { salesmanProfileId: profile.id as string };
}

function normalizeSlug(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!SLUG_PATTERN.test(s)) return null;
  if (RESERVED_SLUGS.has(s)) return null;
  return s;
}

// PATCH: slug 설정 / 변경 / 삭제(빈 문자열 또는 null)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const { teamId } = await params;
  if (!teamId) {
    return NextResponse.json({ error: 'teamId가 필요합니다.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { slug?: string | null } | null;
  if (!body) {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 본인 mall 검증
  const { data: mall } = await admin
    .from('partner_malls')
    .select('id, salesman_id, slug')
    .eq('id', teamId)
    .maybeSingle();
  if (!mall) {
    return NextResponse.json({ error: '단체를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (mall.salesman_id !== auth.salesmanProfileId) {
    return NextResponse.json({ error: '본인 소유 단체가 아닙니다.' }, { status: 403 });
  }

  // 빈 문자열/null이면 slug 삭제
  if (body.slug === null || body.slug === '' || body.slug === undefined) {
    const { error } = await admin.from('partner_malls').update({ slug: null }).eq('id', teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { slug: null } });
  }

  const normalized = normalizeSlug(body.slug);
  if (!normalized) {
    return NextResponse.json(
      {
        error:
          '슬러그는 3~40자, 소문자 영문/숫자/하이픈만 가능하며 시스템 예약어는 사용할 수 없습니다.',
        code: 'INVALID_FORMAT',
      },
      { status: 400 },
    );
  }

  // 변경 없으면 그냥 OK
  if (mall.slug === normalized) {
    return NextResponse.json({ data: { slug: normalized } });
  }

  // 중복 체크 (UNIQUE 인덱스가 있지만 사용자에게 명확한 에러를 주기 위해 사전 조회)
  const { data: existing } = await admin
    .from('partner_malls')
    .select('id')
    .eq('slug', normalized)
    .neq('id', teamId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: '이미 사용 중인 슬러그입니다.', code: 'TAKEN' },
      { status: 409 },
    );
  }

  const { error: updErr } = await admin
    .from('partner_malls')
    .update({ slug: normalized })
    .eq('id', teamId);
  if (updErr) {
    if (updErr.code === '23505') {
      return NextResponse.json(
        { error: '이미 사용 중인 슬러그입니다.', code: 'TAKEN' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: { slug: normalized } });
}

// GET ?candidate=foo — 사용 가능 여부 확인 (본인 mall은 사용 가능 처리)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const { teamId } = await params;
  const url = new URL(request.url);
  const candidate = url.searchParams.get('candidate');
  if (!candidate) {
    return NextResponse.json({ error: 'candidate 쿼리 파라미터가 필요합니다.' }, { status: 400 });
  }

  const normalized = normalizeSlug(candidate);
  if (!normalized) {
    return NextResponse.json({
      data: { available: false, reason: 'INVALID_FORMAT', normalized: candidate.trim().toLowerCase() },
    });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('partner_malls')
    .select('id')
    .eq('slug', normalized)
    .neq('id', teamId)
    .maybeSingle();

  return NextResponse.json({
    data: {
      available: !existing,
      reason: existing ? 'TAKEN' : 'OK',
      normalized,
    },
  });
}
