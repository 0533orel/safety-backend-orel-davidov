require('reflect-metadata');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { client, fixtureSession } = require('./auth-support.cjs');
let credentials;
const request = app => client(app, credentials);
const { newDb, DataType } = require('pg-mem');
let app, db, uploads;
const event = {
  unitName: 'Demo', description: 'Synthetic test incident', eventDate: '2025-01-01',
  eventTime: '10:30', location: 'בסיס', result: 'א.נ.א.נ (אין נפגעים, אין נזק)', unitActivity: 'אימונים',
  personalActivity: 'אימון', category: 'עבודה', weather: 'נאה', eventSeverity: 'קל'
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function withImage(method, url, fields = event) {
  let r = request(app)[method](url);
  for (const [key, value] of Object.entries(fields)) r = r.field(key, String(value));
  return r.attach('image', png, 'pixel.png');
}
before(async () => {
  uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'safety-test-'));
  process.env.UPLOAD_DIR = uploads;
  if (process.env.SAFETY_REAL_POSTGRES === 'true') {
    await require('./postgres/events.test.cjs').migrationsReady;
    db = require('../dist/config/database').AppDataSource;
    await db.initialize();
    app = require('../dist/server').createApp();
    credentials = await fixtureSession(db);
    return;
  }
  const memory = newDb();
  memory.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'test' });
  memory.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 16' });
  const { SafetyEventEntity } = require('../dist/entities/SafetyEventEntity');
  db = memory.adapters.createTypeormDataSource({ type: 'postgres', entities: [SafetyEventEntity, require('../dist/entities/UserEntity').UserEntity, require('../dist/entities/SessionEntity').SessionEntity], synchronize: true });
  await db.initialize();
  const { AppDataSource } = require('../dist/config/database');
  AppDataSource.getRepository = db.getRepository.bind(db);
  AppDataSource.transaction = db.transaction.bind(db);
  app = require('../dist/server').createApp();
  credentials = await fixtureSession(db);
});
after(async () => { if (db?.isInitialized) await db.destroy(); if (uploads) await fs.rm(uploads, { recursive: true, force: true }); });
module.exports = { authenticatedRequest: () => request(app) };

test('JSON CRUD ignores client IDs and timestamps; bigint returns as a number', async () => {
  const created = await request(app).post('/api/events').send({ ...event, id: 999, createdAt: 0, imagePath: '../bad' }).expect(201);
  assert.notEqual(created.body.id, 999);
  assert.ok(created.body.createdAt > 0);
  assert.equal(created.body.imagePath, null);
  const rows = await request(app).get('/api/events').expect(200);
  assert.equal(typeof rows.body.items[0].createdAt, 'number');
  await request(app).put('/api/events/' + created.body.id).send({ ...event, description: 'Updated' }).expect(200);
  await request(app).delete('/api/events/' + created.body.id).expect(204);
  await request(app).delete('/api/events/' + created.body.id).expect(404);
});
test('invalid identifiers, missing fields, impossible dates and malformed flags return 400', async () => {
  for (const id of ['12abc', '0', '-1', '2147483648', '9007199254740992']) await request(app).delete('/api/events/' + id).expect(400);
  for (const body of [{}, { ...event, eventDate: '0000-01-01' }, { ...event, eventDate: '2025-02-30' }, { ...event, eventTime: '25:00' }, { ...event, eventDate: '2999-01-01' }]) {
    await request(app).post('/api/events').send(body).expect(400);
  }
  const created = await request(app).post('/api/events').send(event).expect(201);
  await request(app).put('/api/events/' + created.body.id).send({ ...event, deleteImage: 'yes' }).expect(400);
});
test('JSON boolean and multipart string both remove stored images', async () => {
  for (const multipart of [false, true]) {
    const created = await withImage('post', '/api/events').expect(201);
    const filename = created.body.imagePath;
    await fs.access(path.join(uploads, filename));
    let update = request(app).put('/api/events/' + created.body.id);
    if (multipart) {
      for (const [key, value] of Object.entries(event)) update = update.field(key, value);
      update = update.field('deleteImage', 'true');
    } else update = update.send({ ...event, deleteImage: true });
    const result = await update.expect(200);
    assert.equal(result.body.imagePath, null);
    await assert.rejects(fs.access(path.join(uploads, filename)));
  }
});
test('replacement wins over deletion and obsolete file is removed after save', async () => {
  const created = await withImage('post', '/api/events').expect(201);
  const updated = await withImage('put', '/api/events/' + created.body.id, { ...event, deleteImage: 'true' }).expect(200);
  assert.notEqual(updated.body.imagePath, created.body.imagePath);
  await fs.access(path.join(uploads, updated.body.imagePath));
  await assert.rejects(fs.access(path.join(uploads, created.body.imagePath)));
});
test('failed validation and missing records do not leave uploaded files', async () => {
  const before = (await fs.readdir(uploads)).sort();
  await withImage('post', '/api/events', { description: 'Missing fields' }).expect(400);
  await withImage('put', '/api/events/999999').expect(404);
  assert.deepEqual((await fs.readdir(uploads)).sort(), before);
});
test('non-image content, SVG and oversized files are rejected', async () => {
  await request(app).post('/api/events').attach('image', Buffer.from('<svg/>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
  await request(app).post('/api/events').attach('image', Buffer.alloc(6 * 1024 * 1024), 'large.png').expect(400);
});

test('PUT clears omitted optional text fields', async () => {
  const created = await request(app).post('/api/events').send({ ...event, recommendations: 'Old recommendation', coordinates: '123456/123456', injurySeverity: 'ללא פגיעה' }).expect(201);
  const updated = await request(app).put('/api/events/' + created.body.id).send(event).expect(200);
  for (const field of ['recommendations', 'coordinates', 'injurySeverity']) assert.equal(updated.body[field], '');
});

test('domain options, conditional fields and bounded pagination reject invalid input', async () => {
  const contract = require('../dist/contract/event-contract.json');
  for (const field of Object.keys(contract.enums))
    await request(app).post('/api/events').send({ ...event, [field]: 'unknown-option' }).expect(400);
  await request(app).post('/api/events').send({ ...event, location: 'שטח אזרחי' }).expect(400);
  await request(app).post('/api/events').send({ ...event, result: contract.enums.result[2] }).expect(400);
  for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'limit=1&limit=2', 'cursor=no', 'cursor=1:0', 'cursor=9007199254740992:1'])
    await request(app).get('/api/events?' + query).expect(400);
});

