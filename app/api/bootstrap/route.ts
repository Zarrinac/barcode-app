import { prisma } from '@/lib/prisma';
import { mapLocation, mapProductModel } from '@/lib/api-mappers';
import { canManageUsers } from '@/lib/roles';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireUser(request);

  if (auth instanceof Response) {
    return auth;
  }

  // The account list is admin-only information; models and locations are needed by anyone who
  // can reach the dashboard, so only the users half is withheld.
  const isAdmin = canManageUsers(auth.role);
  const [productModels, locations, users] = await Promise.all([
    prisma.productModel.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.warehouseLocation.findMany({
      include: {
        _count: {
          select: { serials: true },
        },
      },
      orderBy: { id: 'asc' },
    }),
    isAdmin
      ? prisma.user.findMany({
          orderBy: { id: 'asc' },
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return Response.json({
    locations: locations.map(mapLocation),
    models: productModels.map(mapProductModel),
    users,
  });
}
