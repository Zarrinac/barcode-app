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
