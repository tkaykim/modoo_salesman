import AuthGuard from '@/components/AuthGuard';
import MobileApp from '@/components/MobileApp';
import PWARegister from '@/components/PWARegister';

export default function Home() {
  return (
    <AuthGuard>
      <PWARegister />
      <MobileApp />
    </AuthGuard>
  );
}
