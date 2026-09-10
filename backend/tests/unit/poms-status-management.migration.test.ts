import { describe, it, expect } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up, down, config } from '../../src/db/migrations/0113_create_poms_status_management';
describe('POMS status migration SQL', () => {
  it('creates status/audit tables with integrity constraints and drops in foreign-key-safe order', async () => {
    const client = knex({ client: 'mssql' });
    const statements: string[] = [];
    const fake = {
      schema: {
        createTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
          statements.push(
            ...client.schema
              .createTable(name, callback)
              .toSQL()
              .map((s) => s.sql),
          );
        },
        raw: async (sql: string) => {
          statements.push(sql);
        },
        dropTable: async (name: string) => {
          statements.push(`DROP ${name}`);
        },
      },
    } as unknown as Knex;
    await up(fake);
    const sql = statements.join('\n');
    expect(config.transaction).toBe(true);
    expect(sql).toContain('[eligible_factory_id] bigint');
    expect(sql).toContain('REFERENCES [eligible_factories]');
    expect(sql).toContain('REFERENCES [users]');
    expect(sql).toContain('ISJSON(state_json) = 1');
    expect(sql).toContain('ISJSON(before_json) = 1');
    expect(sql).toContain('uq_poms_factory_status_event_revision');
    await down(fake);
    expect(statements.slice(-2)).toEqual([
      'DROP poms_factory_status_events',
      'DROP poms_factory_status_management',
    ]);
    await client.destroy();
  });
});
