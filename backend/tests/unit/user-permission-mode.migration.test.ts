import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { mergePermissionScopesWithOverrides } from '../../src/modules/auth/permissions';
import {
  buildLegacyPermissionSnapshot,
  config,
  up,
  down,
  type LegacyPermissionGrant,
  type LegacyPermissionOverride,
  type PermissionSnapshotRow,
} from '../../src/db/migrations/0136_add_user_permission_mode';

const grant = (
  userId: number,
  permissionId: number,
  code: string,
  scope: LegacyPermissionGrant['scope'],
  role = 'officer',
): LegacyPermissionGrant => ({
  user_id: userId,
  permission_id: permissionId,
  code,
  scope,
  role_code: role,
});
const override = (
  permissionId: number,
  code: string,
  effect: 'allow' | 'deny',
  scope: LegacyPermissionOverride['scope'],
): LegacyPermissionOverride => ({
  user_id: 1,
  permission_id: permissionId,
  code,
  effect,
  scope,
  region_name: null,
  province_id: null,
  estate_code: null,
  granted_by: 99,
});

describe('legacy custom permission snapshot', () => {
  it('prioritizes every saved permission over inherited role defaults', () => {
    const result = buildLegacyPermissionSnapshot(
      [
        grant(1, 1, 'dashboard:view', 'ALL'),
        grant(1, 2, 'factories:view', 'OWN_FACTORY'),
        grant(1, 3, 'chat:answer', null),
        grant(1, 4, 'kwp_forms:view', 'IN_PROVINCE'),
        grant(2, 1, 'dashboard:view', 'ALL'),
      ],
      [
        { ...override(1, 'dashboard:view', 'allow', 'IN_PROVINCE'), province_id: '21' },
        override(2, 'factories:view', 'allow', 'ALL'),
        override(3, 'chat:answer', 'deny', null),
        override(9, 'permissions:manage', 'allow', null),
      ],
      [{ user_id: 1, province_id: '24' }],
    );

    expect(result.userIds).toEqual([1]);
    expect(result.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 1,
          permission_id: 1,
          effect: 'allow',
          scope: 'IN_PROVINCE',
          province_id: '21',
          granted_by: 99,
        }),
        expect.objectContaining({
          user_id: 1,
          permission_id: 2,
          effect: 'allow',
          scope: 'ALL',
          granted_by: 99,
        }),
        expect.objectContaining({ user_id: 1, permission_id: 3, effect: 'deny', scope: null }),
        expect.objectContaining({
          user_id: 1,
          permission_id: 9,
          effect: 'allow',
          scope: null,
          granted_by: 99,
        }),
        expect.objectContaining({
          user_id: 1,
          permission_id: 4,
          effect: 'allow',
          scope: 'IN_PROVINCE',
          province_id: '24',
        }),
      ]),
    );
    expect(result.permissions).toHaveLength(5);
  });

  it('keeps a saved ALL scope instead of the former ownership/region intersection', () => {
    const saved = {
      ...override(2, 'factories:view', 'allow', 'ALL'),
      granted_at: '2026-10-01T00:00:00.000Z',
    };
    const result = buildLegacyPermissionSnapshot(
      [grant(1, 2, 'factories:view', 'OWN_FACTORY')],
      [saved],
      [{ user_id: 1, regional_access_json: '{"regions":["ภาคกลาง","ภาคตะวันออก"]}' }],
    );
    const { code: _code, ...expected } = saved;
    expect(result).toEqual({ userIds: [1], permissions: [expected] });
  });

  it('keeps an outside-role saved action without relying on any role grant', () => {
    const saved = override(9, 'permissions:manage', 'allow', null);
    const { code: _code, ...expected } = saved;
    expect(buildLegacyPermissionSnapshot([], [saved], [])).toEqual({
      userIds: [1],
      permissions: [expected],
    });
  });

  it.each(['OWN_FACTORY', null] as const)(
    'honors an explicit saved %s scope without the former profile/ownership ceiling',
    (scope) => {
      const saved = {
        ...override(2, 'factories:view', 'allow', scope),
        granted_at: '2026-10-01T00:00:00.000Z',
      };
      const { code: _code, ...expected } = saved;
      expect(
        buildLegacyPermissionSnapshot(
          [grant(1, 2, 'factories:view', 'OWN_FACTORY')],
          [saved],
          [{ user_id: 1, regional_access_json: '{"regions":["ภาคกลาง","ภาคตะวันออก"]}' }],
        ),
      ).toEqual({ userIds: [1], permissions: [expected] });
    },
  );

  it('still refuses a saved IN_REGION scope with no qualifier and multiple possible regions', () => {
    expect(() =>
      buildLegacyPermissionSnapshot(
        [grant(1, 2, 'factories:view', 'OWN_FACTORY')],
        [override(2, 'factories:view', 'allow', 'IN_REGION')],
        [{ user_id: 1, regional_access_json: '{"regions":["ภาคกลาง","ภาคตะวันออก"]}' }],
      ),
    ).toThrow('multiple unresolved regions: 1');
  });

  it('persists saved null view without resurrecting the role ALL scope', () => {
    const saved = {
      ...override(1, 'kwp_forms:view', 'allow', null),
      granted_at: '2026-10-01T00:00:00.000Z',
    };
    const { code: _code, ...expected } = saved;
    const result = buildLegacyPermissionSnapshot(
      [grant(1, 1, 'kwp_forms:view', 'ALL')],
      [saved],
      [],
    );
    expect(result.permissions).toEqual([expected]);
    expect(
      mergePermissionScopesWithOverrides(
        [{ code: 'kwp_forms:view', scope: 'ALL' }],
        result.permissions.map((row) => ({
          code: 'kwp_forms:view',
          effect: row.effect,
          scope: row.scope,
          region: row.region_name,
          province: row.province_id,
          estateCode: row.estate_code,
        })),
        'custom',
      ),
    ).toEqual({});
  });

  it('persists nullable edit unchanged while runtime inherits only its saved narrower view', () => {
    const view = { ...override(1, 'kwp_forms:view', 'allow', 'IN_PROVINCE'), province_id: '21' };
    const edit = {
      ...override(2, 'kwp_forms:edit', 'allow', null),
      province_id: '24',
      granted_at: '2026-10-01T00:00:00.000Z',
    };
    const result = buildLegacyPermissionSnapshot(
      [grant(1, 1, 'kwp_forms:view', 'ALL'), grant(1, 2, 'kwp_forms:edit', 'ALL')],
      [view, edit],
      [],
    );
    const { code: _viewCode, ...savedView } = view;
    const { code: _editCode, ...savedEdit } = edit;
    expect(result.permissions).toEqual([savedView, savedEdit]);
    const effective = mergePermissionScopesWithOverrides(
      [],
      result.permissions.map((row) => ({
        code: row.permission_id === 1 ? 'kwp_forms:view' : 'kwp_forms:edit',
        effect: row.effect,
        scope: row.scope,
        region: row.region_name,
        province: row.province_id,
        estateCode: row.estate_code,
      })),
      'custom',
    );
    expect(effective['kwp_forms:edit']).toEqual(effective['kwp_forms:view']);
    expect(effective['kwp_forms:edit']).toEqual(
      expect.objectContaining({ scope: 'IN_PROVINCE', province: '21' }),
    );
  });

  it('preserves saved denial and audit/location details even if an allow follows it', () => {
    const saved = {
      ...override(1, 'dashboard:view', 'deny', 'IN_PROVINCE'),
      province_id: '21',
      granted_at: '2026-10-01T00:00:00.000Z',
    };
    const { code: _code, ...expected } = saved;
    expect(
      buildLegacyPermissionSnapshot(
        [grant(1, 1, 'dashboard:view', 'ALL')],
        [saved, override(1, 'dashboard:view', 'allow', 'ALL')],
        [],
      ),
    ).toEqual({ userIds: [1], permissions: [expected] });
  });

  it('freezes inherited role locations and keeps explicit locations unchanged', () => {
    const result = buildLegacyPermissionSnapshot(
      [
        grant(1, 1, 'dashboard:view', 'IN_REGION', 'monitoring_kpm'),
        grant(1, 2, 'kwp_forms:view', 'IN_ESTATE', 'monitoring_kpm'),
        grant(1, 3, 'factories:view', 'ALL', 'monitoring_kpm'),
      ],
      [{ ...override(3, 'factories:view', 'allow', 'IN_REGION'), region_name: 'ภาคตะวันออก' }],
      [{ user_id: 1, estate_code: 'IE01', regional_access_json: '{"regions":["ภาคตะวันออก"]}' }],
    );
    expect(result.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ permission_id: 1, region_name: 'ภาคกลาง' }),
        expect.objectContaining({ permission_id: 2, estate_code: 'IE01' }),
        expect.objectContaining({ permission_id: 3, region_name: 'ภาคตะวันออก' }),
      ]),
    );
  });

  it('supports a fully denied user without restoring any role grant', () => {
    const result = buildLegacyPermissionSnapshot(
      [grant(1, 1, 'dashboard:view', 'ALL')],
      [override(1, 'dashboard:view', 'deny', null)],
      [],
    );
    expect(result.userIds).toEqual([1]);
    expect(result.permissions).toEqual([
      expect.objectContaining({ effect: 'deny', permission_id: 1 }),
    ]);
  });

  it('does not snapshot users without overrides and runs in a migration transaction', () => {
    expect(buildLegacyPermissionSnapshot([grant(2, 1, 'dashboard:view', 'ALL')], [], [])).toEqual({
      userIds: [],
      permissions: [],
    });
    expect(config.transaction).toBe(true);
  });

  it('refuses unresolved multiple regions and ownership intersections with IDs only', () => {
    const profiles = [
      { user_id: 1, regional_access_json: '{"regions":["ภาคกลาง","ภาคตะวันออก"]}' },
    ];
    const overrides = [override(9, 'permissions:manage', 'deny', null)];
    expect(() =>
      buildLegacyPermissionSnapshot(
        [grant(1, 1, 'dashboard:view', 'IN_REGION')],
        overrides,
        profiles,
      ),
    ).toThrow('multiple unresolved regions: 1');
    expect(() =>
      buildLegacyPermissionSnapshot(
        [grant(1, 1, 'factories:view', 'OWN_FACTORY')],
        overrides,
        profiles,
      ),
    ).toThrow('ownership and region intersection: 1');
    expect(() =>
      buildLegacyPermissionSnapshot(
        [
          grant(1, 1, 'permissions:manage', null),
          grant(1, 2, 'chat:answer', null),
          grant(1, 3, 'dashboard:view', 'ALL'),
        ],
        overrides,
        profiles,
      ),
    ).not.toThrow();
  });

  it('preflights every candidate before deleting data and guards downgrade of custom sets', async () => {
    const writes: string[] = [];
    const data: Record<string, unknown[]> = {
      user_permissions: [override(9, 'permissions:manage', 'deny', null)],
      user_roles: [grant(1, 1, 'dashboard:view', 'IN_REGION')],
      officer_profiles: [
        { user_id: 1, regional_access_json: '{"regions":["ภาคกลาง","ภาคตะวันออก"]}' },
      ],
      users: [{ id: 1, permission_mode: 'custom' }],
    };
    const knex = Object.assign(
      (table: string) => {
        let first = false;
        const query = {
          join() {
            return query;
          },
          leftJoin() {
            return query;
          },
          where() {
            return query;
          },
          whereIn() {
            return query;
          },
          orderBy() {
            return query;
          },
          select() {
            return query;
          },
          first() {
            first = true;
            return query;
          },
          async del() {
            writes.push('delete');
          },
          async insert() {
            writes.push('insert');
          },
          async update() {
            writes.push('update');
          },
          then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
            return Promise.resolve(first ? data[table][0] : data[table]).then(resolve, reject);
          },
        };
        return query;
      },
      {
        schema: { hasColumn: jest.fn<() => Promise<boolean>>().mockResolvedValue(true) },
        raw: jest.fn(),
      },
    ) as unknown as Knex;
    await expect(up(knex)).rejects.toThrow('multiple unresolved regions: 1');
    expect(writes).toEqual([]);
    await expect(down(knex)).rejects.toThrow('custom permission sets exist');
    expect(knex.raw).toHaveBeenCalledTimes(1); // profile SELECT expression only; no downgrade DDL.
  });

  it('leaves citizen/operator overrides and persona-dependent role defaults unchanged', async () => {
    const originalOverrides = [
      { ...override(1, 'dashboard:view', 'deny', null), user_type: 'operator' },
      { ...override(2, 'chat:ask', 'deny', null), user_id: 2, user_type: 'citizen' },
    ];
    const writes: string[] = [];
    const knex = Object.assign(
      (table: string) => {
        let rows = table === 'user_permissions' ? [...originalOverrides] : [];
        const query = {
          join() {
            return query;
          },
          where() {
            return query;
          },
          select() {
            return query;
          },
          whereIn(column: string, values: string[]) {
            if (column === 'users.user_type')
              rows = rows.filter((row) => values.includes(row.user_type));
            return query;
          },
          async del() {
            writes.push('delete');
          },
          async insert() {
            writes.push('insert');
          },
          async update() {
            writes.push('update');
          },
          then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
            return Promise.resolve(rows).then(resolve, reject);
          },
        };
        return query;
      },
      {
        schema: { hasColumn: jest.fn<() => Promise<boolean>>().mockResolvedValue(true) },
        raw: jest.fn(),
      },
    ) as unknown as Knex;
    await up(knex);
    expect(writes).toEqual([]);
    expect(originalOverrides).toHaveLength(2);
  });

  it('writes the complete managed-user snapshot and leaves noncandidates in role_default', async () => {
    const modes = new Map([
      [1, 'role_default'],
      [2, 'role_default'],
      [3, 'role_default'],
    ]);
    const userTypes = new Map([
      [1, 'officer'],
      [2, 'operator'],
      [3, 'officer'],
    ]);
    const operatorOverride = { ...override(1, 'dashboard:view', 'deny', null), user_id: 2 };
    const savedFactoryPermission = {
      ...override(3, 'factories:view', 'allow', 'ALL'),
      granted_at: '2026-10-01T00:00:00.000Z',
    };
    const savedOutsideRolePermission = override(9, 'permissions:manage', 'allow', null);
    const initial = [
      override(1, 'dashboard:view', 'deny', null),
      savedFactoryPermission,
      savedOutsideRolePermission,
      operatorOverride,
    ];
    let persisted: Array<LegacyPermissionOverride | PermissionSnapshotRow> = [...initial];
    const roleGrants = [
      grant(1, 1, 'dashboard:view', 'ALL'),
      grant(1, 2, 'chat:answer', null),
      grant(1, 3, 'factories:view', 'OWN_FACTORY'),
      grant(2, 1, 'dashboard:view', 'OWN_FACTORY'),
      grant(3, 1, 'dashboard:view', 'ALL'),
    ];
    const schemaSql: string[] = [];
    const knex = Object.assign(
      (table: string) => {
        let ids: number[] | undefined;
        let types: string[] | undefined;
        const query = {
          join() {
            return query;
          },
          leftJoin() {
            return query;
          },
          where() {
            return query;
          },
          orderBy() {
            return query;
          },
          select() {
            return query;
          },
          whereIn(column: string, values: number[] | string[]) {
            if (column === 'users.user_type') types = values as string[];
            else ids = values as number[];
            return query;
          },
          async del() {
            persisted = persisted.filter((row) => !ids?.includes(row.user_id));
          },
          async insert(rows: PermissionSnapshotRow[]) {
            persisted.push(...rows);
          },
          async update(patch: { permission_mode: string }) {
            for (const id of ids ?? []) modes.set(id, patch.permission_mode);
          },
          then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
            let rows: unknown[] = [];
            if (table === 'user_permissions')
              rows = initial.filter(
                (row) => !types || types.includes(userTypes.get(row.user_id) ?? ''),
              );
            if (table === 'user_roles')
              rows = roleGrants.filter((row) => ids?.includes(row.user_id));
            return Promise.resolve(rows).then(resolve, reject);
          },
        };
        return query;
      },
      {
        schema: { hasColumn: jest.fn<() => Promise<boolean>>().mockResolvedValue(false) },
        raw(sql: string) {
          if (sql.includes('ALTER TABLE users')) schemaSql.push(sql);
          return sql;
        },
      },
    ) as unknown as Knex;
    await up(knex);
    expect(schemaSql).toHaveLength(2);
    expect(schemaSql[0]).toContain("DEFAULT 'role_default'");
    expect(schemaSql[1]).toContain("CHECK (permission_mode IN ('role_default', 'custom'))");
    expect(modes).toEqual(
      new Map([
        [1, 'custom'],
        [2, 'role_default'],
        [3, 'role_default'],
      ]),
    );
    expect(persisted).toContainEqual(operatorOverride);
    expect(persisted.filter((row) => row.user_id === 1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ permission_id: 1, effect: 'deny', scope: null }),
        expect.objectContaining({ permission_id: 2, effect: 'allow', scope: null }),
        expect.objectContaining({
          permission_id: 3,
          effect: 'allow',
          scope: 'ALL',
          granted_by: 99,
          granted_at: savedFactoryPermission.granted_at,
        }),
        expect.objectContaining({
          permission_id: 9,
          effect: 'allow',
          scope: null,
          granted_by: 99,
        }),
      ]),
    );
    expect(persisted).toHaveLength(5);
  });
});
