import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0094_backfill_wpms_request_number_prefix';

describe('WPMS connection-request number migration', () => {
  it('records and converts only annual WEMS numbers owned by WPMS requests', async () => {
    const { knex, createTable, table, raw } = migrationKnex();

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(createTable).toHaveBeenCalledWith(
      'wpms_request_no_prefix_backfill_0094',
      expect.any(Function),
    );
    expect(table.specificType).toHaveBeenCalledWith('request_id', 'BIGINT NOT NULL');
    expect(table.specificType).toHaveBeenCalledWith('original_request_no', 'VARCHAR(32) NOT NULL');
    expect(table.specificType).toHaveBeenCalledWith(
      'normalized_request_no',
      'VARCHAR(32) NOT NULL',
    );
    expect(table.primary).toHaveBeenCalledWith(['request_id'], {
      constraintName: 'pk_wpms_request_no_prefix_backfill_0094',
    });

    const sql = joinedSql(raw);
    expect(sql).toContain("request_row.system_type = 'WPMS'");
    expect(sql).toContain("LEFT(request_row.request_no, 5) = 'WEMS-'");
    expect(sql).toContain("CHARINDEX('/', request_row.request_no) >= 10");
    expect(sql).toContain("COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%'");
    expect(sql).toContain('RIGHT(request_row.request_no, 4)');
    expect(sql).toContain("STUFF(request_row.request_no, 1, 5, 'WPMS-')");
    expect(sql).toContain('OUTPUT INSERTED.id, DELETED.request_no, INSERTED.request_no');
    expect(sql).toContain('INTO wpms_request_no_prefix_backfill_0094');
    expect(sql).not.toContain("system_type = 'CEMS'");
    expect(sql).not.toContain('point_code');
    expect(sql).not.toContain('stationId');
  });

  it('checks every normalized number for a collision before issuing the update', async () => {
    const { knex, raw } = migrationKnex();

    await up(knex);

    const sql = joinedSql(raw);
    const collisionIndex = sql.indexOf('WPMS_REQUEST_NO_PREFIX_COLLISION');
    const throwIndex = sql.indexOf('THROW 51094');
    const updateIndex = sql.indexOf('UPDATE request_row');

    expect(sql).toContain(
      "existing_request.request_no = STUFF(request_row.request_no, 1, 5, 'WPMS-')",
    );
    expect(collisionIndex).toBeGreaterThanOrEqual(0);
    expect(throwIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThan(throwIndex);
  });

  it('rolls back only tracked unchanged rows and refuses unsafe restoration', async () => {
    const { knex, hasTable, dropTable, raw } = migrationKnex(true);

    await down(knex);

    expect(hasTable).toHaveBeenCalledWith('wpms_request_no_prefix_backfill_0094');
    const sql = joinedSql(raw);
    const stateGuardIndex = sql.indexOf('WPMS_REQUEST_NO_ROLLBACK_STATE_CHANGED');
    const collisionGuardIndex = sql.indexOf('WPMS_REQUEST_NO_ROLLBACK_COLLISION');
    const updateIndex = sql.indexOf('UPDATE request_row');

    expect(sql).toContain('request_row.request_no <> backup.normalized_request_no');
    expect(sql).toContain("request_row.system_type <> 'WPMS'");
    expect(sql).toContain('occupied_request.request_no = backup.original_request_no');
    expect(stateGuardIndex).toBeGreaterThanOrEqual(0);
    expect(collisionGuardIndex).toBeGreaterThan(stateGuardIndex);
    expect(updateIndex).toBeGreaterThan(collisionGuardIndex);
    expect(sql).toContain('SET request_row.request_no = backup.original_request_no');
    expect(dropTable).toHaveBeenCalledWith('wpms_request_no_prefix_backfill_0094');
    expect(raw.mock.invocationCallOrder[0]).toBeLessThan(dropTable.mock.invocationCallOrder[0]);
  });

  it('does nothing on rollback when the audit table is absent', async () => {
    const { knex, dropTable, raw } = migrationKnex(false);

    await down(knex);

    expect(raw).not.toHaveBeenCalled();
    expect(dropTable).not.toHaveBeenCalled();
  });
});

function joinedSql(raw: jest.Mock): string {
  return raw.mock.calls.map(([statement]) => String(statement)).join('\n');
}

function migrationKnex(hasAuditTable = false) {
  const table = {
    specificType: jest.fn().mockReturnThis(),
    primary: jest.fn().mockReturnThis(),
  };
  const raw = jest.fn().mockResolvedValue(undefined as never);
  const createTable = jest.fn(
    async (_tableName: string, callback: (builder: typeof table) => void) => callback(table),
  );
  const hasTable = jest.fn().mockResolvedValue(hasAuditTable as never);
  const dropTable = jest.fn().mockResolvedValue(undefined as never);
  const knex = {
    schema: { createTable, hasTable, dropTable, raw },
  } as unknown as Knex;

  return { knex, createTable, hasTable, dropTable, raw, table };
}
