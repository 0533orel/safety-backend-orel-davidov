import { Router, Response } from 'express';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { UserEntity, Role } from '../entities/UserEntity';
import { SessionEntity } from '../entities/SessionEntity';
import { HttpError, parseEventId } from '../httpError';
import { hashPassword, validPassword } from '../auth/password';
import { authenticate, csrf, publicUser, requireRole } from '../auth/session';
const router = Router();
router.use(authenticate, csrf, requireRole('admin'));
const roles = ['reporter', 'reviewer', 'admin'];
async function lockAndCheckAdmin(manager: EntityManager, res: Response) {
    await manager.query('LOCK TABLE auth_users IN SHARE ROW EXCLUSIVE MODE');
    const caller = await manager.getRepository(UserEntity).findOneBy({ id: res.locals.user.id });
    const session = await manager.getRepository(SessionEntity).findOneBy({ tokenHash: res.locals.session.tokenHash });
    if (!caller?.active || caller.role !== 'admin' || !session || session.expiresAt <= Date.now()) throw new HttpError(403, 'Forbidden');
}
router.get('/', async (_req, res) => {
    // Bounded inventory; use afterId for further pages.
    const raw = _req.query.afterId;
    const afterId = raw === undefined ? 0 : parseEventId(raw);
    const users = await AppDataSource.getRepository(UserEntity).createQueryBuilder('u')
        .where('u.id > :afterId', { afterId }).orderBy('u.id', 'ASC').take(101).getMany();
    res.json({ items: users.slice(0, 100).map(publicUser), nextAfterId: users.length > 100 ? users[99].id : null });
});
router.post('/', async (req, res) => {
    const { username, password, role = 'reporter' } = req.body || {};
    if (typeof username !== 'string' || !/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username) || !roles.includes(role))
        throw new HttpError(400, 'Invalid username or role');
    validPassword(password);
    const passwordHash = await hashPassword(password);
    try {
        const user = await AppDataSource.transaction(async manager => {
            await lockAndCheckAdmin(manager, res);
            return manager.getRepository(UserEntity).save({ username, passwordHash, role, active: true });
        });
        res.status(201).json(publicUser(user));
    } catch (error) {
        if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Username already exists');
        throw error;
    }
});
router.patch('/:id', async (req, res) => {
    const id = parseEventId(req.params.id);
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length ||
        Object.keys(body).some(k => !['role', 'active', 'password'].includes(k)) ||
        (body.role !== undefined && !roles.includes(body.role)) ||
        (body.active !== undefined && typeof body.active !== 'boolean')) throw new HttpError(400, 'Invalid user update');
    let passwordHash: string | undefined;
    if (body.password !== undefined) { validPassword(body.password); passwordHash = await hashPassword(body.password); }
    const user = await AppDataSource.transaction(async manager => {
        // Serialize staff changes, including concurrent attempts to remove the last active admin.
        await lockAndCheckAdmin(manager, res);
        const users = manager.getRepository(UserEntity);
        const current = await users.findOneBy({ id });
        if (!current) throw new HttpError(404, 'User not found');
        const role: Role = body.role ?? current.role;
        const active: boolean = body.active ?? current.active;
        if (current.role === 'admin' && current.active && (role !== 'admin' || !active) &&
            await users.countBy({ role: 'admin', active: true }) <= 1) throw new HttpError(409, 'At least one active admin is required');
        current.role = role; current.active = active;
        if (passwordHash) current.passwordHash = passwordHash;
        await users.save(current);
        await manager.getRepository(SessionEntity).delete({ userId: id });
        return current;
    });
    res.json(publicUser(user));
});
export default router;
