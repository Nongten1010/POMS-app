import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0074_create_officer_direct_connections';

describe('officer direct-connections migration', () => {
  it('runs all schema and RBAC writes in one migration transaction', () => {
    expect(config).toEqual({ transaction: true });
  });

  it('adds source provenance, prepopulates every two-digit year, and grants live roles', async () => {
    const requestSpecificType = jest.fn();
    const sequenceSpecificType = jest.fn();
    const sequencePrimary = jest.fn();
    const sequenceInsert = jest.fn().mockResolvedValue(undefined as never);
    const permissionUpdate = jest.fn().mockResolvedValue(undefined as never);
    const grantUpdate = jest.fn().mockResolvedValue(undefined as never);
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const rolesWhereIn = jest.fn().mockResolvedValue([
      { id: 11, code: 'monitoring_kpm' },
      { id: 12, code: 'admin' },
    ] as never);
    const permissionWhere = jest.fn((criteria: Record<string, unknown>) => ({
      first: jest.fn().mockResolvedValue(('code' in criteria ? { id: 21 } : undefined) as never),
      update: permissionUpdate,
    }));
    const rolePermissionWhere = jest.fn(() => ({
      first: jest.fn().mockResolvedValue({ role_id: 11 } as never),
      update: grantUpdate,
    }));

    const knex = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'cems_wpms_direct_request_sequences') {
          return { insert: sequenceInsert };
        }
        if (tableName === 'permissions') {
          return { where: permissionWhere };
        }
        if (tableName === 'roles') {
          return {
            select: jest.fn(() => ({ whereIn: rolesWhereIn })),
          };
        }
        if (tableName === 'role_permissions') {
          return { where: rolePermissionWhere };
        }
        throw new Error(`Unexpected table: ${tableName}`);
      }),
      {
        schema: {
          alterTable: jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
            callback({ specificType: requestSpecificType });
          }),
          createTable: jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
            callback({ specificType: sequenceSpecificType, primary: sequencePrimary });
          }),
          raw,
        },
      },
    ) as unknown as Knex;

    await up(knex);

    expect(requestSpecificType).toHaveBeenCalledWith(
      'submission_source',
      "VARCHAR(32) NOT NULL CONSTRAINT df_cems_wpms_requests_submission_source DEFAULT 'OPERATOR_FORM'",
    );
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(1, 'system_type', 'VARCHAR(8) NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(2, 'buddhist_year', 'CHAR(2) NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(
      3,
      'last_sequence',
      expect.stringContaining('DEFAULT 0'),
    );
    expect(sequencePrimary).toHaveBeenCalledWith(['system_type', 'buddhist_year'], {
      constraintName: 'pk_cems_wpms_direct_request_sequences',
    });

    const sequenceRows = sequenceInsert.mock.calls[0]?.[0] as Array<{
      system_type: string;
      buddhist_year: string;
      last_sequence: number;
    }>;
    expect(sequenceRows).toHaveLength(200);
    expect(new Set(sequenceRows.map((row) => `${row.system_type}:${row.buddhist_year}`)).size).toBe(
      200,
    );
    expect(sequenceRows).toEqual(
      expect.arrayContaining([
        { system_type: 'CEMS', buddhist_year: '00', last_sequence: 0 },
        { system_type: 'CEMS', buddhist_year: '99', last_sequence: 0 },
        { system_type: 'WPMS', buddhist_year: '00', last_sequence: 0 },
        { system_type: 'WPMS', buddhist_year: '99', last_sequence: 0 },
      ]),
    );

    const constraintSql = raw.mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(constraintSql).toContain("submission_source IN ('OPERATOR_FORM', 'OFFICER_DIRECT_API')");
    expect(constraintSql).toContain("system_type IN ('CEMS', 'WPMS')");
    expect(constraintSql).toContain("buddhist_year LIKE '[0-9][0-9]'");
    expect(constraintSql).toContain('last_sequence BETWEEN 0 AND 99999');
    expect(permissionUpdate).toHaveBeenCalledWith({
      resource: 'cems_wpms_requests',
      action: 'direct_connect',
      description: 'เพิ่มจุดตรวจวัดและเชื่อมต่อทันทีโดยเจ้าหน้าที่',
    });
    expect(rolesWhereIn).toHaveBeenCalledWith('code', ['monitoring_kpm', 'admin']);
    expect(grantUpdate).toHaveBeenCalledTimes(2);
    expect(grantUpdate).toHaveBeenNthCalledWith(1, { scope: 'ALL' });
    expect(grantUpdate).toHaveBeenNthCalledWith(2, { scope: 'ALL' });
  });

  it('drops grants, permission, sequence table, constraints, and source column safely', async () => {
    const deletedTables: string[] = [];
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const dropColumn = jest.fn();
    const deleteRow = jest.fn().mockResolvedValue(undefined as never);
    const permissionWhere = jest.fn((criteria: Record<string, unknown>) => ({
      first: jest.fn().mockResolvedValue(('code' in criteria ? { id: 21 } : undefined) as never),
      del: deleteRow,
    }));

    const knex = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'permissions') return { where: permissionWhere };
        if (tableName === 'role_permissions' || tableName === 'user_permissions') {
          return {
            where: jest.fn(() => ({ del: deleteRow })),
          };
        }
        throw new Error(`Unexpected table: ${tableName}`);
      }),
      {
        schema: {
          dropTableIfExists: jest.fn(async (tableName: string) => {
            deletedTables.push(tableName);
          }),
          raw,
          alterTable: jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
            callback({ dropColumn });
          }),
        },
      },
    ) as unknown as Knex;

    await down(knex);

    expect(deleteRow).toHaveBeenCalledTimes(3);
    expect(deletedTables).toEqual(['cems_wpms_direct_request_sequences']);
    const rollbackSql = raw.mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(rollbackSql).toContain('DROP CONSTRAINT ck_cems_wpms_requests_submission_source');
    expect(rollbackSql).toContain('DROP CONSTRAINT df_cems_wpms_requests_submission_source');
    expect(dropColumn).toHaveBeenCalledWith('submission_source');
  });
});
