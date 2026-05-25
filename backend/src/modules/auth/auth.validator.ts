import { z } from 'zod';

export const loginSchema = z
  .object({
    userType: z.enum(['officer', 'operator', 'citizen']),
    provider: z.enum(['local']).optional(),
    username: z.string().trim().min(1).max(64).optional(),
    departmentID: z.string().trim().min(1).max(32).optional(),
    password: z.string().min(1).max(128),
  })
  .strict()
  .refine((data) => !!data.username, {
    message: 'username is required',
    path: ['username'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
