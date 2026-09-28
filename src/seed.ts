import 'reflect-metadata';
import { AppDataSource } from './config/database';
import contract from './contract/event-contract.json';

export async function seedDemo() {
    if (process.env.ALLOW_DEMO_SEED !== 'true' || process.env.NODE_ENV === 'production')
        throw new Error('Demo seed requires ALLOW_DEMO_SEED=true and non-production NODE_ENV');
    await AppDataSource.transaction(async manager => {
        for (let i = 1; i <= 3; i++) {
            await manager.query(`INSERT INTO safety_events
                ("demoKey", "createdAt", "unitName", description, "eventDate", "eventTime",
                 location, result, "unitActivity", "personalActivity", category, weather, "eventSeverity")
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                ON CONFLICT ("demoKey") DO NOTHING`, [
                `safe01-demo-${i}`, 1735725600000 + i, 'יחידת דמו בדיונית',
                `אירוע סינתטי ${i} — תרגול דיווח בלבד`, '2025-01-01', '10:00',
                contract.enums.location[0], contract.enums.result[0], contract.enums.unitActivity[1],
                contract.enums.personalActivity[1], 'עבודה', 'נאה', 'קל'
            ]);
        }
    });
}
if (require.main === module) {
    AppDataSource.initialize().then(seedDemo).catch(error => {
        console.error(error.message); process.exitCode = 1;
    }).finally(async () => { if (AppDataSource.isInitialized) await AppDataSource.destroy(); });
}
