import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE, verifyToken } from '@/lib/jwt';
import { ROLE_HOME, roleForPath } from '@/lib/rbac';

/**
 * Protects every /admin, /manager, /tl and /employee route.
 * Runs in the Edge runtime - only jose is used here (no Node APIs).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  // Not logged in -> send to login.
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Logged in but wrong role for this section -> send to their own home.
  const required = roleForPath(pathname);
  if (required && session.role !== required) {
    const url = req.nextUrl.clone();
    url.pathname = ROLE_HOME[session.role];
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/manager/:path*', '/tl/:path*', '/employee/:path*'],
};
