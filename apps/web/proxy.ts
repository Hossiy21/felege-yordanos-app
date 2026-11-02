import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
} from '@/lib/i18n/config';

/**
 * Fast, optimistic route guard. It only checks that a session cookie exists
 * (no database or network call), so every navigation stays quick.
 *
 * It is NOT the security boundary. Layouts, pages and server actions must
 * still call requireUser() / requireRole() from lib/session.ts, which
 * validate the session for real.
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/join', // pre-member self-registration (session QR)
  '/up', // health check (Kamal, uptime monitoring)
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)),
  );

  // Note: sending signed-in users away from / and /login happens in those
  // pages (after a real session check), not here. A stale cookie would
  // otherwise cause a redirect loop between /login and /dashboard.
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ?lang=en / ?lang=am opens the page in that language right away (no
  // redirect) and remembers it. Used for links such as /privacy?lang=en for
  // Google's OAuth reviewers, who may not read the Amharic default.
  const lang = request.nextUrl.searchParams.get('lang');
  if (isLocale(lang)) {
    request.cookies.set(LOCALE_COOKIE, lang);
    const response = NextResponse.next({
      request: { headers: request.headers },
    });
    response.cookies.set(LOCALE_COOKIE, lang, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except auth API, Next internals and static files.
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest\\.(?:json|webmanifest)|sw\\.js|workbox-.*|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
