import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../config/database';
import { UserEntity } from '../entities/UserEntity';
import { SessionEntity } from '../entities/SessionEntity';
import { HttpError } from '../httpError';
import { dummyHash, verifyPassword } from '../auth/password';
import { actor, authenticate, cookieName, cookieOptions, csrf, digest, publicUser, readToken, SESSION_MS } from '../auth/session';
import { loginLimit } from '../auth/loginLimit';
const router = Router();
router.post('/login', loginLimit, async (req, res) => {
    const { username, password } = req.body || {};
    if (!req.is('application/json') || typeof username !== 'string' || username.length > 64 ||
        typeof password !== 'string' || Buffer.byteLength(password) > 128)
        throw new HttpError(400, 'Invalid login request');
    const users = AppDataSource.getRepository(UserEntity);
    const user = await users.findOneBy({ username: username.trim().toLowerCase() });
    const valid = await verifyPassword(password, user?.passwordHash || dummyHash);
    if (!user?.active || !valid) throw new HttpError(401, 'Invalid username or password');
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_MS;
    await AppDataSource.transaction(async manager => {
        const current = await manager.getRepository(UserEntity).findOne({ where: { id: user.id }, lock: { mode: 'pessimistic_read' } });
        if (!current?.active || current.passwordHash !== user.passwordHash) throw new HttpError(401, 'Invalid username or password');
        const sessions = manager.getRepository(SessionEntity);
        await sessions.delete({ expiresAt: LessThanOrEqual(Date.now()) });
        const previous = readToken(req);
        if (previous) await sessions.delete({ tokenHash: digest(previous) });
        await sessions.save({ tokenHash: digest(token), userId: current.id, expiresAt });
        res.locals.user = current;
    });
    res.cookie(cookieName(), token, { ...cookieOptions(), maxAge: SESSION_MS });
    res.json({ user: publicUser(actor(res)), csrfToken: digest('csrf:' + token), expiresAt });
});
router.use(authenticate, csrf);
router.get('/me', (_req, res) => {
    res.json({ user: publicUser(actor(res)), csrfToken: res.locals.csrfToken, expiresAt: res.locals.session.expiresAt });
});
router.post('/logout', async (_req, res) => {
    await AppDataSource.getRepository(SessionEntity).delete({ tokenHash: res.locals.session.tokenHash });
    res.clearCookie(cookieName(), cookieOptions());
    res.status(204).end();
});
export default router;
