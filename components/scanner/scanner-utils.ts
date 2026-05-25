import type { ScannerStep } from '@/components/scanner/scanner-types';

export const scannerStorageKey = 'barcode-app-scanner-session';
export const scannerSuccessToastMs = 2800;

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
