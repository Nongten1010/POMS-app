import { z } from 'zod';

export const loginSchema = z
  .object({
    userType: z.enum(['officer', 'operator', 'citizen']),
    username: z.string().min(1).optional(),
    departmentID: z.string().min(1).optional(),
    password: z.string().min(1),
  })
  .refine(
    (data) => !!data.username,
    {
      message: 'username is required',
      path: ['username'],
    },
  )
  .refine(
    (data) => {
      if (data.userType !== 'officer') return true;
      return !!data.departmentID;
    },
    {
      message: 'officer requires departmentID',
      path: ['departmentID'],
    },
  );

export type LoginInput = z.infer<typeof loginSchema>;
