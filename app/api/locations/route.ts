import { mapLocation } from '@/lib/api-mappers';
import { jsonError, readBoolean, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { requireManager, requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireUser(request);

  if (auth instanceof Response) {
    return auth;
  }

  const locations = await prisma.warehouseLocation.findMany({
    include: {
      _count: {
        select: { serials: true },
      },
    },
    orderBy: { id: 'asc' },
  });

  return Response.json({ locations: locations.map(mapLocation) });
}

export async function POST(request: Request) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const code = readString(body, 'code').toUpperCase();
  const name = readString(body, 'name');

  if (!code || !name) {
    return jsonError('Location code and name are required.');
  }

  const location = await prisma.warehouseLocation.create({
    data: {
      code,
      name,
      description: readString(body, 'description') || null,
      // Marks the location as one of ours: scans addressed to it become transfers, not exits.
      isInternal: readBoolean(body, 'isInternal'),
    },
    include: {
      _count: {
        select: { serials: true },
      },
    },
  });

  return Response.json({ location: mapLocation(location) }, { status: 201 });
}
