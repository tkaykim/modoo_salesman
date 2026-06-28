'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { Icon } from '@/components/ui';

function getSafeInternalRedirect(raw: string | null): string {
  if (!raw || typeof raw !== 'string') return '/';
  try {
    const path = decodeURIComponent(raw.trim());
    if (!path.startsWith('/') || path.startsWith('//')) return '/';
    if (path.includes('://') || path.includes('\\')) return '/';
    return path;
  } catch {
    return '/';
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, signInWithOAuth } = useSalesmanStore();
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'kakao'>(null);

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setErrorMessage(null);
    setOauthLoading(provider);
    const result = await signInWithOAuth(provider);
    if (!result.success) {
      setOauthLoading(null);
      setErrorMessage(result.error || '소셜 로그인에 실패했습니다.');
    }
    // 성공 시 Supabase가 OAuth 페이지로 리다이렉트하므로 이후 처리 불필요
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorParam = searchParams.get('error');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || '로그인에 실패했습니다.');
      return;
    }

    const next = getSafeInternalRedirect(searchParams.get('redirect'));
    router.push(next);
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{
        background: 'linear-gradient(180deg, var(--color-brand-softer) 0%, #ffffff 100%)',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <Image
            src="/icons/modoo-partners-icon-192.png"
            alt="MODOO PARTNERS 앱 아이콘"
            width={76}
            height={76}
            priority
            unoptimized
            className="h-[76px] w-[76px] rounded-[22px] shadow-[0_12px_26px_rgba(0,82,204,0.20)]"
          />
          <p className="mt-4 text-[13px] font-black text-[var(--color-brand-500)]">
            MODOO PARTNERS
          </p>
          <h1 className="mt-1 text-[24px] font-black leading-tight text-[var(--color-ink)]">
            모두 파트너스
          </h1>
          <p className="mt-1 text-[12px] font-medium text-[var(--color-muted)]">
            단체복 소개 영업사원 앱
          </p>
        </div>

        <div
          className="bg-[var(--color-surface)] rounded-[20px] p-6 border border-[var(--color-hairline-soft)]"
          style={{ boxShadow: '0 4px 14px rgba(14,17,22,0.06)' }}
        >
          {errorParam === 'pending' && (
            <div className="rounded-[10px] bg-[var(--color-brand-500)]/10 border border-[var(--color-brand-500)]/30 px-3 py-2 text-[12px] text-[var(--color-brand-600)] mb-4 flex items-start gap-2">
              <Icon name="alert" size={14} color="var(--color-brand-500)" />
              <span className="flex-1">승인 대기 중입니다. 본사 운영팀의 승인 후 이용하실 수 있습니다.</span>
            </div>
          )}
          {(errorParam === 'role' || errorParam === 'not_salesman') && (
            <div className="rounded-[10px] bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/30 px-3 py-2 text-[12px] text-[var(--color-warn)] mb-4 flex items-start gap-2">
              <Icon name="alert" size={14} color="var(--color-warn)" />
              <span className="flex-1">영업사원 계정이 아닙니다. 본사에 문의해주세요.</span>
            </div>
          )}
          {errorParam === 'dormant' && (
            <div className="rounded-[10px] bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/30 px-3 py-2 text-[12px] text-[var(--color-warn)] mb-4 flex items-start gap-2">
              <Icon name="alert" size={14} color="var(--color-warn)" />
              <span className="flex-1">휴면 상태 계정입니다. 본사에 활성화 요청을 해주세요.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[11px] font-bold text-[var(--color-muted)] mb-1.5"
                htmlFor="email"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                placeholder="example@modoogoods.com"
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-bold text-[var(--color-muted)] mb-1.5"
                htmlFor="password"
              >
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                placeholder="비밀번호"
              />
            </div>

            {errorMessage && (
              <div className="rounded-[10px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[14px] bg-[var(--color-brand-500)] px-3 py-3 text-white text-[15px] font-bold active:bg-[var(--color-brand-600)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={!isSubmitting ? { boxShadow: 'var(--shadow-cta)' } : undefined}
            >
              {isSubmitting ? '로그인 중…' : '로그인'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-hairline)]" />
            <span className="text-[11px] text-[var(--color-faint)]">또는</span>
            <div className="h-px flex-1 bg-[var(--color-hairline)]" />
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => handleOAuth('kakao')}
              disabled={oauthLoading !== null}
              className="w-full rounded-[12px] bg-[var(--color-ink)] px-3 py-2.5 text-[14px] font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'kakao' ? '연결 중…' : '카카오 계정으로 로그인'}
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null}
              className="w-full rounded-[12px] border border-[var(--color-hairline)] bg-white px-3 py-2.5 text-[14px] font-bold text-[var(--color-ink)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? '연결 중…' : 'Google 계정으로 로그인'}
            </button>
          </div>
        </div>

        <p className="text-center text-[12px] text-[var(--color-muted)] mt-6">
          영업사원으로 활동하고 싶으신가요?{' '}
          <Link href="/apply" className="font-bold text-[var(--color-brand-500)]">
            지원 신청
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-surface)]">
          <div className="w-10 h-10 border-4 border-[var(--color-brand-500)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
