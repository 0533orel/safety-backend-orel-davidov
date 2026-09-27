import path from 'node:path';
import { promises as fs } from 'node:fs';
export const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
export async function cleanupUpload(filename?: string | null): Promise<void> {
    if (!filename) return;
    if (path.basename(filename) !== filename) { console.error('Invalid stored upload filename'); return; }
    try { await fs.unlink(path.join(uploadDir, filename)); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Upload cleanup failed; check uploads directory');
    }
}
