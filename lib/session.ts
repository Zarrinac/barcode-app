import { getCookieValue, sessionCookieName, verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type CurrentUser = {
  role: string;
  username: string;
};

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const session = verifySessionToken(getCookieValue(request, sessionCookieName));

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    select: {
      isActive: true,
      role: true,
      username: true,
    },
    where: {
      username: session.username,
    },
  });

  if (!user?.isActive) {
    return null;
  }

  return {
    role: user.role,
    username: user.username,
  };
}
