import { StatusCodes } from 'http-status-codes';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { hashPassword } from '../../shared/utils/password';
import { usersRepository } from './users.repository';
import {
  groupPermissions,
  hasValidPermissionDataScope,
  isBinaryPermissionCode,
  isEditablePermissionCode,
  mergePermissionScopesWithOverrides,
  projectEditablePermissionGroups,
} from '../auth/permissions';
import type { PermissionMode } from '../auth/permissions';
import type {
  CreateManagedUserInput,
  CreateLocalAccountInput,
  ListManagedUsersQuery,
  ManagedUserAuthDetailDTO,
  ManagedUserDetailDTO,
  OfficerProfileInput,
  PaginatedManagedUsersDTO,
  PermissionGrantDTO,
  PermissionOverrideInput,
  PermissionScope,
  ReplaceUserPermissionsInput,
  UpdateManagedUserInput,
  UserPermissionsDTO,
} from './users.types';

export const usersService = {
  async list(query: ListManagedUsersQuery): Promise<PaginatedManagedUsersDTO> {
    const { rows, total } = await usersRepository.list(query);
    const meta: PaginatedManagedUsersDTO['meta'] = { total };
    if (query.page !== undefined && query.perPage !== undefined) {
      meta.page = query.page;
      meta.perPage = query.perPage;
      meta.totalPages = Math.ceil(total / query.perPage);
    }

    return {
      data: rows,
      meta,
    };
  },

  async getById(userId: number): Promise<ManagedUserDetailDTO> {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async getAuthDetailById(userId: number): Promise<ManagedUserAuthDetailDTO> {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const [rolePermissions, overrides] = await Promise.all([
      usersRepository.getRolePermissions(userId),
      usersRepository.getUserPermissionOverrides(userId),
    ]);
    const permissionMode = user.permissionMode ?? 'role_default';
    const effectivePermissionDetails = buildEffectivePermissionDetails(
      rolePermissions,
      overrides,
      permissionMode,
    );
    const roleCodes = [...(user.roleCodes ?? [user.roles])];

    return {
      user: {
        accountType: user.accountType ?? (user.identityProvider === 'local' ? 'poms' : 'api'),
        identityProvider: user.identityProvider,
        userType: user.userType,
        username: user.username,
        fullName: [joinNamePrefix(user.prenameTh, user.firstName), user.lastName]
          .filter(Boolean)
          .join(' '),
        department: user.department,
        lineNameTh: user.lineNameTh,
        levelNameTh: user.levelNameTh,
        provinceName: user.profile?.provinceName ?? null,
        estateCode: user.profile?.estateCode ?? null,
        regionalAccess: user.profile?.regionalAccess ?? null,
        roles: user.roles,
        roleCodes,
        permissionMode,
        isActive: user.isActive,
        source: toManagedUserSource(user.identityProvider),
      },
      permissions: projectEditablePermissionGroups(
        permissionMode === 'custom'
          ? groupPermissions(effectivePermissionDetails)
          : projectManagedPermissionAssignments(
              groupPermissions(effectivePermissionDetails),
              roleCodes,
              user.profile,
            ),
      ),
    };
  },

  async create(input: CreateManagedUserInput, actorUserId: number): Promise<ManagedUserDetailDTO> {
    if (input.externalId !== undefined && input.externalId !== input.username) {
      throw new BadRequestError('POMS username and account key must match');
    }
    await ensureUniqueIdentity(input.externalId ?? input.username);
    await ensureRolesExist(input.roleCodes);
    const resolvedInput = await withResolvedOfficerProfile(input);
    ensureRequiredRoleAssignment(resolvedInput.roleCodes[0], resolvedInput.profile);
    return usersRepository.create(resolvedInput, actorUserId);
  },

  async createLocalAccount(
    input: CreateLocalAccountInput,
    actorUserId: number,
  ): Promise<ManagedUserDetailDTO> {
    await ensureUniqueIdentity(input.username);
    await ensureRolesExist(input.roleCodes);
    const resolvedInput = await withResolvedUserInput(input);
    if (resolvedInput.permissionOverrides === undefined) {
      ensureRequiredRoleAssignment(resolvedInput.roleCodes[0], resolvedInput.profile);
    }
    if (resolvedInput.permissionOverrides) {
      await ensurePermissionsExist(
        resolvedInput.permissionOverrides.map((permission) => permission.code),
      );
    }
    const permissionOverrides = resolvedInput.permissionOverrides
      ? await preparePermissionSnapshot(
          resolvedInput.permissionOverrides,
          resolvedInput.roleCodes,
          undefined,
          resolvedInput.profile,
        )
      : undefined;

    const passwordHash = await hashPassword(input.password);
    return usersRepository.createLocalAccount(
      {
        ...resolvedInput,
        permissionOverrides,
        passwordHash,
      },
      actorUserId,
    );
  },

  async update(
    userId: number,
    input: UpdateManagedUserInput,
    actorUserId: number,
  ): Promise<ManagedUserDetailDTO> {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw new NotFoundError('User not found');

    const identitySafeInput = sanitizeIdentityUpdate(existing, input);
    if (
      existing.identityProvider === 'local' &&
      (identitySafeInput.username !== undefined || identitySafeInput.externalId !== undefined)
    ) {
      await ensureUniqueIdentity(
        identitySafeInput.externalId ?? identitySafeInput.username ?? existing.externalId,
        existing.identityProvider,
        userId,
      );
    }
    if (identitySafeInput.roleCodes !== undefined) {
      await ensureRolesExist(identitySafeInput.roleCodes);
    }
    const resolvedInput = await withResolvedUserInput(identitySafeInput);
    if (input.permissionMode === 'role_default' && input.permissionOverrides !== undefined) {
      throw new BadRequestError(
        'Cannot reset role permissions and replace a custom snapshot together',
      );
    }
    if (input.permissionMode === 'custom' && input.permissionOverrides === undefined) {
      throw new BadRequestError('Custom permission mode requires a permission snapshot');
    }
    if (
      input.permissionOverrides === undefined &&
      (input.permissionMode ?? existing.permissionMode ?? 'role_default') === 'role_default'
    ) {
      ensureRequiredRoleAssignment(
        resolvedInput.roleCodes?.[0] ?? existing.roleCodes[0],
        resolvedInput.profile,
        existing.profile,
      );
    }
    if (resolvedInput.permissionOverrides !== undefined) {
      await ensurePermissionsExist(
        resolvedInput.permissionOverrides.map((permission) => permission.code),
      );
    }

    const permissionOverrides =
      resolvedInput.permissionOverrides === undefined
        ? undefined
        : await preparePermissionSnapshot(
            resolvedInput.permissionOverrides,
            resolvedInput.roleCodes ?? existing.roleCodes,
            existing,
            { ...existing.profile, ...resolvedInput.profile },
            resolvedInput.permissionEditSource === 'grouped',
          );

    const { password, ...repositoryInput } = resolvedInput;
    return usersRepository.update(
      userId,
      await withResolvedOfficerProfile({
        ...repositoryInput,
        ...(permissionOverrides !== undefined
          ? { permissionOverrides, permissionMode: 'custom' as const }
          : {}),
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      }),
      actorUserId,
    );
  },

  async delete(userId: number, actorUserId: number): Promise<void> {
    if (userId === actorUserId) {
      throw new ForbiddenError('Users cannot delete themselves');
    }
    const existing = await usersRepository.findById(userId);
    if (!existing) throw new NotFoundError('User not found');
    await usersRepository.softDelete(userId, actorUserId);
  },

  async getPermissions(userId: number): Promise<UserPermissionsDTO> {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw new NotFoundError('User not found');

    const [rolePermissions, overrides] = await Promise.all([
      usersRepository.getRolePermissions(userId),
      usersRepository.getUserPermissionOverrides(userId),
    ]);
    const permissionMode = existing.permissionMode ?? 'role_default';
    const effectiveScopes = buildEffectiveScopes(rolePermissions, overrides, permissionMode);
    const effectivePermissionDetails = buildEffectivePermissionDetails(
      rolePermissions,
      overrides,
      permissionMode,
    );

    return {
      userId,
      permissionMode,
      rolePermissions,
      overrides,
      effectiveScopes,
      permissions: groupPermissions(effectivePermissionDetails),
    };
  },

  async replacePermissions(
    userId: number,
    input: ReplaceUserPermissionsInput,
    actorUserId: number,
  ): Promise<UserPermissionsDTO> {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw new NotFoundError('User not found');
    await ensurePermissionsExist(input.permissions.map((permission) => permission.code));
    const rolePermissions = await usersRepository.getRolePermissions(userId);
    validateNewPermissionScopes(input.permissions, rolePermissions);
    const permissions = await resolvePermissionOverrides(
      fillPermissionSnapshotDefaults(
        input.permissions,
        rolePermissions,
        existing.roleCodes,
        existing.profile,
      ),
    );
    await usersRepository.replaceUserPermissionOverrides(userId, permissions, actorUserId);
    return this.getPermissions(userId);
  },
};

function buildEffectiveScopes(
  rolePermissions: PermissionGrantDTO[],
  overrides: Awaited<ReturnType<typeof usersRepository.getUserPermissionOverrides>>,
  permissionMode: PermissionMode = 'role_default',
): Record<string, PermissionScope> {
  return Object.fromEntries(
    Object.entries(buildEffectivePermissionDetails(rolePermissions, overrides, permissionMode)).map(
      ([code, details]) => [code, details.scope],
    ),
  );
}

function buildEffectivePermissionDetails(
  rolePermissions: PermissionGrantDTO[],
  overrides: Awaited<ReturnType<typeof usersRepository.getUserPermissionOverrides>>,
  permissionMode: PermissionMode = 'role_default',
): Record<
  string,
  {
    scope: PermissionScope;
    region?: string | null;
    province?: string | null;
    estateCode?: string | null;
    estate?: string | null;
  }
> {
  const merged = mergePermissionScopesWithOverrides(
    rolePermissions.map((permission) => ({
      code: permission.code,
      scope: permission.scope,
    })),
    overrides.map((override) => ({
      code: override.code,
      effect: override.effect,
      scope: override.scope,
      region: override.region,
      province: override.provinceName ?? override.provinceId,
      estateCode: override.estateCode ?? override.estate,
      estate: override.estate,
    })),
    permissionMode,
  );

  return Object.fromEntries(
    Object.entries(merged).map(([code, details]) => [
      code,
      typeof details === 'object' && details !== null ? details : { scope: details },
    ]),
  );
}

function projectManagedPermissionAssignments(
  groups: ReturnType<typeof groupPermissions>,
  roleCodes: readonly string[],
  profile: OfficerProfileInput | undefined,
): ReturnType<typeof groupPermissions> {
  const assignedRegion =
    roleCodes.includes('monitoring_kpm') || roleCodes.includes('kpm_director')
      ? 'ภาคกลาง'
      : profile?.regionalAccess?.regions.length === 1
        ? profile.regionalAccess.regions[0]
        : null;
  const assignedProvince = normalizeLocationValue(profile?.provinceName ?? profile?.provinceId);
  const assignedEstate = normalizeLocationValue(profile?.estateCode);

  return Object.fromEntries(
    Object.entries(groups).map(([module, group]) => {
      if (group.data === 'IN_REGION') {
        return [
          module,
          {
            ...group,
            region: resolveMenuLocation(group.region, assignedRegion),
          },
        ];
      }
      if (group.data === 'IN_PROVINCE') {
        return [
          module,
          {
            ...group,
            province: resolveMenuLocation(group.province, assignedProvince),
          },
        ];
      }
      if (group.data === 'IN_ESTATE') {
        const estateCode = resolveMenuLocation(group.estateCode ?? group.estate, assignedEstate);
        return [module, { ...group, estateCode, estate: estateCode }];
      }
      return [module, group];
    }),
  );
}

function resolveMenuLocation(
  requested: string | PermissionScope | boolean | undefined,
  assigned: string | null,
): string | null {
  const requestedLocation =
    typeof requested === 'string' ? normalizeLocationValue(requested) : null;
  return requestedLocation ?? assigned;
}

function joinNamePrefix(prenameTh: string | null, firstName: string): string {
  return `${prenameTh ?? ''}${firstName}`;
}

function toManagedUserSource(identityProvider: string): 'api' | 'created' {
  return identityProvider === 'local' ? 'created' : 'api';
}

async function ensureUniqueIdentity(
  externalId: string,
  identityProvider = 'local',
  excludeUserId?: number,
): Promise<void> {
  const externalIdOwner = await usersRepository.findByExternalId(
    identityProvider,
    externalId,
    excludeUserId,
  );
  if (externalIdOwner) throw new ConflictError('External ID already exists');
}

function sanitizeIdentityUpdate(
  existing: Pick<ManagedUserDetailDTO, 'identityProvider' | 'externalId' | 'username'>,
  input: UpdateManagedUserInput,
): UpdateManagedUserInput {
  if (existing.identityProvider === 'local') {
    if (
      input.username !== undefined &&
      input.externalId !== undefined &&
      input.username !== input.externalId
    ) {
      throw new BadRequestError('POMS username and account key must match');
    }
    const accountKey = input.externalId ?? input.username;
    return accountKey === undefined
      ? input
      : { ...input, username: accountKey, externalId: accountKey };
  }

  if (
    (input.username !== undefined && input.username !== existing.username) ||
    (input.externalId !== undefined && input.externalId !== existing.externalId)
  ) {
    throw new BadRequestError('API account identity cannot be changed');
  }

  if (
    input.userType !== undefined ||
    input.prenameTh !== undefined ||
    input.firstName !== undefined ||
    input.lastName !== undefined ||
    input.email !== undefined ||
    input.phone !== undefined ||
    input.password !== undefined ||
    input.passwordHash !== undefined
  ) {
    throw new BadRequestError('API account profile is managed by its identity provider');
  }

  const authorizationProfile = sanitizeApiAuthorizationProfile(input.profile);

  const {
    username: _username,
    externalId: _externalId,
    password: _password,
    passwordHash: _passwordHash,
    profile: _profile,
    ...safeInput
  } = input;
  return {
    ...safeInput,
    ...(authorizationProfile !== undefined ? { profile: authorizationProfile } : {}),
  };
}

function sanitizeApiAuthorizationProfile(
  profile: OfficerProfileInput | undefined,
): OfficerProfileInput | undefined {
  if (profile === undefined) return undefined;

  const { regionalAccess, provinceId, provinceName, estateCode, ...providerOwnedFields } = profile;
  if (Object.values(providerOwnedFields).some((value) => value !== undefined)) {
    throw new BadRequestError('API account profile is managed by its identity provider');
  }

  return {
    ...(regionalAccess !== undefined ? { regionalAccess } : {}),
    ...(provinceId !== undefined ? { provinceId } : {}),
    ...(provinceName !== undefined ? { provinceName } : {}),
    ...(estateCode !== undefined ? { estateCode } : {}),
  };
}

async function ensureRolesExist(roleCodes: string[]): Promise<void> {
  if (roleCodes.length !== 1) {
    throw new BadRequestError('Exactly one system role is required');
  }
  const uniqueRoleCodes = Array.from(new Set(roleCodes));
  if (uniqueRoleCodes.length !== roleCodes.length) {
    throw new BadRequestError('roleCodes must not contain duplicates');
  }

  const roles = await usersRepository.findRolesByCodes(uniqueRoleCodes);
  const foundCodes = new Set(roles.map((role) => role.code));
  const missing = uniqueRoleCodes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new BadRequestError('Unknown roleCodes', {
      roleCodes: missing,
      status: StatusCodes.BAD_REQUEST,
    });
  }
}

