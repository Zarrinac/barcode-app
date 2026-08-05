import { persianCompareKey } from '@/lib/persian-text';
import { prisma } from '@/lib/prisma';

export type InternalWarehouse = {
  id: number;
  name: string;
};

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

/**
 * The warehouses we own, keyed by the normalized name operators type into the customer field.
 * warehouse_locations is a handful of rows, so this is read per request rather than cached — an
 * admin marking a new warehouse internal takes effect on the next scan, not after a restart.
 */
export async function loadInternalWarehouses() {
  const locations = await prisma.warehouseLocation.findMany({
    select: { id: true, name: true },
    where: { isInternal: true },
  });
  const byName = new Map<string, InternalWarehouse>();

  for (const location of locations) {
    byName.set(persianCompareKey(location.name), location);
  }

  return byName;
}

export function matchInternalWarehouse(
  internalWarehouses: Map<string, InternalWarehouse>,
  customerName: string,
) {
  return internalWarehouses.get(persianCompareKey(customerName)) ?? null;
}

/** Single-record form of matchInternalWarehouse(), for routes that handle one scan at a time. */
export async function findInternalWarehouse(customerName: string) {
  if (!customerName.trim()) {
    return null;
  }

  return matchInternalWarehouse(await loadInternalWarehouses(), customerName);
}
