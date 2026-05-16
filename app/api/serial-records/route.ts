import { MovementType, RecordSource, SerialStatus } from '@prisma/client';

import { mapSerialRecord, toPrismaMovement } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const serials = await prisma.serialRecord.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });

  return Response.json({ serials: serials.map(mapSerialRecord) });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const serialNo = readString(body, 'serialNo');

  if (!serialNo) {
    return jsonError('Serial number is required.');
  }

  const productCode = readString(body, 'productCode');
  const requestedModel = readString(body, 'model');
  const product = productCode
    ? await prisma.productModel.findFirst({
        where: { productCode },
        orderBy: { id: 'asc' },
      })
    : null;
  const movement = toPrismaMovement(readString(body, 'movement'));

  const serial = await prisma.serialRecord.create({
    data: {
      docDate: readString(body, 'date'),
      documentNo: readString(body, 'documentNo'),
      customerName: readString(body, 'customerName') || 'انبار مرکزی',
      productCode: productCode || product?.productCode || '',
      modelName: requestedModel || product?.modelName || '',
      trackingCode: readString(body, 'trackingCode'),
      serialNo,
      movement,
      status: movement === MovementType.OUTBOUND ? SerialStatus.EXITED : SerialStatus.REGISTERED,
      source: RecordSource.MANUAL,
      productModelId: product?.id,
      createdBy: 'admin',
      updatedBy: 'admin',
    },
  });

  return Response.json({ serial: mapSerialRecord(serial) }, { status: 201 });
}
