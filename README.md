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
Tests exercise HTTP routes and file lifecycle using pg-mem, an isolated PostgreSQL emulator.
They do not validate real PostgreSQL locking, rollback or deployment behavior.
The default listener is 127.0.0.1:3000. Production start runs compiled JavaScript.
Set CORS_ORIGINS to a comma-separated list of frontend origins. It is not authentication.

## API
| Method | Path | Result |
|---|---|---|
| GET | /health | Process liveness |
| GET | /api/events | Events, newest first |
| POST | /api/events | Create; 201 |
| PUT | /api/events/:id | Full writable-field replacement; 200 |
| DELETE | /api/events/:id | Delete; 204 or 404 |

Required strings: unitName, description, eventDate (YYYY-MM-DD), eventTime (HH:mm),
location, result, unitActivity, personalActivity, category, weather, eventSeverity.
Optional strings: injurySeverity, recommendations, coordinates.
All strings are limited to 800 characters. Dates must be valid and not future-dated
in the server timezone. Configure the server timezone to match intended users.
IDs, createdAt and imagePath from request bodies are ignored.
To attach a file use multipart field `image`; to remove one use `deleteImage: true`
in JSON or `deleteImage=true` in multipart. A new upload takes precedence.

## Scope and remaining work
This is a **local portfolio demo**, not an authenticated production application.
Do not expose it publicly with real incident data. User authentication, role authorization,
rate limiting, pagination, domain-specific enum validation, malware scanning, backups and
real-PostgreSQL integration tests remain to be implemented. File signatures are not full image decoding.
Cleanup failures are logged; a reconciliation job is still needed.
The repository does not establish ownership or permission for any real data.
