import { afterAll, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up } from '../../src/db/migrations/0116_add_connected_point_officer_emails';

const mssql = knex({ client: 'mssql' });
afterAll(async () => {
  await mssql.destroy();
});

describe('connected point officer-email migration', () => {
  it('adds a nullable NVARCHAR(MAX) override without rewriting source snapshots', async () => {
    const statements: string[] = [];
    const executor = {
      schema: {
        alterTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
          statements.push(
            ...mssql.schema
              .alterTable(name, callback)
              .toSQL()
              .map((query) => query.sql),
          );
        },
      },
    } as unknown as Knex;
    await up(executor);
    expect(statements).toEqual([
      'ALTER TABLE [cems_wpms_connected_measurement_points] ADD [officer_notification_emails_json] nvarchar(max) null',
    ]);
  });
});
