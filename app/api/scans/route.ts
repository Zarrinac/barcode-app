import { MovementType, RecordSource, SerialStatus } from '@prisma/client';

import { mapProductModel, mapSerialRecord, toPersianDate } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

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

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const barcode = normalizeBarcode(readString(body, 'barcode'));
  const requestedMode = readString(body, 'mode') as ScanMode;
  const mode: ScanMode = ['lookup', 'inbound', 'outbound'].includes(requestedMode)
    ? requestedMode
    : 'lookup';

  if (!barcode) {
    return jsonError('Barcode is required.');
  }

  const [existingSerial, matchedProduct] = await Promise.all([
    prisma.serialRecord.findFirst({
      where: {
        OR: [{ serialNo: barcode }, { trackingCode: barcode }, { productCode: barcode }],
      },
      orderBy: { id: 'desc' },
    }),
    prisma.productModel.findFirst({
      where: {
        OR: [{ productCode: barcode }, { warrantyCode: barcode }, { modelName: barcode }],
      },
      orderBy: { id: 'asc' },
    }),
  ]);

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

  const movement = getMovement(mode);
  const serial = await prisma.serialRecord.create({
    data: {
      docDate: toPersianDate(new Date()),
      documentNo: '',
      customerName: existingSerial?.customerName || 'انبار مرکزی',
      productCode: matchedProduct?.productCode || existingSerial?.productCode || '',
      modelName: matchedProduct?.modelName || existingSerial?.modelName || '',
      trackingCode: existingSerial?.trackingCode || '',
      serialNo: existingSerial?.serialNo || barcode,
      movement,
      status: getStatus(mode),
      source: RecordSource.PDA,
      productModelId: matchedProduct?.id || existingSerial?.productModelId || null,
      locationId: existingSerial?.locationId || null,
      createdBy: 'scanner',
      updatedBy: 'scanner',
    },
  });

  return Response.json(
    {
      action: mode === 'outbound' ? 'OUTBOUND_CREATED' : 'INBOUND_CREATED',
      barcode,
      matchedModel: matchedProduct ? mapProductModel(matchedProduct) : null,
      message: mode === 'outbound' ? 'خروج با اسکن ثبت شد.' : 'ورود با اسکن ثبت شد.',
      serial: mapSerialRecord(serial),
    },
    { status: 201 },
  );
}
