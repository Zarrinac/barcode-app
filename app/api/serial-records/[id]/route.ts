import { MovementType, SerialStatus } from '@prisma/client';

import { mapSerialRecord, toPrismaMovement } from '@/lib/api-mappers';
import {
  isRecordNotFoundError,
  jsonError,
  parseId,
  readJsonBody,
  readString,
} from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { isBlockedBy, scopeOfRecord } from '@/lib/serial-duplicates';
import { getCurrentUser, requireManager } from '@/lib/session';
import { findInternalWarehouse } from '@/lib/warehouse-location';

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
  const requestedCustomerName = readString(body, 'customerName');
  // The destination decides the movement here too: pointing a row at one of our warehouses makes it
  // a transfer, and pointing it back at a customer makes it a real exit again. Only those two cases
  // are rewritten — a legacy INBOUND row edited for a typo keeps its direction.
  const destination = await findInternalWarehouse(requestedCustomerName);
  const requestedMovement = toPrismaMovement(readString(body, 'movement'));
  const movement = destination
    ? MovementType.TRANSFER
    : requestedMovement === MovementType.TRANSFER
      ? MovementType.OUTBOUND
      : requestedMovement;
  const existing = await prisma.serialRecord.findMany({
    select: {
      serialNo: true,
      trackingCode: true,
      movement: true,
      customerName: true,
    },
    where: {
      id: { not: id },
      OR: [
        { serialNo },
        ...(trackingCode && isRealTrackingCode(trackingCode) ? [{ trackingCode }] : []),
      ],
    },
  });

  if (
    isBlockedBy(
      existing.filter((record) => record.serialNo === serialNo).map(scopeOfRecord),
      destination,
    )
  ) {
    return jsonError('شماره سریال قبلا ثبت شده است.', 409);
  }

  if (
    trackingCode &&
    isRealTrackingCode(trackingCode) &&
    isBlockedBy(
      existing.filter((record) => record.trackingCode === trackingCode).map(scopeOfRecord),
      destination,
    )
  ) {
    return jsonError('کد رهگیری قبلا ثبت شده است.', 409);
  }

  try {
    const serial = await prisma.serialRecord.update({
      where: { id },
      data: {
        docDate: readString(body, 'date'),
        documentNo: readString(body, 'documentNo'),
        customerName: destination?.name || requestedCustomerName || 'انبار مرکزی',
        productCode,
        modelName: product?.modelName || readString(body, 'model') || '',
        trackingCode,
        serialNo,
        movement,
        // Left undefined for INBOUND so an edited legacy row keeps whatever status it was imported
        // with; the two directions this route can rewrite get the status that matches.
        status:
          movement === MovementType.TRANSFER
            ? SerialStatus.TRANSFERRED
            : movement === MovementType.OUTBOUND
              ? SerialStatus.EXITED
              : undefined,
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
