'use client';

import { UploadFileOutlined } from '@mui/icons-material';
import { useRef, useState } from 'react';

import { Modal } from '@/components/admin/dashboard-primitives';

/**
 * Recovers scan batches that only ever made it to the device's local Excel backup — the operator
 * copies those files off the device, drops them here, and the serials land in the database.
 *
 * Always previews first: the confirm step is only reachable after the server has reported exactly
 * what it would insert and what it would skip as already-present.
 */

type ImportOutcome = 'inserted' | 'duplicate-in-db' | 'duplicate-in-file' | 'invalid';

type ImportRowReport = {
  sourceFile: string;
  sheetRow: number;
  serialNo: string;
  trackingCode: string;
  outcome: ImportOutcome;
  reason?: string;
};

type ImportFileReport = {
  sourceFile: string;
  total: number;
  inserted: number;
  duplicateInDb: number;
  duplicateInFile: number;
  invalid: number;
  error?: string;
};

type ImportReport = {
  dryRun: boolean;
  movement: 'INBOUND' | 'OUTBOUND';
  counts: {
    total: number;
    inserted: number;
    duplicateInDb: number;
    duplicateInFile: number;
    invalid: number;
  };
  files: ImportFileReport[];
  rows: ImportRowReport[];
};

const skippedRowLimit = 50;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatCount(value: number) {
  return value.toLocaleString('fa-IR');
}

