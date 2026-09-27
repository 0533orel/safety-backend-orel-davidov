import multer from 'multer';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { uploadDir } from '../config/uploads';
import { HttpError } from '../httpError';
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30 } }).single('image');
export async function uploadImage(req: Request, res: Response, next: NextFunction) {
    parser(req, res, async error => {
        if (error) { next(error); return; }
        try {
            if (req.file) {
                const b = req.file.buffer;
                const png = b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
                const jpeg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
                const webp = b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
                if (!png && !jpeg && !webp) throw new HttpError(400, 'Only PNG, JPEG and WebP images are supported');
                req.file.filename = randomUUID() + (png ? '.png' : jpeg ? '.jpg' : '.webp');
                await fs.mkdir(uploadDir, { recursive: true });
                await fs.writeFile(path.join(uploadDir, req.file.filename), b, { flag: 'wx' });
            }
            next();
        } catch (error) { next(error); }
    });
}
