import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/config';

const { auth } = NextAuth(authConfig);

/** Guards every host-only route; everything else stays public. */
export default auth((request) => {
  const signedIn = Boolean(request.auth?.user);
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/present');
  const isAuthPage = pathname === '/sign-in' || pathname === '/sign-up';

  if (isProtected && !signedIn) {
    const url = new URL('/sign-in', request.nextUrl.origin);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && signedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/present/:path*',
    '/sign-in',
    '/sign-up',
  ],
};
