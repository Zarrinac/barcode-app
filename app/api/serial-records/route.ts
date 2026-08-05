import { RecordSource } from '@prisma/client';

import { mapSerialRecord } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { findModelNamesByProductCode, resolveModelName } from '@/lib/model-name';
import { prisma } from '@/lib/prisma';
import { classifyDestination, isBlockedBy, scopeOfRecord } from '@/lib/serial-duplicates';
import { buildSerialRecordWhere, readSerialRecordFilters } from '@/lib/serial-records-query';
import { getCurrentUser, requireUser } from '@/lib/session';
import { findInternalWarehouse, getDefaultWarehouseLocationId } from '@/lib/warehouse-location';

export const dynamic = 'force-dynamic';

const defaultPageSize = 20;
const maxPageSize = 200;

function isRealTrackingCode(value: string) {
  return value.trim().toLowerCase() !== 'panel';
}

function readPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const page = readPositiveInt(searchParams.get('page'), 1);
  const pageSize = Math.min(
    maxPageSize,
    readPositiveInt(searchParams.get('pageSize'), defaultPageSize),
  );
  const where = buildSerialRecordWhere(readSerialRecordFilters(searchParams));

  const [serials, filteredTotal, total] = await Promise.all([
    prisma.serialRecord.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.serialRecord.count({ where }),
    prisma.serialRecord.count(),
  ]);

  const modelNames = await findModelNamesByProductCode(serials.map((serial) => serial.productCode));

  return Response.json({
    serials: serials.map((serial) => mapSerialRecord(serial, resolveModelName(serial, modelNames))),
    filteredTotal,
    total,
    page,
    pageSize,
  });
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
  const requestedCustomerName = readString(body, 'customerName');
  const product = productCode
    ? await prisma.productModel.findFirst({
        where: { productCode },
        orderBy: { id: 'asc' },
      })
    : null;
  // A serial is only ever recorded as it leaves the warehouse, so the movement is decided here
  // rather than taken from the request. Deciding it server-side means records are correct from
  // the moment this deploys, without waiting for every M3 device to get the rebuilt APK — older
  // builds still send "ورود" and would otherwise keep writing the wrong direction.
  //
  // Shipping to one of our own warehouses is not a real exit though: it is a TRANSFER, which the
  // duplicate scoping below lets the destination warehouse record a real exit for later on.
  const destination = await findInternalWarehouse(requestedCustomerName);
  const { movement, status } = classifyDestination(destination);
  const duplicateConditions = [
    { serialNo },
    ...(trackingCode && isRealTrackingCode(trackingCode) ? [{ trackingCode }] : []),
  ];
  // A serial has at most a handful of rows, so the conflicting scopes are worked out in memory
  // with the same helpers the batch endpoints use rather than encoded into the query.
  const existing = await prisma.serialRecord.findMany({
    select: {
      serialNo: true,
      trackingCode: true,
      movement: true,
      customerName: true,
    },
    where: {
      OR: duplicateConditions,
    },
  });
  const blockingSerial = existing.filter((record) => record.serialNo === serialNo);
  const blockingTracking = existing.filter((record) => record.trackingCode === trackingCode);

  if (isBlockedBy(blockingSerial.map(scopeOfRecord), destination)) {
    return jsonError(
      destination
        ? `شماره سریال قبلا به ${destination.name} منتقل شده یا از انبار خارج شده است.`
        : 'شماره سریال قبلا ثبت شده است.',
      409,
    );
  }

  if (
    trackingCode &&
    isRealTrackingCode(trackingCode) &&
    isBlockedBy(blockingTracking.map(scopeOfRecord), destination)
  ) {
    return jsonError('کد رهگیری قبلا ثبت شده است.', 409);
  }

  const locationId = await getDefaultWarehouseLocationId();

  const serial = await prisma.serialRecord.create({
    data: {
      docDate: readString(body, 'date'),
      documentNo: readString(body, 'documentNo'),
      // An internal destination is stored under the warehouse's own name so the spelling operators
      // typed cannot fragment a transfer across several near-identical customer names.
      customerName: destination?.name || requestedCustomerName || 'انبار مرکزی',
      productCode: productCode || product?.productCode || '',
      // product_models wins over the value the device sent: a device whose cached model list is
      // stale (or an older APK) posts the product code here, which then shows up as a number in
      // the model column of every Excel export.
      modelName: product?.modelName || requestedModel || '',
      trackingCode,
      serialNo,
      movement,
      status,
      source: RecordSource.MANUAL,
      productModelId: product?.id,
      locationId,
      createdBy: currentUser.username,
    },
  });

  return Response.json({ serial: mapSerialRecord(serial) }, { status: 201 });
}
