import { inflateRawSync } from 'node:zlib';

/**
 * Minimal server-side .xlsx reader.
 *
 * The scanner apps write their workbooks by hand (see lib/serial-excel-workbook.ts and
 * android-native/.../ExcelExporter.java), so a full spreadsheet library would be far more
 * machinery than this needs. It also has to cope with files an operator re-saved in Excel on
 * the way to the dashboard, which adds deflate compression and a shared string table.
 *
 * Supported: stored + deflated zip entries, inline strings, shared strings, plain numbers.
 * Not supported: zip64, encrypted workbooks, .xls (BIFF).
 */

const eocdSignature = 0x06054b50;
const maxEocdCommentLength = 0xffff;

export class XlsxReadError extends Error {}

function findEndOfCentralDirectory(bytes: Buffer) {
  const earliest = Math.max(0, bytes.length - maxEocdCommentLength - 22);

  for (let offset = bytes.length - 22; offset >= earliest; offset -= 1) {
    if (bytes.readUInt32LE(offset) === eocdSignature) {
      return offset;
    }
  }

  return -1;
}

function readZipEntries(bytes: Buffer) {
  const eocd = findEndOfCentralDirectory(bytes);

  if (eocd < 0) {
    throw new XlsxReadError('فایل معتبر نیست یا فرمت آن xlsx نمی‌باشد.');
  }

  const entryCount = bytes.readUInt16LE(eocd + 10);
  const entries = new Map<string, Buffer>();
  let offset = bytes.readUInt32LE(eocd + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length) {
      throw new XlsxReadError('ساختار فایل اکسل ناقص است.');
    }

    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLength);

    // Sizes are read from the central directory rather than the local header, because entries
    // written with a data descriptor leave the local header sizes zeroed.
    const localNameLength = bytes.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      entries.set(name, data);
    } else if (method === 8) {
      entries.set(name, inflateRawSync(data));
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&amp;/g, '&');
}

function readTextNodes(xml: string) {
  return [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join('');
}

function readSharedStrings(entries: Map<string, Buffer>) {
  const raw = entries.get('xl/sharedStrings.xml');

  if (!raw) {
    return [];
  }

  return [...raw.toString('utf8').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    // Phonetic runs are metadata for East Asian text and must not join the visible value.
    readTextNodes(match[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')),
  );
}

function findFirstSheetName(entries: Map<string, Buffer>) {
  const workbook = entries.get('xl/workbook.xml')?.toString('utf8');
  const relationships = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  const relationshipId = workbook ? /<sheet[^>]*r:id="([^"]+)"/.exec(workbook)?.[1] : undefined;

  if (relationshipId && relationships) {
    const escapedId = relationshipId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const target = new RegExp(`<Relationship[^>]*Id="${escapedId}"[^>]*Target="([^"]+)"`).exec(
      relationships,
    )?.[1];

    if (target) {
      const normalized = target.replace(/^\/?(xl\/)?/, '');

      if (entries.has(`xl/${normalized}`)) {
        return `xl/${normalized}`;
      }
    }
  }

  return [...entries.keys()].find((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name));
}

function columnLetterToIndex(letters: string) {
  let index = 0;

  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }

  return index - 1;
}

function readCellValue(attributes: string, inner: string, sharedStrings: string[]) {
  const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? 'n';

  if (type === 'inlineStr') {
    return readTextNodes(inner);
  }

  const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];

  if (value === undefined) {
    return '';
  }

  if (type === 's') {
    return sharedStrings[Number(value)] ?? '';
  }

  return decodeXmlText(value);
}

export type XlsxGrid = string[][];

/** Reads the first worksheet of an .xlsx file into a dense grid of trimmed cell strings. */
export function readFirstSheetGrid(fileBytes: Uint8Array): XlsxGrid {
  const entries = readZipEntries(Buffer.from(fileBytes));
  const sheetName = findFirstSheetName(entries);

  if (!sheetName) {
    throw new XlsxReadError('هیچ شیتی در فایل پیدا نشد.');
  }

  const sharedStrings = readSharedStrings(entries);
  const sheetXml = entries.get(sheetName)!.toString('utf8');
  const grid: XlsxGrid = [];

  for (const rowMatch of sheetXml.matchAll(/<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowIndex = Number(rowMatch[1]) - 1;
    const cells: string[] = [];

    // Matches both `<c ...>…</c>` and the self-closing `<c ... />` used for empty cells.
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const reference = /\br="([A-Z]+)\d+"/.exec(attributes)?.[1];

      if (!reference) {
        continue;
      }

      cells[columnLetterToIndex(reference)] = readCellValue(
        attributes,
        cellMatch[2] ?? '',
        sharedStrings,
      ).trim();
    }

    grid[rowIndex] = cells;
  }

  for (let index = 0; index < grid.length; index += 1) {
    grid[index] ??= [];
  }

  return grid;
}
