import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import multer from 'multer';
import eventsRouter from './routes/eventsRouter';
import { uploadDir } from './config/uploads';
import { HttpError } from './httpError';
export function createApp() {
    const app = express();
    const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim());
    app.disable('x-powered-by');
    app.use(cors({ origin: origins }));
    app.use(express.json({ limit: '1mb' }));
    app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
    // Use an authenticated gateway before exposing this demonstration API publicly.
    app.use('/api/events', eventsRouter);
    app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', setHeaders: res => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
    } }));
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
