import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1765457950280 implements MigrationInterface {
    name = 'InitialMigration1765457950280'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "safety_events" ("id" SERIAL NOT NULL, "createdAt" bigint NOT NULL, "unitName" text NOT NULL, "description" text NOT NULL, "eventDate" text NOT NULL, "eventTime" text NOT NULL, "location" text NOT NULL, "result" text NOT NULL, "injurySeverity" text, "unitActivity" text NOT NULL, "personalActivity" text NOT NULL, "category" text NOT NULL, "weather" text NOT NULL, "eventSeverity" text NOT NULL, "recommendations" text, "coordinates" text, "imagePath" text, CONSTRAINT "PK_60ae264b41ba817882aa3396360" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "safety_events"`);
    }

}
