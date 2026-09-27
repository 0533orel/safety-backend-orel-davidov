export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function parseEventId(value: unknown): number {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647)
        throw new HttpError(400, 'Invalid event ID');
    return Number(value);
}
