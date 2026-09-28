import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../httpError';
// Node's maintained OpenSSL-backed scrypt implementation; versioned parameters.
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 },
        (error, key) => error ? reject(error) : resolve(key));
});
export function validPassword(value: unknown): asserts value is string {
    if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value) > 128)
        throw new HttpError(400, 'Password must be at least 12 characters and at most 128 UTF-8 bytes');
}
export async function hashPassword(password: string) {
    validPassword(password);
    const salt = randomBytes(16).toString('hex');
    return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
    const [version, salt, hex] = encoded.split('$');
    if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
    return timingSafeEqual(await derive(password, salt), Buffer.from(hex, 'hex'));
}
// Equal-cost verification for an unknown username; no usable account uses this hash.
export const dummyHash = 'scrypt-v1$' + '0'.repeat(32) + '$' + '0'.repeat(128);
