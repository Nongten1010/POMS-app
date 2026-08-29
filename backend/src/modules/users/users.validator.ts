import { z } from 'zod';
import {
  EDITABLE_LOCATION_SCOPED_PERMISSION_MODULES,
  EDITABLE_PERMISSION_ACTIONS,
  permissionGroupsToUserPermissionOverrides,
} from '../auth/permissions';
import { normalizeRegionalAccess } from '../auth/regional-access';
import type { PermissionGroups } from '../auth/permissions';

const idParam = z.coerce.number().int().positive();
const nullableTrimmedString = z.string().trim().min(1).max(255).nullable();
const optionalNullableTrimmedString = nullableTrimmedString.optional();
const permissionScopeSchema = z
  .enum(['ALL', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY', 'FACTORY_TYPE_88'])
  .nullable();
const optionalTrimmedNonEmptyString = (max: number) =>
  z.preprocess(
    (value) =>
      value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value,
    z.string().trim().min(1).max(max).optional(),
  );
const optionalFormScopeValue = (max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' || trimmed.toLowerCase() === 'all' ? null : trimmed;
  }, z.string().trim().min(1).max(max).nullable().optional());
const clearableFormScopeValue = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' || trimmed.toLowerCase() === 'all' ? null : trimmed;
  }, z.string().trim().min(1).max(max).nullable().optional());
const optionalPasswordString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(8).max(128).optional(),
);
const regionalAccessSchema = z
  .object({
    regions: z.array(z.string().trim().min(1).max(128)).length(1),
  })
  .strict()
  .transform((value) => normalizeRegionalAccess(value) ?? value);
const formRegionsSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const values = Array.isArray(value) ? value : [value];
    const regions = values
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item && item.toLowerCase() !== 'all');
    return regions.length > 0 ? regions : null;
  },
  z.array(z.string().trim().min(1).max(128)).max(1).nullable().optional(),
);

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
    divisionNameTh: optionalNullableTrimmedString,
    departmentId: optionalNullableTrimmedString,
    ministryId: optionalNullableTrimmedString,
    provinceId: optionalNullableTrimmedString,
    provinceName: clearableFormScopeValue(128),
    estateCode: clearableFormScopeValue(32),
    perStatus: optionalNullableTrimmedString,
    perStatusName: optionalNullableTrimmedString,
    relocationType: optionalNullableTrimmedString,
    relocationName: optionalNullableTrimmedString,
    regionalAccess: regionalAccessSchema.nullable().optional(),
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
  roleCodes: z.array(z.string().trim().min(1).max(32)).length(1),
  profile: officerProfileSchema.optional(),
};

const editablePermissionGroupShape = Object.fromEntries(
  Object.entries(EDITABLE_PERMISSION_ACTIONS).map(([module, actions]) => {
    const actionShape = Object.fromEntries(
      actions.map((action) => [action, z.boolean().optional()]),
    );
    const schema = EDITABLE_LOCATION_SCOPED_PERMISSION_MODULES.has(module)
      ? z
          .object({
            data: permissionScopeSchema,
            region: optionalFormScopeValue(128),
            province: optionalFormScopeValue(128),
            ...actionShape,
          })
          .strict()
      : z.object(actionShape).strict();
    return [module, schema.optional()];
  }),
);
const editablePermissionGroupsSchema = z.object(editablePermissionGroupShape).strict();

