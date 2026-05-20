import { createCookieHeader, legacyLoginCookieName, sessionCookieName } from '@/lib/auth';

function redirectWithLogout(request: Request) {
  const headers = new Headers();

  headers.set('Location', '/');
  headers.append(
    'Set-Cookie',
    createCookieHeader(request, sessionCookieName, '', { httpOnly: true, maxAge: 0 }),
  );
  headers.append(
    'Set-Cookie',
    createCookieHeader(request, legacyLoginCookieName, '', { maxAge: 0 }),
  );

  return new Response(null, { headers, status: 303 });
}

export function GET(request: Request) {
  return redirectWithLogout(request);
}

export function POST(request: Request) {
  return redirectWithLogout(request);
}
