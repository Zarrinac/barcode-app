# Barcode Warehouse - Beta Documentation

## Overview

Barcode Warehouse is a beta warehouse barcode scanning and inventory tracking app for office and warehouse workers. It is built as a Next.js web application with a Capacitor Android wrapper for the scanner workflow.

The Android app opens the deployed scanner page:

" http://bcrs.dcode.co.ir/scanner?freshLogin=1 "

## Current Beta Scope

- User login with seeded office accounts.
- Product model management.
- Serial record management.
- Barcode collection for inbound warehouse records.
- Android scanner workflow through Capacitor.
- Excel export/save for collected serial rows.
- PostgreSQL database storage through Prisma.
- nginx reverse proxy in front of the Next.js server.

## Technology Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Prisma
- Material UI icons/components
- Capacitor for Android
- nginx as reverse proxy

## Main App Areas

### Web Dashboard

The main dashboard is available from:

" / "

It is used for managing product models, serial records, searching records, filtering by date, and exporting serial data.

### Scanner App

The scanner workflow is available from:

" /scanner "

It is optimized for office workers using the Android app or a mobile browser. Users log in, enter document/customer information, scan product/tracking/serial barcodes, then send records to the server.

## Android App

The Android app is built with Capacitor. It is a native Android shell around the deployed web scanner page, not a separate native rewrite.

The production/beta server URL is configured with:

```env
CAPACITOR_SERVER_URL="http://bcrs.dcode.co.ir/scanner?freshLogin=1"
```

To build the beta APK:

```powershell
$env:CAPACITOR_SERVER_URL="http://bcrs.dcode.co.ir/scanner?freshLogin=1"
npm run android:apk
```

The debug APK is generated at:

" android/app/build/outputs/apk/debug/app-debug.apk "

## Deployment Summary

This app must run as a Node.js server because it uses Next.js API routes and Prisma/PostgreSQL. It should not be deployed as a static export.

Basic production flow:

```bash

npm ci
npm run db:deploy
npm run build
npm run start:prod

```

nginx should proxy public traffic to:

" http://127.0.0.1:3000 "

See `DEPLOYMENT.md` for the full server and nginx setup.

## Beta Notes

- This beta is intended for controlled office use.
- Keep database backups before and during beta testing.
- Change default seeded passwords before wider distribution.
- The current Android beta uses `http://`; moving to `https://` is recommended before public production release.
- Collect feedback from office users about login, scanning speed, barcode errors, and missing workflows.
