import { config } from 'dotenv';
import { existsSync } from 'node:fs';

const hasProductionEnv = existsSync('.env.production');

config({ path: '.env.production' });
config();

if (!hasProductionEnv && process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local', override: true });
}

import { MovementType, SerialStatus } from '@prisma/client';

import { warehouseNameKey } from '../lib/persian-text';

/**
 * Registers our own warehouses and reclassifies the rows that were recorded as exits while the
 * goods were only moving between them.
 *
 * Until this ran, a serial moved from «انبار قزوین» to «انبار زرین شورآباد» had an OUTBOUND row,
 * and the duplicate check rejected the warehouse that later shipped it to the actual customer —
 * the operator simply could not record the real exit. Converting those rows to TRANSFER frees the
 * serial without deleting any history: the transfer stays visible in the list and the export.
 *
 *   npx tsx scripts/mark-internal-warehouses.ts            # preview only, writes nothing
 *   npx tsx scripts/mark-internal-warehouses.ts --commit   # apply
 */

const internalWarehouses = [
  { code: 'QAZVIN', name: 'انبار قزوین' },
  { code: 'ZARRIN-SHOURABAD', name: 'انبار زرین شورآباد' },
];

const isCommit = process.argv.includes('--commit');

async function main() {
  const { prisma } = await import('../lib/prisma');

  for (const warehouse of internalWarehouses) {
    if (isCommit) {
      await prisma.warehouseLocation.upsert({
        create: { code: warehouse.code, name: warehouse.name, isInternal: true },
        update: { name: warehouse.name, isInternal: true },
        where: { code: warehouse.code },
      });
    }

    console.log(
      `${isCommit ? 'انبار داخلی ثبت شد' : 'انبار داخلی (پیش‌نمایش)'}: ${warehouse.name}`,
    );
  }

  // Matched on the normalized name so every spelling an operator typed is caught, which a plain
  // equality filter in the query would miss.
  const internalKeys = new Set(
    internalWarehouses.map((warehouse) => warehouseNameKey(warehouse.name)),
  );
  const candidates = await prisma.serialRecord.findMany({
    select: { id: true, customerName: true, movement: true },
    where: { movement: { not: MovementType.TRANSFER } },
  });
  const matched = candidates.filter((record) =>
    internalKeys.has(warehouseNameKey(record.customerName)),
  );
  // Broken down by the exact spelling and direction, because that is what tells a reviewer the
  // match caught every variant of a warehouse and no customer who merely shares a word with one.
  const byName = new Map<string, number>();

  for (const record of matched) {
    const key = `${record.customerName} [${record.movement}]`;

    byName.set(key, (byName.get(key) ?? 0) + 1);
  }

  console.log(`\nردیف‌های قابل تبدیل به انتقال بین انبار: ${matched.length}`);

  for (const [name, count] of [...byName].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  if (!isCommit) {
    console.log('\nپیش‌نمایش بود؛ چیزی نوشته نشد. برای اعمال، با --commit اجرا کنید.');
    return;
  }

  if (matched.length > 0) {
    const updated = await prisma.serialRecord.updateMany({
      data: { movement: MovementType.TRANSFER, status: SerialStatus.TRANSFERRED },
      where: { id: { in: matched.map((record) => record.id) } },
    });

    console.log(`\n${updated.count} ردیف به انتقال بین انبار تبدیل شد.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import('../lib/prisma');

    await prisma.$disconnect();
  });
