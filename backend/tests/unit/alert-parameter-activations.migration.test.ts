import { afterAll, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up } from '../../src/db/migrations/0128_create_alert_parameter_activations';

const mssql = knex({ client: 'mssql' });
afterAll(async () => mssql.destroy());

describe('activation registry migration', () => {
  it('creates isolated episodes with an active unique key and conservatively backfills current registrations', async () => {
    const statements: string[] = [];
    const inserts: Record<string, unknown>[] = [];
    const executor = Object.assign(
      () => ({
        insert: async (rows: Record<string, unknown>[]) => {
          inserts.push(...rows);
        },
      }),
      {
        schema: {
          createTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
            statements.push(
              ...mssql.schema
                .createTable(name, callback)
                .toSQL()
                .map((query) => query.sql),
            );
          },
          raw: async (sql: string) => {
            statements.push(sql);
          },
        },
        raw: async (sql: string) => {
          statements.push(sql);
          return [
            {
              connected_point_id: 7,
              connected_at: new Date('2026-01-01T00:00:00Z'),
              updated_at: new Date('2026-09-01T00:00:00Z'),
              data_type: 'CO (ppm)',
            },
            {
              connected_point_id: 7,
              connected_at: new Date('2026-01-01T00:00:00Z'),
              updated_at: new Date('2026-09-02T00:00:00Z'),
              data_type: 'CO ( ppm )',
            },
            {
              connected_point_id: 7,
              connected_at: new Date('2026-01-01T00:00:00Z'),
              updated_at: new Date('2026-09-01T00:00:00Z'),
              data_type: 'CO (%)',
            },
            {
              connected_point_id: 7,
              connected_at: new Date('2026-01-01T00:00:00Z'),
              updated_at: new Date('2026-09-01T00:00:00Z'),
              data_type: 'CO',
            },
            {
              connected_point_id: 8,
              connected_at: new Date('2026-10-01T00:00:00Z'),
              updated_at: new Date('2026-09-01T00:00:00Z'),
              data_type: 'CO (ppm)',
            },
          ];
        },
      },
    ) as unknown as Knex;
    await up(executor);
    expect(inserts).toEqual([
      {
        connected_point_id: 7,
        parameter_code: 'co',
        unit: 'ppm',
        activated_at: new Date('2026-09-02T00:00:00Z'),
      },
      {
        connected_point_id: 7,
        parameter_code: 'co',
        unit: '%',
        activated_at: new Date('2026-09-01T00:00:00Z'),
      },
      {
        connected_point_id: 8,
        parameter_code: 'co',
        unit: 'ppm',
        activated_at: new Date('2026-10-01T00:00:00Z'),
      },
    ]);
    const sql = statements.join('\n').toLowerCase();
    expect(sql).toContain('create table [alert_parameter_activations]');
    expect(sql).toContain('where deactivated_at is null');
    expect(sql).toContain('sysutcdatetime()');
    expect(sql).toContain('dc.request_id is null');
    expect(sql).toContain('ch.deleted_at is null');
    expect(sql).toContain('ch.test_mode');
    expect(sql).toContain("coalesce(nullif(ltrim(rtrim(cp.point_code)), ''), cp.point_name)");
    expect(sql).not.toContain('update device_connection_configs');
  });
});
