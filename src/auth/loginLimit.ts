import { RequestHandler } from 'express';
import { AppDataSource } from '../config/database';
import { digest } from './session';
import { HttpError } from '../httpError';
const WINDOW_MS = 15 * 60 * 1000;
// PostgreSQL atomic counters survive restarts and cover multiple API processes.
export const loginLimit: RequestHandler = async (req, res, next) => {
    try {
        const now = Date.now();
        const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase().slice(0, 64) : '';
        const keys: [string, number][] = [['global', 100], ['ip:' + (req.ip || 'unknown'), 30], ['account:' + username, 10]];
        // Apply the global bound first, so hostile unique names/IPs cannot grow storage unboundedly.
        await AppDataSource.query('DELETE FROM auth_login_limits WHERE "resetAt" <= $1', [now]);
        for (const [key, limit] of keys) {
            const [row] = await AppDataSource.query(`INSERT INTO auth_login_limits (key, attempts, "resetAt") VALUES ($1,1,$2)
                ON CONFLICT (key) DO UPDATE SET attempts = auth_login_limits.attempts + 1 RETURNING attempts, "resetAt"`, [digest(key), now + WINDOW_MS]);
            if (row.attempts > limit) {
                res.setHeader('Retry-After', Math.max(1, Math.ceil((Number(row.resetAt) - now) / 1000)));
                throw new HttpError(429, 'Too many login attempts; try later');
            }
        }
        next();
    } catch (error) { next(error); }
};
