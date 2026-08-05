import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { groupScopesByKey, isBlockedBy } from '@/lib/serial-duplicates';
import { getCurrentUser } from '@/lib/session';
import { findInternalWarehouse } from '@/lib/warehouse-location';

export const dynamic = 'force-dynamic';

function readStringList(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()),
    ),
  ).filter(Boolean);
}

function isRealTrackingCode(value: string) {
  return value.trim().toLowerCase() !== 'panel';
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser(request);

  if (!currentUser) {
    return jsonError('Authentication is required.', 401);
  }

  const body = await readJsonBody(request);
  const serialNos = readStringList(body, 'serialNos');
  const trackingCodes = readStringList(body, 'trackingCodes').filter(isRealTrackingCode);

  if (serialNos.length === 0 && trackingCodes.length === 0) {
    return Response.json({ serialNos: [], trackingCodes: [] });
  }

  // Batches sent by an older APK carry no customer name; those are checked as real exits, which is
  // the stricter reading. POST /api/serial-records always knows the destination and stays the
  // authoritative guard — this endpoint only saves the operator a round trip per row.
  const destination = await findInternalWarehouse(readString(body, 'customerName'));
  const candidates = await prisma.serialRecord.findMany({
    select: {
      serialNo: true,
      trackingCode: true,
      movement: true,
      customerName: true,
    },
    where: {
      OR: [
        ...(serialNos.length > 0 ? [{ serialNo: { in: serialNos } }] : []),
        ...(trackingCodes.length > 0 ? [{ trackingCode: { in: trackingCodes } }] : []),
      ],
    },
  });

  const scopesBySerialNo = groupScopesByKey(candidates, (record) => record.serialNo);
  const scopesByTrackingCode = groupScopesByKey(candidates, (record) => record.trackingCode);
  const duplicateSerialNos = serialNos.filter((serialNo) =>
    isBlockedBy(scopesBySerialNo.get(serialNo) ?? [], destination),
  );
  const duplicateTrackingCodes = trackingCodes.filter((trackingCode) =>
    isBlockedBy(scopesByTrackingCode.get(trackingCode) ?? [], destination),
  );

  return Response.json({
    serialNos: duplicateSerialNos,
    trackingCodes: duplicateTrackingCodes,
  });
}
