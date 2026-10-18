import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  buildChatPermissionScopeBackfill,
  buildChatPermissionBackupSql,
  CHAT_SCOPE_BACKUP_TABLES,
  config,
  up,
  down,
  type ChatScopeRoleGrant,
  type ChatScopeOverride,
  type ChatScopeMembership,
} from '../../src/db/migrations/0142_scope_chat_permissions';

const role = (
  code: string,
  scope: string | null,
  permissionId = 1,
  roleId = 10,
): ChatScopeRoleGrant => ({
  role_id: roleId,
  permission_id: permissionId,
  code,
  scope,
});
const membership = (userId = 1, roleId = 10, roleCode = 'officer'): ChatScopeMembership => ({
  user_id: userId,
  role_id: roleId,
  role_code: roleCode,
});
const saved = (
  code: string,
  scope: string | null,
  permissionId = 1,
  effect: 'allow' | 'deny' = 'allow',
): ChatScopeOverride => ({
  user_id: 1,
  permission_id: permissionId,
  code,
  effect,
  scope,
  region_name: null,
  province_id: null,
  estate_code: null,
});
const user = { id: 1, permission_mode: 'role_default' as const };
const customUser = { id: 1, permission_mode: 'custom' as const };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Chat permission scope backfill', () => {
  it('backfills only existing binary role actions from that role eligible audience', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('chat:answer', null, 2),
        role('eligible_factories:view', 'IN_PROVINCE', 9),
      ],
      [],
      [],
      [],
      [],
    );
    expect(result.roleUpdates).toEqual([
      { role_id: 10, permission_id: 1, scope: 'IN_PROVINCE' },
      { role_id: 10, permission_id: 2, scope: 'IN_PROVINCE' },
    ]);
    expect(result.userUpdates).toEqual([]);
    expect(result.userInserts).toEqual([]);
  });

  it.each([null, 'INVALID', undefined])(
    'never falls back to ALL for a role missing a valid eligible scope (%s)',
    (scope) => {
      const grants = [role('chat:view', null)];
      if (scope !== undefined) grants.push(role('eligible_factories:view', scope, 9));
      expect(buildChatPermissionScopeBackfill(grants, [], [], [], []).roleUpdates).toEqual([]);
    },
  );

  it('freezes an inherited narrowed eligible override before changing role defaults', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('chat:ask', null, 2),
        role('eligible_factories:view', 'ALL', 9),
      ],
      [membership()],
      [user],
      [{ ...saved('eligible_factories:view', 'IN_PROVINCE', 9), province_id: '21' }],
      [{ user_id: 1, province_id: '24' }],
    );
    expect(result.userInserts).toEqual([
      {
        user_id: 1,
        permission_id: 1,
        effect: 'allow',
        scope: 'IN_PROVINCE',
        region_name: null,
        province_id: '21',
        estate_code: null,
      },
      {
        user_id: 1,
        permission_id: 2,
        effect: 'allow',
        scope: 'IN_PROVINCE',
        region_name: null,
        province_id: '21',
        estate_code: null,
      },
    ]);
  });

  it('merges old role eligible scopes before applying the user override', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('eligible_factories:view', 'ALL', 9),
        role('eligible_factories:view', 'IN_REGION', 9, 11),
      ],
      [membership(), membership(1, 11)],
      [user],
      [{ ...saved('eligible_factories:view', 'IN_PROVINCE', 9), province_id: '21' }],
      [],
    );
    expect(result.userInserts[0]).toMatchObject({
      scope: 'IN_PROVINCE',
      province_id: '21',
      effect: 'allow',
    });
  });

  it('uses profile location only for role defaults and retains KPM legacy central assignment', () => {
    const result = buildChatPermissionScopeBackfill(
      [role('chat:view', null), role('eligible_factories:view', 'IN_REGION', 9)],
      [membership(1, 10, 'monitoring_kpm')],
      [user],
      [],
      [{ user_id: 1, regional_access_json: '{"regions":["ภาคตะวันออก"]}' }],
    );
    expect(result.userInserts[0]).toMatchObject({ scope: 'IN_REGION', region_name: 'ภาคกลาง' });
  });

  it.each([
    { scope: 'IN_PROVINCE', profile: { province_id: '21' }, expected: { province_id: '21' } },
    { scope: 'IN_ESTATE', profile: { estate_code: 'IE01' }, expected: { estate_code: 'IE01' } },
    {
      scope: 'IN_REGION',
      profile: { department_name_th: 'ศวภ.ตอ.' },
      expected: { region_name: 'ภาคตะวันออก' },
    },
  ])(
    'carries the legacy $scope profile qualifier into a user snapshot',
    ({ scope, profile, expected }) => {
      const result = buildChatPermissionScopeBackfill(
        [role('chat:view', null), role('eligible_factories:view', scope, 9)],
        [membership()],
        [user],
        [],
        [{ user_id: 1, ...profile }],
      );
      expect(result.userInserts[0]).toMatchObject({ scope, effect: 'allow', ...expected });
    },
  );

  it('preserves an operator OWN_FACTORY audience without requiring an officer profile', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('chat:ask', null, 2),
        role('eligible_factories:view', 'OWN_FACTORY', 9),
      ],
      [membership(1, 10, 'operator')],
      [user],
      [],
      [],
    );
    expect(result.userInserts).toHaveLength(2);
    expect(
      result.userInserts.every((row) => row.scope === 'OWN_FACTORY' && row.effect === 'allow'),
    ).toBe(true);
  });

  it.each([null, 'INVALID', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE'])(
    'fails closed for a role user with unresolved eligible audience %s',
    (scope) => {
      const result = buildChatPermissionScopeBackfill(
        [role('chat:view', null), role('eligible_factories:view', scope, 9)],
        [membership()],
        [user],
        [],
        [],
      );
      expect(result.userInserts[0]).toMatchObject({ effect: 'deny', scope: null });
    },
  );

  it('does not expand multiple assigned regions into ALL', () => {
    const result = buildChatPermissionScopeBackfill(
      [role('chat:view', null), role('eligible_factories:view', 'IN_REGION', 9)],
      [membership()],
      [user],
      [],
      [{ user_id: 1, regional_access_json: '{"regions":["ภาคกลาง","ภาคตะวันออก"]}' }],
    );
    expect(result.userInserts[0]).toMatchObject({
      effect: 'allow',
      scope: 'IN_REGION',
      region_name: null,
    });
  });

  it('keeps explicit Chat denial and freezes denied eligible audience as denial for other actions', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('chat:ask', null, 2),
        role('eligible_factories:view', 'ALL', 9),
      ],
      [membership()],
      [user],
      [saved('chat:view', null, 1, 'deny'), saved('eligible_factories:view', 'ALL', 9, 'deny')],
      [],
    );
    expect(result.userUpdates).toEqual([]);
    expect(result.userInserts).toEqual([
      expect.objectContaining({ permission_id: 2, effect: 'deny', scope: null }),
    ]);
  });

  it.each([
    { eligibleRows: [] },
    { eligibleRows: [saved('eligible_factories:view', 'ALL', 9, 'deny')] },
    { eligibleRows: [saved('eligible_factories:view', null, 9)] },
    { eligibleRows: [saved('eligible_factories:view', 'INVALID', 9)] },
  ])(
    'keeps custom null Chat closed without borrowing a missing/denied/invalid eligible scope',
    ({ eligibleRows }) => {
      const result = buildChatPermissionScopeBackfill(
        [role('chat:view', null), role('eligible_factories:view', 'ALL', 9)],
        [membership()],
        [customUser],
        [saved('chat:view', null), ...eligibleRows],
        [{ user_id: 1, province_id: '21', regional_access_json: '{"regions":["ภาคกลาง"]}' }],
      );
      expect(result.userUpdates).toEqual([]);
      expect(result.userInserts).toEqual([]);
    },
  );

  it('backfills custom snapshots only from explicit eligible data and never adds an omitted action', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('chat:ask', null, 2),
        role('eligible_factories:view', 'ALL', 9),
      ],
      [membership()],
      [customUser],
      [
        saved('chat:view', null),
        { ...saved('eligible_factories:view', 'IN_PROVINCE', 9), province_id: '21' },
      ],
      [{ user_id: 1, province_id: '24' }],
    );
    expect(result.userUpdates).toEqual([
      expect.objectContaining({
        permission_id: 1,
        effect: 'allow',
        scope: 'IN_PROVINCE',
        province_id: '21',
      }),
    ]);
    expect(result.userInserts).toEqual([]);
  });

  it('keeps missing custom location unresolved instead of filling it from the officer profile', () => {
    const result = buildChatPermissionScopeBackfill(
      [],
      [],
      [customUser],
      [saved('chat:view', null), saved('eligible_factories:view', 'IN_PROVINCE', 9)],
      [{ user_id: 1, province_id: '21' }],
    );
    expect(result.userUpdates).toEqual([]);
  });

  it('preserves existing scoped custom Chat and effective scoped role overrides', () => {
    const scoped = { ...saved('chat:view', 'IN_PROVINCE'), province_id: '21' };
    expect(
      buildChatPermissionScopeBackfill([], [], [customUser], [scoped], []).userUpdates,
    ).toEqual([]);
    expect(
      buildChatPermissionScopeBackfill(
        [role('chat:view', 'ALL'), role('eligible_factories:view', 'ALL', 9)],
        [membership()],
        [user],
        [scoped],
        [],
      ).userUpdates,
    ).toEqual([]);
  });

  it('does not activate a previously ignored scoped role_default override after role backfill', () => {
    const result = buildChatPermissionScopeBackfill(
      [role('chat:view', null), role('eligible_factories:view', 'ALL', 9)],
      [membership()],
      [user],
      [{ ...saved('chat:view', 'IN_PROVINCE'), province_id: '21' }],
      [],
    );
    expect(result.userUpdates[0]).toMatchObject({ effect: 'deny', scope: null, province_id: null });
  });

  it('denies a null role override when eligible is absent instead of letting the new role scope win', () => {
    const result = buildChatPermissionScopeBackfill(
      [role('chat:view', null), role('eligible_factories:view', 'ALL', 9)],
      [membership()],
      [user],
      [saved('chat:view', null), saved('eligible_factories:view', 'ALL', 9, 'deny')],
      [],
    );
    expect(result.userUpdates[0]).toMatchObject({ effect: 'deny', scope: null });
    expect(result.userInserts).toEqual([]);
  });

  it('does not acquire outside-role actions or grant incompatible cross-role audiences', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('eligible_factories:view', 'OWN_FACTORY', 9),
        role('eligible_factories:view', 'ALL', 9, 11),
      ],
      [membership(), membership(1, 11)],
      [user],
      [
        saved('chat:answer', null, 3),
        { ...saved('eligible_factories:view', 'IN_PROVINCE', 9), province_id: '21' },
      ],
      [],
    );
    expect(result.userUpdates).toEqual([]);
    expect(result.userInserts).toEqual([
      expect.objectContaining({ permission_id: 1, effect: 'deny' }),
    ]);
  });

  it('does not expose a different inherited audience underneath a still-ignored scoped override', () => {
    const result = buildChatPermissionScopeBackfill(
      [
        role('chat:view', null),
        role('eligible_factories:view', 'OWN_FACTORY', 9),
        role('eligible_factories:view', 'ALL', 9, 11),
      ],
      [membership(), membership(1, 11)],
      [user],
      [
        saved('chat:view', 'ALL'),
        { ...saved('eligible_factories:view', 'IN_PROVINCE', 9), province_id: '21' },
      ],
      [],
    );
    expect(result.userUpdates[0]).toMatchObject({ effect: 'deny', scope: null });
  });

  it('fails closed on order-dependent OWN_FACTORY/FACTORY_TYPE_88 role ties', () => {
    for (const scopes of [
      ['OWN_FACTORY', 'FACTORY_TYPE_88'],
      ['FACTORY_TYPE_88', 'OWN_FACTORY'],
    ] as const) {
      const result = buildChatPermissionScopeBackfill(
        [
          role('chat:view', null),
          role('eligible_factories:view', scopes[0], 9),
          role('eligible_factories:view', scopes[1], 9, 11),
        ],
        [membership(), membership(1, 11)],
        [user],
        [],
        [],
      );
      expect(result.userInserts[0]).toMatchObject({ effect: 'deny', scope: null });
    }
  });

  it.each([
    { rawProvinceId: '21', expectedEffect: 'deny', expectedScope: null, expectedProvinceId: null },
    {
      rawProvinceId: '2100',
      expectedEffect: 'allow',
      expectedScope: 'IN_PROVINCE',
      expectedProvinceId: '2100',
    },
  ])(
    'resolves profile province $rawProvinceId against the existing master before planning writes',
    async ({ rawProvinceId, expectedEffect, expectedScope, expectedProvinceId }) => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const provinceIds = new Set(['2100']);
      const profileJoins: unknown[][] = [];
      let profileSelection: unknown[] = [];
      const inserts: Array<Record<string, unknown>> = [];
      const rows: Record<string, unknown[]> = {
        role_permissions: [
          role('chat:view', null),
          role('eligible_factories:view', 'IN_PROVINCE', 9),
        ],
        user_roles: [membership()],
        users: [user],
        user_permissions: [],
      };
      const fakeKnex = Object.assign(
        (table: string) => {
          const query = {
            join: (..._args: unknown[]) => query,
            leftJoin: (...args: unknown[]) => {
              if (table === 'officer_profiles') profileJoins.push(args);
              return query;
            },
            whereIn: (..._args: unknown[]) => query,
            where: (..._args: unknown[]) => query,
            whereNull: (..._args: unknown[]) => query,
            select: async (...columns: unknown[]) => {
              if (table !== 'officer_profiles') return rows[table] ?? [];
              profileSelection = columns;
              const usesJoinedProvince =
                profileJoins.some(
                  ([tableName, masterId, profileId]) =>
                    tableName === 'provinces as profile_province' &&
                    masterId === 'profile_province.id' &&
                    profileId === 'officer_profiles.province_id',
                ) && columns.includes('profile_province.id as province_id');
              // Model a LEFT JOIN, including an orphan profile value that must
              // remain unresolved rather than being translated to another ID.
              return [
                {
                  user_id: 1,
                  province_id: usesJoinedProvince
                    ? provinceIds.has(rawProvinceId)
                      ? rawProvinceId
                      : null
                    : rawProvinceId,
                },
              ];
            },
            update: async (..._args: unknown[]) => undefined,
            insert: async (values: Array<Record<string, unknown>>) => inserts.push(...values),
          };
          return query;
        },
        {
          raw: (sql: string) =>
            sql === buildChatPermissionBackupSql()
              ? Promise.resolve([{ role_permissions_count: 2, user_permissions_count: 0 }])
              : sql,
        },
      );
      try {
        await up(fakeKnex as unknown as Knex);

        expect(profileSelection).toContain('profile_province.id as province_id');
        expect(profileSelection).not.toContain('officer_profiles.province_id');
        expect(profileJoins).toContainEqual([
          'provinces as profile_province',
          'profile_province.id',
          'officer_profiles.province_id',
        ]);
        expect(inserts).toEqual([
          expect.objectContaining({
            user_id: 1,
            permission_id: 1,
            effect: expectedEffect,
            scope: expectedScope,
            province_id: expectedProvinceId,
          }),
        ]);
        expect(
          inserts.every(
            (row) => row.province_id === null || provinceIds.has(String(row.province_id)),
          ),
        ).toBe(true);
      } finally {
        log.mockRestore();
      }
    },
  );

  it('reads every legacy snapshot before applying user writes and then role updates', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const events: Array<{ table: string; operation: string; values?: unknown }> = [];
    const rows: Record<string, unknown[]> = {
      role_permissions: [role('chat:view', null), role('eligible_factories:view', 'ALL', 9)],
      user_roles: [membership(1), membership(2)],
      users: [user, { ...user, id: 2 }],
      user_permissions: [saved('chat:view', null)],
      officer_profiles: [],
    };
    const fakeKnex = Object.assign(
      (table: string) => {
        const query = {
          join: (..._args: unknown[]) => query,
          leftJoin: (..._args: unknown[]) => query,
          whereIn: (..._args: unknown[]) => query,
          where: (..._args: unknown[]) => query,
          whereNull: (..._args: unknown[]) => query,
          select: async (..._args: unknown[]) => {
            events.push({ table, operation: 'select' });
            return rows[table] ?? [];
          },
          update: async (values: unknown) => {
            events.push({ table, operation: 'update', values });
          },
          insert: async (values: unknown) => {
            events.push({ table, operation: 'insert', values });
          },
        };
        return query;
      },
      {
        raw: (sql: string) => {
          if (sql === buildChatPermissionBackupSql()) {
            events.push({ table: 'backups', operation: 'verified' });
            return Promise.resolve([{ role_permissions_count: 2, user_permissions_count: 1 }]);
          }
          return sql;
        },
      },
    );
    await up(fakeKnex as unknown as Knex);
    const firstWrite = events.findIndex((event) => ['update', 'insert'].includes(event.operation));
    expect(events[0]).toEqual({ table: 'backups', operation: 'verified' });
    expect(events.slice(firstWrite).some((event) => event.operation === 'select')).toBe(false);
    expect(events.slice(firstWrite).map(({ table, operation }) => ({ table, operation }))).toEqual([
      { table: 'user_permissions', operation: 'update' },
      { table: 'user_permissions', operation: 'insert' },
      { table: 'role_permissions', operation: 'update' },
    ]);
    expect(events[firstWrite]?.values).toMatchObject({ effect: 'allow', scope: 'ALL' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      '[migration 0142] verified backup rows: role_permissions=2, user_permissions=1',
    );
  });

  it('takes immutable full-table backups under source locks and verifies both before returning counts', () => {
    const sql = buildChatPermissionBackupSql();
    const roleCopy = `SELECT * INTO dbo.${CHAT_SCOPE_BACKUP_TABLES.role}`;
    const userCopy = `SELECT * INTO dbo.${CHAT_SCOPE_BACKUP_TABLES.user}`;
    const roleCheck = `(SELECT COUNT_BIG(*) FROM dbo.${CHAT_SCOPE_BACKUP_TABLES.role}) <> @role_permission_count`;
    const userCheck = `(SELECT COUNT_BIG(*) FROM dbo.${CHAT_SCOPE_BACKUP_TABLES.user}) <> @user_permission_count`;
    const result = 'SELECT @role_permission_count AS role_permissions_count';
    expect(sql).toContain('FROM dbo.role_permissions WITH (TABLOCKX, HOLDLOCK)');
    expect(sql).toContain('FROM dbo.user_permissions WITH (TABLOCKX, HOLDLOCK)');
    for (const table of Object.values(CHAT_SCOPE_BACKUP_TABLES)) {
      expect(
        sql.match(new RegExp(`OBJECT_ID\\(N'dbo\\.${table}', N'U'\\) IS NOT NULL`, 'g')),
      ).toHaveLength(2);
    }
    expect(sql.indexOf('THROW 51420')).toBeLessThan(sql.indexOf('WITH (TABLOCKX, HOLDLOCK)'));
    expect(sql.lastIndexOf('THROW 51420')).toBeLessThan(sql.indexOf(roleCopy));
    expect(sql.indexOf('DECLARE @role_permission_count')).toBeLessThan(sql.indexOf(roleCopy));
    expect(sql.indexOf('DECLARE @user_permission_count')).toBeLessThan(sql.indexOf(userCopy));
    expect(sql.indexOf(roleCopy)).toBeLessThan(sql.indexOf(userCopy));
    expect(sql.indexOf(userCopy)).toBeLessThan(sql.indexOf(roleCheck));
    expect(sql.indexOf(roleCheck)).toBeLessThan(sql.indexOf(result));
    expect(sql.indexOf(userCheck)).toBeLessThan(sql.indexOf(result));
    expect(sql).toContain(
      "THROW 51421, 'Chat scope backup row count mismatch; no permissions were changed'",
    );
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE|UPDATE|MERGE)\b/i);
    expect(sql).not.toMatch(/\b(?:PRINT|EXEC|EXECUTE)\b/i);
    expect(sql).not.toContain('?');
  });

  it.each(['role', 'user'] as const)(
    'refuses an existing %s backup without reading or writing permissions',
    async (table) => {
      const raw = jest
        .fn<(sql: string) => Promise<never>>()
        .mockRejectedValue(
          new Error(`Chat scope backup ${CHAT_SCOPE_BACKUP_TABLES[table]} already exists`),
        );
      const query = jest.fn();
      const knex = Object.assign(query, { raw }) as unknown as Knex;
      await expect(up(knex)).rejects.toThrow('already exists');
      expect(raw).toHaveBeenCalledWith(buildChatPermissionBackupSql());
      expect(query).not.toHaveBeenCalled();
    },
  );

  it.each(['role', 'user'] as const)(
    'aborts a %s backup count mismatch before any permission writes',
    async (table) => {
      const raw = jest
        .fn<(sql: string) => Promise<never>>()
        .mockRejectedValue(new Error(`Chat scope ${table} backup row count mismatch`));
      const query = jest.fn();
      const knex = Object.assign(query, { raw }) as unknown as Knex;
      await expect(up(knex)).rejects.toThrow('row count mismatch');
      expect(query).not.toHaveBeenCalled();
    },
  );

  it.each([
    [],
    [{ role_permissions_count: 1 }],
    [{ role_permissions_count: -1, user_permissions_count: 1 }],
    [{ role_permissions_count: 'secret-row-data', user_permissions_count: 1 }],
  ])('refuses unverifiable backup results before touching permissions', async (...rows) => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const raw = jest.fn<(sql: string) => Promise<unknown>>().mockResolvedValue(rows);
    const query = jest.fn();
    const knex = Object.assign(query, { raw }) as unknown as Knex;
    await expect(up(knex)).rejects.toThrow('valid row counts');
    expect(query).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('refuses a second run instead of replacing the original backup snapshot', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    let backedUp = false;
    const raw = jest.fn<(sql: string) => Promise<unknown>>().mockImplementation(async () => {
      if (backedUp) throw new Error('Chat scope backup tables already exist');
      backedUp = true;
      return [{ role_permissions_count: 0, user_permissions_count: 0 }];
    });
    const query = jest.fn(() => {
      const builder = {
        join: (..._args: unknown[]) => builder,
        whereIn: (..._args: unknown[]) => builder,
        select: async (..._args: unknown[]) => [],
      };
      return builder;
    });
    const knex = Object.assign(query, { raw }) as unknown as Knex;
    await up(knex);
    const readsAfterFirstRun = query.mock.calls.length;
    await expect(up(knex)).rejects.toThrow('already exist');
    expect(query).toHaveBeenCalledTimes(readsAfterFirstRun);
    expect(raw).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('is transactional and refuses a rollback that could erase newer permission choices', async () => {
    expect(config.transaction).toBe(true);
    await expect(down({} as Knex)).rejects.toThrow('cannot be reversed safely');
  });
});
