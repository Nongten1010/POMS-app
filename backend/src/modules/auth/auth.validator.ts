import { z } from 'zod';

export const loginSchema = z
  .object({
    userType: z.enum(['officer', 'operator', 'citizen']),
    username: z.string().min(1).optional(),
    departmentID: z.string().min(1).optional(),
    citizenId: z
      .string()
      .regex(/^\d{13}$/, 'citizenId must be 13 digits')
      .optional(),
    password: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.userType === 'operator') return !!data.citizenId;
      return !!data.username;
    },
    {
      message: 'operator requires citizenId; officer/citizen requires username',
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
