import { MovementType, RecordSource, SerialStatus } from '@prisma/client';

import { mapProductModel, mapSerialRecord, toPersianDate } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getDefaultWarehouseLocationId } from '@/lib/warehouse-location';

export const dynamic = 'force-dynamic';

type ScanMode = 'lookup' | 'inbound' | 'outbound';

function normalizeBarcode(value: string) {
  return value.replace(/[\r\n\t]/g, '').trim();
}

function getMovement(mode: ScanMode) {
  return mode === 'outbound' ? MovementType.OUTBOUND : MovementType.INBOUND;
}

function getStatus(mode: ScanMode) {
  return mode === 'outbound' ? SerialStatus.EXITED : SerialStatus.REGISTERED;
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
  const barcode = normalizeBarcode(readString(body, 'barcode'));
  const requestedMode = readString(body, 'mode') as ScanMode;
  const mode: ScanMode = ['lookup', 'inbound', 'outbound'].includes(requestedMode)
    ? requestedMode
    : 'lookup';
  const contextProductCode = normalizeBarcode(readString(body, 'productCode'));
  const contextModelName = readString(body, 'model');
  const contextTrackingCode = normalizeBarcode(readString(body, 'trackingCode'));

  if (!barcode) {
    return jsonError('Barcode is required.');
  }

  const [existingSerial, matchedProduct, contextProduct] = await Promise.all([
    prisma.serialRecord.findFirst({
      where: {
        OR: [{ serialNo: barcode }, { trackingCode: barcode }],
      },
      orderBy: { id: 'desc' },
    }),
    prisma.productModel.findFirst({
      where: {
        OR: [{ productCode: barcode }, { warrantyCode: barcode }, { modelName: barcode }],
      },
      orderBy: { id: 'asc' },
    }),
    contextProductCode
      ? prisma.productModel.findFirst({
          where: { productCode: contextProductCode },
          orderBy: { id: 'asc' },
        })
      : null,
  ]);
  const activeProduct = contextProduct || matchedProduct;
  const isKnownTrackingCode = Boolean(
    matchedProduct?.warrantyCode && matchedProduct.warrantyCode === barcode,
  );
  const isNumericBarcode = /^\d+$/.test(barcode);

  if (mode === 'lookup') {
    return Response.json({
      action: existingSerial || matchedProduct ? 'FOUND' : 'NOT_FOUND',
      barcode,
      matchedModel: matchedProduct ? mapProductModel(matchedProduct) : null,
      message:
        existingSerial || matchedProduct ? 'بارکد پیدا شد.' : 'بارکد در اطلاعات فعلی پیدا نشد.',
      serial: existingSerial ? mapSerialRecord(existingSerial) : null,
    });
  }

  if (isNumericBarcode) {
    if (matchedProduct) {
      return Response.json({
        action: isKnownTrackingCode ? 'TRACKING_SELECTED' : 'PRODUCT_SELECTED',
        barcode,
        matchedModel: mapProductModel(matchedProduct),
        message: isKnownTrackingCode
          ? 'کد رهگیری شناسایی شد. برای ثبت کالا شماره سریال را اسکن کنید.'
          : 'شناسه کالا شناسایی شد. برای ثبت کالا شماره سریال را اسکن کنید.',
        serial: null,
        trackingCode: isKnownTrackingCode ? barcode : null,
      });
    }

    if (activeProduct) {
      return Response.json({
        action: 'TRACKING_SELECTED',
        barcode,
        matchedModel: mapProductModel(activeProduct),
        message: 'کد رهگیری شناسایی شد. برای ثبت کالا شماره سریال را اسکن کنید.',
        serial: null,
        trackingCode: barcode,
      });
    }

    return Response.json({
      action: 'NOT_FOUND',
      barcode,
      matchedModel: null,
      message: 'این بارکد عددی به عنوان شناسه کالا یا کد رهگیری شناخته نشد.',
      serial: null,
    });
  }

  if (!existingSerial && matchedProduct) {
    return Response.json({
      action: isKnownTrackingCode ? 'TRACKING_SELECTED' : 'PRODUCT_SELECTED',
      barcode,
      matchedModel: mapProductModel(matchedProduct),
      message: isKnownTrackingCode
        ? 'کد رهگیری شناسایی شد. برای ثبت کالا شماره سریال را اسکن کنید.'
        : 'شناسه کالا شناسایی شد. برای ثبت کالا شماره سریال را اسکن کنید.',
      serial: null,
      trackingCode: isKnownTrackingCode ? barcode : null,
    });
  }

  const movement = getMovement(mode);
  const duplicateTrackingCode =
    contextTrackingCode && isRealTrackingCode(contextTrackingCode)
      ? await prisma.serialRecord.findFirst({
          select: {
            trackingCode: true,
          },
          where: {
            trackingCode: contextTrackingCode,
          },
        })
      : null;

  if (existingSerial?.serialNo === barcode) {
    return jsonError('شماره سریال قبلا ثبت شده است.', 409);
  }

  if (
    existingSerial?.trackingCode === barcode ||
    duplicateTrackingCode?.trackingCode === contextTrackingCode
  ) {
    return jsonError('کد رهگیری قبلا ثبت شده است.', 409);
  }

  const locationId = existingSerial?.locationId || (await getDefaultWarehouseLocationId());

  const serial = await prisma.serialRecord.create({
    data: {
      docDate: toPersianDate(new Date()),
      documentNo: '',
      customerName: existingSerial?.customerName || 'انبار مرکزی',
      productCode: activeProduct?.productCode || existingSerial?.productCode || contextProductCode,
      modelName: activeProduct?.modelName || existingSerial?.modelName || contextModelName,
      trackingCode: existingSerial?.trackingCode || contextTrackingCode,
      serialNo: existingSerial?.serialNo || barcode,
      movement,
      status: getStatus(mode),
      source: RecordSource.PDA,
      productModelId: activeProduct?.id || existingSerial?.productModelId || undefined,
      locationId,
      createdBy: currentUser.username,
    },
  });

  return Response.json(
    {
      action: mode === 'outbound' ? 'OUTBOUND_CREATED' : 'INBOUND_CREATED',
      barcode,
      matchedModel: activeProduct ? mapProductModel(activeProduct) : null,
      message: mode === 'outbound' ? 'خروج با اسکن ثبت شد.' : 'ورود با اسکن ثبت شد.',
      serial: mapSerialRecord(serial),
    },
    { status: 201 },
  );
}