test('event clock and future rejection are independent of host timezone', async () => {
  const { eventClock } = require('../dist/contract/eventClock');
  assert.equal(eventClock(new Date('2025-01-01T22:30:00Z')), '2025-01-02T00:30');
  assert.equal(eventClock(new Date('2025-07-01T22:30:00Z')), '2025-07-02T01:30');
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      assert.equal(eventClock(new Date('2025-01-01T22:30:00Z')), '2025-01-02T00:30');
      await request(app).post('/api/events').send({ ...event, eventDate: '2999-01-01' }).expect(400);
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

if (process.env.SAFETY_REAL_POSTGRES === 'true') {
  require('./auth-scenarios.cjs')({ context: () => ({ app, db, uploads, credentials }), event, png });
  test('every contract option is accepted by HTTP and database constraints', async () => {
    const contract = require('../dist/contract/event-contract.json');
    for (const [field, values] of Object.entries(contract.enums)) {
      for (const value of values) {
        const created = await request(app).post('/api/events').send({
          ...event, coordinates: '123456/123456', injurySeverity: 'ללא פגיעה', [field]: value
        }).expect(201);
        assert.equal(created.body[field], value);
        await request(app).delete('/api/events/' + created.body.id).expect(204);
      }
    }
  });

  test('keyset pages traverse equal timestamps exactly once, despite insertion/deletion', async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const response = await request(app).post('/api/events').send(event).expect(201);
      ids.push(response.body.id);
    }
    await db.query('UPDATE safety_events SET "createdAt" = 1800000000000 WHERE id = ANY($1)', [ids]);
    const first = (await request(app).get('/api/events?limit=2').expect(200)).body;
    assert.deepEqual(first.items.map(row => row.id), ids.slice(-2).reverse());
    await request(app).delete('/api/events/' + first.items[0].id).expect(204);
    const inserted = await request(app).post('/api/events').send(event).expect(201);
    await db.query('UPDATE safety_events SET "createdAt" = 1800000000001 WHERE id=$1', [inserted.body.id]);
    const seen = first.items.map(row => row.id);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = (await request(app).get('/api/events').query({ limit: 2, cursor }).expect(200)).body;
      seen.push(...page.items.map(row => row.id)); cursor = page.nextCursor;
    }
    assert.equal(new Set(seen).size, seen.length);
    assert.ok(ids.every(id => seen.includes(id)));
    assert.ok(!seen.includes(inserted.body.id));
  });

  test('PostgreSQL commit failure rolls back update/delete and preserves original image', async () => {
    const created = (await withImage('post', '/api/events').expect(201)).body;
    const files = (await fs.readdir(uploads)).sort();
    await db.query(`CREATE FUNCTION safe01_fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic deferred commit failure'; END $$`);
    await db.query(`CREATE CONSTRAINT TRIGGER safe01_fail_commit AFTER UPDATE OR DELETE ON safety_events
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safe01_fail_commit()`);
    try {
      await withImage('put', '/api/events/' + created.id, { ...event, description: 'Must roll back' }).expect(500);
      await request(app).delete('/api/events/' + created.id).expect(500);
      const stored = await db.getRepository(require('../dist/entities/SafetyEventEntity').SafetyEventEntity).findOneBy({ id: created.id });
      assert.equal(stored.description, event.description);
      assert.equal(stored.imagePath, created.imagePath);
      assert.deepEqual((await fs.readdir(uploads)).sort(), files);
      await fs.access(path.join(uploads, created.imagePath));
    } finally {
      await db.query('DROP TRIGGER safe01_fail_commit ON safety_events');
      await db.query('DROP FUNCTION safe01_fail_commit()');
    }
  });

  test('real row locks block HTTP update and delete until the holding transaction commits', async () => {
    for (const method of ['put', 'delete']) {
      const created = (await request(app).post('/api/events').send(event).expect(201)).body;
      const runner = db.createQueryRunner();
      await runner.connect(); await runner.startTransaction();
      let pending;
      try {
        const [{ pid }] = await runner.query('SELECT pg_backend_pid() AS pid');
        await runner.query('SELECT id FROM safety_events WHERE id=$1 FOR UPDATE', [created.id]);
        let req = request(app)[method]('/api/events/' + created.id);
        if (method === 'put') req = req.send({ ...event, description: 'After lock' });
        pending = req.then(response => response);
        const deadline = Date.now() + 5000;
        let blocked = false;
        while (Date.now() < deadline) {
          const rows = await db.query('SELECT pid FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))', [pid]);
          if (rows.length) { blocked = true; break; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.ok(blocked, 'HTTP transaction must actually wait on PostgreSQL row lock');
        await runner.commitTransaction();
        const response = await pending;
        assert.equal(response.status, method === 'put' ? 200 : 204);
        if (method === 'put') assert.equal(response.body.description, 'After lock');
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        if (pending) await pending;
        await runner.release();
      }
    }
  });
}
