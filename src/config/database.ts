import { DataSource} from "typeorm";
import {SafetyEventEntity} from "../entities/SafetyEventEntity";
import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config()

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "safety_db",
    synchronize: false,
    logging: false,
    entities: [SafetyEventEntity],
    migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
    migrationsTableName: "migrations",
})