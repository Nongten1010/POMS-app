import { afterAll, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up } from '../../src/db/migrations/0117_add_poms_contact_snapshots';
const mssql = knex({ client: 'mssql' });
afterAll(async () => mssql.destroy());
it('adds nullable live overrides and audit snapshots without fabricating historical values', async () => {
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
  expect(statements).toHaveLength(2);
  expect(statements.join('\n')).toContain('[current_contacts_json] nvarchar(max) null');
  expect(statements.join('\n')).toContain('[proposed_contacts_json] nvarchar(max) null');
  expect(statements.join('\n')).toContain('[contact_persons_json] nvarchar(max) null');
  expect(statements.join('\n')).not.toMatch(/UPDATE|INSERT|DELETE/i);
});
