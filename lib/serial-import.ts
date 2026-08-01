import { MovementType, RecordSource, SerialStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getDefaultWarehouseLocationId } from '@/lib/warehouse-location';
import { readFirstSheetGrid, XlsxReadError } from '@/lib/xlsx-read';

/**
 * Recovers scan batches that never reached the database — typically because the device lost its
 * connection and the operator could only save the local Excel backup.
 *
 * parseSerialWorkbook() turns one of those workbooks into rows; importSerialRows() is the ingest
 * core and deliberately knows nothing about Excel, so the offline outbox on the device can post
 * the same shape later.
 */

const defaultCustomerName = 'انبار مرکزی';
const lookupChunkSize = 500;
const insertChunkSize = 500;

export type SerialImportRow = {
  sourceFile: string;
  sheetRow: number;
  docDate: string;
  documentNo: string;
  customerName: string;
  productCode: string;
  modelName: string;
  trackingCode: string;
  serialNo: string;
};

export type SerialImportOutcome = 'inserted' | 'duplicate-in-db' | 'duplicate-in-file' | 'invalid';

export type SerialImportRowReport = {
  sourceFile: string;
  sheetRow: number;
  serialNo: string;
  trackingCode: string;
  outcome: SerialImportOutcome;
  reason?: string;
};

export type SerialImportFileReport = {
  sourceFile: string;
  total: number;
  inserted: number;
  duplicateInDb: number;
  duplicateInFile: number;
  invalid: number;
  error?: string;
};

export type SerialImportReport = {
  dryRun: boolean;
  movement: MovementType;
  counts: {
    total: number;
    inserted: number;
    duplicateInDb: number;
    duplicateInFile: number;
    invalid: number;
  };
  files: SerialImportFileReport[];
  rows: SerialImportRowReport[];
};

