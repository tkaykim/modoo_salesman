import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';

// 영업사원 셀프 가입 신청 (2026-06-13).
// 흐름: 간편 상담 신청 폼 → 이 라우트 → 내부 신청 계정 생성 + salesman_profiles status='pending' 적재.
// 승인은 modoo_admin 영업사원 화면에서 status='active' 전환 시 발효 (그 전까지 로그인해도 대기 안내).
// service role 사용 — 익명 가입 RLS 우회. 입력 검증은 여기서 책임진다.

interface ApplyBody {
  display_name?: string;
  phone?: string;
  region?: string;
  age_range?: string;
}

const PHONE_RE = /^[0-9\-+\s()]{8,20}$/;
const AGE_RANGES = new Set(['20대', '30대', '40대', '50대 이상']);

export async function POST(req: Request) {
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const displayName = body.display_name?.trim();
  const phone = body.phone?.trim();
  const phoneDigits = phone?.replace(/[^0-9]/g, '') ?? '';
  const region = body.region?.trim();
  const ageRange = body.age_range?.trim();

  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
  }
  if (!phone || !PHONE_RE.test(phone) || phoneDigits.length < 10) {
    return NextResponse.json({ error: '유효한 연락처를 입력해주세요.' }, { status: 400 });
  }
  if (!region || region.length < 2) {
    return NextResponse.json({ error: '활동 지역을 입력해주세요.' }, { status: 400 });
  }
  if (!ageRange || !AGE_RANGES.has(ageRange)) {
    return NextResponse.json({ error: '나이대를 선택해주세요.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const applicationMeta = {
    region,
    age_range: ageRange,
    phone: phoneDigits,
    applied_at: new Date().toISOString(),
    source: 'modoo_partners_apply',
    account_mode: 'lead_only',
  };
  const note = [
    '[모두 파트너스 상담 신청]',
    `지역: ${region}`,
    `나이대: ${ageRange}`,
    `연락처: ${phoneDigits}`,
    '신청 방식: 간편 상담 신청',
    '안내: 로그인 정보를 받지 않은 리드형 신청입니다. 상담 후 계정 안내가 필요합니다.',
  ].filter(Boolean).join('\n');

  // 1) 동일 연락처 신청 중복 차단
  const { data: existingSalesman } = await admin
    .from('salesman_profiles')
    .select('id, status')
    .eq('phone', phoneDigits)
    .maybeSingle();

  if (existingSalesman) {
    const msg =
      existingSalesman.status === 'pending'
        ? '이미 신청하셨습니다. 승인 대기 중입니다.'
        : '이미 등록된 연락처입니다. 기존 파트너는 로그인해주세요.';
    return NextResponse.json({ error: msg, already: true }, { status: 409 });
  }

  // 2) auth 사용자 생성 (사용자에게 묻지 않는 내부 신청 계정)
  const email = `partner-${phoneDigits}-${Date.now().toString(36)}@modoo-partners.local`;
  const password = `${randomUUID()}${randomUUID()}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName, phone: phoneDigits, partner_application: applicationMeta },
  });
  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: `신청 계정 생성 실패: ${createErr?.message ?? '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
  const userId = created.user.id;

  // 3) salesman_code 발급 (NOT NULL) + pending 프로필 생성
  const { data: codeData, error: codeErr } = await admin.rpc('generate_salesman_code');
  if (codeErr) {
    // 롤백: 방금 만든 auth 사용자 제거 (고아 방지)
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: `코드 발급 실패: ${codeErr.message}` }, { status: 500 });
  }

  const { error: insertErr } = await admin.from('salesman_profiles').insert({
    user_id: userId,
    salesman_code: codeData as unknown as string,
    grade: 'LV0',
    status: 'pending',
    display_name: displayName,
    phone: phoneDigits,
    note,
  });
  if (insertErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: `신청 처리 실패: ${insertErr.message}` }, { status: 500 });
  }

  // 4) 운영 알림 — 신청이 DB에만 쌓이고 아무도 모르는 사고 방지 (2026-07-21).
  // 알림 실패가 신청 성공을 막으면 안 되므로 fire-and-forget.
  await notifyNewApplication({ displayName, phone: phoneDigits, region, ageRange });

  return NextResponse.json({ ok: true }, { status: 201 });
}

async function notifyNewApplication(app: {
  displayName: string;
  phone: string;
  region: string;
  ageRange: string;
}) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  const content = [
    '🔔 **모두 파트너스 신규 상담 신청**',
    `이름: ${app.displayName}`,
    `연락처: ${app.phone}`,
    `지역: ${app.region} / 나이대: ${app.ageRange}`,
    '상태: pending — modoo_admin 영업사원 화면에서 승인 필요. 상담 연락 바랍니다.',
  ].join('\n');
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[apply] notify failed:', err);
  }
}
