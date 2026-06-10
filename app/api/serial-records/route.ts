import { MovementType, RecordSource, SerialStatus } from '@prisma/client';

import { mapSerialRecord, toPrismaMovement } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getDefaultWarehouseLocationId } from '@/lib/warehouse-location';

export const dynamic = 'force-dynamic';

function isRealTrackingCode(value: string) {
  return value.trim().toLowerCase() !== 'panel';
}

export async function GET() {
  const serials = await prisma.serialRecord.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });

  return Response.json({ serials: serials.map(mapSerialRecord) });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser(request);

  if (!currentUser) {
    return jsonError('Authentication is required.', 401);
  }

  const body = await readJsonBody(request);
  const serialNo = readString(body, 'serialNo');

  if (!serialNo) {
    return jsonError('Serial number is required.');
  }

  const productCode = readString(body, 'productCode');
  const requestedModel = readString(body, 'model');
  const trackingCode = readString(body, 'trackingCode');
  const product = productCode
    ? await prisma.productModel.findFirst({
        where: { productCode },
        orderBy: { id: 'asc' },
      })
    : null;
  const movement = toPrismaMovement(readString(body, 'movement'));
  const duplicateConditions = [
    { serialNo },
    ...(trackingCode && isRealTrackingCode(trackingCode) ? [{ trackingCode }] : []),
  ];
  const duplicate = await prisma.serialRecord.findFirst({
    select: {
      serialNo: true,
      trackingCode: true,
    },
    where: {
      OR: duplicateConditions,
    },
  });

  if (duplicate?.serialNo === serialNo) {
    return jsonError('شماره سریال قبلا ثبت شده است.', 409);
  }

  if (duplicate?.trackingCode === trackingCode) {
    return jsonError('کد رهگیری قبلا ثبت شده است.', 409);
  }

  const locationId = await getDefaultWarehouseLocationId();

  const serial = await prisma.serialRecord.create({
    data: {
      docDate: readString(body, 'date'),
      documentNo: readString(body, 'documentNo'),
      customerName: readString(body, 'customerName') || 'انبار مرکزی',
      productCode: productCode || product?.productCode || '',
      modelName: requestedModel || product?.modelName || '',
      trackingCode,
      serialNo,
      movement,
      status: movement === MovementType.OUTBOUND ? SerialStatus.EXITED : SerialStatus.REGISTERED,
      source: RecordSource.MANUAL,
      productModelId: product?.id,
      locationId,
      createdBy: currentUser.username,
    },
  });

  return Response.json({ serial: mapSerialRecord(serial) }, { status: 201 });
}
