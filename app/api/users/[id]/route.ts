import { UserRole } from '@prisma/client';

import { jsonError, parseId, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

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
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid user id.');
  }

  const body = await readJsonBody(request);
  const username = readString(body, 'username');
  const role = readString(body, 'role').toUpperCase() === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;
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
      updatedBy: 'admin',
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

export async function DELETE(_request: Request, ctx: RouteContext<'/api/users/[id]'>) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid user id.');
  }

  await prisma.user.delete({ where: { id } });

  return Response.json({ ok: true });
}
