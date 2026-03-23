import { z } from 'zod';

export const loginRequestSchema = z.object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(4096),
});

export const bootstrapRequestSchema = z.object({
    email: z.string().trim().email().max(320),
    password: z.string().min(12).max(4096),
    displayName: z.string().trim().min(1).max(120),
    setupCode: z.string().trim().min(1).max(120),
});

export const authModeSchema = z.enum(['disabled', 'password', 'oidc']);
