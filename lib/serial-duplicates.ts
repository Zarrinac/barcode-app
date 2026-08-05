import { MovementType, SerialStatus } from '@prisma/client';

import { persianCompareKey } from '@/lib/persian-text';
import type { InternalWarehouse } from '@/lib/warehouse-location';

/**
 * A serial number is not unique in serial_records, and deliberately so.
 *
 * Goods moved between our own warehouses («انبار قزوین» → «انبار زرین شورآباد») are scanned on
 * their way out of the first warehouse even though they never leave the company. If those rows
 * blocked the serial the way a real exit does, the operator at the second warehouse could never
 * record the actual exit to the customer — which is exactly the error this scoping removes.
 *
 * So a scan is compared only against rows in the same "exit scope":
 *   - a real exit to a customer is blocked by any earlier non-transfer row (unchanged behaviour,
 *     including the legacy INBOUND rows imported before 2026-07-27);
 *   - a transfer is blocked by an earlier transfer to the *same* warehouse — that is the same
 *     batch being scanned twice — and by any real exit, since the goods have already left.
 */
export type ExitScope = string;

const realExitScope: ExitScope = 'exit';

function transferScope(warehouseName: string): ExitScope {
  return `transfer:${persianCompareKey(warehouseName)}`;
}

/** The scope an already-stored row occupies. */
export function scopeOfRecord(record: { movement: MovementType; customerName: string }): ExitScope {
  return record.movement === MovementType.TRANSFER
    ? transferScope(record.customerName)
    : realExitScope;
}

/** The scope a new scan will occupy once it is written. */
export function scopeForDestination(destination: InternalWarehouse | null): ExitScope {
  return destination ? transferScope(destination.name) : realExitScope;
}

/** The scopes a new scan collides with, given the destination it resolved to. */
export function blockingScopes(destination: InternalWarehouse | null): ExitScope[] {
  return destination ? [realExitScope, transferScope(destination.name)] : [realExitScope];
}

export function isBlockedBy(
  existingScopes: Iterable<ExitScope>,
  destination: InternalWarehouse | null,
) {
  const blocking = new Set(blockingScopes(destination));

  for (const scope of existingScopes) {
    if (blocking.has(scope)) {
      return true;
    }
  }

  return false;
}

/**
 * What a scan is recorded as. The destination decides it server-side — the same reason
 * POST /api/serial-records ignores the movement the device sends: an M3 running an older APK has
 * no idea the warehouse it is shipping to is one of ours.
 */
export function classifyDestination(destination: InternalWarehouse | null) {
  return destination
    ? { movement: MovementType.TRANSFER, status: SerialStatus.TRANSFERRED }
    : { movement: MovementType.OUTBOUND, status: SerialStatus.EXITED };
}

/**
 * Groups the rows an existing-serial lookup returned into scope sets, so each candidate scan can be
 * tested against only the rows that actually conflict with it.
 */
export function groupScopesByKey<T extends { movement: MovementType; customerName: string }>(
  records: T[],
  keyOf: (record: T) => string,
) {
  const scopes = new Map<string, Set<ExitScope>>();

  for (const record of records) {
    const key = keyOf(record);
    const existing = scopes.get(key);

    if (existing) {
      existing.add(scopeOfRecord(record));
    } else {
      scopes.set(key, new Set([scopeOfRecord(record)]));
    }
  }

  return scopes;
}
