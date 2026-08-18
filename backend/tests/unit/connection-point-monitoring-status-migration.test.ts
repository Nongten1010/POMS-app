import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0096_add_monitoring_point_status_to_connection_points';

describe('connection point monitoring status migration', () => {
  it('adds indexed nullable status columns to request snapshots and active POMS points', async () => {
    const harness = migrationHarness(false);

    await up(harness.knex);

    expect(config).toEqual({ transaction: true });
    expect(harness.specificType.mock.calls).toEqual([
      ['monitoring_point_status', 'NVARCHAR(64) NULL'],
      ['monitoring_point_status', 'NVARCHAR(64) NULL'],
    ]);
    expect(harness.alterTable.mock.calls.map(([tableName]) => tableName)).toEqual([
      'cems_wpms_measurement_points',
      'cems_wpms_connected_measurement_points',
    ]);
    expect(harness.raw.mock.calls[0]?.[0]).toContain(
      'CREATE INDEX ix_connected_points_monitoring_status',
    );
    expect(harness.raw.mock.calls[0]?.[0]).toContain('WHERE deleted_at IS NULL');
  });

  it('drops the active-point index before removing both status columns', async () => {
    const harness = migrationHarness(true);

    await down(harness.knex);

    expect(harness.raw.mock.calls[0]?.[0]).toContain(
      'DROP INDEX ix_connected_points_monitoring_status',
    );
    expect(harness.dropColumn.mock.calls).toEqual([
      ['monitoring_point_status'],
      ['monitoring_point_status'],
    ]);
  });
});

function migrationHarness(hasColumnResult: boolean): {
  knex: Knex;
  raw: jest.Mock<(statement: string) => Promise<void>>;
  alterTable: jest.Mock<
    (
      tableName: string,
      callback: (table: { specificType: jest.Mock; dropColumn: jest.Mock }) => void,
    ) => Promise<void>
  >;
  specificType: jest.Mock;
  dropColumn: jest.Mock;
} {
  const raw = jest.fn(async (_statement: string) => undefined);
  const specificType = jest.fn();
  const dropColumn = jest.fn();
  const alterTable = jest.fn(
    async (
      _tableName: string,
      callback: (table: {
        specificType: typeof specificType;
        dropColumn: typeof dropColumn;
      }) => void,
    ) => callback({ specificType, dropColumn }),
  );
  const hasColumn = jest.fn(async () => hasColumnResult);
  const knex = { schema: { raw, alterTable, hasColumn } } as unknown as Knex;

  return { knex, raw, alterTable, specificType, dropColumn };
}
