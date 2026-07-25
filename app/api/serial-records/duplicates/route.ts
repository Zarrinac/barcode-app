import { jsonError, readJsonBody } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

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

  const duplicates = await prisma.serialRecord.findMany({
    select: {
      serialNo: true,
      trackingCode: true,
    },
    where: {
      OR: [
        ...(serialNos.length > 0 ? [{ serialNo: { in: serialNos } }] : []),
        ...(trackingCodes.length > 0 ? [{ trackingCode: { in: trackingCodes } }] : []),
      ],
    },
  });

  const duplicateSerialNos = new Set<string>();
  const duplicateTrackingCodes = new Set<string>();

  for (const duplicate of duplicates) {
    if (serialNos.includes(duplicate.serialNo)) {
      duplicateSerialNos.add(duplicate.serialNo);
    }

    if (trackingCodes.includes(duplicate.trackingCode)) {
      duplicateTrackingCodes.add(duplicate.trackingCode);
    }
  }

  return Response.json({
    serialNos: Array.from(duplicateSerialNos),
    trackingCodes: Array.from(duplicateTrackingCodes),
  });
}
