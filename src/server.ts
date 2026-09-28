import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import multer from 'multer';
import eventsRouter from './routes/eventsRouter';
import { HttpError } from './httpError';
import authRouter from './routes/authRouter';
import usersRouter from './routes/usersRouter';
import { authenticate } from './auth/session';
export function createApp() {
    const app = express();
    const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim());
    if (origins.some(x => !/^https?:\/\//.test(x) || new URL(x).origin !== x) ||
        (process.env.NODE_ENV === 'production' && (!process.env.CORS_ORIGINS || origins.some(x => !x.startsWith('https://')))))
        throw new Error('CORS_ORIGINS must contain exact origins; production requires explicit HTTPS origins');
    app.disable('x-powered-by');
    app.use(cors({ origin: origins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }));
    app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    // Browser writes (including login) require an exact approved Origin. CLI clients send it too.
    app.use((req, _res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origins.includes(req.get('Origin') || ''))
            return next(new HttpError(403, 'Untrusted request origin'));
        next();
    });
    app.use(express.json({ limit: '1mb' }));
    app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
    app.use('/api/auth', authRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/events', eventsRouter);
    // Retire public static URLs; even knowledge of a filename grants no access.
    app.use('/uploads', authenticate, (_req, res) => { res.status(404).json({ message: 'Use the event image endpoint' }); });
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
        if (error instanceof HttpError) { res.status(error.status).json({ message: error.message }); return; }
        if (error instanceof multer.MulterError) { res.status(400).json({ message: 'Invalid upload: ' + error.code }); return; }
        if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ message: 'Invalid JSON' }); return; }
        console.error('Request failed');
        res.status(500).json({ message: 'Internal server error' });
    };
    app.use(errors);
    return app;
}
