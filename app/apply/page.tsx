'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';

export default function ApplyPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [region, setRegion] = useState('');
  const [communityType, setCommunityType] = useState('학교·학과');
  const [reachableGroups, setReachableGroups] = useState('');
  const [activityTime, setActivityTime] = useState('주 1~2시간');
  const [intro, setIntro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const potentialLabel = useMemo(() => {
    const n = Number(reachableGroups.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return '첫 단체 후보';
    if (n >= 5) return '핵심 파트너 후보';
    if (n >= 2) return '실전 가능 후보';
    return '첫 단체 후보';
  }, [reachableGroups]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!displayName || !phone || !email || !password || !region || !reachableGroups) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== password2) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/salesman/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          phone,
          email,
          password,
          region,
          community_type: communityType,
          reachable_groups: reachableGroups,
          activity_time: activityTime,
          intro,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || '신청에 실패했습니다.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-surface-alt)] px-5 py-8 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="rounded-[24px] bg-white p-6 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-[20px] flex items-center justify-center"
              style={{ background: 'var(--color-pos)', boxShadow: '0 8px 18px rgba(16,185,129,0.25)' }}
            >
              <Icon name="check" size={28} color="white" strokeWidth={2.4} />
            </div>
            <p className="text-[11px] font-extrabold text-[var(--color-brand-500)] mb-2">
              MODOO PARTNERS
            </p>
            <h1 className="text-[21px] font-black text-[var(--color-ink)] tracking-tight mb-2">
              지원서가 접수되었습니다
            </h1>
            <p className="text-[13px] text-[var(--color-muted)] leading-relaxed mb-5">
              운영팀이 활동 가능 단체와 지역을 확인한 뒤 승인합니다.
              <br />
              승인되면 앱에서 교육 미션과 첫 단체몰 만들기를 시작할 수 있습니다.
            </p>
            <div className="rounded-[16px] bg-[var(--color-surface-alt)] p-3 text-left mb-5">
              <p className="text-[11px] text-[var(--color-muted)] font-bold mb-1">다음 단계</p>
              <ol className="text-[12px] text-[var(--color-body)] leading-relaxed space-y-1">
                <li>1. 운영팀 승인 대기</li>
                <li>2. 파트너 스쿨 필수 교육 수강</li>
                <li>3. 첫 단체 등록 후 공유 링크 전달</li>
              </ol>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="w-full rounded-[14px] bg-[var(--color-brand-500)] px-3 py-3 text-white text-[15px] font-bold active:bg-[var(--color-brand-600)] transition-colors"
              style={{ boxShadow: 'var(--shadow-cta)' }}
            >
              로그인 화면으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-surface-alt)]">
      <main className="mx-auto w-full max-w-md pb-10">
        <section className="bg-white px-5 pt-8 pb-6">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-[12px] bg-[var(--color-brand-500)] flex items-center justify-center">
                <Icon name="trophy" size={20} color="white" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[13px] font-black text-[var(--color-ink)]">모두 파트너스</p>
                <p className="text-[10px] font-bold text-[var(--color-muted)]">단체복 영업 파트너</p>
              </div>
            </div>
            <Link href="/login" prefetch={false} className="text-[12px] font-bold text-[var(--color-brand-500)]">
              로그인
            </Link>
          </div>

          <p className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-100)] px-3 py-1 text-[11px] font-extrabold text-[var(--color-brand-500)]">
            <Icon name="bolt" size={13} color="var(--color-brand-500)" strokeWidth={2.2} />
            주변 단체를 주문 링크로 연결
          </p>
          <h1 className="mt-4 text-[33px] font-black leading-[1.12] tracking-tight text-[var(--color-ink)]">
            하루 1시간,
            <br />
            단체복 주문을
            <br />
            수익으로 연결하세요
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-muted)]">
            디자인, 제작, 결제, 배송은 모두의 유니폼이 맡고 파트너는 가까운 단체를 발굴해 전용 주문 링크를 전달합니다.
          </p>

          <div className="mt-6 rounded-[22px] bg-[var(--color-ink)] p-4 text-white">
            <div className="grid grid-cols-3 gap-2">
              <HeroMetric label="초기비용" value="0원" />
              <HeroMetric label="출퇴근" value="없음" />
              <HeroMetric label="정산" value="월별" />
            </div>
            <div className="mt-4 rounded-[16px] bg-white/9 p-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[15px] bg-[var(--color-gold)] flex items-center justify-center">
                  <Icon name="wallet" size={24} color="var(--color-ink)" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/65 font-bold">수익 구조</p>
                  <p className="text-[15px] font-extrabold mt-0.5">
                    결제 주문 매출 기준 수수료
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            <Benefit icon="group" title="가까운 단체" desc="학과, 동호회, 학원, 매장" />
            <Benefit icon="qr" title="전용 단체몰" desc="QR과 링크로 바로 주문" />
            <Benefit icon="palette" title="디자인 지원" desc="로고와 시안 제작 흐름" />
            <Benefit icon="gift" title="미션 리워드" desc="첫 단체몰까지 적립 예정" />
          </div>
        </section>

        <section className="px-5">
          <div className="rounded-[24px] bg-white p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[11px] font-extrabold text-[var(--color-brand-500)]">30초 지원</p>
                <h2 className="text-[20px] font-black text-[var(--color-ink)] tracking-tight mt-1">
                  파트너 지원하기
                </h2>
              </div>
              <span className="rounded-full bg-[var(--color-gold-soft)] px-3 py-1 text-[11px] font-extrabold text-[var(--color-gold-deep)]">
                {potentialLabel}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="이름" htmlFor="name" required>
                <input
                  id="name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="modoo-input"
                  placeholder="홍길동"
                />
              </Field>
              <Field label="연락처" htmlFor="phone" required>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="modoo-input"
                  placeholder="010-1234-5678"
                />
              </Field>
              <Field label="이메일" htmlFor="email" required>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="modoo-input"
                  placeholder="example@email.com"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="활동 지역" htmlFor="region" required>
                  <input
                    id="region"
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="modoo-input"
                    placeholder="서울 마포"
                  />
                </Field>
                <Field label="활동 시간" htmlFor="time">
                  <select
                    id="time"
                    value={activityTime}
                    onChange={(e) => setActivityTime(e.target.value)}
                    className="modoo-input"
                  >
                    <option>주 1~2시간</option>
                    <option>주 3~5시간</option>
                    <option>하루 1시간</option>
                    <option>필요할 때 집중</option>
                  </select>
                </Field>
              </div>
              <Field label="가장 가까운 단체 유형" htmlFor="community">
                <select
                  id="community"
                  value={communityType}
                  onChange={(e) => setCommunityType(e.target.value)}
                  className="modoo-input"
                >
                  <option>학교·학과</option>
                  <option>동아리·동호회</option>
                  <option>학원·스튜디오</option>
                  <option>매장·프랜차이즈</option>
                  <option>회사·팀</option>
                  <option>교회·모임</option>
                  <option>기타</option>
                </select>
              </Field>
              <Field label="바로 연락 가능한 단체 수" htmlFor="groups" required>
                <input
                  id="groups"
                  type="text"
                  value={reachableGroups}
                  onChange={(e) => setReachableGroups(e.target.value)}
                  className="modoo-input"
                  placeholder="예: 2곳, 학과 1곳과 동호회 1곳"
                />
              </Field>
              <Field label="간단 소개" htmlFor="intro">
                <textarea
                  id="intro"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  className="modoo-input min-h-[88px] resize-none"
                  placeholder="현재 소속, 주변 단체, 활동 경험을 적어주세요."
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="비밀번호" htmlFor="pw" required>
                  <input
                    id="pw"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="modoo-input"
                    placeholder="8자 이상"
                  />
                </Field>
                <Field label="비밀번호 확인" htmlFor="pw2" required>
                  <input
                    id="pw2"
                    type="password"
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="modoo-input"
                    placeholder="재입력"
                  />
                </Field>
              </div>

              {error && (
                <div className="rounded-[12px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[16px] bg-[var(--color-brand-500)] px-3 py-4 text-white text-[15px] font-bold active:bg-[var(--color-brand-600)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={!submitting ? { boxShadow: 'var(--shadow-cta)' } : undefined}
              >
                {submitting ? '지원 접수 중...' : '파트너 지원하기'}
              </button>
            </form>
          </div>
        </section>

        <p className="px-6 pt-5 text-[10px] leading-relaxed text-[var(--color-faint)]">
          수수료와 리워드는 실제 결제 주문, 승인 상태, 정산 기준에 따라 달라질 수 있습니다.
          <br />
          모두의 유니폼 운영팀 승인 후 영업사원 앱 이용이 가능합니다.
        </p>
      </main>

      <style jsx>{`
        :global(.modoo-input) {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--color-hairline);
          background: #fff;
          padding: 11px 12px;
          font-size: 16px;
          outline: none;
        }
        :global(.modoo-input:focus) {
          border-color: var(--color-brand-500);
          box-shadow: 0 0 0 3px rgba(0, 82, 204, 0.08);
        }
      `}</style>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-white/10 px-3 py-2">
      <p className="text-[10px] text-white/55 font-bold">{label}</p>
      <p className="text-[15px] text-white font-extrabold mt-0.5">{value}</p>
    </div>
  );
}

function Benefit({
  icon,
  title,
  desc,
}: {
  icon: 'group' | 'qr' | 'palette' | 'gift';
  title: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-[18px] bg-white p-4 min-h-[126px]"
      style={{ border: '1px solid var(--color-hairline-soft)', boxShadow: 'var(--shadow-card-flat)' }}
    >
      <div className="w-10 h-10 rounded-[13px] bg-[var(--color-brand-100)] flex items-center justify-center mb-3">
        <Icon name={icon} size={21} color="var(--color-brand-500)" strokeWidth={2} />
      </div>
      <p className="text-[14px] font-extrabold text-[var(--color-ink)] tracking-tight">{title}</p>
      <p className="text-[11px] leading-relaxed text-[var(--color-muted)] mt-1">{desc}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-bold text-[var(--color-muted)] mb-1.5"
        htmlFor={htmlFor}
      >
        {label}
        {required ? <span className="text-[var(--color-err)]"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
