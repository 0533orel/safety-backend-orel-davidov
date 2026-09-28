import { createHash, timingSafeEqual } from 'node:crypto';
import { Request, RequestHandler, Response } from 'express';
import { AppDataSource } from '../config/database';
import { SessionEntity } from '../entities/SessionEntity';
import { UserEntity, Role } from '../entities/UserEntity';
import { HttpError } from '../httpError';
export const SESSION_MS = 8 * 60 * 60 * 1000;
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-safety_session' : 'safety_session';
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });
export function readToken(req: Request) {
    const cookies = (req.headers.cookie || '').split(';').map(x => x.trim()).filter(x => x.startsWith(cookieName() + '='));
    if (cookies.length !== 1) return undefined;
    const value = cookies[0].slice(cookieName().length + 1);
    return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export const publicUser = (u: UserEntity) => ({ id: u.id, username: u.username, role: u.role, active: u.active });
export const actor = (res: Response): UserEntity => res.locals.user;
export const authenticate: RequestHandler = async (req, res, next) => {
    try {
        const token = readToken(req);
        const session = token && await AppDataSource.getRepository(SessionEntity).findOneBy({ tokenHash: digest(token) });
        if (!session || session.expiresAt <= Date.now()) throw new HttpError(401, 'Authentication required');
        const user = await AppDataSource.getRepository(UserEntity).findOneBy({ id: session.userId });
        if (!user?.active) throw new HttpError(401, 'Authentication required');
        res.locals.user = user;
        res.locals.session = session;
        res.locals.csrfToken = digest('csrf:' + token);
        next();
    } catch (error) { next(error); }
};
export const requireRole = (...roles: Role[]): RequestHandler => (_req, res, next) => {
    if (!roles.includes(actor(res).role)) return next(new HttpError(403, 'Forbidden'));
    next();
};
export const csrf: RequestHandler = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const actual = req.get('X-CSRF-Token') || '';
    const expected: string = res.locals.csrfToken;
    if (!/^[a-f0-9]{64}$/.test(actual) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected)))
        return next(new HttpError(403, 'Invalid CSRF token'));
    next();
};
