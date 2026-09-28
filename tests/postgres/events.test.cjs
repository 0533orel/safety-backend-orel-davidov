// The harness provisions a disposable database before loading the shared HTTP suite.
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const connection = {
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};
if (!connection.database?.endsWith('_test') || process.env.ALLOW_DATABASE_RESET !== 'true')
  throw new Error('Requires dedicated DB_NAME ending _test and ALLOW_DATABASE_RESET=true; public schema is reset');
process.env.SAFETY_REAL_POSTGRES = 'true';
const sql = new Client(connection);
function cli(file, args = [], extra = {}) {
  return spawnSync(process.execPath, [file, ...args], {
    cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', timeout: 60000
  });
}
function success(result) {
  assert.equal(result.status, 0, result.stderr + result.stdout);
}
// Node may start multiple before hooks together; gate all HTTP fixtures on completed migrations.
let resolveReady, rejectReady;
module.exports.migrationsReady = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
before(async () => {
  try {
  await sql.connect();
  await sql.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  success(cli('node_modules/typeorm/cli-ts-node-commonjs.js', ['migration:run', '-d', 'src/config/database.ts']));
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM migrations')).rows[0].n, 4);
  // Full down/up from compiled JavaScript, then a repeat run (no pending migrations).
  for (let i = 0; i < 4; i++) success(cli('node_modules/typeorm/cli.js', ['migration:revert', '-d', 'dist/config/database.js']));
  assert.equal((await sql.query("SELECT to_regclass('safety_events') AS name")).rows[0].name, null);
  success(cli('node_modules/typeorm/cli.js', ['migration:run', '-d', 'dist/config/database.js']));
  success(cli('node_modules/typeorm/cli.js', ['migration:run', '-d', 'dist/config/database.js']));
  assert.notEqual(cli('dist/seed.js', [], { ALLOW_DEMO_SEED: 'false' }).status, 0);
  assert.notEqual(cli('dist/seed.js', [], { ALLOW_DEMO_SEED: 'true', NODE_ENV: 'production' }).status, 0);
  success(cli('node_modules/ts-node/dist/bin.js', ['src/seed.ts'], { ALLOW_DEMO_SEED: 'true' }));
  const original = (await sql.query('SELECT * FROM safety_events ORDER BY id')).rows;
  success(cli('dist/seed.js', [], { ALLOW_DEMO_SEED: 'true' }));
  assert.equal(original.length, 3);
  assert.deepEqual((await sql.query('SELECT * FROM safety_events ORDER BY id')).rows, original);
  // An upgrade with legacy invalid values must fail atomically, without deleting data.
  for (let i = 0; i < 3; i++) success(cli('node_modules/typeorm/cli.js', ['migration:revert', '-d', 'dist/config/database.js']));
  await sql.query("UPDATE safety_events SET category='legacy-invalid'");
  assert.notEqual(cli('node_modules/typeorm/cli.js', ['migration:run', '-d', 'dist/config/database.js']).status, 0);
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM migrations')).rows[0].n, 1);
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM safety_events')).rows[0].n, 3);
  assert.equal((await sql.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conname LIKE 'domain_%'")).rows[0].n, 0);
  await sql.query('UPDATE safety_events SET category=$1', ['עבודה']);
  success(cli('node_modules/typeorm/cli.js', ['migration:run', '-d', 'dist/config/database.js']));
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM safety_events')).rows[0].n, 3);
  // Restore fixture keys removed by the deliberate down migration.
  for (const row of original) await sql.query('UPDATE safety_events SET "demoKey"=$1 WHERE id=$2', [row.demoKey, row.id]);
  // Migrations and seed are verified before any shared HTTP test runs.
  resolveReady();
  } catch (error) { rejectReady(error); throw error; }
});
require('../events.test.cjs');
test('migration inventory, compiled restart persistence and seed remain intact', async () => {
  const { AppDataSource } = require('../../dist/config/database');
  await AppDataSource.destroy();
  await AppDataSource.initialize();
  const response = await require('../events.test.cjs').authenticatedRequest().get('/api/events').expect(200);
  assert.ok(response.body.items.length >= 3);
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM migrations')).rows[0].n, 4);
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM safety_events WHERE "demoKey" IS NOT NULL')).rows[0].n, 3);
});
test('development user seed requires an operator password, refuses production and preserves edited users', async () => {
  const { randomBytes } = require('node:crypto');
  const password = randomBytes(18).toString('hex');
  for (const extra of [
    { ALLOW_DEMO_SEED: 'false', DEMO_USER_PASSWORD: password },
    { ALLOW_DEMO_SEED: 'true', NODE_ENV: 'production', DEMO_USER_PASSWORD: password },
    { ALLOW_DEMO_SEED: 'true', DEMO_USER_PASSWORD: '' }
  ]) assert.notEqual(cli('dist/seedUsers.js', [], extra).status, 0);
  success(cli('node_modules/ts-node/dist/bin.js', ['src/seedUsers.ts'], { ALLOW_DEMO_SEED: 'true', DEMO_USER_PASSWORD: password }));
  const original = (await sql.query("SELECT * FROM auth_users WHERE username LIKE 'demo.%' ORDER BY id")).rows;
  assert.equal(original.length, 3);
  assert.equal(new Set(original.map(u => u.passwordHash)).size, 3);
  assert.ok(original.every(u => !u.passwordHash.includes(password)));
  const { verifyPassword } = require('../../dist/auth/password');
  for (const u of original) assert.ok(await verifyPassword(password, u.passwordHash));
  await sql.query("UPDATE auth_users SET active=false WHERE username='demo.reporter'");
  success(cli('dist/seedUsers.js', [], { ALLOW_DEMO_SEED: 'true', DEMO_USER_PASSWORD: randomBytes(18).toString('hex') }));
  const repeated = (await sql.query("SELECT * FROM auth_users WHERE username LIKE 'demo.%' ORDER BY id")).rows;
  assert.deepEqual(repeated.map(u => u.passwordHash), original.map(u => u.passwordHash));
  assert.equal(repeated.find(u => u.username === 'demo.reporter').active, false);
});
after(async () => { await sql.end(); });
