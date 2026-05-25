# Barcode Warehouse - Operator Guide

## Introduction

Barcode Warehouse helps warehouse and office operators collect barcode information, register serial records, and send inventory data to the central server.

The system is optimized for fast barcode workflows using Android scanners and mobile devices.

---

## Login

1. Open the scanner application.
2. Enter your username.
3. Enter your password.
4. Tap **Login**.

If login fails, contact the system administrator.

---

## Start a New Document

After login:

1. Verify the date.
2. Enter the document number.
3. Enter the customer name.
4. Tap **Collect Barcodes**.

The scanner page will open.

---

## Barcode Scanning Workflow

Scan the fields in the following order:

1. Product Code
2. Tracking Code
3. Serial Number

After scanning the serial number:

- Press Enter on the scanner or keyboard
- The row will be added automatically

Collected rows appear at the bottom of the screen.

---

## AC Product Buttons

For AC-related products:

### Panel

Automatically sets the tracking code to:

```txt
panel
```

### Motor

Waits for a normal tracking code scan.

---

## Sending Records

When scanning is complete:

1. Review the collected rows
2. Tap **Send**

After successful submission:

- Data is sent to the server
- The current list is cleared
- The system returns to the document page

---

## Save Excel File

Tap **Save** to create an Excel backup file.

Android save location:

```txt
Documents/barcode-files
```

This file can be used as a local backup.

---

## Delete One Row

Each row contains a delete button.

Use it to remove incorrect rows before submission.

---

## Clear Current List

Tap **Clear** to remove all unsent rows.

Use carefully. Cleared rows must be scanned again.

---

## Main Web Dashboard

Dashboard route:

```txt
/
```

The dashboard is intended for desktop or tablet usage.

Main capabilities:

- Record search
- Record filtering
- Excel export
- Product management
- Record correction
- Administrative review

---

## Product Management

Administrators can:

- Add product models
- Edit product information
- Delete incorrect models
- Search product records

If the scanner shows:

```txt
Unknown Product
```

the Product Code may not exist in the system.

---

## Manual Record Entry

If barcode scanning is unavailable, records can be entered manually from the web dashboard.

Typical fields include:

- Date
- Document Number
- Customer Name
- Product Code
- Product Model
- Tracking Code
- Serial Number

---

## Best Practices

- Verify document information before scanning
- Check row counts regularly
- Review rows before sending
- Keep internet connectivity active
- Save Excel backups when necessary
- Send records before closing the application

---

## Common Problems

### Login Failure

Check username and password or contact the administrator.

---

### Unknown Product

The Product Code may not exist in the database.

Contact the administrator.

---

### Send Failure

Check internet connectivity and try again.

If the issue continues:

1. Save the Excel file
2. Report the problem to the administrator

---

### Application Requests Login Again

The application may require login again after reopening for security purposes.

---

## Recommended Workflow

1. Login
2. Create document
3. Scan products
4. Review rows
5. Send records
6. Save backup if needed
7. Start next document
