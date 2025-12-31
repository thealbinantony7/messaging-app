import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
    logger.info('Running database migrations...');

    try {
        const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
        await pool.query(schema);
        logger.info('✅ Database schema applied successfully');
    } catch (err) {
        logger.error({ err }, '❌ Migration failed');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
