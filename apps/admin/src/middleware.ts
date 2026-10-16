import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Vexora Admin Console Middleware — Phase 9
 *
 * Enforces:
 * 1. CSRF verification on state-changing requests
 * 2. Origin validation for admin mutations
 * 3. Security header verification
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 1. Clickjacking protection: frame-ancestors / X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 2. CSRF & Origin validation for mutating requests (POST, PUT, PATCH, DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Reject if cross-origin mutation without trusted origin
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host && !originUrl.host.includes('localhost')) {
          return new NextResponse(
            JSON.stringify({ error: 'CSRF_BLOCKED', message: 'Cross-origin mutation rejected' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ error: 'INVALID_ORIGIN', message: 'Malformed origin header' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
