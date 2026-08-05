import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

import { createSerialExcelBytes, sanitizeFilename } from '@/lib/serial-excel-workbook';
import type { SerialExcelRow } from '@/lib/serial-excel-workbook';

export type { SerialExcelRow };

export type SerialExcelSaveResult = {
  filename: string;
  native: boolean;
  path: string;
};

const serialExcelFolderName = 'barcode-files';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);

    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function downloadSerialExcelBytes(workbookBytes: Uint8Array, filename: string) {
  const arrayBuffer = new ArrayBuffer(workbookBytes.byteLength);

  new Uint8Array(arrayBuffer).set(workbookBytes);

  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function ensureSerialExcelFolder() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await Filesystem.stat({
      directory: Directory.Documents,
      path: serialExcelFolderName,
    });
  } catch {
    await Filesystem.mkdir({
      directory: Directory.Documents,
      path: serialExcelFolderName,
      recursive: true,
    });
  }
}

export function downloadSerialExcelFile(rows: SerialExcelRow[], filename: string) {
  const safeFilename = `${sanitizeFilename(filename)}.xlsx`;

  downloadSerialExcelBytes(createSerialExcelBytes(rows), safeFilename);
}

export function downloadExcelBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function saveSerialExcelFile(
  rows: SerialExcelRow[],
  filename: string,
): Promise<SerialExcelSaveResult> {
  const safeFilename = `${sanitizeFilename(filename)}.xlsx`;
  const workbookBytes = createSerialExcelBytes(rows);

  if (Capacitor.isNativePlatform()) {
    const path = `${serialExcelFolderName}/${safeFilename}`;

    await Filesystem.writeFile({
      data: bytesToBase64(workbookBytes),
      directory: Directory.Documents,
      path,
      recursive: true,
    });

    return {
      filename: safeFilename,
      native: true,
      path: `Documents/${path}`,
    };
  }

  downloadSerialExcelBytes(workbookBytes, safeFilename);

  return {
    filename: safeFilename,
    native: false,
    path: safeFilename,
  };
}
