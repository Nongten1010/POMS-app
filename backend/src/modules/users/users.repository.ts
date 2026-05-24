import type { Knex } from 'knex';
import { db } from '../../config/database';
import type {
  CreateManagedUserInput,
  ListManagedUsersQuery,
  ManagedUserDetailDTO,
  ManagedUserTableDTO,
  OfficerProfileInput,
  PermissionGrantDTO,
  PermissionOverrideInput,
  RoleSummaryDTO,
  UpdateManagedUserInput,
  UserPermissionOverrideDTO,
} from './users.types';

interface ManagedUserJoinedRow {
  id: number | string;
  external_id: string;
  identity_provider: string;
  user_type: 'officer' | 'admin';
  username: string | null;
  email: string | null;
  phone: string | null;
  prename_th: string | null;
  first_name: string;
  last_name: string;
  is_active: boolean;
  pos_no: string | null;
  pertype_id: string | null;
  pertype: string | null;
  position_type_id: string | null;
  position_type_th: string | null;
  line_id: string | null;
  line_name_th: string | null;
  level_id: string | null;
  level_name_th: string | null;
  mposition_id: string | null;
  mposition: string | null;
  organize_id: string | null;
  division_id: string | null;
  department_id: string | null;
  ministry_id: string | null;
  province_id: string | null;
  per_status: string | null;
  per_status_name: string | null;
  relocation_type: string | null;
  relocation_name: string | null;
  role_code: string | null;
  role_name_th: string | null;
  role_name_en: string | null;
  department_name_th: string | null;
  division_name_th: string | null;
  organize_name_th: string | null;
}

interface RoleRow {
  id: number;
  code: string;
  name_th: string;
  name_en: string;
}

interface PermissionRow {
  id: number;
  code: string;
  resource: string;
  action: string;
  description: string | null;
}

interface PermissionGrantRow {
  code: string;
  resource: string;
  action: string;
  description: string | null;
  scope: 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null;
}

interface UserPermissionOverrideRow extends PermissionGrantRow {
  effect: 'allow' | 'deny';
}

