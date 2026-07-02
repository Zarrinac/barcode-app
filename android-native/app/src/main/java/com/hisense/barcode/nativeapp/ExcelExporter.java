package com.hisense.barcode.nativeapp;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

final class ExcelExporter {
    private static final String FOLDER_NAME = "barcode-files";

    private ExcelExporter() {}

    static SaveResult saveSerialExcelFile(Context context, List<ScanRow> rows, String filename)
            throws IOException {
        String safeFilename = sanitizeFilename(filename) + ".xlsx";
        byte[] workbookBytes = createSerialExcelBytes(rows);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return saveWithMediaStore(context, workbookBytes, safeFilename);
        }

        return saveWithPublicDocuments(context, workbookBytes, safeFilename);
    }

    private static SaveResult saveWithMediaStore(Context context, byte[] workbookBytes, String safeFilename)
            throws IOException {
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        String relativePath = Environment.DIRECTORY_DOCUMENTS + "/" + FOLDER_NAME;

        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeFilename);
        values.put(
                MediaStore.MediaColumns.MIME_TYPE,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Files.getContentUri("external"), values);

        if (uri == null) {
            throw new IOException("Could not create MediaStore file");
        }

        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) {
                throw new IOException("Could not open MediaStore file");
            }

            output.write(workbookBytes);
        }

        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        return new SaveResult(safeFilename, relativePath + "/" + safeFilename);
    }

    private static SaveResult saveWithPublicDocuments(Context context, byte[] workbookBytes, String safeFilename)
            throws IOException {
        File documentsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
        File folder = new File(documentsDir, FOLDER_NAME);

        if (!folder.exists() && !folder.mkdirs()) {
            File fallbackDir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
            folder = new File(fallbackDir == null ? context.getFilesDir() : fallbackDir, FOLDER_NAME);

            if (!folder.exists() && !folder.mkdirs()) {
                throw new IOException("Could not create " + folder.getAbsolutePath());
            }
        }

        File file = new File(folder, safeFilename);

        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(workbookBytes);
        }

        return new SaveResult(safeFilename, file.getAbsolutePath());
    }

    private static byte[] createSerialExcelBytes(List<ScanRow> rows) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            addZipEntry(zip, "[Content_Types].xml", contentTypes());
            addZipEntry(zip, "_rels/.rels", rootRels());
            addZipEntry(zip, "xl/workbook.xml", workbook());
            addZipEntry(zip, "xl/_rels/workbook.xml.rels", workbookRels());
            addZipEntry(zip, "xl/worksheets/sheet1.xml", worksheet(rows));
            addZipEntry(zip, "xl/styles.xml", styles());
        }

        return output.toByteArray();
    }

    private static void addZipEntry(ZipOutputStream zip, String name, String content)
            throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String worksheet(List<ScanRow> rows) {
        String[] columns = {
            "ردیف",
            "تاریخ",
            "شماره سند",
            "نام مشتری",
            "شناسه کالا",
            "مدل کالا",
            "کد رهگیری",
            "شماره سریال"
        };
        String[] columnLetters = {"A", "B", "C", "D", "E", "F", "G", "H"};
        StringBuilder headerCells = new StringBuilder();

        for (int index = 0; index < columns.length; index++) {
            headerCells.append(createCell(columnLetters[index] + "2", columns[index], 2, false));
        }

        StringBuilder dataRows = new StringBuilder();

        for (int index = 0; index < rows.size(); index++) {
            ScanRow row = rows.get(index);
            int rowNumber = index + 3;
            String[] values = {
                String.valueOf(index + 1),
                row.date,
                row.documentNo,
                row.customerName,
                row.productCode,
                row.model,
                row.trackingCode,
                row.serialNo
            };
            dataRows.append("<row r=\"").append(rowNumber).append("\">");

            for (int valueIndex = 0; valueIndex < values.length; valueIndex++) {
                boolean numeric = valueIndex == 0 || numericText(values[valueIndex]);
                int style = numeric ? 4 : 3;
                dataRows.append(
                        createCell(
                                columnLetters[valueIndex] + rowNumber,
                                values[valueIndex],
                                style,
                                numeric));
            }

            dataRows.append("</row>");
        }

        int lastRow = rows.size() + 2;

        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" "
                + "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\n"
                + "  <dimension ref=\"A1:H"
                + lastRow
                + "\"/>\n"
                + "  <sheetViews><sheetView workbookViewId=\"0\"/></sheetViews>\n"
                + "  <sheetFormatPr defaultRowHeight=\"15\"/>\n"
                + "  <cols>\n"
                + "    <col min=\"1\" max=\"1\" width=\"5.14\" customWidth=\"1\"/>\n"
                + "    <col min=\"2\" max=\"2\" width=\"10.71\" customWidth=\"1\"/>\n"
                + "    <col min=\"3\" max=\"3\" width=\"12\" customWidth=\"1\"/>\n"
                + "    <col min=\"4\" max=\"4\" width=\"28\" customWidth=\"1\"/>\n"
                + "    <col min=\"5\" max=\"5\" width=\"20\" customWidth=\"1\"/>\n"
                + "    <col min=\"6\" max=\"6\" width=\"20\" customWidth=\"1\"/>\n"
                + "    <col min=\"7\" max=\"7\" width=\"20\" customWidth=\"1\"/>\n"
                + "    <col min=\"8\" max=\"8\" width=\"30\" customWidth=\"1\"/>\n"
                + "  </cols>\n"
                + "  <sheetData>\n"
                + "    <row r=\"1\">"
                + createCell("A1", "D'CODE", 1, false)
                + "</row>\n"
                + "    <row r=\"2\">"
                + headerCells
                + "</row>\n"
                + dataRows
                + "  </sheetData>\n"
                + "  <mergeCells count=\"1\"><mergeCell ref=\"A1:H1\"/></mergeCells>\n"
                + "</worksheet>";
    }

    private static String createCell(String ref, String value, int style, boolean numeric) {
        if (numeric) {
            return "<c r=\""
                    + ref
                    + "\" s=\""
                    + style
                    + "\"><v>"
                    + escapeXml(value)
                    + "</v></c>";
        }

        return "<c r=\""
                + ref
                + "\" s=\""
                + style
                + "\" t=\"inlineStr\"><is><t>"
                + escapeXml(value)
                + "</t></is></c>";
    }

    private static String styles() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">\n"
                + "  <numFmts count=\"1\"><numFmt numFmtId=\"164\" formatCode=\"0\"/></numFmts>\n"
                + "  <fonts count=\"2\">\n"
                + "    <font><sz val=\"11\"/><name val=\"Calibri\"/><family val=\"2\"/></font>\n"
                + "    <font><b/><sz val=\"11\"/><name val=\"Calibri\"/><family val=\"2\"/></font>\n"
                + "  </fonts>\n"
                + "  <fills count=\"3\">\n"
                + "    <fill><patternFill patternType=\"none\"/></fill>\n"
                + "    <fill><patternFill patternType=\"gray125\"/></fill>\n"
                + "    <fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFD9EAD3\"/><bgColor indexed=\"64\"/></patternFill></fill>\n"
                + "  </fills>\n"
                + "  <borders count=\"2\">\n"
                + "    <border><left/><right/><top/><bottom/><diagonal/></border>\n"
                + "    <border><left style=\"thin\"><color auto=\"1\"/></left><right style=\"thin\"><color auto=\"1\"/></right><top style=\"thin\"><color auto=\"1\"/></top><bottom style=\"thin\"><color auto=\"1\"/></bottom><diagonal/></border>\n"
                + "  </borders>\n"
                + "  <cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>\n"
                + "  <cellXfs count=\"5\">\n"
                + "    <xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>\n"
                + "    <xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyAlignment=\"1\"><alignment horizontal=\"center\"/></xf>\n"
                + "    <xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"center\"/></xf>\n"
                + "    <xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"center\"/></xf>\n"
                + "    <xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"center\"/></xf>\n"
                + "  </cellXfs>\n"
                + "  <cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>\n"
                + "</styleSheet>";
    }

    private static String workbook() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" "
                + "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\n"
                + "  <sheets><sheet name=\"Sheet1\" sheetId=\"1\" r:id=\"rId1\"/></sheets>\n"
                + "</workbook>";
    }

    private static String workbookRels() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n"
                + "  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>\n"
                + "  <Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>\n"
                + "</Relationships>";
    }

    private static String rootRels() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n"
                + "  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>\n"
                + "</Relationships>";
    }

    private static String contentTypes() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\n"
                + "  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\n"
                + "  <Default Extension=\"xml\" ContentType=\"application/xml\"/>\n"
                + "  <Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>\n"
                + "  <Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>\n"
                + "  <Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>\n"
                + "</Types>";
    }

    private static String sanitizeFilename(String filename) {
        String source = filename == null ? "" : filename.trim();
        StringBuilder clean = new StringBuilder();

        for (int index = 0; index < source.length(); index++) {
            char value = source.charAt(index);

            if (value < 32 || "<>:\"/\\|?*".indexOf(value) >= 0) {
                clean.append('-');
            } else {
                clean.append(value);
            }
        }

        String result = clean.toString().trim();
        return result.isEmpty() ? "scanner-records" : result;
    }

    private static boolean numericText(String value) {
        return value != null && value.matches("\\d+");
    }

    private static String escapeXml(String value) {
        String source = value == null ? "" : value;
        StringBuilder escaped = new StringBuilder(source.length());

        for (int index = 0; index < source.length(); index++) {
            char current = source.charAt(index);

            switch (current) {
                case '&':
                    escaped.append("&amp;");
                    break;
                case '<':
                    escaped.append("&lt;");
                    break;
                case '>':
                    escaped.append("&gt;");
                    break;
                case '"':
                    escaped.append("&quot;");
                    break;
                case '\'':
                    escaped.append("&apos;");
                    break;
                default:
                    escaped.append(current);
                    break;
            }
        }

        return escaped.toString();
    }

    static final class SaveResult {
        final String filename;
        final String path;

        SaveResult(String filename, String path) {
            this.filename = filename;
            this.path = path;
        }
    }
}
