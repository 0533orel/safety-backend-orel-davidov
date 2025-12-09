import { DataSource} from "typeorm";
import {SafetyEventEntity} from "../entities/SafetyEventEntity";
import dotenv from 'dotenv'

dotenv.config()

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "1234",
    database: process.env.DB_NAME || "safety_db",
    synchronize: true,
    logging: false,
    entities: [SafetyEventEntity]
})