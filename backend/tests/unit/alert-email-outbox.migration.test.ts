import { afterAll, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';

const mssql = knex({ client: 'mssql' });
afterAll(async () => mssql.destroy());

describe('alert email outbox migration', () => {
  it('creates only the separate outbox tables with uniqueness, foreign keys and UTC timestamps', async () => {
    const statements: string[] = [];
    const executor = {
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
    } as unknown as Knex;
    await jest
      .requireActual<
        typeof import('../../src/db/migrations/0127_create_alert_email_outbox')
      >('../../src/db/migrations/0127_create_alert_email_outbox')
      .up(executor);
    const sql = statements.join('\n').toLowerCase();
    expect(sql).toContain('create table [alert_email_batches]');
    expect(sql).toContain('create table [alert_email_batch_events]');
    expect(sql).toContain('create table [alert_email_deliveries]');
    expect(sql).toContain('uq_alert_email_batches_deduplication');
    expect(sql).toContain('uq_alert_email_deliveries_batch');
    expect(sql).toContain('uq_alert_email_batch_events');
    expect(sql).toContain('uq_alert_email_recipient_events');
    expect(sql).toContain('[recipient_key]');
    expect(sql).toContain('foreign key');
    expect(sql).toContain('sysutcdatetime()');
    expect(sql).not.toContain('measurement_daily_summaries');
    expect(sql).not.toContain('alert_notifications');
  });

  it('rolls back children before their batch without touching the existing alert tables', async () => {
    const names: string[] = [];
    const executor = {
      schema: {
        dropTableIfExists: async (name: string) => {
          names.push(name);
        },
      },
    } as unknown as Knex;
    await jest
      .requireActual<
        typeof import('../../src/db/migrations/0127_create_alert_email_outbox')
      >('../../src/db/migrations/0127_create_alert_email_outbox')
      .down(executor);
    expect(names).toEqual([
      'alert_email_deliveries',
      'alert_email_batch_events',
      'alert_email_batches',
    ]);
  });
});
