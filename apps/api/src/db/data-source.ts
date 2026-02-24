import 'reflect-metadata';
import 'dotenv/config';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

const rootDir = resolve();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [
    resolve(rootDir, 'dist', '**', '*.entity.js'),
    resolve(rootDir, 'src', '**', '*.entity.ts'),
  ],
  migrations: [
    resolve(rootDir, 'dist', 'db', 'migrations', '*.js'),
    resolve(rootDir, 'src', 'db', 'migrations', '*.ts'),
  ],
  synchronize: false,
  migrationsRun: true,
});





