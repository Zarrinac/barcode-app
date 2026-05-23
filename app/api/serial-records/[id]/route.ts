import { MovementType } from '@prisma/client';

import { mapSerialRecord, toPrismaMovement, toPrismaSerialStatus } from '@/lib/api-mappers';
import { jsonError, parseId, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: RouteContext<'/api/serial-records/[id]'>) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid serial record id.');
  }

  const body = await readJsonBody(request);
  const serialNo = readString(body, 'serialNo');

  if (!serialNo) {
    return jsonError('Serial number is required.');
  }

  const productCode = readString(body, 'productCode');
  const product = productCode
    ? await prisma.productModel.findFirst({
        where: { productCode },
        orderBy: { id: 'asc' },
      })
    : null;
  const movement = toPrismaMovement(readString(body, 'movement'));

  const serial = await prisma.serialRecord.update({
    where: { id },
    data: {
      docDate: readString(body, 'date'),
      documentNo: readString(body, 'documentNo'),
      customerName: readString(body, 'customerName') || 'انبار مرکزی',
      productCode,
      modelName: readString(body, 'model') || product?.modelName || '',
      trackingCode: readString(body, 'trackingCode'),
      serialNo,
      movement,
      status: toPrismaSerialStatus(
        readString(body, 'status') || (movement === MovementType.OUTBOUND ? 'خروج شده' : 'ثبت شده'),
      ),
      productModelId: product?.id,
      legacyFlag: 1,
      updatedBy: 'admin',
    },
  });

  return Response.json({ serial: mapSerialRecord(serial) });
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/serial-records/[id]'>) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid serial record id.');
  }

  await prisma.serialRecord.delete({ where: { id } });

  return Response.json({ ok: true });
}
