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
- [app/api/](app/api/) — REST routes: `login`/`logout`/`session`, `users`, `product-models`, `locations`, `serial-records` (+ `/duplicates`), `scans`, `bootstrap`.
- [components/scanner/](components/scanner/) — scanner UI; [components/admin/](components/admin/) — dashboard UI (Persian date support, sample data).
- [lib/](lib/) — `auth.ts`, `session.ts`, `prisma.ts`, `api-mappers.ts`, `api-utils.ts`, `serial-excel.ts`, `warehouse-location.ts`.
- [prisma/schema.prisma](prisma/schema.prisma) — models `User`, `ProductModel`, `WarehouseLocation`, `SerialRecord`; enums `UserRole`, `MovementType`, `SerialStatus`, `RecordSource`.
- [scripts/](scripts/) — `seed-auth-users.ts`, `import-legacy-sample.ts`, `check-production-readiness.ts`, Android build/install PowerShell scripts.

## Auth (custom — no NextAuth)

[lib/auth.ts](lib/auth.ts): passwords hashed with **scrypt**; session is an **HMAC-SHA256-signed token** stored in cookie `barcode-app-session` (default 8h, `AUTH_SESSION_MAX_AGE_SECONDS`). `getCurrentUser()` in [lib/session.ts](lib/session.ts) verifies the token and re-checks the user is active. `AUTH_SECRET` must stay stable across restarts or everyone is logged out.

## Two Android apps (different package IDs, installable side by side)

- **Capacitor wrapper** — appId `com.hisense.barcode`, name "D'CODE". Loads the deployed `/scanner` page. Config in [capacitor.config.ts](capacitor.config.ts), server URL from `CAPACITOR_SERVER_URL`.
- **Native scanner** — `android-native/`, applicationId `com.hisense.barcode.nativeapp`. Calls the backend APIs directly via `BARCODE_API_BASE_URL`; no dashboard.
- Build both: `npm run android:apk` → publishes to `public/downloads/dcode-barcode-latest.apk` and `public/downloads/barcode-native.apk`.

## Common commands

- `npm run dev` — dev server on `0.0.0.0:3000`.
- `npm run db:push` then `npm run db:auth:seed` — set up DB (seed is local-dev only).
- `npm run lint` / `npm run format`.
- `npm run deploy:check` — production-readiness check + build.

## Deployment

Must run as a **Node server** (`next start`) — not a static export (uses API routes + Prisma). Production target: `bcrs.dcode.co.ir` behind nginx, Node via nvm (v24.x). Runs under **systemd** (`barcode-app.service`, `ExecStart=… npm run start:prod`), **not PM2**. See [DEPLOYMENT.md](DEPLOYMENT.md).

Deploy flow (in `/opt/barcode-app`): `git pull origin main` → `npm ci` → `npx prisma generate` → `npm run db:deploy` → `npm run deploy:check` → `npm run build` → `sudo systemctl restart barcode-app`. Verify: `systemctl status barcode-app --no-pager`, `curl -I http://127.0.0.1:3000/scanner`, `curl -I http://127.0.0.1/scanner`. Note: node/npm come from nvm, so over ssh prefix commands with `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Database backups

Prod DB (`barcode_app`) is backed up by `/home/reza/scripts/backup-db.sh` on the barcode-app server (cron, daily 02:30 IST). It runs `pg_dump -Fc` and rotates grandfather-father-son: `db-backups/{daily(5),weekly(4,Sun),monthly(6,1st)}/`, then `rsync --delete` mirrors all tiers offsite to `ntp-server:/home/reza/barcode-db-backups/`. Log: `~/db-backups/backup.log`.

- **Restore:** `pg_restore -d "<DATABASE_URL without ?schema>" --clean --if-exists <file.dump>`.
- Dumps are **pg_dump 18** custom-format; `pg_restore` **must be ≥ 18** to read them (an older client fails with "unsupported version"). To restore into an older server, use an 18 client against it (works for this simple Prisma schema; a harmless `transaction_timeout` SET error is ignored).

## After changing code

Run `graphify update .` to keep `graphify-out/` current (AST-only, no API cost).
