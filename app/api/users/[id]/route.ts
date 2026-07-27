import { UserRole } from '@prisma/client';

import {
  isRecordNotFoundError,
  jsonError,
  parseId,
  readJsonBody,
  readString,
} from '@/lib/api-utils';
import { toPrismaUserRole } from '@/lib/api-mappers';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

function mapUser(user: { id: number; username: string; role: UserRole; isActive: boolean }) {
  return {
    id: String(user.id),
    username: user.username,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/users/[id]'>) {
  const auth = await requireAdmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid user id.');
  }

  const body = await readJsonBody(request);
  const username = readString(body, 'username');
  const role = toPrismaUserRole(readString(body, 'role'));
  const isActive = body.isActive !== false;

  if (!username) {
    return jsonError('Username is required.');
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      username,
      role,
      isActive,
      legacyFlag: isActive ? 0 : 1,
      updatedBy: auth.username,
    },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  return Response.json({ user: mapUser(user) });
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/users/[id]'>) {
  const auth = await requireAdmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid user id.');
  }

  const target = await prisma.user.findUnique({ select: { username: true }, where: { id } });

  if (!target) {
    return jsonError('این کاربر پیدا نشد.', 404);
  }

  // Deleting your own account while it is the only way back into the admin screens would lock
  // everyone out, and there is no recovery path short of editing the database by hand.
  if (target.username === auth.username) {
    return jsonError('حساب کاربری خودتان را نمی‌توانید حذف کنید.', 409);
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این کاربر پیدا نشد.', 404);
    }

    throw error;
  }

  return Response.json({ ok: true });
}
