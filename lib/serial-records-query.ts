import type { Prisma } from '@prisma/client';

import { formatPersianDateParts, parsePersianDate } from '@/components/admin/persian-date';

export type SerialRecordFilters = {
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
};

// docDate is stored as a zero-padded ASCII Jalali string (YYYY/MM/DD), so a
// normalized string comparison is equivalent to comparing persianDateKey values.
function normalizeJalaliDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parts = parsePersianDate(value);

  return parts ? formatPersianDateParts(parts) : null;
}

export function readSerialRecordFilters(searchParams: URLSearchParams): SerialRecordFilters {
  return {
    search: (searchParams.get('search') ?? '').trim(),
    dateFrom: normalizeJalaliDate(searchParams.get('dateFrom')),
    dateTo: normalizeJalaliDate(searchParams.get('dateTo')),
  };
}

export function buildSerialRecordWhere(
  filters: SerialRecordFilters,
): Prisma.SerialRecordWhereInput {
  const where: Prisma.SerialRecordWhereInput = {};

  if (filters.search) {
    where.OR = [
      { documentNo: { contains: filters.search, mode: 'insensitive' } },
      { customerName: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.dateFrom || filters.dateTo) {
    where.docDate = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  return where;
}
