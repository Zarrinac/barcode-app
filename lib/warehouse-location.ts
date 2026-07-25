import { prisma } from '@/lib/prisma';

export async function getDefaultWarehouseLocationId() {
  const location = await prisma.warehouseLocation.upsert({
    create: {
      code: 'MAIN',
      name: 'انبار',
    },
    select: {
      id: true,
    },
    update: {},
    where: {
      code: 'MAIN',
    },
  });

  return location.id;
}
