import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.coerce.number().default(3001),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().url(),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    // Supabase Storage
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string().min(1),
    STORAGE_BUCKET: z.string().min(1),

    // AI
    OPENAI_API_KEY: z.string().optional(),
    AI_RATE_LIMIT_PER_HOUR: z.coerce.number().default(20),
    AI_COST_LIMIT_PER_DAY: z.coerce.number().default(0.5),

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
