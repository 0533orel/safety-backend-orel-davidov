import 'reflect-metadata';
import { AppDataSource } from './config/database';
import { hashPassword, validPassword } from './auth/password';
export async function seedUsers() {
    if (process.env.ALLOW_DEMO_SEED !== 'true' || process.env.NODE_ENV === 'production')
        throw new Error('Demo users require ALLOW_DEMO_SEED=true and non-production NODE_ENV');
    const password = process.env.DEMO_USER_PASSWORD;
    validPassword(password);
    const roles = ['reporter', 'reviewer', 'admin'];
    const hashes: string[] = [];
    for (const _role of roles) hashes.push(await hashPassword(password));
    await AppDataSource.transaction(async manager => {
        for (const [i, role] of roles.entries()) {
            await manager.query(`INSERT INTO auth_users (username, "passwordHash", role) VALUES ($1,$2,$3)
                ON CONFLICT (username) DO NOTHING`, ['demo.' + role, hashes[i], role]);
        }
    });
}
if (require.main === module) {
    AppDataSource.initialize().then(seedUsers).catch(() => {
        console.error('User seed failed: enable non-production demo seed and supply a 12+ character DEMO_USER_PASSWORD (max 128 UTF-8 bytes)');
        process.exitCode = 1;
    }).finally(async () => { if (AppDataSource.isInitialized) await AppDataSource.destroy(); });
}
