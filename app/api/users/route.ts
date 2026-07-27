import { UserRole } from '@prisma/client';

import { toPrismaUserRole } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
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

export async function GET(request: Request) {
  const auth = await requireAdmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  return Response.json({ users: users.map(mapUser) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const username = readString(body, 'username');
  const passwordHash = readString(body, 'passwordHash');
  const role = toPrismaUserRole(readString(body, 'role'));

  if (!username || !passwordHash) {
    return jsonError('Username and passwordHash are required.');
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role,
      createdBy: auth.username,
      updatedBy: auth.username,
    },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  return Response.json({ user: mapUser(user) }, { status: 201 });
}
