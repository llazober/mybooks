import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  
  if (request.nextUrl.pathname === '/') {
    if (session?.value) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session?.value) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
