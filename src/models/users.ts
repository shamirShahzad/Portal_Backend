import { z } from 'zod';

export const UserSchema = z.object({
    email: z.email(),
    password: z.string(),
    invited_at: z.date().nullable().optional(),
    confirmation_token: z.string().nullable().optional(),
    confirmation_sent_at: z.date().nullable().optional(),
    created_at: z.date().optional(),
    updated_at: z.date().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;