const legacyCreateLocalAccountSchema = z
  .object({
    fullName: z.string().trim().min(1).max(255),
    username: z.string().trim().min(3).max(64),
    password: z.string().min(8).max(128),
    department: optionalTrimmedNonEmptyString(255),
    lineNameTh: optionalTrimmedNonEmptyString(128),
    levelNameTh: optionalTrimmedNonEmptyString(64),
    provinceId: optionalFormScopeValue(32),
    provinceName: optionalFormScopeValue(128),
    estateCode: optionalFormScopeValue(32),
    regionName: optionalFormScopeValue(128),
    regions: formRegionsSchema,
    regionalAccess: regionalAccessSchema.nullable().optional(),
    roles: z.string().trim().min(1).max(32),
    userType: z.enum(['officer', 'admin']).default('officer'),
    isActive: z.boolean().default(true),
    permissionOverrides: z
      .array(
        z
          .object({
            code: z.string().trim().min(1).max(64),
            effect: z.enum(['allow', 'deny']),
            scope: permissionScopeSchema.optional(),
            region: optionalFormScopeValue(128),
            province: optionalFormScopeValue(128),
            estateCode: optionalFormScopeValue(32),
            estate: optionalFormScopeValue(32),
          })
          .strict(),
      )
      .max(200)
      .optional(),
  })
  .strict()
  .refine(
    (value) => {
      const codes = value.permissionOverrides?.map((permission) => permission.code) ?? [];
      return new Set(codes).size === codes.length;
    },
    {
      message: 'permissionOverrides must not contain duplicate codes',
      path: ['permissionOverrides'],
    },
  )
  .transform(
    ({
      department,
      lineNameTh,
      levelNameTh,
      provinceId,
      provinceName,
      estateCode,
      regionName,
      regions,
      regionalAccess,
      roles,
      ...value
    }) => {
      const hasRegionInput =
        regionalAccess !== undefined || regions !== undefined || regionName !== undefined;
      const formRegionalAccess =
        regionalAccess ??
        (hasRegionInput
          ? normalizeRegionalAccess({
              regions: [...(regions ?? []), ...(regionName ? [regionName] : [])],
            })
          : undefined);
      return {
        ...value,
        roleCodes: [roles],
        profile:
          department !== undefined ||
          lineNameTh !== undefined ||
          levelNameTh !== undefined ||
          provinceId !== undefined ||
          provinceName !== undefined ||
          estateCode !== undefined ||
          formRegionalAccess !== undefined
            ? {
                departmentNameTh: department,
                lineNameTh,
                levelNameTh,
                provinceId,
                provinceName,
                estateCode,
                regionalAccess: formRegionalAccess,
              }
            : undefined,
      };
    },
  );

const nestedCreateLocalAccountSchema = z
  .object({
    user: z
      .object({
        fullName: z.string().trim().min(1).max(255),
        username: z.string().trim().min(3).max(64),
        password: z.string().min(8).max(128),
        department: optionalTrimmedNonEmptyString(255),
        lineNameTh: optionalTrimmedNonEmptyString(128),
        levelNameTh: optionalTrimmedNonEmptyString(64),
        provinceId: optionalFormScopeValue(32),
        provinceName: optionalFormScopeValue(128),
        estateCode: optionalFormScopeValue(32),
        regionName: optionalFormScopeValue(128),
        regions: formRegionsSchema,
        regionalAccess: regionalAccessSchema.nullable().optional(),
        roleCodes: z.array(z.string().trim().min(1).max(32)).length(1),
        userType: z.enum(['officer', 'admin']).default('officer'),
        isActive: z.boolean().default(true),
      })
      .strict(),
    permissions: editablePermissionGroupsSchema.default({}),
  })
  .strict()
  .transform(({ user, permissions }) => {
    const { roleCodes, ...localAccount } = user;
    return {
      ...localAccount,
      roles: roleCodes[0],
      permissionOverrides: permissionGroupsToUserPermissionOverrides(
        permissions as PermissionGroups,
      ),
    };
  });

export const createLocalAccountSchema = z.any().transform((value, ctx) => {
  let result;
  if (value && typeof value === 'object' && 'user' in value) {
    const nestedResult = nestedCreateLocalAccountSchema.safeParse(value);
    if (!nestedResult.success) {
      for (const issue of nestedResult.error.issues) ctx.addIssue(issue as never);
      return z.NEVER;
    }
    result = legacyCreateLocalAccountSchema.safeParse(nestedResult.data);
  } else {
    result = legacyCreateLocalAccountSchema.safeParse(value);
  }
  if (result.success) return result.data;

  for (const issue of result.error.issues) {
    ctx.addIssue(issue as never);
  }
  return z.NEVER;
});

export const createManagedUserSchema = z
  .object({
    ...managedUserPayloadShape,
    userType: managedUserPayloadShape.userType.default('officer'),
    isActive: managedUserPayloadShape.isActive.default(true),
  })
  .strict();

