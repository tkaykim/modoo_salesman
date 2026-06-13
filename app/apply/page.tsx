'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';

// 영업사원 셀프 가입 신청 화면 (2026-06-13). 제출 → /api/salesman/apply → status='pending'.
// 승인 전까지 로그인해도 "승인 대기" 안내. 본사 modoo_admin에서 승인 시 활성화.

export default function ApplyPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!displayName || !phone || !email || !password) {
      setError('모든 항목을 입력해주세요.');
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
        body: JSON.stringify({ display_name: displayName, phone, email, password }),
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
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center px-5"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(0,82,204,0.08) 0%, transparent 60%), radial-gradient(circle at 70% 80%, rgba(0,82,204,0.04) 0%, transparent 60%), var(--color-surface)',
        }}
      >
        <div className="w-full max-w-sm text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-[20px] flex items-center justify-center"
            style={{ background: 'var(--color-brand-500)', boxShadow: 'var(--shadow-cta)' }}
          >
            <Icon name="check" size={28} color="white" strokeWidth={2.4} />
          </div>
          <h1 className="text-[20px] font-black text-[var(--color-ink)] tracking-tight mb-2">
            신청이 접수되었습니다
          </h1>
          <p className="text-[13px] text-[var(--color-muted)] leading-relaxed mb-6">
            본사 운영팀의 승인 후 로그인하실 수 있습니다.
            <br />
            승인되면 등록하신 이메일로 안내드리겠습니다.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full rounded-[14px] bg-[var(--color-brand-500)] px-3 py-3 text-white text-[15px] font-bold active:bg-[var(--color-brand-600)] transition-colors"
            style={{ boxShadow: 'var(--shadow-cta)' }}
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10"
      style={{
        background:
          'radial-gradient(circle at 30% 20%, rgba(0,82,204,0.08) 0%, transparent 60%), radial-gradient(circle at 70% 80%, rgba(0,82,204,0.04) 0%, transparent 60%), var(--color-surface)',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-[20px] flex items-center justify-center"
            style={{ background: 'var(--color-brand-500)', boxShadow: 'var(--shadow-cta)' }}
          >
            <Icon name="sparkle" size={28} color="white" strokeWidth={2.2} />
          </div>
          <h1 className="text-[20px] font-black text-[var(--color-ink)] tracking-tight">
            영업사원 지원
          </h1>
          <p className="text-[12px] text-[var(--color-muted)] mt-1 font-medium">
            모두의 유니폼 영업사원으로 활동하기
          </p>
        </div>

        <div
          className="bg-[var(--color-surface)] rounded-[20px] p-6 border border-[var(--color-hairline-soft)]"
          style={{ boxShadow: '0 4px 14px rgba(14,17,22,0.06)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="이름" htmlFor="name">
              <input
                id="name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="modoo-input"
                placeholder="홍길동"
              />
            </Field>
            <Field label="연락처" htmlFor="phone">
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
            <Field label="이메일" htmlFor="email">
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
            <Field label="비밀번호 (8자 이상)" htmlFor="pw">
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="modoo-input"
                placeholder="비밀번호"
              />
            </Field>
            <Field label="비밀번호 확인" htmlFor="pw2">
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="modoo-input"
                placeholder="비밀번호 재입력"
              />
            </Field>

            {error && (
              <div className="rounded-[10px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-[14px] bg-[var(--color-brand-500)] px-3 py-3 text-white text-[15px] font-bold active:bg-[var(--color-brand-600)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={!submitting ? { boxShadow: 'var(--shadow-cta)' } : undefined}
            >
              {submitting ? '신청 중...' : '지원 신청'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[var(--color-muted)] mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-bold text-[var(--color-brand-500)]">
            로그인
          </Link>
        </p>
      </div>

      <style jsx>{`
        :global(.modoo-input) {
          width: 100%;
          border-radius: 10px;
          border: 1px solid var(--color-hairline);
          padding: 10px 12px;
          font-size: 15px;
          outline: none;
        }
        :global(.modoo-input:focus) {
          border-color: var(--color-brand-500);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-bold text-[var(--color-muted)] mb-1.5"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
