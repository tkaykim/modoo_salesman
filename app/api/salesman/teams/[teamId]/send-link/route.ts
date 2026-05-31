import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendGmailEmail } from '@/lib/gmail';

// 단체 전용몰 링크를 담당자 이메일로 자동 발송 (Gmail SMTP 재사용).
// 영업사원이 ShareLinkTab에서 트리거 → 등록된 담당자 이메일(또는 요청 body의 email)로 발송.

const CUSTOMER_APP_BASE = 'https://modoouniform.com';

interface Contact { name?: string; email?: string; isPrimary?: boolean }

async function requireSalesman() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('salesman_profiles')
    .select('id, display_name, salesman_code')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!profile) {
    return { error: NextResponse.json({ error: '영업사원 자격이 없습니다.' }, { status: 403 }) };
  }
  return { profile };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireSalesman();
  if ('error' in auth) return auth.error;

  const { teamId } = await params;
  if (!teamId) {
    return NextResponse.json({ error: 'teamId가 필요합니다.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string | null };

  const admin = createAdminClient();
  const { data: mall, error } = await admin
    .from('partner_malls')
    .select('id, name, slug, share_token, salesman_id, team_meta')
    .eq('id', teamId)
    .maybeSingle();
  if (error || !mall) {
    return NextResponse.json({ error: '단체를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (mall.salesman_id !== auth.profile.id) {
    return NextResponse.json({ error: '본인이 담당하는 단체만 발송할 수 있습니다.' }, { status: 403 });
  }

  // 수신 이메일: 요청 body 우선 → team_meta.contacts의 대표/첫 이메일
  const meta = (mall.team_meta as { contacts?: Contact[] } | null) ?? {};
  const contacts = Array.isArray(meta.contacts) ? meta.contacts : [];
  const primary = contacts.find((c) => c.isPrimary && c.email) ?? contacts.find((c) => c.email);
  const recipientEmail = (body.email?.trim() || primary?.email || '').trim();
  const recipientName = primary?.name || mall.name;

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json(
      { error: '담당자 이메일이 없습니다. 단체 정보에 이메일을 등록하거나 직접 입력해주세요.' },
      { status: 400 },
    );
  }

  const effectiveSlug = mall.slug || mall.share_token;
  if (!effectiveSlug) {
    return NextResponse.json({ error: '공유 링크가 아직 생성되지 않았습니다.' }, { status: 400 });
  }
  const link = `${CUSTOMER_APP_BASE}/mall/${effectiveSlug}`;
  const salesmanName = auth.profile.display_name || '담당 영업사원';
  const mallName = mall.name;

  const subject = `[모두의 유니폼] ${mallName} 전용 주문 페이지 안내`;
  const text =
    `${recipientName}님, 안녕하세요.\n` +
    `${mallName} 전용 유니폼 주문 페이지를 안내드립니다.\n\n` +
    `아래 링크에서 준비된 제품을 확인하고 사이즈·수량만 선택해 바로 주문하실 수 있습니다.\n${link}\n\n` +
    `문의: ${salesmanName} (모두의 유니폼)`;
  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">` +
    `<p style="font-size:15px;margin:0 0 8px">${recipientName}님, 안녕하세요.</p>` +
    `<p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 20px">` +
    `<b>${mallName}</b> 전용 유니폼 주문 페이지를 안내드립니다.<br/>준비된 제품을 확인하고 사이즈·수량만 선택해 바로 주문하실 수 있어요.</p>` +
    `<a href="${link}" style="display:inline-block;background:#0052CC;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 22px;border-radius:12px">전용몰 바로가기</a>` +
    `<p style="font-size:12px;color:#888;margin:20px 0 0;word-break:break-all">${link}</p>` +
    `<p style="font-size:12px;color:#aaa;margin:16px 0 0">문의: ${salesmanName} · 모두의 유니폼</p>` +
    `</div>`;

  const ok = await sendGmailEmail({
    to: [{ email: recipientEmail, name: recipientName }],
    subject,
    text,
    html,
  });

  if (!ok) {
    return NextResponse.json({ error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 502 });
  }

  return NextResponse.json({ data: { sent: true, to: recipientEmail, link } });
}
