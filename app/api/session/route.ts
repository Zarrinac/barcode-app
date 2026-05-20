import { getCookieValue, sessionCookieName, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const session = verifySessionToken(getCookieValue(request, sessionCookieName));

  if (!session) {
    return Response.json({ authenticated: false });
  }

  return Response.json({
    authenticated: true,
    user: {
      role: session.role,
      username: session.username,
    },
  });
}
