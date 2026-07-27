@AGENTS.md

# Barcode Warehouse App

Warehouse barcode scanning + inventory management for Hisense. Operators scan product serials/tracking codes; admins manage models, locations, users, and serial records through a dashboard.

## Stack (read carefully — versions are ahead of common knowledge)

- **Next.js 16** (App Router). The pinned warning in AGENTS.md is real: read `node_modules/next/dist/docs/` before writing Next code; APIs differ from older Next.
- **React 19**, **MUI 9** (`@mui/material` + Emotion), Tailwind 4 (PostCSS plugin).
- **Prisma 7** with the **`PrismaPg` driver adapter** (`@prisma/adapter-pg`), not the default engine. Client is constructed in [lib/prisma.ts](lib/prisma.ts) from `DATABASE_URL`.
- **PostgreSQL**. Schema-only workflow: `npm run db:push` (Prisma `db push`) — there is **no migrations directory**, do not run `prisma migrate`.
- **Capacitor 8** Android wrapper + a separate **native Android** scanner under `android-native/`.
- TypeScript, ESLint + Prettier (enforced via Husky + lint-staged on commit).

## Layout

- [app/](app/) — App Router pages + API routes. `app/scanner/` is the operator scanner page; `app/page.tsx` is the admin dashboard entry.
- [app/api/](app/api/) — REST routes: `login`/`logout`/`session`, `users`, `product-models`, `locations`, `serial-records` (+ `/duplicates`, `/export`, `/import`), `scans`, `bootstrap`.
- [components/scanner/](components/scanner/) — scanner UI; [components/admin/](components/admin/) — dashboard UI (Persian date support, sample data, `serial-import-dialog.tsx`).
- [lib/](lib/) — `auth.ts`, `session.ts`, `roles.ts`, `prisma.ts`, `api-mappers.ts`, `api-utils.ts`, `serial-excel.ts`, `serial-import.ts`, `xlsx-read.ts`, `warehouse-location.ts`.
- [prisma/schema.prisma](prisma/schema.prisma) — models `User`, `ProductModel`, `WarehouseLocation`, `SerialRecord`; enums `UserRole`, `MovementType`, `SerialStatus`, `RecordSource`.
- [scripts/](scripts/) — `seed-auth-users.ts`, `import-legacy-sample.ts`, `check-production-readiness.ts`, Android build/install PowerShell scripts.

## Auth (custom — no NextAuth)

[lib/auth.ts](lib/auth.ts): passwords hashed with **scrypt**; session is an **HMAC-SHA256-signed token** stored in cookie `barcode-app-session` (default 8h, `AUTH_SESSION_MAX_AGE_SECONDS`). `getCurrentUser()` in [lib/session.ts](lib/session.ts) verifies the token and re-checks the user is active. `AUTH_SECRET` must stay stable across restarts or everyone is logged out.

### Roles and route guards

Three roles (`UserRole`): **ADMIN** (everything, only role that manages user accounts), **MANAGER** (warehouse data: serials, product models, locations, Excel import), **USER** (scanner operators: sign in, scan, send serials, read lists).

[lib/roles.ts](lib/roles.ts) holds the names plus `canManageData()`/`canManageUsers()` and is kept **free of server-only imports** so the dashboard gates its UI with exactly the predicate the API enforces. [lib/session.ts](lib/session.ts) wraps them as guards that return either the user or the error `Response`:

```ts
const auth = await requireManager(request);
if (auth instanceof Response) return auth;
```

`requireUser` / `requireManager` / `requireAdmin` are applied to **every** route except `login`, `logout`, `session`. `GET /api/bootstrap` withholds the `users` array from non-admins rather than rejecting them. Deletes and updates map Prisma `P2025` to a 404 via `isRecordNotFoundError()` in [lib/api-utils.ts](lib/api-utils.ts) — without it a stale dashboard row produces a bare 500 with an empty body.

## Movement is always OUTBOUND

A serial is only ever recorded as it **leaves** the warehouse. `POST /api/serial-records` therefore **ignores the request's `movement`** and always writes `OUTBOUND` + `EXITED`. Deciding it server-side keeps new rows correct even when an M3 device is still running an older APK that sends `ورود`. Records created before 2026-07-27 are deliberately left as `INBOUND` — there is no backfill, do not add one without asking. `MovementType` stays in the schema because [app/api/scans/route.ts](app/api/scans/route.ts) supports both directions for the dashboard scan panel.

