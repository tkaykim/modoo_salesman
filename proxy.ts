import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16: middleware가 proxy로 이름이 바뀜.
// @supabase/ssr 표준 패턴 — 매 요청마다 쿠키를 읽어 access token을 갱신하고
// 갱신된 토큰을 응답 쿠키로 다시 굽는다. 이 파일이 없으면 1시간 후 토큰이
// 만료되어 사용자가 자동 로그아웃됨.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser()는 access token을 검증하고 필요하면 refresh token으로 자동 갱신.
  // 이 호출의 부수효과(set-cookie)가 위 setAll 콜백을 통해 response에 전파됨.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // 정적 자원 / 이미지 / favicon 등 제외
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