export function SerialImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) {
      return;
    }

    const selected = [...incoming].filter((file) => file.name.toLowerCase().endsWith('.xlsx'));

    setError(selected.length === incoming.length ? '' : 'فقط فایل‌های xlsx پذیرفته می‌شوند.');
    // A fresh selection invalidates the previous preview, so the confirm step can never
    // commit a report that no longer matches the chosen files.
    setReport(null);
    setFiles((current) => {
      const merged = [...current];

      for (const file of selected) {
        if (!merged.some((item) => item.name === file.name && item.size === file.size)) {
          merged.push(file);
        }
      }

      return merged;
    });
  };

  const removeFile = (name: string) => {
    setReport(null);
    setFiles((current) => current.filter((file) => file.name !== name));
  };

  const submit = async (dryRun: boolean) => {
    if (files.length === 0) {
      setError('حداقل یک فایل اکسل انتخاب کنید.');
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const body = new FormData();

      body.append('dryRun', dryRun ? 'true' : 'false');

      for (const file of files) {
        body.append('files', file);
      }

      const response = await fetch('/api/serial-records/import', { body, method: 'POST' });
      const payload = (await response.json()) as { report?: ImportReport; error?: string };

      if (!response.ok || !payload.report) {
        setError(payload.error ?? 'بارگذاری فایل با خطا مواجه شد.');
        return;
      }

      if (dryRun) {
        setReport(payload.report);
        return;
      }

      onImported(`${formatCount(payload.report.counts.inserted)} سریال به دیتابیس اضافه شد.`);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setIsBusy(false);
    }
  };

  const skippedRows = report?.rows.filter((row) => row.outcome !== 'inserted') ?? [];

  return (
    <Modal
      onClose={onClose}
      subtitle="فایل‌های اکسل ذخیره‌شده روی دستگاه را اینجا رها کنید تا سریال‌های ثبت‌نشده به دیتابیس اضافه شوند."
      title="بازیابی از فایل اکسل"
      wide
    >
      <div className="grid gap-5 px-6 py-6 max-smd:px-4 max-smd:py-4">
        <div
          className={cx(
            'grid place-items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition max-smd:p-5',
            isDragging
              ? 'border-dcode-red-500 bg-dcode-red-500/5'
              : 'border-app-line bg-app-surface-soft',
          )}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <UploadFileOutlined className="text-4xl text-app-muted" />
          <p className="m-0 text-base font-black text-dcode-900">
            فایل‌ها را اینجا بکشید و رها کنید
          </p>
          <p className="m-0 text-xs font-bold text-app-muted">یا از دکمه زیر انتخاب کنید</p>
          <button
            className={
              'mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 bg-linear-to-br from-dcode-red-500 to-dcode-red-700 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px'
            }
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            انتخاب فایل
          </button>
          <input
            accept=".xlsx"
            className="hidden"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>

        {files.length > 0 && (
          <ul className="m-0 grid list-none gap-2 p-0">
            {files.map((file) => (
              <li
                className={
                  'flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface px-3.5 py-2.5'
                }
                key={`${file.name}-${file.size}`}
              >
                {/* Filenames are latin text inside an RTL dialog: without dir, "21000.xlsx"
                    renders reordered as "xlsx.21000" and no longer matches the device. */}
                <span className="truncate text-right text-sm font-bold text-dcode-900" dir="ltr">
                  {file.name}
                </span>
                <button
                  className="shrink-0 rounded-lg border-0 bg-app-line px-2.5 py-1 text-xs font-bold text-dcode-900"
                  onClick={() => removeFile(file.name)}
                  type="button"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="m-0 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        {report && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryTile label="قابل ثبت" tone="green" value={report.counts.inserted} />
              <SummaryTile
                label="تکراری در دیتابیس"
                tone="orange"
                value={report.counts.duplicateInDb}
              />
              <SummaryTile
                label="تکراری در فایل"
                tone="orange"
                value={report.counts.duplicateInFile}
              />
              <SummaryTile label="نامعتبر" tone="red" value={report.counts.invalid} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-sm">
                <thead>
                  <tr className="bg-app-surface-soft">
                    <th className="px-3 py-2 font-black text-dcode-900">فایل</th>
                    <th className="px-3 py-2 font-black text-dcode-900">کل</th>
                    <th className="px-3 py-2 font-black text-dcode-900">قابل ثبت</th>
                    <th className="px-3 py-2 font-black text-dcode-900">رد شده</th>
                  </tr>
                </thead>
                <tbody>
                  {report.files.map((file) => (
                    <tr className="border-t border-app-line" key={file.sourceFile}>
                      <td className="px-3 py-2 font-bold text-dcode-900">
                        <span dir="ltr">{file.sourceFile}</span>
                        {file.error && (
                          <span className="block text-xs font-bold text-red-700">{file.error}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold">{formatCount(file.total)}</td>
                      <td className="px-3 py-2 font-bold text-emerald-700">
                        {formatCount(file.inserted)}
                      </td>
                      <td className="px-3 py-2 font-bold text-amber-700">
                        {formatCount(file.total - file.inserted)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {skippedRows.length > 0 && (
              <details className="rounded-xl border border-app-line bg-app-surface-soft px-3.5 py-2.5">
                <summary className="cursor-pointer text-sm font-black text-dcode-900">
                  {formatCount(skippedRows.length)} ردیف ثبت نمی‌شود
                </summary>
                <ul className="m-0 mt-2 grid list-none gap-1 p-0">
                  {skippedRows.slice(0, skippedRowLimit).map((row) => (
                    <li
                      className="text-xs font-bold text-app-muted"
                      key={`${row.sourceFile}-${row.sheetRow}`}
                    >
                      <span dir="ltr">{row.sourceFile}</span> — سطر {formatCount(row.sheetRow)} —{' '}
                      <span dir="ltr">{row.serialNo}</span> — {row.reason}
                    </li>
                  ))}
                  {skippedRows.length > skippedRowLimit && (
                    <li className="text-xs font-bold text-app-muted">…</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5 max-smd:flex-col-reverse max-smd:items-stretch">
          <button
            className="min-h-10 rounded-xl border border-app-line bg-app-surface px-4 font-extrabold text-dcode-900"
            onClick={onClose}
            type="button"
          >
            انصراف
          </button>
          <button
            className={
              'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 font-extrabold text-dcode-900 disabled:cursor-wait disabled:opacity-70'
            }
            disabled={isBusy || files.length === 0}
            onClick={() => submit(true)}
            type="button"
          >
            بررسی فایل‌ها
          </button>
          <button
            className={
              'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 bg-linear-to-br from-dcode-red-500 to-dcode-red-700 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70'
            }
            disabled={isBusy || !report || report.counts.inserted === 0}
            onClick={() => submit(false)}
            type="button"
          >
            ثبت {report ? formatCount(report.counts.inserted) : ''} سریال
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'orange' | 'red';
}) {
  const tones = {
    green: 'text-emerald-700',
    orange: 'text-amber-700',
    red: 'text-red-700',
  } as const;

  return (
    <div className="grid gap-1 rounded-xl border border-app-line bg-app-surface px-3.5 py-2.5">
      <span className="text-xs font-bold text-app-muted">{label}</span>
      <span className={cx('text-xl font-black', tones[tone])}>{formatCount(value)}</span>
    </div>
  );
}
