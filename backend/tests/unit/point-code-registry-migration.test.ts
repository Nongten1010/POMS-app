import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0095_create_point_code_registry';

describe('point-code registry migration', () => {
  it('creates an insert-only registry and point assignment provenance', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    expect(config).toEqual({ transaction: true });
    expect(harness.createTable).toHaveBeenCalledWith(
      'cems_wpms_point_code_registry',
      expect.any(Function),
    );
    expect(harness.alterTable).toHaveBeenCalledWith(
      'cems_wpms_measurement_points',
      expect.any(Function),
    );
    expect(harness.calls).toEqual(
      expect.arrayContaining([
        ['specificType', 'point_code', 'VARCHAR(64) NOT NULL'],
        ['specificType', 'normalized_point_code', 'VARCHAR(64) NOT NULL'],
        ['specificType', 'system_type', 'VARCHAR(8) NOT NULL'],
        ['specificType', 'prefix', 'CHAR(1) NULL'],
        ['integer', 'numeric_sequence'],
        ['nullable'],
        ['specificType', 'assignment_mode', 'VARCHAR(32) NOT NULL'],
        ['bigInteger', 'source_request_id'],
        ['bigInteger', 'source_measurement_point_id'],
        ['specificType', 'reason', 'NVARCHAR(1000) NULL'],
        ['bigInteger', 'assigned_by'],
        ['specificType', 'point_code_assignment_mode', 'VARCHAR(32) NULL'],
        ['specificType', 'point_code_assignment_reason', 'NVARCHAR(1000) NULL'],
        ['bigInteger', 'point_code_assigned_by'],
        ['specificType', 'point_code_assigned_at', 'DATETIME2 NULL'],
        [
          'unique',
          ['normalized_point_code'],
          { indexName: 'uq_cems_wpms_point_code_registry_normalized' },
        ],
      ]),
    );

    const sql = harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("system_type IN ('CEMS', 'WPMS')");
    expect(sql).toContain("prefix IN ('S', 'W')");
    expect(sql).toContain('prefix IS NULL AND numeric_sequence IS NULL');
    expect(sql).toContain('prefix IS NOT NULL');
    expect(sql).toContain('numeric_sequence IS NOT NULL');
    expect(sql).toContain('numeric_sequence BETWEEN 0 AND 9999');
    expect(sql).toContain("prefix + RIGHT('0000' + CONVERT(VARCHAR(4), numeric_sequence), 4)");
    expect(sql).toContain("'AUTO', 'MANUAL_LEGACY', 'OFFICER_DIRECT', 'LEGACY_IMPORTED'");
    expect(sql).toContain('normalized_point_code = UPPER(LTRIM(RTRIM(point_code)))');
    expect(sql).toContain('CREATE TRIGGER trg_cems_wpms_point_code_registry_immutable');
    expect(sql).toContain('INSTEAD OF UPDATE, DELETE');
    expect(sql).toContain('THROW 51095');
    expect(sql).not.toContain('deleted_at');
  });

  it('backfills one deterministic owner per normalized code without assigning ADD_PARAMETER rows', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    const backfillSql = harness.raw.mock.calls
      .map(([statement]) => String(statement))
      .find((statement) => statement.includes('measurement_point_candidates'));

    expect(backfillSql).toBeDefined();
    expect(backfillSql).toContain('UPPER(LTRIM(RTRIM(mp.point_code)))');
    expect(backfillSql).toContain('cems_wpms_connected_measurement_points AS connected');
    expect(backfillSql).toContain('1 AS source_priority');
    expect(backfillSql).toContain('2 AS source_priority');
    expect(backfillSql).toContain('PARTITION BY candidate.normalized_point_code');
    expect(backfillSql).toContain('candidate.source_priority ASC');
    expect(backfillSql).toContain('candidate.assigned_at ASC');
    expect(backfillSql).toContain('ranked.ownership_rank = 1');
    expect(backfillSql).toContain("'LEGACY_IMPORTED' AS assignment_mode");
    expect(backfillSql).toContain('LEN(ranked.normalized_point_code) = 5');
    expect(backfillSql).toContain(
      "SUBSTRING(ranked.normalized_point_code, 2, 4) NOT LIKE '%[^0-9]%'",
    );
    expect(backfillSql?.match(/<> 'ADD_PARAMETER'/g)).toHaveLength(3);
    expect(backfillSql).toContain("mp.point_code_assignment_mode = 'LEGACY_IMPORTED'");
    expect(backfillSql).not.toContain('UPDATE cems_wpms_point_code_registry');
  });

  it('drops the immutable trigger and registry before removing provenance columns', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    expect(harness.raw.mock.calls[0]?.[0]).toContain(
      'DROP TRIGGER trg_cems_wpms_point_code_registry_immutable',
    );
    expect(harness.dropTableIfExists).toHaveBeenCalledWith('cems_wpms_point_code_registry');
    expect(harness.dropColumns).toEqual([
      'point_code_assignment_mode',
      'point_code_assignment_reason',
      'point_code_assigned_by',
      'point_code_assigned_at',
    ]);
    expect(harness.raw.mock.invocationCallOrder[0]).toBeLessThan(
      harness.dropTableIfExists.mock.invocationCallOrder[0],
    );
    expect(harness.dropTableIfExists.mock.invocationCallOrder[0]).toBeLessThan(
      harness.alterTable.mock.invocationCallOrder[0],
    );
  });
});

function migrationHarness(): {
  knex: Knex;
  raw: jest.Mock<(statement: string) => Promise<void>>;
  createTable: jest.Mock<(tableName: string, callback: (table: unknown) => void) => Promise<void>>;
  alterTable: jest.Mock<(tableName: string, callback: (table: unknown) => void) => Promise<void>>;
  dropTableIfExists: jest.Mock<(tableName: string) => Promise<void>>;
  calls: unknown[][];
  dropColumns: string[];
} {
  const calls: unknown[][] = [];
  const dropColumns: string[] = [];
  let tableBuilder: Record<string, unknown>;
  tableBuilder = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'then') return undefined;
        return (...args: unknown[]) => {
          calls.push([String(property), ...args]);
          if (property === 'dropColumn') dropColumns.push(String(args[0]));
          return tableBuilder;
        };
      },
    },
  );

  const raw = jest.fn(async (_statement: string) => undefined);
  const createTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) =>
    callback(tableBuilder),
  );
  const alterTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) =>
    callback(tableBuilder),
  );
  const dropTableIfExists = jest.fn(async (_tableName: string) => undefined);
  const knex = {
    schema: { raw, createTable, alterTable, dropTableIfExists },
  } as unknown as Knex;

  return {
    knex,
    raw,
    createTable,
    alterTable,
    dropTableIfExists,
    calls,
    dropColumns,
  };
}
