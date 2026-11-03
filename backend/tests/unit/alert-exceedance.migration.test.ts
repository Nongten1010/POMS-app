import { afterAll, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up, down } from '../../src/db/migrations/0155_create_alert_exceedance_state';
const compiler = knex({ client: 'mssql' });
afterAll(async () => compiler.destroy());
describe('exceedance metadata migration', () => {
  it('creates only new worker tables and drops them in reverse order', async () => {
    const statements: string[] = [];
    const dropped: string[] = [];
    const executor = {
      schema: {
        createTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
          statements.push(
            ...compiler.schema
              .createTable(name, callback)
              .toSQL()
              .map((item) => item.sql),
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
    expect(sql).toContain('[alert_exceedance_lease]');
    expect(sql).toContain('[alert_exceedance_points]');
    expect(sql).toContain('[alert_exceedance_hours]');
    expect(sql).toContain('[ix_alert_exceedance_retry]');
    expect(sql).not.toMatch(/ALTER TABLE|data_60m|alert_events/i);
    expect(dropped).toEqual([
      'alert_exceedance_hours',
      'alert_exceedance_points',
      'alert_exceedance_lease',
    ]);
  });
});
