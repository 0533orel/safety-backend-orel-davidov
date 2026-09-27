require('reflect-metadata');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { newDb, DataType } = require('pg-mem');
let app, db, uploads;
const event = {
  unitName: 'Demo', description: 'Synthetic test incident', eventDate: '2025-01-01',
  eventTime: '10:30', location: 'Office', result: 'No injury', unitActivity: 'Work',
  personalActivity: 'Work', category: 'Equipment', weather: 'Clear', eventSeverity: 'Low'
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
  const memory = newDb();
  memory.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'test' });
  memory.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 16' });
  const { SafetyEventEntity } = require('../dist/entities/SafetyEventEntity');
  db = memory.adapters.createTypeormDataSource({ type: 'postgres', entities: [SafetyEventEntity], synchronize: true });
  await db.initialize();
  const { AppDataSource } = require('../dist/config/database');
  AppDataSource.getRepository = db.getRepository.bind(db);
  AppDataSource.transaction = db.transaction.bind(db);
  app = require('../dist/server').createApp();
});
after(async () => { if (db?.isInitialized) await db.destroy(); if (uploads) await fs.rm(uploads, { recursive: true, force: true }); });

test('JSON CRUD ignores client IDs and timestamps; bigint returns as a number', async () => {
  const created = await request(app).post('/api/events').send({ ...event, id: 999, createdAt: 0, imagePath: '../bad' }).expect(201);
  assert.notEqual(created.body.id, 999);
  assert.ok(created.body.createdAt > 0);
  assert.equal(created.body.imagePath, null);
  const rows = await request(app).get('/api/events').expect(200);
  assert.equal(typeof rows.body[0].createdAt, 'number');
  await request(app).put('/api/events/' + created.body.id).send({ ...event, description: 'Updated' }).expect(200);
  await request(app).delete('/api/events/' + created.body.id).expect(204);
  await request(app).delete('/api/events/' + created.body.id).expect(404);
});
test('invalid identifiers, missing fields, impossible dates and malformed flags return 400', async () => {
  for (const id of ['12abc', '0', '-1', '2147483648', '9007199254740992']) await request(app).delete('/api/events/' + id).expect(400);
  for (const body of [{}, { ...event, eventDate: '2025-02-30' }, { ...event, eventTime: '25:00' }, { ...event, eventDate: '2999-01-01' }]) {
    await request(app).post('/api/events').send(body).expect(400);
  }
  await request(app).put('/api/events/1').send({ ...event, deleteImage: 'yes' }).expect(400);
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
  const created = await request(app).post('/api/events').send({ ...event, recommendations: 'Old recommendation', coordinates: '123456/123456', injurySeverity: 'None' }).expect(201);
  const updated = await request(app).put('/api/events/' + created.body.id).send(event).expect(200);
  for (const field of ['recommendations', 'coordinates', 'injurySeverity']) assert.equal(updated.body[field], '');
});
