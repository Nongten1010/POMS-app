import { StatusCodes } from 'http-status-codes';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { usersRepository } from './users.repository';
import type {
  CreateManagedUserInput,
  ListManagedUsersQuery,
  ManagedUserDetailDTO,
  PaginatedManagedUsersDTO,
  UpdateManagedUserInput,
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
};

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
