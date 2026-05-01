'use client';

import { useSalesmanAuth } from '@/hooks/useSalesmanAuth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authStatus } = useSalesmanAuth();

  if (authStatus !== 'authenticated') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-brand-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
