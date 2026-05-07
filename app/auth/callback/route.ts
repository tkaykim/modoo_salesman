import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  let next = requestUrl.searchParams.get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    const cookieValue = request.cookies.get('login_return_to')?.value;
    if (cookieValue) {
      try {
        const decoded = decodeURIComponent(cookieValue);
        if (decoded.startsWith('/') && !decoded.startsWith('//')) {
          next = decoded;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const resp = NextResponse.redirect(`${origin}${next}`);
      resp.cookies.set('login_return_to', '', { path: '/', maxAge: 0 });
      return resp;
    }
  }

  const resp = NextResponse.redirect(`${origin}/login?error=oauth`);
  resp.cookies.set('login_return_to', '', { path: '/', maxAge: 0 });
  return resp;
}
