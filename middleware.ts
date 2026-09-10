import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware does two jobs:
 *
 *   1. Refreshes the Supabase session cookie on every request, so an admin's
 *      session does not expire mid-shift.
 *   2. Turns away unauthenticated requests to /admin before any page renders.
 *
 * Job 2 is a convenience, NOT the security boundary. Middleware runs on the
 * edge and can be bypassed by anything that reaches the origin directly, so
 * every admin page calls requireAdmin(), every action calls assertPermission(),
 * and every RPC calls require_permission() in SQL. This just makes the common
 * case fast and the redirect clean.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there is no session to refresh; let the page render
  // and show its own configuration error rather than 500 from the edge.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Revalidates the JWT and rotates the cookie. Must be getUser(), not
  // getSession() — the latter trusts a cookie the client could have edited.
  const { data } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith('/admin');
  const isLoginPage = pathname === '/admin/login';

  if (isAdminArea && !isLoginPage && !data.user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/admin/login';
    // Preserve where they were headed, but only as a same-site path so this
    // cannot be turned into an open redirect.
    redirectUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginPage && data.user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/admin';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the image optimiser, and files with an
     * extension. Keeping the 3D model and images out of middleware matters for
     * first-load performance.
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|models/|images/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|glb|gltf|txt|xml|ico)$).*)',
  ],
};
