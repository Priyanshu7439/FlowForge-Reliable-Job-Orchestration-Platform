import { z } from 'zod';

export const config = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  EXECUTOR_URL: z.string().url().default('http://localhost:8000'),
  JWT_SECRET: z.string().min(16),
  EXECUTOR_SHARED_SECRET: z.string().min(8),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3)
}).parse(process.env);
