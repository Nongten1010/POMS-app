import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0108_create_laws_and_faqs';

describe('laws and FAQs migration', () => {
  it('creates the two auditable tables with internal and public identifiers', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    expect(config).toEqual({ transaction: true });
    expect(harness.createTable.mock.calls.map(([tableName]) => tableName)).toEqual([
      'laws',
      'faqs',
    ]);

    expect(harness.tableCalls.laws).toEqual(
      expect.arrayContaining([
        ['bigIncrements', 'id'],
        ['specificType', 'public_id', 'UNIQUEIDENTIFIER NOT NULL'],
        ['specificType', 'title', 'NVARCHAR(500) NOT NULL'],
        ['specificType', 'category', 'VARCHAR(32) NOT NULL'],
        ['specificType', 'document_type', 'VARCHAR(64) NOT NULL'],
        ['specificType', 'published_date', 'DATE NOT NULL'],
        ['specificType', 'original_file_name', 'NVARCHAR(255) NOT NULL'],
        ['specificType', 'mime_type', 'VARCHAR(100) NOT NULL'],
        ['specificType', 'file_size', 'BIGINT NOT NULL'],
        ['specificType', 'storage_path', 'NVARCHAR(1000) NOT NULL'],
        ['specificType', 'created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()'],
        ['specificType', 'updated_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()'],
        ['bigInteger', 'created_by'],
        ['bigInteger', 'updated_by'],
        ['specificType', 'deleted_at', 'DATETIME2 NULL'],
      ]),
    );
    expect(harness.tableCalls.faqs).toEqual(
      expect.arrayContaining([
        ['bigIncrements', 'id'],
        ['specificType', 'public_id', 'UNIQUEIDENTIFIER NOT NULL'],
        ['specificType', 'question', 'NVARCHAR(1000) NOT NULL'],
        ['specificType', 'answer', 'NVARCHAR(MAX) NOT NULL'],
        ['specificType', 'category', 'VARCHAR(32) NOT NULL'],
        ['specificType', 'updated_date', 'DATE NOT NULL'],
        ['specificType', 'created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()'],
        ['specificType', 'updated_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()'],
        ['bigInteger', 'created_by'],
        ['bigInteger', 'updated_by'],
        ['specificType', 'deleted_at', 'DATETIME2 NULL'],
      ]),
    );
  });

  it('enforces public ids, enums, dates, non-empty content, and private PDF files', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n'),
    );

    expect(sql).toContain('CREATE UNIQUE INDEX uq_laws_public_id ON laws(public_id)');
    expect(sql).toContain('CREATE UNIQUE INDEX uq_faqs_public_id ON faqs(public_id)');
    expect(sql).toContain("CHECK (category IN ('CEMS', 'WPMS', 'OTHER'))");
    expect(sql).toContain(
      "CHECK (document_type IN ('MINISTERIAL_REGULATION', 'RULE_AND_ANNOUNCEMENT', 'REGULATION_REQUIREMENT', 'OTHER'))",
    );
    expect(sql).toContain("published_date BETWEEN '1900-01-01' AND '9999-12-31'");
    expect(sql).toContain("updated_date BETWEEN '1900-01-01' AND '9999-12-31'");
    expect(sql).toContain('CHECK (LEN(LTRIM(RTRIM(title))) > 0)');
    expect(sql).toContain('CHECK (LEN(LTRIM(RTRIM(original_file_name))) > 0)');
    expect(sql).toContain('CHECK (LEN(LTRIM(RTRIM(question))) > 0)');
    expect(sql).toContain('CHECK (LEN(LTRIM(RTRIM(answer))) > 0)');
    expect(sql).toContain("CHECK (mime_type = 'application/pdf')");
    expect(sql).toContain('CHECK (file_size BETWEEN 1 AND 10485760)');
    expect(sql).toContain("storage_path LIKE '.private/laws/%'");
    expect(sql).toContain("storage_path NOT LIKE '%..%'");
    expect(sql).toContain("storage_path NOT LIKE '%\\%'");
    expect(sql).toContain('CREATE INDEX ix_laws_active_title ON laws(title, id)');
    expect(sql).toContain('CREATE INDEX ix_faqs_active_updated_date');
    expect(sql).toContain('ON faqs(updated_date DESC, id DESC)');
    expect(sql.match(/WHERE deleted_at IS NULL/g)).toHaveLength(2);
  });

  it('drops FAQs before laws during rollback', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    expect(harness.dropTableIfExists.mock.calls.map(([tableName]) => tableName)).toEqual([
      'faqs',
      'laws',
    ]);
  });
});

function migrationHarness(): {
  knex: Knex;
  raw: jest.Mock<(statement: string) => Promise<void>>;
  createTable: jest.Mock<(tableName: string, callback: (table: unknown) => void) => Promise<void>>;
  dropTableIfExists: jest.Mock<(tableName: string) => Promise<void>>;
  tableCalls: Record<string, unknown[][]>;
} {
  const tableCalls: Record<string, unknown[][]> = {};
  const raw = jest.fn(async (_statement: string) => undefined);
  const createTable = jest.fn(async (tableName: string, callback: (table: unknown) => void) => {
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
    tableCalls[tableName] = calls;
    callback(tableBuilder);
  });
  const dropTableIfExists = jest.fn(async (_tableName: string) => undefined);
  const knex = {
    schema: { raw, createTable, dropTableIfExists },
  } as unknown as Knex;

  return { knex, raw, createTable, dropTableIfExists, tableCalls };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
