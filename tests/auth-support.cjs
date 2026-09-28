const request = require('supertest');
const { randomBytes } = require('node:crypto');
const origin = 'http://localhost:5173';
function client(app, credentials) {
  return Object.fromEntries(['get', 'head', 'post', 'put', 'patch', 'delete'].map(method => [method, url => {
    let r = request(app)[method](url).set('Origin', origin);
    if (credentials) r = r.set('Cookie', credentials.cookie).set('X-CSRF-Token', credentials.csrfToken);
    return r;
  }]));
}
async function fixtureSession(db, username = 'fixture.admin', role = 'admin') {
  const { UserEntity } = require('../dist/entities/UserEntity');
  const { SessionEntity } = require('../dist/entities/SessionEntity');
  const { digest } = require('../dist/auth/session');
  const user = await db.getRepository(UserEntity).save({ username, passwordHash: 'unusable-test-fixture', role, active: true });
  const token = randomBytes(32).toString('hex');
  await db.getRepository(SessionEntity).save({ tokenHash: digest(token), userId: user.id, expiresAt: Date.now() + 3600000 });
  return { user, cookie: 'safety_session=' + token, csrfToken: digest('csrf:' + token), tokenHash: digest(token) };
}
module.exports = { client, fixtureSession, origin };
