import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0091_create_factory_monitoring_point_attachments';

describe('monitoring point attachments migration', () => {
  it('creates one pending/claimed attachment table with private storage and lifecycle guards', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    expect(config).toEqual({ transaction: true });
    expect(harness.createTable).toHaveBeenCalledWith(
      'factory_monitoring_point_attachments',
      expect.any(Function),
    );
    expect(harness.calls).toEqual(
      expect.arrayContaining([
        ['bigIncrements', 'id'],
        ['specificType', 'public_id', 'UNIQUEIDENTIFIER NOT NULL'],
        ['specificType', 'claim_token_hash', 'VARBINARY(32) NOT NULL'],
        ['bigInteger', 'monitoring_point_id'],
        ['specificType', 'storage_path', 'NVARCHAR(1024) NOT NULL'],
        ['specificType', 'expires_at', 'DATETIME2 NOT NULL'],
        ['specificType', 'claimed_at', 'DATETIME2 NULL'],
        ['bigInteger', 'created_by'],
      ]),
    );

    const sql = harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('attachment_links_json NVARCHAR(MAX) NOT NULL');
    expect(sql).toContain("DEFAULT N'[]' WITH VALUES");
    expect(sql).toContain('ISJSON(attachment_links_json) = 1');
    expect(sql).toContain('uq_fmp_attachments_public_id');
    expect(sql).toContain('uq_fmp_attachments_claim_token');
    expect(sql).toContain('ix_fmp_attachments_pending_expiry');
    expect(sql).toContain('ix_fmp_attachments_deleted_retry');
    expect(sql).toContain("storage_path LIKE '.private/monitoring-point-forms/attachments/%'");
    expect(sql).toContain('file_size BETWEEN 1 AND 10485760');
    expect(sql).toContain('monitoring_point_id IS NULL');
    expect(sql).toContain('monitoring_point_id IS NOT NULL');
    expect(sql).toContain('sort_order IS NOT NULL');
    expect(sql).not.toContain('fk_fmp_attachments_created_by');
    expect(sql).not.toContain('fk_fmp_attachments_updated_by');
  });

  it('drops the links column constraints before dropping the attachment table', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    const sql = harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('DROP CONSTRAINT ck_factory_monitoring_points_attachment_links_json');
    expect(sql).toContain('DROP CONSTRAINT df_factory_monitoring_points_attachment_links');
    expect(sql).toContain('DROP COLUMN attachment_links_json');
    expect(harness.dropTableIfExists).toHaveBeenCalledWith('factory_monitoring_point_attachments');
    expect(harness.raw.mock.invocationCallOrder[0]).toBeLessThan(
      harness.dropTableIfExists.mock.invocationCallOrder[0],
    );
  });
});

function migrationHarness(): {
  knex: Knex;
  raw: jest.Mock<(statement: string) => Promise<void>>;
  createTable: jest.Mock<(tableName: string, callback: (table: unknown) => void) => Promise<void>>;
  dropTableIfExists: jest.Mock<(tableName: string) => Promise<void>>;
  calls: unknown[][];
} {
  const calls: unknown[][] = [];
  let tableBuilder: Record<string, unknown>;
  tableBuilder = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'then') return undefined;
        return (...args: unknown[]) => {
          calls.push([String(property), ...args]);
          return tableBuilder;
        };
      },
    },
  );

  const raw = jest.fn(async (_statement: string) => undefined);
  const createTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) =>
    callback(tableBuilder),
  );
  const dropTableIfExists = jest.fn(async (_tableName: string) => undefined);
  const knex = {
    schema: { raw, createTable, dropTableIfExists },
  } as unknown as Knex;
  return { knex, raw, createTable, dropTableIfExists, calls };
}
