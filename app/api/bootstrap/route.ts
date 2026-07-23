import { prisma } from '@/lib/prisma';
import { mapLocation, mapProductModel, mapSerialRecord } from '@/lib/api-mappers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [productModels, serialRecords, locations, users] = await Promise.all([
    prisma.productModel.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.serialRecord.findMany({
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
    prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
      },
    }),
  ]);

  return Response.json({
    locations: locations.map(mapLocation),
    models: productModels.map(mapProductModel),
    serials: serialRecords.map(mapSerialRecord),
    users,
  });
}
