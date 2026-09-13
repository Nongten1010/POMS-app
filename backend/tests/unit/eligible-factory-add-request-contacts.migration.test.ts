import { afterAll, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up, down } from '../../src/db/migrations/0118_add_eligible_factory_add_request_contacts';

const mssql = knex({ client: 'mssql' });
afterAll(async () => {
  await mssql.destroy();
});

async function compileMigration(migration: (db: Knex) => Promise<void>) {
  const statements: string[] = [];
  await migration({
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
  } as unknown as Knex);
  return statements.join('\n');
}

describe('eligible add-request contact migration', () => {
  it('adds nullable Unicode text columns so existing requests need no backfill', async () => {
    const sql = await compileMigration(up);
    expect(sql).toContain('ALTER TABLE [eligible_factory_add_requests] ADD');
    expect(sql).toContain('[contact_name] NVARCHAR(255) NULL');
    expect(sql).toContain('[contact_phone] NVARCHAR(64) NULL');
    expect(sql).not.toMatch(/UPDATE|DELETE|DROP/i);
  });

  it('rolls back only the two added columns', async () => {
    const sql = await compileMigration(down);
    expect(sql).toContain(
      'ALTER TABLE [eligible_factory_add_requests] DROP COLUMN [contact_name], [contact_phone]',
    );
  });
});
