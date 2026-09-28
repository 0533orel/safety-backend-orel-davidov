# ADR 0002: single-organization sessions and authorization

Status: accepted for SAFE-02, 2026-09-28. Depends on SAFE-01 backend PR #4.

## Context and decision

Safety is one organization's portfolio demonstration, with one PostgreSQL database.
There is no tenant selector, public registration, external identity provider, or client-supplied role.
The server is the authorization boundary. UI login and navigation are SAFE-03.

| Operation | reporter | reviewer | admin |
|---|---|---|---|
| Create incident | Own | Own | Own |
| List/detail/image | Own only | All | All |
| Replace fields/image | Own only | All | All |
| Delete incident | No | No | All |
| List/create/change users | No | No | Yes |

Anonymous callers receive 401 (untrusted write origins receive 403 before authentication).
An authenticated caller lacking access receives 403; missing rows receive 404. This intentionally
distinguishes forbidden IDs from missing IDs in this single-organization demo, without disclosing their contents.
Event ownerId is assigned from the session on create and never accepted from client input.
The migration keeps existing incidents with NULL ownership: staff can access them; reporters cannot.
No existing record is assigned to a guessed owner. There is no ownership-transfer endpoint in SAFE-02.
Reporter list filtering happens in SQL before keyset pagination. Edit access is checked before upload
buffering and again inside the row-lock transaction. Delete is admin-only at both route and service.
Reviewers edit existing incident fields; workflow statuses/history remain SAFE-04.

## Passwords and sessions

Use the maintained Node.js 22 `node:crypto` library's asynchronous, OpenSSL-backed scrypt:
N=131072, r=8, p=1, 16 random salt bytes and 64 derived bytes, with timing-safe comparison.
The stored format is versioned (`scrypt-v1`); plaintext passwords are never persisted or returned.
Passwords require 12 characters and at most 128 UTF-8 bytes. Unknown users incur the same KDF work.
Source: [Node crypto.scrypt documentation](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

Login creates a fresh 256-bit opaque random token; PostgreSQL stores only its SHA-256 digest.
The HttpOnly, SameSite=Lax, Path=/ cookie has an absolute eight-hour lifetime, without sliding refresh.
Production uses Secure and the `__Host-safety_session` name, with no Domain attribute.
Successful login revokes any presented valid-format previous token; logout deletes the session.
Expired sessions are refused on every request and cleaned on successful login. Users and current
roles are read from PostgreSQL on every authenticated request, never trusted from a token claim.
Role, password and active-state updates revoke **all** target sessions in the same transaction.
User management is serialized with a database table lock, rechecks the caller after locking, and
refuses removal of the last active administrator even under concurrent requests. Accounts are deactivated,
not hard-deleted, preserving event ownership. Already-authorized event requests may finish while another
request revokes their session; this is request-boundary revocation, not cancellation of in-flight work.

## Browser topology and CSRF

Local development uses `http://localhost:5173` and `http://localhost:3000`. Use the same hostname;
mixing localhost and 127.0.0.1 breaks the intended same-site cookie topology.
Deployment requires a same-site HTTPS UI/API (prefer one reverse-proxied origin).
Cross-site deployments requiring SameSite=None are unsupported by this ADR.
Every unsafe request, including login, requires an exact allowlisted Origin. Login accepts JSON only.
Other writes additionally require X-CSRF-Token from login or GET /api/auth/me, bound to the random session
token. CORS allows credentials only for explicit configured origins, never `*`; production refuses
missing/non-HTTPS configuration. SameSite and CORS complement the Origin and CSRF checks.
No trust-proxy override is enabled; forwarded IP headers cannot bypass login limits. A future proxy
deployment must deliberately configure and test trusted hops, instead of blindly trusting headers.

Login budgets persist in PostgreSQL with atomic counters: 10/account, 30/socket IP, and 100 globally
per 15-minute fixed window starting at the first attempt. Invalid and successful attempts count too.
429 includes Retry-After. Global checking happens first to bound unique-key storage and KDF work.
These conservative demo limits can temporarily deny legitimate users; they are not a production
bot-defense or availability guarantee. Expired limit rows are removed at the next login attempt.

## Files, seeding and limits

All responses under /api are no-store. GET/HEAD /api/events/:id/image uses event authorization and
serves a basename from the private upload directory with nosniff. Public /uploads paths are retired
(401 without a session; 404 with one). Do not mount uploads through a separate public web server.
Image decoding, metadata stripping and orphan reconciliation remain SAFE-04.

`seed:users` requires explicit ALLOW_DEMO_SEED and an operator-provided DEMO_USER_PASSWORD;
it refuses production. Three synthetic users have distinct salted hashes and usernames demo.reporter,
demo.reviewer, demo.admin. Repeated execution never resets their passwords, roles or active state.
Existing event seed rows stay staff-only. There is no default deployment password or production
bootstrap/recovery flow. Deployment, TLS, operational audit logs, recovery, backups and UI E2E are
not delivered by SAFE-02; this milestone is not full-product demo-ready or production-ready.

Migration rollback removes authentication tables and ownerId; it loses auth data and must not be
used against a live populated deployment without an explicit backup/recovery plan.
