import contract from '../contract/event-contract.json';
import { eventClock } from '../contract/eventClock';
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
        if (value === undefined || value === null) { result[field] = ''; continue; }
        if (typeof value !== 'string' || value.length > 800) throw new HttpError(400, 'Invalid field: ' + field);
        result[field] = value.trim();
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.eventDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(result.eventTime))
        throw new HttpError(400, 'Invalid date or time');
    const date = new Date(result.eventDate + 'T00:00:00Z');
    if (result.eventDate < '0001-01-01' || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result.eventDate)
        throw new HttpError(400, 'Invalid date');
    for (const [field, values] of Object.entries(contract.enums)) {
        if (field === 'injurySeverity' && !result[field]) continue;
        if (!values.includes(result[field])) throw new HttpError(400, 'Invalid option: ' + field);
    }
    if (result.result.includes('יש נפגעים') && !result.injurySeverity)
        throw new HttpError(400, 'Missing injurySeverity');
    if ((result.location === 'שטח אזרחי' || result.coordinates) && !/^\d{6}\/\d{6}$/.test(result.coordinates))
        throw new HttpError(400, 'Invalid coordinates');
    if (result.eventDate + 'T' + result.eventTime > eventClock())
        throw new HttpError(400, 'Future events are not allowed');
    return result;
}
export function parseDeleteImage(value: unknown): boolean {
    if (value === undefined || value === false || value === 'false') return false;
    if (value === true || value === 'true') return true;
    throw new HttpError(400, 'Invalid deleteImage flag');
}
