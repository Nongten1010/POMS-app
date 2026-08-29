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
  isEditablePermissionCode,
  isSameOrNarrowerPermissionScope,
  mergePermissionScopesWithOverrides,
  projectEditablePermissionGroups,
} from '../auth/permissions';
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
    const effectivePermissionDetails = buildEffectivePermissionDetails(rolePermissions, overrides);
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
        isActive: user.isActive,
        source: toManagedUserSource(user.identityProvider),
      },
      permissions: projectEditablePermissionGroups(
        projectManagedPermissionAssignments(
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
    ensureRequiredRoleAssignment(resolvedInput.roleCodes[0], resolvedInput.profile);
    if (resolvedInput.permissionOverrides) {
      await ensurePermissionsExist(
        resolvedInput.permissionOverrides.map((permission) => permission.code),
      );
    }
    const permissionOverrides = resolvedInput.permissionOverrides
      ? await validatePermissionOverridesForRoleCodes(
          resolvedInput.permissionOverrides,
          resolvedInput.roleCodes,
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
    ensureRequiredRoleAssignment(
      resolvedInput.roleCodes?.[0] ?? existing.roleCodes[0],
      resolvedInput.profile,
      existing.profile,
    );
    if (resolvedInput.permissionOverrides !== undefined) {
      await ensurePermissionsExist(
        resolvedInput.permissionOverrides.map((permission) => permission.code),
      );
    }

    const permissionOverrides =
      resolvedInput.permissionOverrides === undefined
        ? undefined
        : await validatePermissionOverridesForRoleCodes(
            resolvedInput.permissionOverrides,
            resolvedInput.roleCodes ?? existing.roleCodes,
            resolvedInput.profile ?? existing.profile,
            userId,
          );

    const { password, ...repositoryInput } = resolvedInput;
    return usersRepository.update(
      userId,
      await withResolvedOfficerProfile({
        ...repositoryInput,
        ...(permissionOverrides !== undefined ? { permissionOverrides } : {}),
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
    const effectiveScopes = buildEffectiveScopes(rolePermissions, overrides);
    const effectivePermissionDetails = buildEffectivePermissionDetails(rolePermissions, overrides);

    return {
      userId,
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
    const resolvedPermissions = await resolvePermissionOverrides(input.permissions);
    await ensurePermissionsExist(resolvedPermissions.map((permission) => permission.code));
    const rolePermissions = await usersRepository.getRolePermissions(userId);
    const permissions = validatePermissionOverridesAgainstRole(
      resolvedPermissions,
      rolePermissions,
      existing.roleCodes,
      existing.profile,
    );
    await usersRepository.replaceUserPermissionOverrides(userId, permissions, actorUserId);
    return this.getPermissions(userId);
  },
};

function buildEffectiveScopes(
  rolePermissions: PermissionGrantDTO[],
  overrides: Awaited<ReturnType<typeof usersRepository.getUserPermissionOverrides>>,
): Record<string, PermissionScope> {
  return Object.fromEntries(
    Object.entries(buildEffectivePermissionDetails(rolePermissions, overrides)).map(
      ([code, details]) => [code, details.scope],
    ),
  );
}

function buildEffectivePermissionDetails(
  rolePermissions: PermissionGrantDTO[],
  overrides: Awaited<ReturnType<typeof usersRepository.getUserPermissionOverrides>>,
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
            region: intersectAssignedLocation(group.region, assignedRegion),
          },
        ];
      }
      if (group.data === 'IN_PROVINCE') {
        return [
          module,
          {
            ...group,
            province: intersectAssignedLocation(group.province, assignedProvince),
          },
        ];
      }
      if (group.data === 'IN_ESTATE') {
        const estateCode = intersectAssignedLocation(
          group.estateCode ?? group.estate,
          assignedEstate,
        );
        return [module, { ...group, estateCode, estate: estateCode }];
      }
      return [module, group];
    }),
  );
}

