import { describe, expect, it, jest } from '@jest/globals';
import knex, { Knex } from 'knex';
import {
  up,
  down,
} from '../../src/db/migrations/0121_add_kwp_submission_attachments_and_report_period';

describe('KWP optional fields migration', () => {
  it('compiles additive nullable columns for SQL Server without backfilling old requests', async () => {
    const sqlBuilder = knex({ client: 'mssql' });
    const statements: string[] = [];
    const connection = {
      schema: {
        alterTable: async (table: string, callback: (builder: Knex.CreateTableBuilder) => void) => {
          statements.push(
            ...sqlBuilder.schema
              .alterTable(table, callback)
              .toSQL()
              .map((query) => query.sql),
          );
        },
      },
    } as unknown as Knex;
    await up(connection);
    expect(statements.join('\n')).toMatch(/alter table \[kwp_form_submissions\] add/i);
    expect(statements.join('\n')).toContain('NVARCHAR(1000) NULL');
    expect(statements.join('\n')).not.toMatch(/not null|update |default /i);
    await sqlBuilder.destroy();
  });
  it('refuses rollback when any new field contains data', async () => {
    const alterTable = jest.fn();
    const connection = Object.assign(
      () => ({ where: () => ({ first: async () => ({ id: 1 }) }) }),
      { schema: { alterTable } },
    ) as unknown as Knex;
    await expect(down(connection)).rejects.toThrow('contain data');
    expect(alterTable).not.toHaveBeenCalled();
  });
});
