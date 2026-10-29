import knexFactory, { type Knex } from 'knex';
import { describe, expect, it, jest } from '@jest/globals';
import { config, down, up } from '../../src/db/migrations/0148_add_device_channel_scale_and_gain';

// Compile actual MSSQL DDL/query builders; no production database is contacted.
function boundary(existing: boolean, configuredChannel?: { id: number }) {
  const compiler = knexFactory({ client: 'mssql' });
  const statements: string[] = [];
  const query = compiler('device_measurement_channels');
  const first = jest
    .spyOn(query, 'first')
    .mockImplementation(() => Promise.resolve(configuredChannel) as never);
  const alterTable = jest.fn(
    async (name: string, callback: (table: Knex.AlterTableBuilder) => void) => {
      statements.push(
        ...compiler.schema
          .alterTable(name, callback)
          .toSQL()
          .map((statement) => statement.sql),
      );
    },
  );
  const knex = Object.assign(
    jest.fn(() => query),
    {
      schema: {
        hasColumn: jest.fn(async () => existing),
        alterTable,
      },
    },
  ) as unknown as Knex;
  return { knex, query, first, alterTable, statements };
}

describe('channel Scale/Gain migration', () => {
  it('adds nullable decimal columns without changing historical values', async () => {
    const { knex, statements } = boundary(false);
    await up(knex);
    expect(config.transaction).toBe(true);
    expect(statements).toHaveLength(3);
    for (const column of ['scale_min', 'scale_max', 'gain']) {
      expect(statements).toContain(
        `ALTER TABLE [device_measurement_channels] ADD [${column}] decimal(18, 6) null`,
      );
    }
    expect(statements.join('\n')).not.toMatch(/UPDATE|DELETE|DEFAULT/i);
  });

  it('does not add columns that already exist', async () => {
    const { knex, alterTable } = boundary(true);
    await up(knex);
    expect(alterTable).not.toHaveBeenCalled();
  });

  it('blocks rollback for any configured channel, including zero or historical values', async () => {
    const { knex, query, alterTable } = boundary(true, { id: 1 });
    await expect(down(knex)).rejects.toThrow('configured channel values exist');
    const sql = query.toSQL().sql;
    for (const column of ['scale_min', 'scale_max', 'gain'])
      expect(sql).toContain(`[${column}] is not null`);
    expect(sql).not.toContain('deleted_at');
    expect(alterTable).not.toHaveBeenCalled();
  });

  it('allows rollback only when all added values are null', async () => {
    const { knex, statements } = boundary(true);
    await down(knex);
    const sql = statements.join('\n');
    expect(sql).toContain('DROP COLUMN [scale_min], [scale_max], [gain]');
  });

  it('does not query absent columns during rollback', async () => {
    const { knex, first, alterTable } = boundary(false);
    await down(knex);
    expect(first).not.toHaveBeenCalled();
    expect(alterTable).not.toHaveBeenCalled();
  });
});
