import { afterAll, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up, down } from '../../src/db/migrations/0156_create_integration_alert_receipts';
const compiler = knex({ client: 'mssql' });
afterAll(async () => compiler.destroy());
describe('passive integration receipt migration', () => {
  it('only creates its archive and bounded constraints without linking to alert or email tables', async () => {
    const statements: string[] = [];
    const dropped: string[] = [];
    const executor = {
      schema: {
        createTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
          statements.push(
            ...compiler.schema
              .createTable(name, callback)
              .toSQL()
              .map((q) => q.sql),
          );
        },
        dropTableIfExists: async (name: string) => {
          dropped.push(name);
        },
      },
    } as unknown as Knex;
    await up(executor);
    await down(executor);
    const sql = statements.join('\n');
    expect(sql).toContain('[integration_alert_receipts]');
    expect(sql).toContain('uniqueidentifier');
    expect(sql).toContain('ISJSON(payload_json) = 1');
    expect(sql).toContain('event_count BETWEEN 1 AND 500');
    expect(sql).not.toMatch(/ALTER TABLE|alert_events|alert_email|data_60m/i);
    expect(dropped).toEqual(['integration_alert_receipts']);
  });
});