/** Grouped edits replace editable grants and freeze the currently effective hidden grants. */
async function preparePermissionSnapshot(
  permissions: PermissionOverrideInput[],
  roleCodes: string[],
  existing?: ManagedUserDetailDTO,
  profile?: OfficerProfileInput,
  preserveActionScopes = false,
): Promise<PermissionOverrideInput[]> {
  const rolePermissions = await usersRepository.getRolePermissionsByRoleCodes(roleCodes);
  validateNewPermissionScopes(permissions, rolePermissions);
  permissions = await resolvePermissionOverrides(
    fillPermissionSnapshotDefaults(permissions, rolePermissions, roleCodes, profile),
  );
  const hidden: PermissionOverrideInput[] = [];
  if (existing) {
    const [currentRolePermissions, existingOverrides] = await Promise.all([
      usersRepository.getRolePermissions(existing.id),
      usersRepository.getUserPermissionOverrides(existing.id),
    ]);
    const incomingCodes = new Set(permissions.map((permission) => permission.code));
    const current = buildEffectivePermissionDetails(
      currentRolePermissions,
      existingOverrides,
      existing.permissionMode ?? 'role_default',
    );
    const overrideByCode = new Map(
      existingOverrides.map((permission) => [permission.code, permission]),
    );
    const currentSnapshot = fillPermissionSnapshotDefaults(
      Object.entries(current).map(([code, details]) => ({
        code,
        effect: 'allow',
        ...details,
        province: overrideByCode.get(code)?.provinceId ?? details.province,
      })),
      currentRolePermissions,
      existing.roleCodes,
      existing.profile,
    );
    if (preserveActionScopes) {
      permissions = preserveUnchangedActionScopes(permissions, currentSnapshot);
    }
    for (const [code, details] of Object.entries(current)) {
      if (!isEditablePermissionCode(code) && !incomingCodes.has(code)) {
        hidden.push(
          ...fillPermissionSnapshotDefaults(
            [{ code, effect: 'allow', ...details, province: details.province ?? null }],
            currentRolePermissions,
            existing.roleCodes,
            existing.profile,
          ),
        );
      }
    }
    for (const permission of existingOverrides) {
      if (
        permission.effect === 'deny' &&
        !isEditablePermissionCode(permission.code) &&
        !incomingCodes.has(permission.code)
      ) {
        hidden.push({ code: permission.code, effect: 'deny' });
      }
    }
  }
  return [...permissions, ...(await resolvePermissionOverrides(hidden))];
}

