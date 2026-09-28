import { MigrationInterface, QueryRunner } from 'typeorm';
export class DemoSeedKey1790553600001 implements MigrationInterface {
    async up(runner: QueryRunner): Promise<void> {
        await runner.query('ALTER TABLE safety_events ADD COLUMN "demoKey" text UNIQUE');
    }
    async down(runner: QueryRunner): Promise<void> {
        await runner.query('ALTER TABLE safety_events DROP COLUMN "demoKey"');
    }
}
