import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return Response.json({ authenticated: false });
  }

  return Response.json({
    authenticated: true,
    user: {
      role: user.role,
      username: user.username,
    },
  });
}
