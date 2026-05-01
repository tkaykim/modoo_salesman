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
          await logout();
          if (isActive) setAuthStatus('unauthenticated');
          router.push('/login?error=lookup');
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
        await logout();
        if (isActive) setAuthStatus('unauthenticated');
        router.push('/login');
      }
    };

    checkAuth();

    return () => {
      isActive = false;
    };
  }, [skip, isHydrated, authStatus, router, pathname, setUser, setAuthStatus, logout]);

  return { authStatus, user, logout };
}