/** A menu's widest display scope must not silently expand a narrower existing action. */
function preserveUnchangedActionScopes(
  incoming: PermissionOverrideInput[],
  current: PermissionOverrideInput[],
): PermissionOverrideInput[] {
  const details = Object.fromEntries(
    current.map((permission) => [
      permission.code,
      {
        scope: permission.scope ?? null,
        region: permission.region,
        province: permission.province,
        estateCode: permission.estateCode,
      },
    ]),
  );
  const groups = groupPermissions(details);
  const byCode = new Map(current.map((permission) => [permission.code, permission]));
  return incoming.map((permission) => {
    const previous = byCode.get(permission.code);
    if (permission.effect !== 'allow' || !previous || permission.scope === undefined)
      return permission;
    const candidateGroups = groupPermissions({
      [permission.code]: {
        scope: permission.scope,
        region: permission.region,
        province: permission.province,
        estateCode: permission.estateCode ?? permission.estate,
      },
    });
    const module = Object.keys(candidateGroups)[0];
    const candidate = candidateGroups[module];
    const group = groups[module];
    if (!candidate || !group || candidate.data !== group.data) return permission;
    if (
      ['region', 'province', 'estateCode'].some(
        (key) =>
          normalizeLocationValue(candidate[key] as string | null | undefined) !==
          normalizeLocationValue(group[key] as string | null | undefined),
      )
    )
      return permission;
    return previous;
  });
}

