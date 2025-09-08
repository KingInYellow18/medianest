import { NextRequest, NextResponse } from 'next/server';

// Performance monitoring and optimization middleware
export function middleware(request: NextRequest) {
  const startTime = Date.now();

  // Security headers for performance
  const response = NextResponse.next();

  // Performance headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Compression hints
  response.headers.set('Vary', 'Accept-Encoding');

  // Resource hints for critical assets
  if (request.nextUrl.pathname === '/') {
    response.headers.set(
      'Link',
      '</api/user>; rel=preload; as=fetch; crossorigin, ' +
        '</api/dashboard>; rel=preload; as=fetch; crossorigin'
    );
  }

  // Performance timing
  const duration = Date.now() - startTime;
  response.headers.set('X-Response-Time', `${duration}ms`);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
