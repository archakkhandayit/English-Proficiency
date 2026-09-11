import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URLS: z.string()
});

export const env = envSchema.parse(process.env);
