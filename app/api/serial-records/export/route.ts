import { prisma } from '@/lib/prisma';
import { createSerialExcelBytes, sanitizeFilename } from '@/lib/serial-excel-workbook';
import { buildSerialRecordWhere, readSerialRecordFilters } from '@/lib/serial-records-query';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireUser(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const filters = readSerialRecordFilters(searchParams);
  const where = buildSerialRecordWhere(filters);

  const records = await prisma.serialRecord.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const rows = records.map((record) => ({
    date: record.docDate,
    documentNo: record.documentNo,
    customerName: record.customerName,
    productCode: record.productCode,
    model: record.modelName,
    trackingCode: record.trackingCode,
    serialNo: record.serialNo,
  }));

  const documentNos = Array.from(new Set(rows.map((row) => row.documentNo.trim()).filter(Boolean)));
  const exportName =
    filters.search && documentNos.length === 1 && documentNos[0] === filters.search
      ? documentNos[0]
      : `serials-${Date.now()}`;
  const filename = `${sanitizeFilename(exportName)}.xlsx`;
  const workbookBytes = createSerialExcelBytes(rows);

  return new Response(workbookBytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
