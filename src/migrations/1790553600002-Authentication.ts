import { MigrationInterface, QueryRunner } from 'typeorm';
export class Authentication1790553600002 implements MigrationInterface {
    async up(q: QueryRunner): Promise<void> {
        await q.query(`CREATE TABLE auth_users (
            id SERIAL PRIMARY KEY, username text NOT NULL UNIQUE,
            "passwordHash" text NOT NULL, role text NOT NULL CHECK (role IN ('reporter','reviewer','admin')),
            active boolean NOT NULL DEFAULT true,
            CONSTRAINT username_format CHECK (username ~ '^[a-z0-9][a-z0-9_.-]{2,63}$'))`);
        await q.query(`CREATE TABLE auth_sessions (
            "tokenHash" text PRIMARY KEY, "userId" integer NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
            "expiresAt" bigint NOT NULL)`);
        await q.query('CREATE INDEX sessions_user ON auth_sessions ("userId")');
        await q.query('CREATE INDEX sessions_expiry ON auth_sessions ("expiresAt")');
        await q.query(`CREATE TABLE auth_login_limits (key text PRIMARY KEY, attempts integer NOT NULL, "resetAt" bigint NOT NULL)`);
        await q.query('CREATE INDEX login_limits_expiry ON auth_login_limits ("resetAt")');
        // No invented ownership: pre-authentication rows remain restricted to staff.
        await q.query('ALTER TABLE safety_events ADD COLUMN "ownerId" integer REFERENCES auth_users(id) ON DELETE RESTRICT');
        await q.query('CREATE INDEX events_owner_page ON safety_events ("ownerId", "createdAt" DESC, id DESC)');
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query('ALTER TABLE safety_events DROP COLUMN "ownerId"');
        await q.query('DROP TABLE auth_login_limits');
        await q.query('DROP TABLE auth_sessions');
        await q.query('DROP TABLE auth_users');
    }
}