const legacyUpdateManagedUserSchema = z
  .object({
    ...managedUserPayloadShape,
    roleCodes: z.array(z.string().trim().min(1).max(32)).length(1).optional(),
    password: optionalPasswordString,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const editResponseUpdateSchema = z
  .object({
    user: z
      .object({
        accountType: z.enum(['poms', 'api']).optional(),
        identityProvider: z.string().trim().min(1).max(32).optional(),
        fullName: z.string().trim().min(1).max(255),
        username: z.string().trim().min(3).max(64),
        password: optionalPasswordString,
        department: optionalTrimmedNonEmptyString(255),
        lineNameTh: optionalTrimmedNonEmptyString(128),
        levelNameTh: optionalTrimmedNonEmptyString(64),
        provinceName: clearableFormScopeValue(128),
        estateCode: clearableFormScopeValue(32),
        regionName: clearableFormScopeValue(128),
        regions: formRegionsSchema,
        regionalAccess: regionalAccessSchema.nullable().optional(),
        roles: z.string().trim().min(1).max(32).optional(),
        roleCodes: z.array(z.string().trim().min(1).max(32)).length(1).optional(),
        isActive: z.boolean(),
        source: z.enum(['api', 'created']).optional(),
      })
      .refine((user) => user.roles !== undefined || user.roleCodes !== undefined, {
        message: 'roles or roleCodes is required',
        path: ['roleCodes'],
      })
      .strict(),
    permissions: editablePermissionGroupsSchema.optional(),
  })
  .strict()
  .transform(({ user, permissions }) => {
    const isApiAccount = user.source === 'api' || user.accountType === 'api';
    const permissionOverrides = permissions
      ? permissionGroupsToUserPermissionOverrides(permissions as PermissionGroups)
      : undefined;
    const hasRegionInput =
      user.regionalAccess !== undefined ||
      user.regions !== undefined ||
      user.regionName !== undefined;
    const regionalAccess =
      user.regionalAccess ??
      (hasRegionInput
        ? normalizeRegionalAccess({
            regions: [...(user.regions ?? []), ...(user.regionName ? [user.regionName] : [])],
          })
        : undefined);
    const hasProviderOwnedProfilePatch =
      !isApiAccount &&
      (user.department !== undefined ||
        user.lineNameTh !== undefined ||
        user.levelNameTh !== undefined);
    const hasAuthorizationProfilePatch =
      user.provinceName !== undefined ||
      user.estateCode !== undefined ||
      regionalAccess !== undefined;
    const profilePatch =
      hasProviderOwnedProfilePatch || hasAuthorizationProfilePatch
        ? {
            ...(!isApiAccount
              ? {
                  departmentNameTh: user.department,
                  lineNameTh: user.lineNameTh,
                  levelNameTh: user.levelNameTh,
                }
              : {}),
            provinceName: user.provinceName,
            estateCode: user.estateCode,
            regionalAccess,
          }
        : undefined;
    return {
      username: user.username,
      externalId: isApiAccount ? undefined : user.username,
      firstName: isApiAccount ? undefined : user.fullName,
      lastName: isApiAccount ? undefined : '',
      password: user.password,
      isActive: user.isActive,
      roleCodes: user.roleCodes ?? (user.roles ? [user.roles] : undefined),
      profile: profilePatch,
      permissionOverrides,
    };
  });

export const updateManagedUserSchema = z.any().transform((value, ctx) => {
  const result =
    value && typeof value === 'object' && 'user' in value
      ? editResponseUpdateSchema.safeParse(value)
      : legacyUpdateManagedUserSchema.safeParse(value);
  if (result.success) return result.data;

  for (const issue of result.error.issues) {
    ctx.addIssue(issue as never);
  }
  return z.NEVER;
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
            region: optionalFormScopeValue(128),
            province: optionalFormScopeValue(128),
            estateCode: optionalFormScopeValue(32),
            estate: optionalFormScopeValue(32),
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
export type CreateLocalAccountSchemaInput = z.infer<typeof createLocalAccountSchema>;
export type CreateManagedUserSchemaInput = z.infer<typeof createManagedUserSchema>;
export type UpdateManagedUserSchemaInput = z.infer<typeof updateManagedUserSchema>;
export type ReplaceUserPermissionsSchemaInput = z.infer<typeof replaceUserPermissionsSchema>;
