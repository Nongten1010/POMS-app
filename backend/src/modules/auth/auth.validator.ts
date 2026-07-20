import { z } from 'zod';

export const loginSchema = z
  .object({
    accountType: z.enum(['poms', 'api']).optional(),
    userType: z.enum(['officer', 'operator', 'citizen']),
    provider: z.enum(['local']).optional(),
    username: z.string().trim().min(1).max(64),
    departmentID: z.string().trim().min(1).max(32).optional(),
    password: z.string().min(1).max(128),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.accountType === 'api' && data.provider === 'local') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'provider local conflicts with accountType api',
        path: ['provider'],
      });
    }

    if (data.accountType !== 'api' || data.userType !== 'officer') return;
    if (!data.departmentID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'departmentID is required for API officer login',
        path: ['departmentID'],
      });
    }

    const username = data.username ?? '';
    if (!/^\d{13}$/.test(username) && !/^U[A-Za-z0-9._-]+$/i.test(username)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unsupported API officer username',
        path: ['username'],
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