function validateNewPermissionScopes(
  permissions: PermissionOverrideInput[],
  rolePermissions: PermissionGrantDTO[],
): void {
  const roleCodes = new Set(rolePermissions.map((permission) => permission.code));
  for (const permission of permissions) {
    if (
      permission.effect === 'allow' &&
      !isBinaryPermissionCode(permission.code) &&
      (permission.scope === null ||
        (permission.scope === undefined && !roleCodes.has(permission.code)))
    ) {
      throw new BadRequestError('Data-scoped permissions require a valid scope', {
        permission: permission.code,
      });
    }
  }
}

/** Defaults are copied once at save time; a custom snapshot never inherits later role changes. */
function fillPermissionSnapshotDefaults(
  permissions: PermissionOverrideInput[],
  rolePermissions: PermissionGrantDTO[],
  roleCodes: readonly string[],
  profile?: OfficerProfileInput,
): PermissionOverrideInput[] {
  const roleScopes = new Map(
    rolePermissions.map((permission) => [permission.code, permission.scope]),
  );
  const region =
    roleCodes.includes('monitoring_kpm') || roleCodes.includes('kpm_director')
      ? 'ภาคกลาง'
      : profile?.regionalAccess?.regions.length === 1
        ? profile.regionalAccess.regions[0]
        : null;
  return permissions.map((permission) => {
    if (permission.effect === 'deny') return { ...permission, scope: undefined };
    let scope =
      permission.scope === undefined ? (roleScopes.get(permission.code) ?? null) : permission.scope;
    if (!isBinaryPermissionCode(permission.code) && scope === null) {
      const [resource, action] = permission.code.split(':');
      // Legacy action defaults borrow the role view area once, then become explicit snapshot data.
      if (permission.scope === undefined && (action === 'edit' || action === 'approve')) {
        scope = roleScopes.get(`${resource}:view`) ?? null;
      }
      if (scope === null) {
        throw new BadRequestError('Data-scoped permissions require a valid scope', {
          permission: permission.code,
        });
      }
    }
    return {
      ...permission,
      scope,
      region: scope === 'IN_REGION' ? (normalizeLocationValue(permission.region) ?? region) : null,
      province:
        scope === 'IN_PROVINCE'
          ? (normalizeLocationValue(permission.province) ??
            profile?.provinceId ??
            profile?.provinceName ??
            null)
          : null,
      estateCode:
        scope === 'IN_ESTATE'
          ? (normalizeLocationValue(permission.estateCode ?? permission.estate) ??
            profile?.estateCode ??
            null)
          : null,
      estate:
        scope === 'IN_ESTATE'
          ? (normalizeLocationValue(permission.estateCode ?? permission.estate) ??
            profile?.estateCode ??
            null)
          : null,
    };
  });
}

