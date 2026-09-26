import type { Prisma } from '@prisma/client';

import { formatPersianDateParts, parsePersianDate } from '@/components/admin/persian-date';
import { prisma } from '@/lib/prisma';

export type SerialRecordFilters = {
  search: string;
  model: string;
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
    model: (searchParams.get('model') ?? '').trim(),
    dateFrom: normalizeJalaliDate(searchParams.get('dateFrom')),
    dateTo: normalizeJalaliDate(searchParams.get('dateTo')),
  };
}

/**
 * The list shows the model name resolved from product_models by productCode (see lib/model-name.ts),
 * so the filter matches on that too, not only on the name stored on the row. A value that is exactly
 * a known model name matches that model alone — otherwise "HID-24S" would also pull in "HID-24S2".
 * Anything else is treated as a partial name.
 */
async function buildModelWhere(model: string): Promise<Prisma.SerialRecordWhereInput> {
  const exactProducts = await prisma.productModel.findMany({
    select: { productCode: true },
    where: { modelName: { equals: model, mode: 'insensitive' } },
  });
  const isExact = exactProducts.length > 0;
  const products = isExact
    ? exactProducts
    : await prisma.productModel.findMany({
        select: { productCode: true },
        where: { modelName: { contains: model, mode: 'insensitive' } },
      });
  const productCodes = [...new Set(products.map((product) => product.productCode.trim()))].filter(
    Boolean,
  );

  return {
    OR: [
      {
        modelName: isExact
          ? { equals: model, mode: 'insensitive' }
          : { contains: model, mode: 'insensitive' },
      },
      ...(productCodes.length > 0 ? [{ productCode: { in: productCodes } }] : []),
    ],
  };
}

export async function buildSerialRecordWhere(
  filters: SerialRecordFilters,
): Promise<Prisma.SerialRecordWhereInput> {
  const conditions: Prisma.SerialRecordWhereInput[] = [];

  if (filters.search) {
    conditions.push({
      OR: [
        { documentNo: { contains: filters.search, mode: 'insensitive' } },
        { customerName: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.model) {
    conditions.push(await buildModelWhere(filters.model));
  }

  if (filters.dateFrom || filters.dateTo) {
    conditions.push({
      docDate: {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