export const usersRepository = {
  async list(
    query: ListManagedUsersQuery,
  ): Promise<{ rows: ManagedUserTableDTO[]; total: number }> {
    const baseQuery = buildManagedUsersBaseQuery(query);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .countDistinct<{ total: number | string }>('users.id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const idsQuery = baseQuery
      .clone()
      .clearSelect()
      .distinct('users.id')
      .orderBy('users.id', 'asc');

    if (query.page !== undefined && query.perPage !== undefined) {
      idsQuery.limit(query.perPage).offset((query.page - 1) * query.perPage);
    }

    const ids = await idsQuery;
    const userIds = ids.map((row: { id: number | string }) => Number(row.id));
    if (userIds.length === 0) return { rows: [], total };

    const rows = await managedUsersWithJoins()
      .whereIn('users.id', userIds)
      .orderBy('users.id', 'asc')
      .orderBy('roles.code', 'asc');

    return { rows: toTableDTOs(rows), total };
  },

  async findById(userId: number, trx?: Knex.Transaction): Promise<ManagedUserDetailDTO | null> {
    const rows = await managedUsersWithJoins(trx)
      .where('users.id', userId)
      .whereIn('users.user_type', ['officer', 'admin'])
      .whereNull('users.deleted_at')
      .orderBy('roles.code', 'asc');
    if (rows.length === 0) return null;
    return toDetailDTO(rows);
  },

  async findByUsername(
    username: string,
    excludeUserId?: number,
  ): Promise<{ id: number } | undefined> {
    const query = db('users').where({ username }).whereNull('deleted_at').select('id').first();
    if (excludeUserId !== undefined) query.whereNot('id', excludeUserId);
    return query;
  },

  async findByExternalId(
    identityProvider: string,
    externalId: string,
    excludeUserId?: number,
  ): Promise<{ id: number } | undefined> {
    const query = db('users')
      .where({ identity_provider: identityProvider, external_id: externalId })
      .whereNull('deleted_at')
      .select('id')
      .first();
    if (excludeUserId !== undefined) query.whereNot('id', excludeUserId);
    return query;
  },

  async findRolesByCodes(roleCodes: string[], trx?: Knex.Transaction): Promise<RoleRow[]> {
    return (trx ?? db)<RoleRow>('roles')
      .whereIn('code', roleCodes)
      .whereNull('deleted_at')
      .select('id', 'code', 'name_th', 'name_en');
  },

  async findPermissionsByCodes(
    permissionCodes: string[],
    trx?: Knex.Transaction,
  ): Promise<PermissionRow[]> {
    if (permissionCodes.length === 0) return [];
    return (trx ?? db)<PermissionRow>('permissions')
      .whereIn('code', permissionCodes)
      .select('id', 'code', 'resource', 'action', 'description');
  },

  async getRolePermissions(userId: number): Promise<PermissionGrantDTO[]> {
    const rows: PermissionGrantRow[] = await db('user_roles')
      .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('user_roles.user_id', userId)
      .select(
        'permissions.code as code',
        'permissions.resource as resource',
        'permissions.action as action',
        'permissions.description as description',
        'role_permissions.scope as scope',
      );

    return rows.map(toPermissionGrantDTO);
  },

  async getUserPermissionOverrides(userId: number): Promise<UserPermissionOverrideDTO[]> {
    const rows: UserPermissionOverrideRow[] = await db('user_permissions')
      .join('permissions', 'user_permissions.permission_id', 'permissions.id')
      .where('user_permissions.user_id', userId)
      .select(
        'permissions.code as code',
        'permissions.resource as resource',
        'permissions.action as action',
        'permissions.description as description',
        'user_permissions.scope as scope',
        'user_permissions.effect as effect',
      );

    return rows.map((row) => ({
      ...toPermissionGrantDTO(row),
      effect: row.effect,
    }));
  },

  async create(input: CreateManagedUserInput, actorUserId: number): Promise<ManagedUserDetailDTO> {
    return db.transaction(async (trx) => {
      const roleRows = await this.findRolesByCodes(input.roleCodes, trx);
      const externalId = input.externalId ?? input.username;
      const [{ id }] = await trx('users')
        .insert({
          external_id: externalId,
          identity_provider: 'local',
          user_type: input.userType,
          username: input.username,
          email: input.email ?? null,
          phone: input.phone ?? null,
          prename_th: input.prenameTh ?? null,
          first_name: input.firstName,
          last_name: input.lastName,
          is_active: input.isActive,
          created_by: actorUserId,
          updated_by: actorUserId,
        })
        .returning('id');
      const userId = Number(id);

      await upsertOfficerProfile(trx, userId, input.profile ?? {});
      await replaceUserRoles(trx, userId, roleRows, actorUserId);

      const created = await this.findById(userId, trx);
      if (!created) throw new Error('Created user could not be loaded');
      return created;
    });
  },

  async update(
    userId: number,
    input: UpdateManagedUserInput,
    actorUserId: number,
  ): Promise<ManagedUserDetailDTO> {
    return db.transaction(async (trx) => {
      const userPatch: Record<string, unknown> = {
        updated_at: trx.raw('SYSDATETIME()'),
        updated_by: actorUserId,
      };

      if (input.externalId !== undefined) userPatch.external_id = input.externalId;
      if (input.userType !== undefined) userPatch.user_type = input.userType;
      if (input.username !== undefined) userPatch.username = input.username;
      if (input.email !== undefined) userPatch.email = input.email;
      if (input.phone !== undefined) userPatch.phone = input.phone;
      if (input.prenameTh !== undefined) userPatch.prename_th = input.prenameTh;
      if (input.firstName !== undefined) userPatch.first_name = input.firstName;
      if (input.lastName !== undefined) userPatch.last_name = input.lastName;
      if (input.isActive !== undefined) userPatch.is_active = input.isActive;

      await trx('users').where({ id: userId }).whereNull('deleted_at').update(userPatch);

      if (input.profile !== undefined) {
        await upsertOfficerProfile(trx, userId, input.profile);
      }

      if (input.roleCodes !== undefined) {
        const roleRows = await this.findRolesByCodes(input.roleCodes, trx);
        await replaceUserRoles(trx, userId, roleRows, actorUserId);
      }

      const updated = await this.findById(userId, trx);
      if (!updated) throw new Error('Updated user could not be loaded');
      return updated;
    });
  },

  async softDelete(userId: number, actorUserId: number): Promise<void> {
    await db('users')
      .where({ id: userId })
      .whereNull('deleted_at')
      .update({
        is_active: false,
        deleted_at: db.raw('SYSDATETIME()'),
        updated_at: db.raw('SYSDATETIME()'),
        updated_by: actorUserId,
      });
  },

  async replaceUserPermissionOverrides(
    userId: number,
    permissions: PermissionOverrideInput[],
    actorUserId: number,
  ): Promise<void> {
    await db.transaction(async (trx) => {
      const permissionRows = await this.findPermissionsByCodes(
        permissions.map((permission) => permission.code),
        trx,
      );
      const permissionByCode = new Map(
        permissionRows.map((permission) => [permission.code, permission]),
      );

      await trx('user_permissions').where({ user_id: userId }).del();

      if (permissions.length === 0) return;

      await trx('user_permissions').insert(
        permissions.map((permission) => {
          const permissionRow = permissionByCode.get(permission.code);
          if (!permissionRow) throw new Error(`Permission not loaded: ${permission.code}`);
          return {
            user_id: userId,
            permission_id: permissionRow.id,
            effect: permission.effect,
            scope: permission.effect === 'allow' ? (permission.scope ?? null) : null,
            granted_by: actorUserId,
          };
        }),
      );
    });
  },
};

function buildManagedUsersBaseQuery(query: ListManagedUsersQuery): Knex.QueryBuilder {
  const builder = db('users')
    .leftJoin('officer_profiles', 'officer_profiles.user_id', 'users.id')
    .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
    .leftJoin('roles', 'roles.id', 'user_roles.role_id')
    .whereIn('users.user_type', ['officer', 'admin'])
    .whereNull('users.deleted_at');

  if (query.search) {
    const term = `%${query.search}%`;
    builder.andWhere((qb) => {
      qb.where('users.username', 'like', term)
        .orWhere('users.first_name', 'like', term)
        .orWhere('users.last_name', 'like', term)
        .orWhereRaw("CONCAT(users.first_name, ' ', users.last_name) LIKE ?", [term]);
    });
  }

  if (query.roleCode) builder.andWhere('roles.code', query.roleCode);
  if (query.status === 'active') builder.andWhere('users.is_active', true);
  if (query.status === 'suspended') builder.andWhere('users.is_active', false);

  return builder;
}

function managedUsersWithJoins(trx?: Knex.Transaction): Knex.QueryBuilder<ManagedUserJoinedRow[]> {
  return (trx ?? db)('users')
    .leftJoin('officer_profiles', 'officer_profiles.user_id', 'users.id')
    .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
    .leftJoin('roles', 'roles.id', 'user_roles.role_id')
    .leftJoin({ department_org: 'organizations' }, function joinDepartment() {
      this.on('officer_profiles.department_id', '=', 'department_org.external_id').andOnVal(
        'department_org.level',
        '=',
        'department',
      );
    })
    .leftJoin({ division_org: 'organizations' }, function joinDivision() {
      this.on('officer_profiles.division_id', '=', 'division_org.external_id').andOnVal(
        'division_org.level',
        '=',
        'division',
      );
    })
    .leftJoin({ organize_org: 'organizations' }, function joinOrganize() {
      this.on('officer_profiles.organize_id', '=', 'organize_org.external_id').andOnVal(
        'organize_org.level',
        '=',
        'organize',
      );
    })
    .whereNull('users.deleted_at')
    .select(
      'users.id',
      'users.external_id',
      'users.identity_provider',
      'users.user_type',
      'users.username',
      'users.email',
      'users.phone',
      'users.prename_th',
      'users.first_name',
      'users.last_name',
      'users.is_active',
      'officer_profiles.pos_no',
      'officer_profiles.pertype_id',
      'officer_profiles.pertype',
      'officer_profiles.position_type_id',
      'officer_profiles.position_type_th',
      'officer_profiles.line_id',
      'officer_profiles.line_name_th',
      'officer_profiles.level_id',
      'officer_profiles.level_name_th',
      'officer_profiles.mposition_id',
      'officer_profiles.mposition',
      'officer_profiles.organize_id',
      'officer_profiles.division_id',
      'officer_profiles.department_id',
      'officer_profiles.ministry_id',
      'officer_profiles.province_id',
      'officer_profiles.per_status',
      'officer_profiles.per_status_name',
      'officer_profiles.relocation_type',
      'officer_profiles.relocation_name',
      'roles.code as role_code',
      'roles.name_th as role_name_th',
      'roles.name_en as role_name_en',
      'department_org.name_th as department_name_th',
      'division_org.name_th as division_name_th',
      'organize_org.name_th as organize_name_th',
    );
}

function toTableDTOs(rows: ManagedUserJoinedRow[]): ManagedUserTableDTO[] {
  const byUser = new Map<number, ManagedUserJoinedRow[]>();
  for (const row of rows) {
    const id = Number(row.id);
    byUser.set(id, [...(byUser.get(id) ?? []), row]);
  }
  return Array.from(byUser.values()).map(toTableDTO);
}

function toTableDTO(rows: ManagedUserJoinedRow[]): ManagedUserTableDTO {
  const first = rows[0]!;
  const roles = collectRoles(rows);
  const isActive = Boolean(first.is_active);
  return {
    id: Number(first.id),
    username: first.username ?? '',
    fullName: `${first.first_name} ${first.last_name}`.trim(),
    affiliation:
      first.department_name_th ?? first.division_name_th ?? first.organize_name_th ?? null,
    position: first.line_name_th ?? first.position_type_th ?? first.mposition ?? null,
    level: first.level_name_th,
    roles,
    primaryRole: roles[0] ?? null,
    status: isActive ? 'active' : 'suspended',
    statusLabel: isActive ? 'ใช้งาน' : 'ระงับใช้งาน',
  };
}

function toDetailDTO(rows: ManagedUserJoinedRow[]): ManagedUserDetailDTO {
  const first = rows[0]!;
  return {
    ...toTableDTO(rows),
    userType: first.user_type,
    externalId: first.external_id,
    identityProvider: first.identity_provider,
    prenameTh: first.prename_th,
    firstName: first.first_name,
    lastName: first.last_name,
    email: first.email,
    phone: first.phone,
    isActive: Boolean(first.is_active),
    profile: {
      posNo: first.pos_no,
      pertypeId: first.pertype_id,
      pertype: first.pertype,
      positionTypeId: first.position_type_id,
      positionTypeTh: first.position_type_th,
      lineId: first.line_id,
      lineNameTh: first.line_name_th,
      levelId: first.level_id,
      levelNameTh: first.level_name_th,
      mpositionId: first.mposition_id,
      mposition: first.mposition,
      organizeId: first.organize_id,
      divisionId: first.division_id,
      departmentId: first.department_id,
      ministryId: first.ministry_id,
      provinceId: first.province_id,
      perStatus: first.per_status,
      perStatusName: first.per_status_name,
      relocationType: first.relocation_type,
      relocationName: first.relocation_name,
    },
  };
}

function collectRoles(rows: ManagedUserJoinedRow[]): RoleSummaryDTO[] {
  const roles = new Map<string, RoleSummaryDTO>();
  for (const row of rows) {
    if (!row.role_code || !row.role_name_th || !row.role_name_en) continue;
    roles.set(row.role_code, {
      code: row.role_code,
      nameTh: row.role_name_th,
      nameEn: row.role_name_en,
    });
  }
  return Array.from(roles.values());
}

function toPermissionGrantDTO(row: PermissionGrantRow): PermissionGrantDTO {
  return {
    code: row.code,
    resource: row.resource,
    action: row.action,
    description: row.description,
    scope: row.scope,
  };
}

async function upsertOfficerProfile(
  trx: Knex.Transaction,
  userId: number,
  profile: OfficerProfileInput,
): Promise<void> {
  const profilePatch = toOfficerProfileRow(profile);
  const existing = await trx('officer_profiles').where({ user_id: userId }).first('user_id');
  if (existing) {
    await trx('officer_profiles')
      .where({ user_id: userId })
      .update({
        ...profilePatch,
        synced_at: trx.raw('SYSDATETIME()'),
      });
    return;
  }

  await trx('officer_profiles').insert({
    user_id: userId,
    ...profilePatch,
    synced_at: trx.raw('SYSDATETIME()'),
  });
}

async function replaceUserRoles(
  trx: Knex.Transaction,
  userId: number,
  roleRows: RoleRow[],
  actorUserId: number,
): Promise<void> {
  await trx('user_roles').where({ user_id: userId }).del();
  if (roleRows.length === 0) return;
  await trx('user_roles').insert(
    roleRows.map((role) => ({
      user_id: userId,
      role_id: role.id,
      assigned_by: actorUserId,
    })),
  );
}

function toOfficerProfileRow(profile: OfficerProfileInput): Record<string, string | null> {
  return {
    pos_no: profile.posNo ?? null,
    pertype_id: profile.pertypeId ?? null,
    pertype: profile.pertype ?? null,
    position_type_id: profile.positionTypeId ?? null,
    position_type_th: profile.positionTypeTh ?? null,
    line_id: profile.lineId ?? null,
    line_name_th: profile.lineNameTh ?? null,
    level_id: profile.levelId ?? null,
    level_name_th: profile.levelNameTh ?? null,
    mposition_id: profile.mpositionId ?? null,
    mposition: profile.mposition ?? null,
    organize_id: profile.organizeId ?? null,
    division_id: profile.divisionId ?? null,
    department_id: profile.departmentId ?? null,
    ministry_id: profile.ministryId ?? null,
    province_id: profile.provinceId ?? null,
    per_status: profile.perStatus ?? null,
    per_status_name: profile.perStatusName ?? null,
    relocation_type: profile.relocationType ?? null,
    relocation_name: profile.relocationName ?? null,
  };
}
