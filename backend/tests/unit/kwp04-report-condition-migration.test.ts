import { describe, expect, it, jest } from '@jest/globals';
import knex, { Knex } from 'knex';
import { up, down } from '../../src/db/migrations/0159_add_kwp04_measurement_report_condition';

describe('KWP04 report condition migration', () => {
  it('adds a nullable SQL Server column without defaults or backfill', async () => {
    const builder = knex({ client: 'mssql' });
    const statements: string[] = [];
    const connection = {
      schema: {
        alterTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
          statements.push(
            ...builder.schema
              .alterTable(name, callback)
              .toSQL()
              .map((query) => query.sql),
          );
        },
      },
    } as unknown as Knex;
    await up(connection);
    expect(statements.join('\n')).toMatch(
      /alter table \[kwp_emission_measurement_items\] add \[report_condition\] VARCHAR\(5\) NULL/i,
    );
    expect(statements.join('\n')).not.toMatch(/not null|default|update /i);
    await builder.destroy();
  });

  it('preserves populated conditions when rollback is requested', async () => {
    const alterTable = jest.fn();
    const connection = Object.assign(
      () => ({ whereNotNull: () => ({ first: async () => ({ id: 1 }) }) }),
      { schema: { alterTable } },
    ) as unknown as Knex;
    await expect(down(connection)).rejects.toThrow('contain data');
    expect(alterTable).not.toHaveBeenCalled();
  });

  it('can remove the column before it contains any conditions', async () => {
    const builder = knex({ client: 'mssql' });
    const statements: string[] = [];
    const connection = Object.assign(
      () => ({ whereNotNull: () => ({ first: async () => undefined }) }),
      {
        schema: {
          alterTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
            statements.push(
              ...builder.schema
                .alterTable(name, callback)
                .toSQL()
                .map((query) => query.sql),
            );
          },
        },
      },
    ) as unknown as Knex;
    await down(connection);
    expect(statements.join('\n')).toMatch(/drop column \[report_condition\]/i);
    await builder.destroy();
  });
});
