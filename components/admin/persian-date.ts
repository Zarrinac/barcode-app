import type { PersianDateParts } from '@/components/admin/types';

const persianDatePartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const persianMonthNames = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const persianWeekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function getPersianDateParts(date: Date): PersianDateParts {
  const parts = persianDatePartsFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

export function formatPersianDateParts(parts: PersianDateParts) {
  return `${parts.year}/${padDatePart(parts.month)}/${padDatePart(parts.day)}`;
}

function formatPersianDate(date: Date) {
  return formatPersianDateParts(getPersianDateParts(date));
}

function normalizeDateDigits(value: string) {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

export function parsePersianDate(value: string): PersianDateParts | null {
  const match = normalizeDateDigits(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  if (
    !Number.isInteger(parts.year) ||
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31
  ) {
    return null;
  }

  return parts;
}

export function getPersianMonthDates(year: number, month: number) {
  const dates: Array<{ date: Date; parts: PersianDateParts }> = [];
  const cursor = new Date(year + 620, 0, 1, 12);
  const end = new Date(year + 622, 11, 31, 12);

  while (cursor <= end) {
    const current = new Date(cursor);
    const parts = getPersianDateParts(current);

    if (parts.year === year && parts.month === month) {
      dates.push({ date: current, parts });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getPersianWeekIndex(date: Date) {
  return (date.getDay() + 1) % 7;
}

export const today = formatPersianDate(new Date());

export function persianDateKey(value: string) {
  const parts = parsePersianDate(value);

  if (!parts) {
    return null;
  }

  return parts.year * 10000 + parts.month * 100 + parts.day;
}
