# Safety API
Backend for a Hebrew incident-reporting application. Pair with [Safety frontend](https://github.com/0533orel/safety-orel-davidov).

## Implemented
- Create, list, replace and delete incidents in PostgreSQL through TypeORM.
- Optional PNG/JPEG/WebP uploads up to 5 MiB, checked by file signature.
- Input validation, server-owned IDs/timestamps and consistent HTTP errors.
- JSON and multipart image removal; old images are cleaned up after database commits.
- Row locks serialize updates/deletes to the same incident.

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
Set CORS_ORIGINS to a comma-separated list of frontend origins. It is not authentication.

## API
| Method | Path | Result |
|---|---|---|
| GET | /health | Process liveness |
| GET | /api/events?limit=50&cursor=… | `{ items, nextCursor }`, newest first |
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
IDs, createdAt and imagePath from request bodies are ignored.
To attach a file use multipart field `image`; to remove one use `deleteImage: true`
in JSON or `deleteImage=true` in multipart. A new upload takes precedence.

## Scope and remaining work
This is a **local portfolio demo**, not an authenticated production application.
Do not expose it publicly with real incident data. User authentication, role authorization,
rate limiting, malware scanning and backups remain to be implemented. File signatures are not full image decoding.
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