function normalizeLetters(value: string) {
  return value
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/‌/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeScan(value: string) {
  return value.replace(/[\r\n\t]/g, '').trim();
}

/** Mirrors normalizeNumberInput() in the scanner apps so imported codes match scanned ones. */
function normalizeNumberInput(value: string) {
  return normalizeScan(value)
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');
}

export function isRealTrackingCode(value: string) {
  return value.trim().toLowerCase() !== 'panel';
}

/**
 * Header text to row field. A field may be listed under more than one heading: the tracking column
 * is labelled «کد رهگیری» by this app but «شناسه رهگیری» by other exports of the same batch, and
 * both have to import the same way.
 */
const headerFields = {
  تاریخ: 'docDate',
  'شماره سند': 'documentNo',
  'نام مشتری': 'customerName',
  'شناسه کالا': 'productCode',
  'مدل کالا': 'modelName',
  'کد رهگیری': 'trackingCode',
  'شناسه رهگیری': 'trackingCode',
  'شماره سریال': 'serialNo',
} as const;

type HeaderField = (typeof headerFields)[keyof typeof headerFields];

function findHeaderRow(grid: string[][]) {
  for (let index = 0; index < grid.length; index += 1) {
    const columns = new Map<HeaderField, number>();

    grid[index].forEach((cell, column) => {
      const field = headerFields[normalizeLetters(cell) as keyof typeof headerFields];

      if (field && !columns.has(field)) {
        columns.set(field, column);
      }
    });

    if (columns.has('serialNo')) {
      return { rowIndex: index, columns };
    }
  }

  return null;
}

/**
 * Excel rewrites a text date like "1405/05/05" into a serial number if the operator opens and
 * re-saves the workbook. Detecting it here keeps a meaningless number out of docDate.
 */
function looksLikeExcelSerialDate(value: string) {
  return /^\d{5}(\.\d+)?$/.test(value);
}

export function parseSerialWorkbook(fileName: string, fileBytes: Uint8Array): SerialImportRow[] {
  const grid = readFirstSheetGrid(fileBytes);
  const header = findHeaderRow(grid);

  if (!header) {
    throw new XlsxReadError('ستون «شماره سریال» در فایل پیدا نشد.');
  }

  const rows: SerialImportRow[] = [];

  for (let index = header.rowIndex + 1; index < grid.length; index += 1) {
    const cells = grid[index];
    const read = (field: HeaderField) => {
      const column = header.columns.get(field);

      return column === undefined ? '' : (cells[column] ?? '');
    };
    const serialNo = normalizeScan(read('serialNo'));

    if (!serialNo) {
      continue;
    }

    const trackingCode = normalizeScan(read('trackingCode'));
    const docDate = normalizeScan(read('docDate'));

    rows.push({
      sourceFile: fileName,
      sheetRow: index + 1,
      docDate: looksLikeExcelSerialDate(docDate) ? '' : docDate,
      documentNo: normalizeScan(read('documentNo')),
      customerName: normalizeScan(read('customerName')),
      productCode: normalizeNumberInput(read('productCode')),
      modelName: normalizeScan(read('modelName')),
      trackingCode: isRealTrackingCode(trackingCode)
        ? normalizeNumberInput(trackingCode)
        : trackingCode.toLowerCase(),
      serialNo,
    });
  }

  return rows;
}

async function chunkedLookup<T>(values: string[], lookup: (chunk: string[]) => Promise<T[]>) {
  const results: T[] = [];

  for (let index = 0; index < values.length; index += lookupChunkSize) {
    results.push(...(await lookup(values.slice(index, index + lookupChunkSize))));
  }

  return results;
}

async function findExistingKeys(serialNos: string[], trackingCodes: string[]) {
  const existingSerialNos = new Set<string>();
  const existingTrackingCodes = new Set<string>();

  const bySerial = await chunkedLookup(serialNos, (chunk) =>
    prisma.serialRecord.findMany({
      select: { serialNo: true },
      where: { serialNo: { in: chunk } },
    }),
  );

  for (const record of bySerial) {
    existingSerialNos.add(record.serialNo);
  }

  const byTracking = await chunkedLookup(trackingCodes, (chunk) =>
    prisma.serialRecord.findMany({
      select: { trackingCode: true },
      where: { trackingCode: { in: chunk } },
    }),
  );

  for (const record of byTracking) {
    existingTrackingCodes.add(record.trackingCode);
  }

  return { existingSerialNos, existingTrackingCodes };
}

async function findProductsByCode(productCodes: string[]) {
  const products = await chunkedLookup(productCodes, (chunk) =>
    prisma.productModel.findMany({
      select: { id: true, modelName: true, productCode: true },
      // Ascending id matches the single-record POST route, which takes the oldest match.
      orderBy: { id: 'asc' },
      where: { productCode: { in: chunk } },
    }),
  );
  const byCode = new Map<string, { id: number; modelName: string }>();

  for (const product of products) {
    if (!byCode.has(product.productCode)) {
      byCode.set(product.productCode, { id: product.id, modelName: product.modelName });
    }
  }

  return byCode;
}

export async function importSerialRows({
  rows,
  movement,
  createdBy,
  dryRun,
}: {
  rows: SerialImportRow[];
  movement: MovementType;
  createdBy: string;
  dryRun: boolean;
}): Promise<SerialImportReport> {
  const reports: SerialImportRowReport[] = [];
  const insertable: SerialImportRow[] = [];
  const seenSerialNos = new Set<string>();
  const seenTrackingCodes = new Set<string>();

  const { existingSerialNos, existingTrackingCodes } = await findExistingKeys(
    [...new Set(rows.map((row) => row.serialNo))],
    [...new Set(rows.map((row) => row.trackingCode).filter(isRealTrackingCode))].filter(Boolean),
  );

  for (const row of rows) {
    const report: SerialImportRowReport = {
      sourceFile: row.sourceFile,
      sheetRow: row.sheetRow,
      serialNo: row.serialNo,
      trackingCode: row.trackingCode,
      outcome: 'inserted',
    };
    const hasRealTrackingCode = Boolean(row.trackingCode) && isRealTrackingCode(row.trackingCode);

    if (!row.serialNo) {
      report.outcome = 'invalid';
      report.reason = 'شماره سریال خالی است.';
    } else if (seenSerialNos.has(row.serialNo)) {
      report.outcome = 'duplicate-in-file';
      report.reason = 'شماره سریال در همین فایل‌ها تکرار شده است.';
    } else if (hasRealTrackingCode && seenTrackingCodes.has(row.trackingCode)) {
      report.outcome = 'duplicate-in-file';
      report.reason = 'کد رهگیری در همین فایل‌ها تکرار شده است.';
    } else if (existingSerialNos.has(row.serialNo)) {
      report.outcome = 'duplicate-in-db';
      report.reason = 'شماره سریال قبلا در دیتابیس ثبت شده است.';
    } else if (hasRealTrackingCode && existingTrackingCodes.has(row.trackingCode)) {
      report.outcome = 'duplicate-in-db';
      report.reason = 'کد رهگیری قبلا در دیتابیس ثبت شده است.';
    }

    if (report.outcome === 'inserted') {
      seenSerialNos.add(row.serialNo);

      if (hasRealTrackingCode) {
        seenTrackingCodes.add(row.trackingCode);
      }

      insertable.push(row);
    }

    reports.push(report);
  }

  if (!dryRun && insertable.length > 0) {
    const products = await findProductsByCode([
      ...new Set(insertable.map((row) => row.productCode).filter(Boolean)),
    ]);
    const locationId = await getDefaultWarehouseLocationId();
    const status =
      movement === MovementType.OUTBOUND ? SerialStatus.EXITED : SerialStatus.REGISTERED;
    const data = insertable.map((row) => {
      const product = products.get(row.productCode);

      return {
        docDate: row.docDate,
        documentNo: row.documentNo,
        customerName: row.customerName || defaultCustomerName,
        productCode: row.productCode,
        // The spreadsheet cell is a fallback only — offline backups carry whatever the device had
        // cached, which is sometimes the product code rather than the model name.
        modelName: product?.modelName || row.modelName || '',
        trackingCode: row.trackingCode,
        serialNo: row.serialNo,
        movement,
        status,
        source: RecordSource.EXCEL_IMPORT,
        productModelId: product?.id,
        locationId,
        createdBy,
      };
    });

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < data.length; index += insertChunkSize) {
        await tx.serialRecord.createMany({ data: data.slice(index, index + insertChunkSize) });
      }
    });
  }

  return buildReport({ dryRun, movement, reports });
}

