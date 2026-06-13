import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 영업사원 셀프 가입 신청 (2026-06-13).
// 흐름: 신청 폼 → 이 라우트 → auth 사용자 생성 + salesman_profiles status='pending' 적재.
// 승인은 modoo_admin 영업사원 화면에서 status='active' 전환 시 발효 (그 전까지 로그인해도 대기 안내).
// service role 사용 — 익명 가입 RLS 우회. 입력 검증은 여기서 책임진다.

interface ApplyBody {
  email?: string;
  password?: string;
  display_name?: string;
  phone?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9\-+\s()]{8,20}$/;

export async function POST(req: Request) {
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  const displayName = body.display_name?.trim();
  const phone = body.phone?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '유효한 이메일을 입력해주세요.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }
  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
  }
  if (!phone || !PHONE_RE.test(phone)) {
    return NextResponse.json({ error: '유효한 연락처를 입력해주세요.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) 이미 영업사원 프로필이 있는 이메일인지 (profiles 경유) 확인 — 중복 신청 차단
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingSalesman } = await admin
      .from('salesman_profiles')
      .select('id, status')
      .eq('user_id', existingProfile.id)
      .maybeSingle();
    if (existingSalesman) {
      const msg =
        existingSalesman.status === 'pending'
          ? '이미 신청하셨습니다. 승인 대기 중입니다.'
          : '이미 등록된 계정입니다. 로그인해주세요.';
      return NextResponse.json({ error: msg, already: true }, { status: 409 });
    }
    // 기존 사용자지만 영업사원은 아님 → 보안상 셀프 가입으로 처리하지 않고 안내
    return NextResponse.json(
      { error: '이미 가입된 이메일입니다. 로그인 후 본사에 영업사원 전환을 요청해주세요.' },
      { status: 409 }
    );
  }

  // 2) auth 사용자 생성 (이메일 확인 생략 — 본사 승인 게이트가 실질 게이트)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName, phone },
  });
  if (createErr || !created?.user) {
    const dup = /already|registered|exist/i.test(createErr?.message ?? '');
    return NextResponse.json(
      { error: dup ? '이미 가입된 이메일입니다. 로그인해주세요.' : `가입 실패: ${createErr?.message ?? '알 수 없는 오류'}` },
      { status: dup ? 409 : 500 }
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
    phone,
  });
  if (insertErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: `신청 처리 실패: ${insertErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