async function ensurePermissionsExist(permissionCodes: string[]): Promise<void> {
  const uniquePermissionCodes = Array.from(new Set(permissionCodes));
  const permissions = await usersRepository.findPermissionsByCodes(uniquePermissionCodes);
  const foundCodes = new Set(permissions.map((permission) => permission.code));
  const missing = uniquePermissionCodes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new BadRequestError('Unknown permission codes', {
      permissionCodes: missing,
      status: StatusCodes.BAD_REQUEST,
    });
  }
}

async function withResolvedOfficerProfile<T extends { profile?: OfficerProfileInput }>(
  input: T,
): Promise<T> {
  if (input.profile === undefined) return input;
  return {
    ...input,
    profile: await resolveOfficerProfile(input.profile),
  };
}

async function withResolvedUserInput<
  T extends { profile?: OfficerProfileInput; permissionOverrides?: PermissionOverrideInput[] },
>(input: T): Promise<T> {
  // Permission locations are resolved after their scope defaults have been copied.
  return withResolvedOfficerProfile(input);
}

async function resolveOfficerProfile(profile: OfficerProfileInput): Promise<OfficerProfileInput> {
  const { provinceName, estateCode, ...persistentProfile } = profile;
  const provinceInput = profile.provinceId !== undefined ? profile.provinceId : provinceName;
  const estateInput = estateCode;

  const resolvedProfile: OfficerProfileInput = { ...persistentProfile };

  if (provinceInput === null) {
    resolvedProfile.provinceId = null;
  } else if (provinceInput !== undefined) {
    const province = await usersRepository.findProvinceByIdOrName(provinceInput);
    if (!province) {
      throw new BadRequestError('Unknown province', {
        province: provinceInput,
        status: StatusCodes.BAD_REQUEST,
      });
    }
    resolvedProfile.provinceId = province.id;
  }

  if (estateInput === null) {
    resolvedProfile.estateCode = null;
  } else if (estateInput !== undefined) {
    const estate = await usersRepository.findIndustrialEstateByCodeOrName(estateInput);
    if (!estate) {
      throw new BadRequestError('Unknown industrial estate', {
        estate: estateInput,
        status: StatusCodes.BAD_REQUEST,
      });
    }
    resolvedProfile.estateCode = estate.code;
  }

  return resolvedProfile;
}

