import { config } from 'dotenv';
import { existsSync } from 'node:fs';

const hasProductionEnv = existsSync('.env.production');

config({ path: '.env.production' });
config();

if (!hasProductionEnv && process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local', override: true });
}

import { MovementType, SerialStatus } from '@prisma/client';

/**
 * Converts the legacy INBOUND rows to OUTBOUND + EXITED.
 *
 * A barcode is only ever scanned as goods leave the warehouse, so INBOUND was always the wrong
 * value — it survived only because the direction used to be taken from the device. The rows
 * predating that fix were left alone on purpose until 2026-08-05, when the user asked for one
 * consistent history instead; run it once and it has nothing left to do.
 *
 * This does not change what any duplicate check does: only TRANSFER rows are ever skipped, so an
 * INBOUND row and an OUTBOUND row block a rescanned serial identically.
 *
 * TRANSFER rows are excluded — moves between our own warehouses are a real distinction, not a
 * legacy artefact. `legacyFlag`, `updatedAt` and `updatedBy` are left untouched so the dashboard
 * does not relabel three thousand untouched rows as «ویرایش شده».
 *
 *   npx tsx scripts/backfill-legacy-outbound.ts            # preview only, writes nothing
 *   npx tsx scripts/backfill-legacy-outbound.ts --commit   # apply
 */

const isCommit = process.argv.includes('--commit');

async function main() {
  const { prisma } = await import('../lib/prisma');

  const before = await prisma.serialRecord.groupBy({
    by: ['movement', 'status'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('وضعیت فعلی:');

  for (const group of before) {
    console.log(`  ${group.movement} / ${group.status}: ${group._count._all}`);
  }

  const pending = await prisma.serialRecord.count({
    where: { movement: MovementType.INBOUND },
  });

  console.log(`\nردیف‌های INBOUND قابل تبدیل به OUTBOUND: ${pending}`);

  if (!isCommit) {
    console.log('\nپیش‌نمایش بود؛ چیزی نوشته نشد. برای اعمال، با --commit اجرا کنید.');
    return;
  }

  if (pending > 0) {
    // REGISTERED is the status those rows only ever had because the direction was wrong, so it
    // moves to EXITED with them. EDITED and CANCELLED say something a later action recorded and
    // are kept — the direction is what is being corrected here, not the row's history.
    const exited = await prisma.serialRecord.updateMany({
      data: { movement: MovementType.OUTBOUND, status: SerialStatus.EXITED },
      where: { movement: MovementType.INBOUND, status: SerialStatus.REGISTERED },
    });
    const rest = await prisma.serialRecord.updateMany({
      data: { movement: MovementType.OUTBOUND },
      where: { movement: MovementType.INBOUND },
    });

    console.log(`\n${exited.count + rest.count} ردیف به خروج تبدیل شد.`);
    console.log(`  با وضعیت «خروج شده»: ${exited.count}`);
    console.log(`  با حفظ وضعیت قبلی: ${rest.count}`);
  }

  const after = await prisma.serialRecord.groupBy({
    by: ['movement', 'status'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\nوضعیت نهایی:');

  for (const group of after) {
    console.log(`  ${group.movement} / ${group.status}: ${group._count._all}`);
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