## Offline Excel recovery

When a device loses connection the operator can only save a local Excel backup, so those serials never reach the DB. [lib/xlsx-read.ts](lib/xlsx-read.ts) is a dependency-free `.xlsx` reader (Node `zlib` only — **do not add a spreadsheet library**) and [lib/serial-import.ts](lib/serial-import.ts) is the ingest core, deliberately Excel-agnostic so a future device outbox can post the same shape. `POST /api/serial-records/import` is multipart and defaults to `dryRun=true`; the dashboard always previews before committing. Imported rows get `RecordSource.EXCEL_IMPORT`.

## Two Android apps (different package IDs, installable side by side)

- **Capacitor wrapper** — appId `com.hisense.barcode`, name "D'CODE". Loads the deployed `/scanner` page. Config in [capacitor.config.ts](capacitor.config.ts), server URL from `CAPACITOR_SERVER_URL`.
- **Native scanner** — `android-native/`, applicationId `com.hisense.barcode.nativeapp`. Calls the backend APIs directly via `BARCODE_API_BASE_URL`; no dashboard. **This is the one the dashboard offers for download** ([lib/app-info.ts](lib/app-info.ts) `NATIVE_APK_DOWNLOAD_PATH`).
- Build both: `npm run android:apk` → publishes to `public/downloads/dcode-barcode-latest.apk` and `public/downloads/barcode-native.apk`.
- Version lives in three places that must stay in sync: `package.json` (drives `APP_VERSION`), `android-native/app/build.gradle`, `android/app/build.gradle`.

### Building behind the Google Maven block

`dl.google.com/dl/android/maven2` is **geo-blocked from this network** — every artifact returns 404, so `npm run android:apk` fails on the Capacitor project's AndroidX dependencies unless the Gradle cache already has them. The native app declares **no dependencies at all**, so it builds offline once you supply `aapt2` from the local SDK:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
cd android-native
.\gradlew.bat :app:assembleDebug "-PBARCODE_API_BASE_URL=http://bcrs.dcode.co.ir" `
  "-Pandroid.aapt2FromMavenOverride=$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\aapt2.exe" --offline
```

Then copy `android-native/app/build/outputs/apk/debug/app-debug.apk` to `public/downloads/barcode-native.apk`.

## Common commands

- `npm run dev` — dev server on `0.0.0.0:3000`.
- `npm run db:push` then `npm run db:auth:seed` — set up DB (seed is local-dev only).
- `npm run lint` / `npm run format`.
- `npm run deploy:check` — production-readiness check + build.

## Deployment

Must run as a **Node server** (`next start`) — not a static export (uses API routes + Prisma). Production target: `bcrs.dcode.co.ir` behind nginx, Node via nvm (v24.x). Runs under **systemd** (`barcode-app.service`, `ExecStart=… npm run start:prod`), **not PM2**. See [DEPLOYMENT.md](DEPLOYMENT.md).

Deploy flow (in `/opt/barcode-app`): `git pull origin main` → `npm ci` → `npx prisma generate` → **`npx prisma db push`** → `npm run deploy:check` → `npm run build` → `sudo systemctl restart barcode-app`. Use bare `prisma db push`, **not `npm run db:deploy`** — that also runs the auth seed, which resets every production password. Verify: `systemctl status barcode-app --no-pager`, `curl -I http://127.0.0.1:3000/scanner`, `curl -I http://127.0.0.1/scanner`. Note: node/npm come from nvm, so over ssh prefix commands with `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Database backups

Prod DB (`barcode_app`) is backed up by `/home/reza/scripts/backup-db.sh` on the barcode-app server (cron, daily 02:30 IST). It runs `pg_dump -Fc` and rotates grandfather-father-son: `db-backups/{daily(5),weekly(4,Sun),monthly(6,1st)}/`, then `rsync --delete` mirrors all tiers offsite to `ntp-server:/home/reza/barcode-db-backups/`. Log: `~/db-backups/backup.log`.

- **Restore:** `pg_restore -d "<DATABASE_URL without ?schema>" --clean --if-exists <file.dump>`.
- Dumps are **pg_dump 18** custom-format; `pg_restore` **must be ≥ 18** to read them (an older client fails with "unsupported version"). To restore into an older server, use an 18 client against it (works for this simple Prisma schema; a harmless `transaction_timeout` SET error is ignored).

## After changing code

Run `graphify update .` to keep `graphify-out/` current (AST-only, no API cost).
