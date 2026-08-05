import type { ProductModel, ScannerStep } from '@/components/scanner/scanner-types';

export const scannerStorageKey = 'barcode-app-scanner-session';
export const scannerSuccessToastMs = 2800;
export const scannerToastMs = 4500;

const productModelsStorageKey = 'barcode-app-product-models';

/**
 * The model list is only reachable online, but the offline Excel backup is exactly what an operator
 * saves when the connection is gone. Without a cached copy every row is exported with an empty
 * model cell, so the last successful download is kept on the device.
 */
export function readCachedProductModels(): ProductModel[] {
  try {
    const cached = window.localStorage.getItem(productModelsStorageKey);
    const parsed = cached ? (JSON.parse(cached) as unknown) : null;

    return Array.isArray(parsed) ? (parsed as ProductModel[]) : [];
  } catch {
    return [];
  }
}

export function writeCachedProductModels(models: ProductModel[]) {
  if (models.length === 0) {
    return;
  }

  try {
    window.localStorage.setItem(productModelsStorageKey, JSON.stringify(models));
  } catch {
    // A full or unavailable storage quota must not break scanning.
  }
}

const internalWarehousesStorageKey = 'barcode-app-internal-warehouses';

/**
 * Names of our own warehouses, cached for the same reason the model list is: an operator moving
 * stock between warehouses on a device that has lost its connection still needs the exact name, or
 * the recovered Excel row imports as a real exit instead of a transfer.
 */
export function readCachedInternalWarehouses(): string[] {
  try {
    const cached = window.localStorage.getItem(internalWarehousesStorageKey);
    const parsed = cached ? (JSON.parse(cached) as unknown) : null;

    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeCachedInternalWarehouses(names: string[]) {
  try {
    window.localStorage.setItem(internalWarehousesStorageKey, JSON.stringify(names));
  } catch {
    // A full or unavailable storage quota must not break scanning.
  }
}

/** Mirrors warehouseNameKey() on the server so the device labels a transfer the same way. */
export function isInternalWarehouseName(names: string[], value: string) {
  const key = warehouseNameKey(value);

  return key.length > 0 && names.some((name) => warehouseNameKey(name) === key);
}

function warehouseNameKey(value: string) {
  return value
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

const persianDatePartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatPersianDate(date: Date) {
  const parts = persianDatePartsFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('year')}/${getPart('month')}/${getPart('day')}`;
}

export function normalizeScan(value: string) {
  return value.replace(/[\r\n\t]/g, '').trim();
}

export function normalizeNumberInput(value: string) {
  const normalizedDigits = normalizeScan(value).replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    const persianIndex = persianDigits.indexOf(digit);

    if (persianIndex >= 0) {
      return String(persianIndex);
    }

    return String(arabicDigits.indexOf(digit));
  });

  return normalizedDigits.replace(/\D/g, '');
}

export function getDefaultStatusMessage(step: ScannerStep) {
  if (step === 'login') {
    return 'نام کاربری و رمز عبور را وارد کنید.';
  }

  if (step === 'document') {
    return 'آماده ثبت سند';
  }

  return 'جمع آوری بارکد';
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
