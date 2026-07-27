import { getCookieValue, sessionCookieName, verifySessionToken } from '@/lib/auth';
import { jsonError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { adminRole as adminRoleName, canManageData } from '@/lib/roles';

export type CurrentUser = {
  role: string;
  username: string;
};

export { adminRole, managerRole } from '@/lib/roles';

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

/**
 * Route guards. Each returns either the caller or the error Response to hand straight back, so a
 * handler cannot accidentally continue past a failed check:
 *
 *   const auth = await requireAdmin(request);
 *   if (auth instanceof Response) return auth;
 *
 * requireUser  — any signed-in account, including scanner operators.
 * requireManager — ADMIN or MANAGER: warehouse data (serials, models, locations, Excel import).
 * requireAdmin — ADMIN only, reserved for user management.
 */
export async function requireUser(request: Request): Promise<CurrentUser | Response> {
  return (await getCurrentUser(request)) ?? jsonError('Authentication is required.', 401);
}

export async function requireManager(request: Request): Promise<CurrentUser | Response> {
  const user = await requireUser(request);

  if (user instanceof Response) {
    return user;
  }

  if (!canManageData(user.role)) {
    return jsonError('دسترسی لازم برای این عملیات را ندارید.', 403);
  }

  return user;
}

export async function requireAdmin(request: Request): Promise<CurrentUser | Response> {
  const user = await requireUser(request);

  if (user instanceof Response) {
    return user;
  }

  if (user.role !== adminRoleName) {
    return jsonError('این عملیات فقط برای مدیر سیستم مجاز است.', 403);
  }

  return user;
}
