import type { ProductModel, SerialRecord, WarehouseLocation } from '@prisma/client';
import { MovementType, SerialStatus } from '@prisma/client';

const persianDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function toPersianDate(value: Date) {
  return persianDateFormatter.format(value);
}

export function mapProductModel(model: ProductModel) {
  return {
    id: String(model.id),
    model: model.modelName,
    productCode: model.productCode,
    warrantyCode: model.warrantyCode || '0',
    createdAt: toPersianDate(model.createdAt),
    updatedAt: toPersianDate(model.updatedAt),
    status: model.isActive ? 'فعال' : 'غیرفعال',
  };
}

export function mapLocation(location: WarehouseLocation & { _count?: { serials: number } }) {
  return {
    id: String(location.id),
    name: location.name,
    code: location.code,
    count: location._count?.serials ?? 0,
    isActive: location.isActive,
  };
}

export function mapSerialRecord(serial: SerialRecord) {
  return {
    id: String(serial.id),
    date: serial.docDate,
    documentNo: serial.documentNo,
    customerName: serial.customerName,
    productCode: serial.productCode,
    model: serial.modelName,
    trackingCode: serial.trackingCode,
    serialNo: serial.serialNo,
    movement: serial.movement === 'OUTBOUND' ? 'خروج' : 'ورود',
    createdAt: toPersianDate(serial.createdAt),
    createdBy: serial.createdBy || '-',
    updatedAt: serial.updatedAt ? toPersianDate(serial.updatedAt) : '',
    updatedBy: serial.updatedBy || '-',
    status: serial.status === 'EXITED' ? 'خروج شده' : 'ثبت شده',
  };
}

export function toPrismaMovement(value: string) {
  return value === 'خروج' ? MovementType.OUTBOUND : MovementType.INBOUND;
}

export function toPrismaSerialStatus(value: string) {
  if (value === 'خروج شده') {
    return SerialStatus.EXITED;
  }

  if (value === 'لغو شده') {
    return SerialStatus.CANCELLED;
  }

  return SerialStatus.REGISTERED;
}
