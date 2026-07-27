import { toPrismaMovement } from '@/lib/api-mappers';
import { jsonError } from '@/lib/api-utils';
import {
  buildReport,
  importSerialRows,
  parseSerialWorkbook,
  type SerialImportRow,
} from '@/lib/serial-import';
import { requireManager } from '@/lib/session';
import { XlsxReadError } from '@/lib/xlsx-read';

export const dynamic = 'force-dynamic';

const maxFiles = 30;
const maxFileBytes = 5 * 1024 * 1024;
const maxRows = 20000;

export async function POST(request: Request) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError('فایلی دریافت نشد.');
  }

  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return jsonError('حداقل یک فایل اکسل انتخاب کنید.');
  }

  if (files.length > maxFiles) {
    return jsonError(`حداکثر ${maxFiles} فایل در هر بار قابل بارگذاری است.`);
  }

  const movement = toPrismaMovement(String(formData.get('movement') ?? ''));
  // Defaults to a preview so the admin always sees what would change before anything is written.
  const dryRun = String(formData.get('dryRun') ?? 'true') !== 'false';
  const rows: SerialImportRow[] = [];
  const failedFiles: { sourceFile: string; error: string }[] = [];

  for (const file of files) {
    if (file.size > maxFileBytes) {
      failedFiles.push({ sourceFile: file.name, error: 'حجم فایل بیش از حد مجاز است.' });
      continue;
    }

    try {
      rows.push(...parseSerialWorkbook(file.name, new Uint8Array(await file.arrayBuffer())));
    } catch (error) {
      failedFiles.push({
        sourceFile: file.name,
        error: error instanceof XlsxReadError ? error.message : 'خواندن فایل اکسل با خطا مواجه شد.',
      });
    }
  }

  if (rows.length > maxRows) {
    return jsonError(`حداکثر ${maxRows} ردیف در هر بار قابل بارگذاری است.`);
  }

  if (rows.length === 0) {
    return Response.json({
      report: buildReport({ dryRun, movement, reports: [], failedFiles }),
    });
  }

  const report = await importSerialRows({
    rows,
    movement,
    createdBy: auth.username,
    dryRun,
  });

  return Response.json({
    report: buildReport({ dryRun, movement, reports: report.rows, failedFiles }),
  });
}
