import { z } from 'zod';

export const loginRequestSchema = z.object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(4096),
});

export const authModeSchema = z.enum(['disabled', 'password']);
