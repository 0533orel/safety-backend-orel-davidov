import { HttpError } from '../httpError';
export function parsePagination(query: Record<string, unknown>) {
    const raw = query.limit ?? '50';
    if (typeof raw !== 'string' || !/^[1-9]\d{0,2}$/.test(raw) || Number(raw) > 100)
        throw new HttpError(400, 'limit must be 1..100');
    let cursor: { createdAt: number; id: number } | undefined;
    if (query.cursor !== undefined) {
        if (typeof query.cursor !== 'string' || !/^\d{1,16}:\d{1,10}$/.test(query.cursor))
            throw new HttpError(400, 'Invalid cursor');
        const [createdAt, id] = query.cursor.split(':').map(Number);
        if (!Number.isSafeInteger(createdAt) || createdAt < 0 || id < 1 || id > 2147483647)
            throw new HttpError(400, 'Invalid cursor');
        cursor = { createdAt, id };
    }
    return { limit: Number(raw), cursor };
}
