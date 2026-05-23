# Barcode Warehouse - User Guide

## Purpose

Barcode Warehouse helps office and warehouse workers collect product barcode information, register serial records, and send the data to the company server.

## Login

1. Open the Android app or the scanner page.
2. Enter your username.
3. Enter your password.
4. Tap **Login**.

If login fails, check your username and password or contact the system administrator.

## Main Web Panel

The main web panel is available at:

```txt
/
```

Use this page from a desktop browser or tablet when you need to review and manage warehouse data.

### Serial List

The serial list shows registered serial records.

You can:

- Search by document number or customer name.
- Filter records by date range.
- Change the number of rows shown per page.
- Export the serial list to an Excel file.
- Edit a serial record if a correction is needed.
- Delete a wrong record after confirming the action.

### Product Models

The product model section is used to manage the list of known products.

You can:

- Add a new product model.
- Enter the model name, product code, and warranty code.
- Search existing product models.
- Edit product model information.
- Delete a product model if it was entered incorrectly.

If the scanner shows **unknown model**, check this section and make sure the product code exists.

### Manual Serial Entry

If a barcode cannot be scanned, use the serial form in the panel to enter the record manually.

Required information usually includes:

- Date
- Document number
- Customer name
- Product code
- Model
- Tracking code
- Serial number

### Panel Best Practice

- Use the panel for review, correction, and reporting.
- Use the scanner page for fast barcode collection.
- Check product models before starting a large scanning session.
- Export data when the office needs an Excel copy.
- Delete records only when you are sure they are incorrect.

## Start A New Document

After login, the app shows the customer/document screen.

1. Confirm the date.
2. Enter the document number.
3. Enter the customer name.
4. Tap **Collect Barcodes**.

The app will move to the barcode collection screen.

## Scan Barcodes

On the scanner screen, complete the fields in this order:

1. Product code
2. Tracking code
3. Serial number

After scanning the serial number, press Enter on the scanner or keyboard to add the row to the list.

The added records appear in the list at the bottom of the screen. The counter shows how many rows are currently collected.

## Panel And Motor Buttons

Use the **Panel** or **Motor** button when the scanned item is an AC part.

- **Panel**: the tracking code is automatically set to `panel`.
- **Motor**: the app expects a normal tracking code scan.

## Send Records

Tap **Send** when all rows for the document are ready.

The app sends the collected rows to the server. After a successful send, the list is cleared and the app returns to the document screen for the next document.

## Save Excel File

Tap **Save** to create an Excel file from the collected rows.

On Android, the file is saved under:

```txt
Documents/barcode-files
```

This is useful as a backup or when the office needs a local copy.

## Clear Current List

Tap **Clear** to remove the current unsent rows from the screen.

Use this carefully. Cleared rows must be scanned again if they were not already sent.

## Delete One Row

Each scanned row has a delete button. Use it to remove only that row from the current list.

## Good Working Practice

- Make sure the internet connection is available before sending records.
- Check the document number and customer name before scanning.
- Watch the row counter after each scan.
- If a barcode is wrong, delete that row and scan it again.
- Send records before closing the app.
- Save an Excel file if you need a local backup.

## Common Problems

### Login does not work

Check username/password and try again. If it still fails, contact the administrator.

### Product model shows as unknown

The product code may not exist in the product model list. Contact the administrator to add or correct the model.

### Send fails

Check the internet connection and try again. If the problem continues, save the Excel file and report the issue.

### App opens login every time

This is expected for the beta Android scanner URL. It starts with a fresh login to avoid using another worker's old session.
