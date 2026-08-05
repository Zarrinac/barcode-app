import type { ProductModel, SerialRecord, WarehouseLocation } from '@prisma/client';
import { MovementType, SerialStatus, UserRole } from '@prisma/client';

/** Anything not explicitly ADMIN or MANAGER falls back to the least-privileged role. */
export function toPrismaUserRole(value: string): UserRole {
  const role = value.trim().toUpperCase();

  if (role === UserRole.ADMIN) {
    return UserRole.ADMIN;
  }

  return role === UserRole.MANAGER ? UserRole.MANAGER : UserRole.USER;
}

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
    updatedAt: model.legacyFlag === 1 && model.updatedAt ? toPersianDate(model.updatedAt) : '',
    status: model.legacyFlag === 1 ? 'ویرایش شده' : 'ثبت شده',
  };
}

export function mapLocation(location: WarehouseLocation & { _count?: { serials: number } }) {
  return {
    id: String(location.id),
    name: location.name,
    code: location.code,
    count: location._count?.serials ?? 0,
    isActive: location.isActive,
    isInternal: location.isInternal,
  };
}

/**
 * `modelName` on the row is only a snapshot of what the device sent. Callers that can look the
 * product up pass the current name from product_models so the model column never shows a code.
 */
export function mapSerialRecord(serial: SerialRecord, modelName?: string) {
  return {
    id: String(serial.id),
    date: serial.docDate,
    documentNo: serial.documentNo,
    customerName: serial.customerName,
    productCode: serial.productCode,
    model: modelName || serial.modelName,
    trackingCode: serial.trackingCode,
    serialNo: serial.serialNo,
    movement: movementLabels[serial.movement],
    createdAt: toPersianDate(serial.createdAt),
    createdBy: serial.createdBy || '-',
    updatedAt: serial.updatedAt ? toPersianDate(serial.updatedAt) : '',
    updatedBy: serial.updatedBy || '-',
    status:
      serial.legacyFlag === 1
        ? 'ویرایش شده'
        : serial.status === 'TRANSFERRED'
          ? 'انتقال بین انبار'
          : serial.status === 'EXITED'
            ? 'خروج شده'
            : 'ثبت شده',
  };
}

export const movementLabels: Record<MovementType, string> = {
  [MovementType.INBOUND]: 'ورود',
  [MovementType.OUTBOUND]: 'خروج',
  [MovementType.TRANSFER]: 'انتقال بین انبار',
};

export function toPrismaMovement(value: string) {
  if (value === movementLabels[MovementType.TRANSFER]) {
    return MovementType.TRANSFER;
  }

  return value === 'خروج' ? MovementType.OUTBOUND : MovementType.INBOUND;
}

export function toPrismaSerialStatus(value: string) {
  if (value === 'انتقال بین انبار') {
    return SerialStatus.TRANSFERRED;
  }

  if (value === 'خروج شده') {
    return SerialStatus.EXITED;
  }

  if (value === 'ویرایش شده') {
    return SerialStatus.EDITED;
  }

  if (value === 'لغو شده') {
    return SerialStatus.CANCELLED;
  }

  return SerialStatus.REGISTERED;
}
