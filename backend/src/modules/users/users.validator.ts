import { z } from 'zod';

const idParam = z.coerce.number().int().positive();
const nullableTrimmedString = z.string().trim().min(1).max(255).nullable();
const optionalNullableTrimmedString = nullableTrimmedString.optional();
const permissionScopeSchema = z.enum(['ALL', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY']).nullable();

export const userIdParamSchema = z.object({
  id: idParam,
});

export const listManagedUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(128).optional(),
    roleCode: z.string().trim().min(1).max(32).optional(),
    status: z.enum(['active', 'suspended', 'all']).default('all'),
  })
  .transform((query) => {
    const shouldPaginate = query.page !== undefined || query.perPage !== undefined;
    if (!shouldPaginate) return query;
    return {
      ...query,
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    };
  });

export const officerProfileSchema = z
  .object({
    posNo: optionalNullableTrimmedString,
    pertypeId: optionalNullableTrimmedString,
    pertype: optionalNullableTrimmedString,
    positionTypeId: optionalNullableTrimmedString,
    positionTypeTh: optionalNullableTrimmedString,
    lineId: optionalNullableTrimmedString,
    lineNameTh: optionalNullableTrimmedString,
    levelId: optionalNullableTrimmedString,
    levelNameTh: optionalNullableTrimmedString,
    mpositionId: optionalNullableTrimmedString,
    mposition: optionalNullableTrimmedString,
    organizeId: optionalNullableTrimmedString,
    divisionId: optionalNullableTrimmedString,
    departmentId: optionalNullableTrimmedString,
    ministryId: optionalNullableTrimmedString,
    provinceId: optionalNullableTrimmedString,
    perStatus: optionalNullableTrimmedString,
    perStatusName: optionalNullableTrimmedString,
    relocationType: optionalNullableTrimmedString,
    relocationName: optionalNullableTrimmedString,
  })
  .strict();

const managedUserPayloadShape = {
  username: z.string().trim().min(3).max(64),
  externalId: z.string().trim().min(1).max(32).optional(),
  userType: z.enum(['officer', 'admin']),
  prenameTh: z.string().trim().min(1).max(16).nullable().optional(),
  firstName: z.string().trim().min(1).max(128),
  lastName: z.string().trim().min(1).max(128),
  email: z.string().trim().email().max(255).nullable().optional(),
  phone: z.string().trim().min(1).max(32).nullable().optional(),
  isActive: z.boolean(),
  roleCodes: z.array(z.string().trim().min(1).max(32)).min(1).max(20),
  profile: officerProfileSchema.optional(),
};

export const createManagedUserSchema = z
  .object({
    ...managedUserPayloadShape,
    userType: managedUserPayloadShape.userType.default('officer'),
    isActive: managedUserPayloadShape.isActive.default(true),
  })
  .strict();

export const updateManagedUserSchema = z
  .object({
    ...managedUserPayloadShape,
    roleCodes: z.array(z.string().trim().min(1).max(32)).min(1).max(20).optional(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const replaceUserPermissionsSchema = z
  .object({
    permissions: z
      .array(
        z
          .object({
            code: z.string().trim().min(1).max(64),
            effect: z.enum(['allow', 'deny']),
            scope: permissionScopeSchema.optional(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
  .refine(
    (value) => {
      const codes = value.permissions.map((permission) => permission.code);
      return new Set(codes).size === codes.length;
    },
    {
      message: 'permissions must not contain duplicate codes',
      path: ['permissions'],
    },
  );

export type ListManagedUsersQueryInput = z.infer<typeof listManagedUsersQuerySchema>;
export type CreateManagedUserSchemaInput = z.infer<typeof createManagedUserSchema>;
export type UpdateManagedUserSchemaInput = z.infer<typeof updateManagedUserSchema>;
export type ReplaceUserPermissionsSchemaInput = z.infer<typeof replaceUserPermissionsSchema>;
