# Safety API
Backend for a Hebrew incident-reporting application. Pair with [Safety frontend](https://github.com/0533orel/safety-orel-davidov).

## Implemented
- Create, list, replace and delete incidents in PostgreSQL through TypeORM.
- Optional PNG/JPEG/WebP uploads up to 5 MiB, checked by file signature.
- Input validation, server-owned IDs/timestamps and consistent HTTP errors.
- JSON and multipart image removal; old images are cleaned up after database commits.
- Row locks serialize updates/deletes to the same incident.
- PostgreSQL-backed login sessions, reporter/reviewer/admin permissions and protected image downloads.
- Admin user creation, role/password changes and deactivation with session revocation.

## Local setup
Requires Node.js 22 and PostgreSQL. Use a dedicated development database with synthetic data.
```sh
npm ci
cp .env.example .env
npm run migration:run
npm run dev
```
On PowerShell use `Copy-Item .env.example .env`. Set database credentials in `.env` first.
Optional local database: `docker compose up -d` (Docker must be running).

## Checks
```sh
npm test
npm run build
npm start
```
`npm test` runs the fast HTTP regressions using pg-mem. The real PostgreSQL suite below
also exercises those scenarios, migrations, seed, deferred commit rollback and row locks.
The default listener is 127.0.0.1:3000. Production start runs compiled JavaScript.
Set CORS_ORIGINS to exact comma-separated frontend origins. Cookie authentication is required
for incidents and users. All writes require an approved Origin; authenticated writes also need CSRF.

## API
| Method | Path | Result |
|---|---|---|
| GET | /health | Process liveness |
| POST | /api/auth/login | JSON username/password; cookie, user, csrfToken, expiresAt |
| GET | /api/auth/me | Current user, csrfToken, expiresAt; 401 if signed out |
| POST | /api/auth/logout | Revoke this session; 204 |
| GET | /api/users?afterId=… | Admin only; `{ items, nextAfterId }`, max 100 |
| POST | /api/users | Admin only; username/password/role (reporter default); 201 |
| PATCH | /api/users/:id | Admin only; role, active and/or password; revokes all target sessions |
| GET | /api/events?limit=50&cursor=… | `{ items, nextCursor }`, newest first |
| GET | /api/events/:id | Authorized incident detail |
| GET | /api/events/:id/image | Authorized image, no-store; HEAD uses identical permissions |
| POST | /api/events | Create; 201 |
| PUT | /api/events/:id | Full writable-field replacement; 200 |
| DELETE | /api/events/:id | Delete; 204 or 404 |

Required strings: unitName, description, eventDate (YYYY-MM-DD), eventTime (HH:mm),
location, result, unitActivity, personalActivity, category, weather, eventSeverity.
Optional strings: injurySeverity, recommendations, coordinates.
All strings are limited to 800 characters. Dates must be valid and not future-dated
in **Asia/Jerusalem**, independently of the browser, OS or `TZ` environment variable.
Date/time fields represent civil wall time, at minute precision, rather than a UTC instant:
they do not disambiguate the repeated hour or validate the skipped hour at DST transitions.
`createdAt` is a server-owned UTC epoch in milliseconds.
Domain options are defined in `src/contract/event-contract.json` (v1), identical to the frontend.
Optional injury severity accepts an empty value, but is required for casualty results.
Civilian locations require coordinates in `123456/123456` format.
IDs, createdAt, ownerId, role and imagePath from event request bodies are ignored.
To attach a file use multipart field `image`; to remove one use `deleteImage: true`
in JSON or `deleteImage=true` in multipart. A new upload takes precedence.

## Scope and remaining work
This is a **local portfolio project**, not a production-ready application or complete product demo.
SAFE-02 implements server authentication and authorization. The current SAFE-01 frontend does not
yet implement login/cookies/CSRF and cannot operate this protected API until SAFE-03 is delivered.
Do not expose it publicly with real incident data. Production bootstrap/recovery, operational audit,
deployment hardening, malware scanning and backups remain. File signatures are not full image decoding.
Cleanup failures are logged; a reconciliation job is still needed.
The repository does not establish ownership or permission for any real data.

## SAFE-01 database and API contract
Deploy the matching SAFE-01 frontend and backend together: list responses changed from an
array to `{ items, nextCursor }`. `limit` defaults to 50, accepts 1–100; malformed values
return 400. Pass `nextCursor` unchanged, URL-encoded, to obtain the next page. Null means
the end. Order is `(createdAt DESC, id DESC)` with a matching index. New inserts appear on
refresh; pagination is not a snapshot of concurrent edits. The frontend loads more on demand
and searches only loaded records.

Migrations run transactionally with `synchronize=false`. The new checks enforce domain
options and valid date/time at the DB boundary. Existing invalid records cause the upgrade
to fail and roll back; inspect/correct those records intentionally before retrying. No records
are silently deleted or mapped to another domain value. Back up an existing DB before upgrades.
The seed adds three fictional incidents using unique internal keys; repeated/concurrent runs
do not duplicate or overwrite incidents. It requires explicit opt-in and refuses production mode.

```sh
npm run migration:run
ALLOW_DEMO_SEED=true npm run seed
npm run build
npm run migration:run:dist
ALLOW_DEMO_SEED=true npm run seed:dist
npm start
```
PowerShell seed opt-in: `$env:ALLOW_DEMO_SEED='true'; npm run seed`.
Compiled migrations use `dist/config/database.js`; reverting one uses
`npm run migration:revert:dist`. Source equivalent: `npm run migration:revert`.

### Real PostgreSQL checks
Tested on Node 22 and PostgreSQL 18. Create a **disposable database ending in `_test`**
and configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME. No external data is needed.
The test suite **drops/recreates its public schema** only with the explicit reset flag:

```sh
DB_NAME=safety_test ALLOW_DATABASE_RESET=true npm run test:postgres
```
PowerShell (set the other connection variables for your local instance first):
```powershell
$env:DB_NAME='safety_test'
$env:ALLOW_DATABASE_RESET='true'
npm run test:postgres
```
The harness verifies source migrations, all down migrations, compiled migrations and repeat
runs; rejected legacy data rolls back the upgrade. It tests source/compiled seed idempotency,
production refusal, HTTP CRUD/IDs/files, time/domain validation, keyset boundaries, real
`pg_blocking_pids` lock waits and deferred transaction failure without losing existing images.
GitHub Actions runs both pg-mem and PostgreSQL 18 suites. Backend `npm run lint` is a TypeScript
no-emit check (no ESLint configuration is claimed).

## SAFE-02 authentication setup and client contract

This change is stacked on backend SAFE-01 [PR #4](https://github.com/0533orel/safety-backend-orel-davidov/pull/4).
Frontend SAFE-01 [PR #7](https://github.com/0533orel/safety-orel-davidov/pull/7) is the baseline for future SAFE-03 UI work.
Neither dependency is assumed merged. See [ADR 0002](docs/adr/0002-authentication.md) for the access matrix,
legacy ownership, password/session design, CSRF topology and limitations.

After migrations, set `ALLOW_DEMO_SEED=true` and supply your own `DEMO_USER_PASSWORD` (12+ characters,
at most 128 UTF-8 bytes) in a local untracked environment. Run `npm run seed:users` or, after build,
`npm run seed:users:dist`. Both refuse `NODE_ENV=production`, never print the password and never
overwrite existing users. The three usernames are `demo.reporter`, `demo.reviewer`, `demo.admin`.
Unset the password and seed flag after seeding. There is no public registration or fixed default password.
Use an admin session to create users or change their password/role/active state. Usernames use 3–64
lowercase ASCII letters/digits/underscore/dot/hyphen and must begin with a letter/digit.

Reporters create, read and edit their own incidents. Reviewers read/edit all incidents. Admins additionally
delete incidents and manage users. Existing incidents and the SAFE-01 event seed have no known owner
and are staff-only. New ownership is assigned from the authenticated user; ownership cannot be transferred.

Client sequence (SAFE-03 will implement it in the frontend):

1. POST JSON `{username,password}` to `/api/auth/login` with `credentials: 'include'`.
2. Retain the returned `csrfToken` in memory. The browser handles the HttpOnly session cookie.
3. Use `credentials: 'include'` on API calls and `X-CSRF-Token` on every POST/PUT/PATCH/DELETE.
4. On refresh, GET `/api/auth/me` to recover user and CSRF token; handle 401 by requesting login.
5. POST `/api/auth/logout` with CSRF, then clear local auth state. A copied old cookie is now invalid.

Browsers set Origin automatically. CLI clients must explicitly send `Origin: http://localhost:5173`
(or the configured trusted origin), retain the cookie and send the CSRF header for writes.
GET/HEAD images use `/api/events/:id/image` with cookies. `/uploads/<filename>` is no longer public
and never serves files; do not expose the upload directory through a proxy or static host.

Development uses the **same hostname** on both ports (localhost UI + localhost API). Production
requires explicitly configured HTTPS origins and same-site HTTPS deployment; cookies then become
Secure with a `__Host-` name. Sessions expire after eight hours. Changing a user's role, password or
active state revokes all sessions; the last active admin cannot be demoted/deactivated.
Login returns 429 + Retry-After after 10 attempts/account, 30/IP or 100 globally within 15 minutes.
These persisted demo budgets include successful logins and are intentionally conservative.

The real-PostgreSQL suite additionally verifies 401/403, reporter pagination/ownership, protected images,
CSRF/CORS, invalid/expired/revoked sessions, role changes, password changes, deactivation, concurrent
admin changes, atomic persistent login limits, source/compiled user seeds and full migration down/up.