function intersectAssignedLocation(
  requested: string | PermissionScope | boolean | undefined,
  assigned: string | null,
): string | null {
  const requestedLocation =
    typeof requested === 'string' ? normalizeLocationValue(requested) : null;
  if (!assigned) return null;
  if (!requestedLocation) return assigned;
  return sameLocation(requestedLocation, assigned) ? assigned : null;
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

async function validatePermissionOverridesForRoleCodes(
  permissions: PermissionOverrideInput[],
  roleCodes: string[],
  profile?: OfficerProfileInput,
  preserveHiddenOverridesForUserId?: number,
): Promise<PermissionOverrideInput[]> {
  const rolePermissions = await usersRepository.getRolePermissionsByRoleCodes(roleCodes);
  const effectivePermissions =
    preserveHiddenOverridesForUserId === undefined
      ? permissions
      : await mergePreservedHiddenPermissionOverrides(
          preserveHiddenOverridesForUserId,
          permissions,
          rolePermissions,
        );
  return validatePermissionOverridesAgainstRole(
    effectivePermissions,
    rolePermissions,
    roleCodes,
    profile,
  );
}

async function mergePreservedHiddenPermissionOverrides(
  userId: number,
  editableOverrides: PermissionOverrideInput[],
  rolePermissions: PermissionGrantDTO[],
): Promise<PermissionOverrideInput[]> {
  const existingOverrides = await usersRepository.getUserPermissionOverrides(userId);
  const incomingCodes = new Set(editableOverrides.map((permission) => permission.code));
  const roleScopes = new Map(
    rolePermissions.map((permission) => [permission.code, permission.scope] as const),
  );
  const hiddenOverrides = existingOverrides
    .filter(
      (permission) =>
        !isEditablePermissionCode(permission.code) &&
        !incomingCodes.has(permission.code) &&
        roleScopes.has(permission.code),
    )
    .filter((permission) => {
      if (permission.effect === 'deny') return true;
      return isSameOrNarrowerPermissionScope(permission.scope, roleScopes.get(permission.code));
    })
    .map((permission) => ({
      code: permission.code,
      effect: permission.effect,
      scope: permission.scope,
      region: permission.region,
      province: permission.provinceId ?? permission.provinceName,
      estateCode: permission.estateCode ?? permission.estate,
      estate: permission.estate ?? permission.estateCode,
    }));

  return [...editableOverrides, ...hiddenOverrides];
}

function validatePermissionOverridesAgainstRole(
  permissions: PermissionOverrideInput[],
  rolePermissions: PermissionGrantDTO[],
  roleCodes: string[] = [],
  profile?: OfficerProfileInput,
): PermissionOverrideInput[] {
  const roleScopes = new Map<string, PermissionScope>();
  for (const permission of rolePermissions) {
    roleScopes.set(permission.code, permission.scope);
  }

  const validated: PermissionOverrideInput[] = [];
  for (const permission of permissions) {
    if (!roleScopes.has(permission.code)) {
      if (permission.effect === 'deny') continue;
      throw new BadRequestError(
        'Permission override cannot grant an action outside the assigned role',
        {
          permission: permission.code,
          status: StatusCodes.BAD_REQUEST,
        },
      );
    }

    const roleScope = roleScopes.get(permission.code) as PermissionScope;
    if (permission.effect === 'deny') {
      validated.push(permission);
      continue;
    }

    const scope = permission.scope === undefined ? roleScope : permission.scope;
    if (!isSameOrNarrowerPermissionScope(scope, roleScope)) {
      throw new BadRequestError('Permission override cannot widen the assigned role scope', {
        permission: permission.code,
        roleScope,
        requestedScope: scope,
        status: StatusCodes.BAD_REQUEST,
      });
    }
    ensurePermissionLocationWithinProfile(permission, scope, roleCodes, profile);
    validated.push({ ...permission, scope });
  }

  return validated;
}

function ensurePermissionLocationWithinProfile(
  permission: PermissionOverrideInput,
  scope: PermissionScope,
  roleCodes: string[],
  profile?: OfficerProfileInput,
): void {
  if (scope === 'IN_REGION') {
    const requestedRegion = normalizeLocationValue(permission.region);
    if (!requestedRegion) return;
    const assignedRegions =
      roleCodes.includes('monitoring_kpm') || roleCodes.includes('kpm_director')
        ? ['ภาคกลาง']
        : (profile?.regionalAccess?.regions ?? []);
    if (!assignedRegions.some((region) => sameLocation(region, requestedRegion))) {
      throw new BadRequestError('Permission region must be inside the user profile assignment', {
        permission: permission.code,
        requestedRegion,
        status: StatusCodes.BAD_REQUEST,
      });
    }
    return;
  }

  if (scope === 'IN_PROVINCE') {
    const requestedProvince = normalizeLocationValue(permission.province);
    if (!requestedProvince) return;
    const assignedProvince = normalizeLocationValue(profile?.provinceId ?? profile?.provinceName);
    if (!assignedProvince || !sameLocation(assignedProvince, requestedProvince)) {
      throw new BadRequestError('Permission province must match the user profile assignment', {
        permission: permission.code,
        requestedProvince,
        status: StatusCodes.BAD_REQUEST,
      });
    }
    return;
  }

  if (scope === 'IN_ESTATE') {
    const requestedEstate = normalizeLocationValue(permission.estateCode ?? permission.estate);
    if (!requestedEstate) return;
    const assignedEstate = normalizeLocationValue(profile?.estateCode);
    if (!assignedEstate || !sameLocation(assignedEstate, requestedEstate)) {
      throw new BadRequestError('Permission estate must match the user profile assignment', {
        permission: permission.code,
        requestedEstate,
        status: StatusCodes.BAD_REQUEST,
      });
    }
  }
}

function sameLocation(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
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
  return {
    ...(await withResolvedOfficerProfile(input)),
    ...(input.permissionOverrides !== undefined
      ? { permissionOverrides: await resolvePermissionOverrides(input.permissionOverrides) }
      : {}),
  };
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
  return Promise.all(permissions.map(resolvePermissionOverride));
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
