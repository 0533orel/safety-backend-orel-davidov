import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from './config/database';
import { createApp } from './server';
AppDataSource.initialize().then(() => {
    createApp().listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
        console.log('Safety backend ready');
    });
}).catch(() => { console.error('Database connection failed'); process.exitCode = 1; });
