import { z } from 'zod';
export const config = z.object({ REDIS_URL: z.string().default('redis://localhost:6379'), DATABASE_URL: z.string().min(1), EXECUTOR_URL: z.string().default('http://localhost:8000'), EXECUTOR_SHARED_SECRET: z.string().min(8), MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3) }).parse(process.env);
