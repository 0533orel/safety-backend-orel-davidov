import { HttpError } from '../httpError';
import { SafetyEventEntity } from '../entities/SafetyEventEntity';
const required = ['unitName', 'description', 'eventDate', 'eventTime', 'location', 'result',
    'unitActivity', 'personalActivity', 'category', 'weather', 'eventSeverity'] as const;
const optional = ['injurySeverity', 'recommendations', 'coordinates'] as const;
export function parseEventInput(input: unknown): Partial<SafetyEventEntity> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Invalid event');
    const body = input as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const field of [...required, ...optional]) {
        const value = body[field];
        if (required.includes(field as typeof required[number]) && (typeof value !== 'string' || !value.trim()))
            throw new HttpError(400, 'Missing field: ' + field);
        if (value === undefined || value === null) continue;
        if (typeof value !== 'string' || value.length > 800) throw new HttpError(400, 'Invalid field: ' + field);
        result[field] = value.trim();
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.eventDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(result.eventTime))
        throw new HttpError(400, 'Invalid date or time');
    const date = new Date(result.eventDate + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result.eventDate)
        throw new HttpError(400, 'Invalid date');
    if (new Date(result.eventDate + 'T' + result.eventTime).getTime() > Date.now())
        throw new HttpError(400, 'Future events are not allowed');
    return result;
}
export function parseDeleteImage(value: unknown): boolean {
    if (value === undefined || value === false || value === 'false') return false;
    if (value === true || value === 'true') return true;
    throw new HttpError(400, 'Invalid deleteImage flag');
}