export function buildReport({
  dryRun,
  movement,
  reports,
  failedFiles = [],
}: {
  dryRun: boolean;
  movement: MovementType;
  reports: SerialImportRowReport[];
  failedFiles?: { sourceFile: string; error: string }[];
}): SerialImportReport {
  const files = new Map<string, SerialImportFileReport>();
  const counts = {
    total: reports.length,
    inserted: 0,
    duplicateInDb: 0,
    duplicateInFile: 0,
    invalid: 0,
  };
  const countKey = {
    inserted: 'inserted',
    'duplicate-in-db': 'duplicateInDb',
    'duplicate-in-file': 'duplicateInFile',
    invalid: 'invalid',
  } as const;

  for (const report of reports) {
    const file =
      files.get(report.sourceFile) ??
      ({
        sourceFile: report.sourceFile,
        total: 0,
        inserted: 0,
        duplicateInDb: 0,
        duplicateInFile: 0,
        invalid: 0,
      } satisfies SerialImportFileReport);
    const key = countKey[report.outcome];

    file.total += 1;
    file[key] += 1;
    counts[key] += 1;
    files.set(report.sourceFile, file);
  }

  for (const failure of failedFiles) {
    files.set(failure.sourceFile, {
      sourceFile: failure.sourceFile,
      total: 0,
      inserted: 0,
      duplicateInDb: 0,
      duplicateInFile: 0,
      invalid: 0,
      error: failure.error,
    });
  }

  return { dryRun, movement, counts, files: [...files.values()], rows: reports };
}
