const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const { client, fixtureSession, origin } = require('./auth-support.cjs');
module.exports = ({ context, event, png }) => {
  const login = (app, username, password) => client(app).post('/api/auth/login').send({ username, password });
  const credentialsOf = r => ({ cookie: r.headers['set-cookie'][0].split(';')[0], csrfToken: r.body.csrfToken });
  test('anonymous requests cannot read/write events, images or users', async () => {
    const { app, credentials } = context();
    const row = await client(app, credentials).post('/api/events').send(event).expect(201);
    for (const url of ['/api/events', '/api/events/' + row.body.id, '/api/events/' + row.body.id + '/image', '/uploads/known.png', '/api/users', '/api/auth/me'])
      await client(app).get(url).expect(401);
    for (const [method, url] of [['post', '/api/events'], ['put', '/api/events/' + row.body.id], ['delete', '/api/events/' + row.body.id], ['post', '/api/users']])
      await client(app)[method](url).send(event).expect(401);
    await request(app).get('/health').expect(200);
  });
  test('reporter ownership applies to list pages, detail, update and protected image; staff has explicit permissions', async () => {
    const { app, db, uploads, credentials } = context();
    const a = await fixtureSession(db, 'reporter.a', 'reporter');
    const b = await fixtureSession(db, 'reporter.b', 'reporter');
    const reviewer = await fixtureSession(db, 'staff.reviewer', 'reviewer');
    const api = client(app, a), other = client(app, b), staff = client(app, reviewer), admin = client(app, credentials);
    let upload = api.post('/api/events');
    for (const [k, v] of Object.entries({ ...event, ownerId: b.user.id, role: 'admin' })) upload = upload.field(k, String(v));
    const row = (await upload.attach('image', png, 'pixel.png').expect(201)).body;
    assert.equal(row.ownerId, a.user.id);
    const base = '/api/events/' + row.id;
    await api.get(base).expect(200);
    const image = await api.get(base + '/image').expect(200).expect('Cache-Control', 'no-store');
    assert.deepEqual(image.body, png);
    await other.get(base).expect(403);
    await other.get(base + '/image').expect(403);
    await other.head(base + '/image').expect(403);
    const files = (await fs.readdir(uploads)).sort();
    await other.put(base).attach('image', png, 'pixel.png').expect(403);
    assert.deepEqual((await fs.readdir(uploads)).sort(), files);
    await api.get('/uploads/' + row.imagePath).expect(404);
    await client(app).get('/uploads/' + row.imagePath).expect(401);
    const updated = await api.put(base).send({ ...event, ownerId: b.user.id, description: 'Own edit' }).expect(200);
    assert.equal(updated.body.ownerId, a.user.id);
    await api.delete(base).expect(403);
    await staff.get(base + '/image').expect(200);
    await staff.put(base).send(event).expect(200);
    await staff.delete(base).expect(403);
    for (let i = 0; i < 3; i++) await api.post('/api/events').send(event).expect(201);
    let cursor, seen = [];
    do {
      const page = (await api.get('/api/events').query({ limit: 1, ...(cursor ? { cursor } : {}) }).expect(200)).body;
      assert.ok(page.items.every(r => r.ownerId === a.user.id)); seen.push(...page.items); cursor = page.nextCursor;
    } while (cursor);
    assert.equal(seen.length, 4);
    assert.deepEqual((await other.get('/api/events').expect(200)).body.items, []);
    const legacy = (await db.query('SELECT id FROM safety_events WHERE "ownerId" IS NULL LIMIT 1'))[0];
    await api.get('/api/events/' + legacy.id).expect(403);
    await staff.get('/api/events/' + legacy.id).expect(200);
    await admin.delete(base).expect(204);
    await api.get(base + '/image').expect(404);
    for (const who of [api, staff]) {
      await who.get('/api/users').expect(403);
      await who.post('/api/users').send({ username: 'escalated', role: 'admin' }).expect(403);
      await who.patch('/api/users/' + a.user.id).send({ role: 'admin' }).expect(403);
    }
  });
  test('CSRF, exact Origin, CORS credentials and production cookie configuration', async () => {
    const { app, credentials } = context();
    await request(app).post('/api/events').set('Cookie', credentials.cookie).send(event).expect(403);
    await request(app).post('/api/events').set('Origin', origin).set('Cookie', credentials.cookie).send(event).expect(403);
    await request(app).post('/api/events').set('Origin', origin).set('Cookie', credentials.cookie).set('X-CSRF-Token', '0'.repeat(64)).send(event).expect(403);
    await client(app, credentials).post('/api/events').set('Origin', 'https://evil.invalid').send(event).expect(403);
    await request(app).post('/api/auth/login').send({}).expect(403);
    await client(app).post('/api/auth/login').set('Origin', 'null').send({}).expect(403);
    await request(app).options('/api/events').set('Origin', origin).set('Access-Control-Request-Method', 'POST')
      .expect('Access-Control-Allow-Origin', origin).expect('Access-Control-Allow-Credentials', 'true').expect(204);
    const evil = await request(app).options('/api/events').set('Origin', 'https://evil.invalid').set('Access-Control-Request-Method', 'POST');
    assert.equal(evil.headers['access-control-allow-origin'], undefined);
    const old = process.env.NODE_ENV, cors = process.env.CORS_ORIGINS;
    try {
      process.env.NODE_ENV = 'production';
      const { cookieName, cookieOptions } = require('../dist/auth/session');
      assert.equal(cookieName(), '__Host-safety_session'); assert.equal(cookieOptions().secure, true);
      assert.throws(() => require('../dist/server').createApp(), /HTTPS/);
      process.env.CORS_ORIGINS = 'https://safety.example';
      require('../dist/server').createApp();
    } finally {
      if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
      if (cors === undefined) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = cors;
    }
  });
  test('login issues opaque hashed sessions, rotates presented cookies, persists, expires and revokes on logout', async () => {
    const { app, db, credentials } = context();
    await db.query('TRUNCATE auth_login_limits');
    const password = randomBytes(18).toString('hex');
    const admin = client(app, credentials);
    const user = (await admin.post('/api/users').send({ username: 'login.reporter', password, role: 'reporter' }).expect(201)).body;
    assert.equal(user.passwordHash, undefined);
    await login(app, 'login.reporter', 'bad-password').expect(401);
    await login(app, 'unknown.person', 'bad-password').expect(401);
    const r = await login(app, 'LOGIN.REPORTER', password).expect(200);
    assert.match(r.headers['set-cookie'][0], /HttpOnly/); assert.match(r.headers['set-cookie'][0], /SameSite=Lax/);
    assert.match(r.headers['set-cookie'][0], /Max-Age=28800/);
    let auth = credentialsOf(r);
    const { digest } = require('../dist/auth/session');
    const raw = auth.cookie.split('=')[1];
    const stored = (await db.query('SELECT * FROM auth_sessions WHERE "tokenHash"=$1', [digest(raw)]))[0];
    assert.ok(stored); assert.ok(!JSON.stringify(stored).includes(raw));
    await client(require('../dist/server').createApp(), auth).get('/api/auth/me').expect(200);
    const rotated = await client(app, auth).post('/api/auth/login').send({ username: 'login.reporter', password }).expect(200);
    await client(app, auth).get('/api/auth/me').expect(401);
    auth = credentialsOf(rotated);
    await client(app, auth).post('/api/auth/logout').expect(204);
    await client(app, auth).get('/api/events').expect(401);
    const expired = credentialsOf(await login(app, 'login.reporter', password).expect(200));
    await db.query('UPDATE auth_sessions SET "expiresAt"=$1 WHERE "userId"=$2', [Date.now() - 1, user.id]);
    await client(app, expired).get('/api/auth/me').expect(401);
    await client(app, { ...expired, cookie: 'safety_session=' + 'f'.repeat(64) }).get('/api/events').expect(401);
    await client(app, { ...expired, cookie: expired.cookie + '; ' + expired.cookie }).get('/api/events').expect(401);
  });
  test('admin manages accounts, role/password/active changes revoke all sessions and the last admin is protected', async () => {
    const { app, db, credentials } = context();
    await db.query('TRUNCATE auth_login_limits');
    const admin = client(app, credentials), password = randomBytes(18).toString('hex');
    const created = (await admin.post('/api/users').send({ username: 'managed.user', password }).expect(201)).body;
    assert.equal(created.role, 'reporter');
    await admin.post('/api/users').send({ username: 'managed.user', password }).expect(409);
    await admin.post('/api/users').send({ username: 'bad.user', password: 'short', role: 'admin' }).expect(400);
    await admin.post('/api/users').send({ username: 'bad.user', password, role: 'root' }).expect(400);
    const auth1 = credentialsOf(await login(app, 'managed.user', password).expect(200));
    const auth2 = credentialsOf(await login(app, 'managed.user', password).expect(200));
    await admin.patch('/api/users/' + created.id).send({ role: 'reviewer' }).expect(200);
    await client(app, auth1).get('/api/events').expect(401);
    await client(app, auth2).get('/api/events').expect(401);
    const reauth = await login(app, 'managed.user', password).expect(200);
    assert.equal(reauth.body.user.role, 'reviewer');
    await admin.patch('/api/users/' + created.id).send({ role: 'reporter' }).expect(200);
    await client(app, credentialsOf(reauth)).get('/api/events').expect(401);
    const nextPassword = randomBytes(18).toString('hex');
    await admin.patch('/api/users/' + created.id).send({ password: nextPassword }).expect(200);
    await login(app, 'managed.user', password).expect(401);
    const finalAuth = credentialsOf(await login(app, 'managed.user', nextPassword).expect(200));
    await admin.patch('/api/users/' + created.id).send({ active: false }).expect(200);
    await client(app, finalAuth).get('/api/auth/me').expect(401);
    await login(app, 'managed.user', nextPassword).expect(401);
    await admin.patch('/api/users/' + credentials.user.id).send({ role: 'reporter' }).expect(409);
    await admin.patch('/api/users/' + credentials.user.id).send({ active: false }).expect(409);
    await admin.patch('/api/users/' + created.id).send({ username: 'rename' }).expect(400);
    const inventory = await admin.get('/api/users').expect(200);
    assert.ok(inventory.body.items.every(u => Object.keys(u).sort().join() === 'active,id,role,username'));
    await admin.patch('/api/users/' + created.id).send({ active: true, role: 'admin' }).expect(200);
    const second = credentialsOf(await login(app, 'managed.user', nextPassword).expect(200));
    // Both administrators attempt to demote the other concurrently: exactly one succeeds.
    const responses = await Promise.all([
      admin.patch('/api/users/' + created.id).send({ role: 'reporter' }),
      client(app, second).patch('/api/users/' + credentials.user.id).send({ role: 'reporter' })
    ]);
    assert.equal(responses.filter(r => r.status === 200).length, 1);
    assert.ok(responses.every(r => [200, 401, 403].includes(r.status)));
    assert.equal((await db.query("SELECT count(*)::int AS n FROM auth_users WHERE active AND role='admin'")).map(r => r.n)[0], 1);
    // Restore test fixture admin without leaving a changed shared session for regression tests.
    const { SessionEntity } = require('../dist/entities/SessionEntity');
    await db.query("UPDATE auth_users SET role='admin' WHERE id=$1", [credentials.user.id]);
    await db.getRepository(SessionEntity).save({ tokenHash: credentials.tokenHash, userId: credentials.user.id, expiresAt: Date.now() + 3600000 });
  });
  test('persistent atomic login limits cover account, IP and global budget and recover after expiry', async () => {
    const { app, db } = context();
    const { digest } = require('../dist/auth/session');
    await db.query('TRUNCATE auth_login_limits');
    // Invalid payloads also consume the pre-hash budget, avoiding expensive fixture passwords.
    const attempts = await Promise.all(Array.from({ length: 11 }, () => login(app, 'limited.account', null)));
    assert.equal(attempts.filter(r => r.status === 429).length, 1);
    assert.equal(attempts.filter(r => r.status === 400).length, 10);
    const retry = await login(require('../dist/server').createApp(), 'limited.account', 'anything').expect(429);
    assert.ok(Number(retry.headers['retry-after']) > 0);
    await db.query('UPDATE auth_login_limits SET "resetAt"=$1', [Date.now() - 1]);
    await login(app, 'limited.account', null).expect(400);
    await db.query('TRUNCATE auth_login_limits');
    for (let i = 0; i < 30; i++) await login(app, 'unique.' + i, null).expect(400);
    await client(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.25').send({ username: 'another.account', password: null }).expect(429);
    await db.query('TRUNCATE auth_login_limits');
    await db.query('INSERT INTO auth_login_limits VALUES ($1,100,$2)', [digest('global'), Date.now() + 60000]);
    await login(app, 'global.limited', null).expect(429);
    await db.query('TRUNCATE auth_login_limits');
  });
};
