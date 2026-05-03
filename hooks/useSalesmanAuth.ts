'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore, type AuthStatus, type SalesmanData } from '@/store/useSalesmanStore';

interface UseSalesmanAuthOptions {
  skip?: boolean;
}

interface UseSalesmanAuthResult {
  authStatus: AuthStatus;
  user: SalesmanData | null;
  logout: () => void;
}

// 일시적 네트워크/서버 오류는 자동 로그아웃 사유가 아님.
// 명시적 인증/권한 오류 코드만 로그아웃 트리거.
function isAuthError(error: { code?: string; status?: number; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 401 || error.status === 403) return true;
  // PostgREST: JWT 만료/유효하지 않음
  if (error.code === 'PGRST301' || error.code === 'PGRST302') return true;
  if (typeof error.message === 'string' && /jwt|unauthor/i.test(error.message)) return true;
  return false;
}

export function useSalesmanAuth(options: UseSalesmanAuthOptions = {}): UseSalesmanAuthResult {
  const { skip = false } = options;
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  const { user, authStatus, setUser, setAuthStatus, logout } = useSalesmanStore();

  // Zustand persist 하이드레이션
  useEffect(() => {
    if (skip) {
      setIsHydrated(true);
      return;
    }
    if (useSalesmanStore.persist.hasHydrated()) {
      setIsHydrated(true);
      setAuthStatus('checking');
      return;
    }
    const unsubscribe = useSalesmanStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
      setAuthStatus('checking');
    });
    useSalesmanStore.persist.rehydrate();
    return () => {
      unsubscribe();
    };
  }, [skip, setAuthStatus]);

  // 인증 + salesman_profiles 검증
  // 영업사원 자격은 profiles.role이 아니라 salesman_profiles 테이블의 레코드 존재 여부로 판단
  // → admin/customer/factory 역할과 무관하게 영업사원도 될 수 있음
  useEffect(() => {
    if (skip || !isHydrated || authStatus !== 'checking') return;

    let isActive = true;

    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (!supabaseUser) {
          if (isActive) setAuthStatus('unauthenticated');
          router.push(`/login?redirect=${encodeURIComponent(pathname ?? '/')}`);
          return;
        }

        // profiles에서 기본 정보 (이름·연락처)
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, phone_number')
          .eq('id', supabaseUser.id)
          .maybeSingle();

        // salesman_profiles에서 영업사원 자격 검증
        const { data: salesman, error: salesmanError } = await supabase
          .from('salesman_profiles')
          .select('id, salesman_code, grade, status, display_name, joined_at')
          .eq('user_id', supabaseUser.id)
          .maybeSingle();

        if (salesmanError) {
          console.error('Error fetching salesman profile:', salesmanError);
          // 일시적 네트워크/서버 오류로는 로그아웃하지 않음.
          // 진짜 인증 만료(401/JWT)일 때만 로그인 페이지로.
          if (isAuthError(salesmanError)) {
            await logout();
            if (isActive) setAuthStatus('unauthenticated');
            router.push('/login?error=lookup');
          } else if (isActive) {
            // 일시 오류 → 캐시된 user를 그대로 두고 authenticated로 마킹.
            // 사용자가 다시 시도하거나 다음 라우트 진입 시 재검증됨.
            setAuthStatus(user ? 'authenticated' : 'unauthenticated');
          }
          return;
        }

        if (!salesman) {
          // 영업사원으로 등록되지 않은 사용자
          await logout();
          if (isActive) setAuthStatus('unauthenticated');
          router.push('/login?error=not_salesman');
          return;
        }

        if (salesman.status !== 'active') {
          // 휴면/이탈
          await logout();
          if (isActive) setAuthStatus('unauthenticated');
          router.push(`/login?error=${salesman.status}`);
          return;
        }

        if (isActive) {
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email || profile?.email || '',
            name: salesman.display_name || supabaseUser.user_metadata?.name,
            phone: supabaseUser.phone || profile?.phone_number,
            role: 'salesman',
            grade: salesman.grade,
            salesman_code: salesman.salesman_code,
            salesman_profile_id: salesman.id,
            joined_at: salesman.joined_at,
          });
        }
      } catch (error) {
        console.error('Error checking salesman auth:', error);
        // catch 분기도 동일 정책: 인증 오류일 때만 logout.
        if (isAuthError(error as { code?: string; status?: number; message?: string })) {
          await logout();
          if (isActive) setAuthStatus('unauthenticated');
          router.push('/login');
        } else if (isActive) {
          setAuthStatus(user ? 'authenticated' : 'unauthenticated');
        }
      }
    };

    checkAuth();

    return () => {
      isActive = false;
    };
  }, [skip, isHydrated, authStatus, router, pathname, setUser, setAuthStatus, logout, user]);

  // Supabase auth 상태 변화 구독.
  // TOKEN_REFRESHED는 자연스러운 갱신이므로 무시(절대 로그아웃 금지).
  // SIGNED_OUT(다른 탭/세션 만료)일 때만 로그인 페이지로.
  useEffect(() => {
    if (skip) return;

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAuthStatus('unauthenticated');
        router.push('/login');
      }
      // TOKEN_REFRESHED / SIGNED_IN / USER_UPDATED 등은 별도 조치 불필요
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [skip, router, setAuthStatus]);

  return { authStatus, user, logout };
}
