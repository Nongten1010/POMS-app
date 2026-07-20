import { StatusCodes } from 'http-status-codes';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { hashPassword } from '../../shared/utils/password';
import { usersRepository } from './users.repository';
import { groupPermissions } from '../auth/permissions';
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
        roles: user.roles,
        roleCodes: [...(user.roleCodes ?? [user.roles])],
        isActive: user.isActive,
        source: toManagedUserSource(user.identityProvider),
      },
      permissions: groupPermissions(effectivePermissionDetails),
    };
  },

  async create(input: CreateManagedUserInput, actorUserId: number): Promise<ManagedUserDetailDTO> {
    if (input.externalId !== undefined && input.externalId !== input.username) {
      throw new BadRequestError('POMS username and account key must match');
    }
    await ensureUniqueIdentity(input.externalId ?? input.username);
    await ensureRolesExist(input.roleCodes);
    return usersRepository.create(await withResolvedOfficerProfile(input), actorUserId);
  },

  async createLocalAccount(
    input: CreateLocalAccountInput,
    actorUserId: number,
  ): Promise<ManagedUserDetailDTO> {
    await ensureUniqueIdentity(input.username);
    await ensureRolesExist(input.roleCodes);
    const resolvedInput = await withResolvedUserInput(input);
    if (resolvedInput.permissionOverrides) {
      await ensurePermissionsExist(
        resolvedInput.permissionOverrides.map((permission) => permission.code),
      );
    }

    const passwordHash = await hashPassword(input.password);
    return usersRepository.createLocalAccount(
      {
        ...resolvedInput,
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
    if (resolvedInput.permissionOverrides !== undefined) {
      await ensurePermissionsExist(
        resolvedInput.permissionOverrides.map((permission) => permission.code),
      );
    }

    const { password, ...repositoryInput } = resolvedInput;
    return usersRepository.update(
      userId,
      await withResolvedOfficerProfile({
        ...repositoryInput,
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
    const permissions = await resolvePermissionOverrides(input.permissions);
    await ensurePermissionsExist(permissions.map((permission) => permission.code));
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
  }
> {
  const priority: Record<string, number> = {
    ALL: 4,
    IN_REGION: 3,
    IN_PROVINCE: 3,
    IN_ESTATE: 2,
    OWN_FACTORY: 1,
  };
  const scopes: Record<
    string,
    {
      scope: PermissionScope;
      region?: string | null;
      province?: string | null;
    }
  > = {};

  for (const permission of rolePermissions) {
    const current = scopes[permission.code];
    const currentRank = current === undefined ? -1 : (priority[current.scope ?? 'NULL'] ?? 0);
    const newRank = priority[permission.scope ?? 'NULL'] ?? 0;
    if (newRank >= currentRank) {
      scopes[permission.code] = {
        scope: permission.scope,
      };
    }
  }

  for (const override of overrides) {
    if (override.effect === 'deny') {
      delete scopes[override.code];
      continue;
    }
    scopes[override.code] = {
      scope: override.scope,
      region: override.region,
      province: override.provinceName ?? override.provinceId,
    };
  }

  return scopes;
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
    input.profile !== undefined ||
    input.password !== undefined ||
    input.passwordHash !== undefined
  ) {
    throw new BadRequestError('API account profile is managed by its identity provider');
  }

  const {
    username: _username,
    externalId: _externalId,
    password: _password,
    passwordHash: _passwordHash,
    ...safeInput
  } = input;
  return safeInput;
}

async function ensureRolesExist(roleCodes: string[]): Promise<void> {
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
  const { provinceName, ...persistentProfile } = profile;
  const provinceInput = profile.provinceId !== undefined ? profile.provinceId : provinceName;

  if (provinceInput === undefined) return persistentProfile;
  if (provinceInput === null) return { ...persistentProfile, provinceId: null };

  const province = await usersRepository.findProvinceByIdOrName(provinceInput);
  if (!province) {
    throw new BadRequestError('Unknown province', {
      province: provinceInput,
      status: StatusCodes.BAD_REQUEST,
    });
  }

  return {
    ...persistentProfile,
    provinceId: province.id,
  };
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

  if (permission.effect === 'deny') {
    return {
      ...permission,
      scope: undefined,
      region: null,
      province: null,
    };
  }

  if (!province) {
    return {
      ...permission,
      region,
      province: null,
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
  };
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}
