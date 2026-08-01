import { mapSerialRecord, toPrismaMovement } from '@/lib/api-mappers';
import {
  isRecordNotFoundError,
  jsonError,
  parseId,
  readJsonBody,
  readString,
} from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireManager } from '@/lib/session';

export const dynamic = 'force-dynamic';

function isRealTrackingCode(value: string) {
  return value.trim().toLowerCase() !== 'panel';
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/serial-records/[id]'>) {
  const currentUser = await getCurrentUser(request);

  if (!currentUser) {
    return jsonError('Authentication is required.', 401);
  }

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
  const trackingCode = readString(body, 'trackingCode');
  const product = productCode
    ? await prisma.productModel.findFirst({
        where: { productCode },
        orderBy: { id: 'asc' },
      })
    : null;
  const movement = toPrismaMovement(readString(body, 'movement'));
  const duplicate = await prisma.serialRecord.findFirst({
    select: {
      serialNo: true,
      trackingCode: true,
    },
    where: {
      id: { not: id },
      OR: [
        { serialNo },
        ...(trackingCode && isRealTrackingCode(trackingCode) ? [{ trackingCode }] : []),
      ],
    },
  });

  if (duplicate?.serialNo === serialNo) {
    return jsonError('شماره سریال قبلا ثبت شده است.', 409);
  }

  if (duplicate?.trackingCode === trackingCode) {
    return jsonError('کد رهگیری قبلا ثبت شده است.', 409);
  }

  try {
    const serial = await prisma.serialRecord.update({
      where: { id },
      data: {
        docDate: readString(body, 'date'),
        documentNo: readString(body, 'documentNo'),
        customerName: readString(body, 'customerName') || 'انبار مرکزی',
        productCode,
        modelName: product?.modelName || readString(body, 'model') || '',
        trackingCode,
        serialNo,
        movement,
        productModelId: product?.id,
        legacyFlag: 1,
        updatedAt: new Date(),
        updatedBy: currentUser.username,
      },
    });

    return Response.json({ serial: mapSerialRecord(serial) });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این سریال پیدا نشد. صفحه را تازه کنید.', 404);
    }

    throw error;
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/serial-records/[id]'>) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid serial record id.');
  }

  try {
    await prisma.serialRecord.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این سریال پیدا نشد. صفحه را تازه کنید.', 404);
    }

    throw error;
  }

  return Response.json({ ok: true });
}
