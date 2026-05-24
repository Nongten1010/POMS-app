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
  ManagedUserDetailDTO,
  PaginatedManagedUsersDTO,
  PermissionGrantDTO,
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

  async create(input: CreateManagedUserInput, actorUserId: number): Promise<ManagedUserDetailDTO> {
    await ensureUniqueIdentity(input.username, input.externalId ?? input.username);
    await ensureRolesExist(input.roleCodes);
    return usersRepository.create(input, actorUserId);
  },

  async createLocalAccount(
    input: CreateLocalAccountInput,
    actorUserId: number,
  ): Promise<ManagedUserDetailDTO> {
    await ensureUniqueIdentity(input.username, input.username);
    await ensureRolesExist(input.roleCodes);
    if (input.permissionOverrides) {
      await ensurePermissionsExist(input.permissionOverrides.map((permission) => permission.code));
    }

    const passwordHash = await hashPassword(input.password);
    return usersRepository.createLocalAccount(
      {
        ...input,
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

    if (input.username !== undefined || input.externalId !== undefined) {
      await ensureUniqueIdentity(
        input.username ?? existing.username,
        input.externalId ?? existing.externalId,
        existing.identityProvider,
        userId,
      );
    }
    if (input.roleCodes !== undefined) await ensureRolesExist(input.roleCodes);

    return usersRepository.update(userId, input, actorUserId);
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

    return {
      userId,
      rolePermissions,
      overrides,
      effectiveScopes,
      permissions: groupPermissions(effectiveScopes),
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
    await usersRepository.replaceUserPermissionOverrides(userId, input.permissions, actorUserId);
    return this.getPermissions(userId);
  },
};

function buildEffectiveScopes(
  rolePermissions: PermissionGrantDTO[],
  overrides: Awaited<ReturnType<typeof usersRepository.getUserPermissionOverrides>>,
): Record<string, PermissionScope> {
  const priority: Record<string, number> = {
    ALL: 4,
    IN_PROVINCE: 3,
    IN_ESTATE: 2,
    OWN_FACTORY: 1,
  };
  const scopes: Record<string, PermissionScope> = {};

  for (const permission of rolePermissions) {
    const current = scopes[permission.code];
    const currentRank = current === undefined ? -1 : (priority[current ?? 'NULL'] ?? 0);
    const newRank = priority[permission.scope ?? 'NULL'] ?? 0;
    if (newRank >= currentRank) scopes[permission.code] = permission.scope;
  }

  for (const override of overrides) {
    if (override.effect === 'deny') {
      delete scopes[override.code];
      continue;
    }
    scopes[override.code] = override.scope;
  }

  return scopes;
}

async function ensureUniqueIdentity(
  username: string,
  externalId: string,
  identityProvider = 'local',
  excludeUserId?: number,
): Promise<void> {
  const [usernameOwner, externalIdOwner] = await Promise.all([
    usersRepository.findByUsername(username, excludeUserId),
    usersRepository.findByExternalId(identityProvider, externalId, excludeUserId),
  ]);
  if (usernameOwner) throw new ConflictError('Username already exists');
  if (externalIdOwner) throw new ConflictError('External ID already exists');
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