async function resolvePermissionOverrides(
  permissions: PermissionOverrideInput[],
): Promise<PermissionOverrideInput[]> {
  const resolved = await Promise.all(permissions.map(resolvePermissionOverride));
  for (const permission of resolved) {
    if (
      permission.effect === 'allow' &&
      !isBinaryPermissionCode(permission.code) &&
      !hasValidPermissionDataScope({ ...permission, scope: permission.scope ?? null })
    ) {
      throw new BadRequestError('Data-scoped permissions require a scope and matching location', {
        permission: permission.code,
      });
    }
  }
  return resolved;
}

async function resolvePermissionOverride(
  permission: PermissionOverrideInput,
): Promise<PermissionOverrideInput> {
  const region =
    permission.scope === 'IN_REGION' ? normalizeLocationValue(permission.region) : null;
  const province =
    permission.scope === 'IN_PROVINCE' ? normalizeLocationValue(permission.province) : null;
  const estateInput =
    permission.scope === 'IN_ESTATE'
      ? normalizeLocationValue(permission.estateCode ?? permission.estate)
      : null;

  if (permission.effect === 'deny') {
    return {
      ...permission,
      scope: undefined,
      region: null,
      province: null,
      estateCode: null,
      estate: null,
    };
  }

  if (estateInput) {
    const estate = await usersRepository.findIndustrialEstateByCodeOrName(estateInput);
    if (!estate) {
      throw new BadRequestError('Unknown permission industrial estate', {
        permission: permission.code,
        estate: estateInput,
        status: StatusCodes.BAD_REQUEST,
      });
    }

    return {
      ...permission,
      region: null,
      province: null,
      estateCode: estate.code,
      estate: estate.code,
    };
  }

  if (!province) {
    return {
      ...permission,
      region,
      province: null,
      estateCode: null,
      estate: null,
    };
  }

  const provinceRow = await usersRepository.findProvinceByIdOrName(province);
  if (!provinceRow) {
    throw new BadRequestError('Unknown permission province', {
      permission: permission.code,
      province,
      status: StatusCodes.BAD_REQUEST,
    });
  }

  return {
    ...permission,
    region,
    province: provinceRow.id,
    estateCode: null,
    estate: null,
  };
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}

function ensureRequiredRoleAssignment(
  roleCode: string | undefined,
  profile?: OfficerProfileInput,
  existingProfile?: OfficerProfileInput,
): void {
  if (!roleCode) throw new BadRequestError('Exactly one system role is required');
  const effectiveProfile = { ...(existingProfile ?? {}), ...(profile ?? {}) };

  if (roleCode === 'monitoring_5_centers' || roleCode === 'center_director') {
    if (effectiveProfile.regionalAccess?.regions.length !== 1) {
      throw new BadRequestError('This role requires exactly one assigned region');
    }
    return;
  }

  if (roleCode === 'provincial_office') {
    if (!normalizeLocationValue(effectiveProfile.provinceId ?? effectiveProfile.provinceName)) {
      throw new BadRequestError('Provincial office role requires an assigned province');
    }
    return;
  }

  if (roleCode === 'industrial_estate') {
    if (!normalizeLocationValue(effectiveProfile.estateCode)) {
      throw new BadRequestError('Industrial estate role requires one assigned estate');
    }
  }
}
