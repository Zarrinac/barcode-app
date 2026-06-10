import { mapLocation } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    },
    include: {
      _count: {
        select: { serials: true },
      },
    },
  });

  return Response.json({ location: mapLocation(location) }, { status: 201 });
}
