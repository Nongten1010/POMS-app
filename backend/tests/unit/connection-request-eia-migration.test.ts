import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { down, up } from '../../src/db/migrations/0066_add_connection_request_eia_assessment';

describe('connection request EIA migration', () => {
  it('rejects null/mismatched categorical snapshots without relying on SQL UNKNOWN', async () => {
    const specificType = jest.fn();
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = {
      schema: {
        alterTable: jest.fn(
          (_tableName: string, callback: (table: { specificType: typeof specificType }) => void) =>
            callback({ specificType }),
        ),
        raw,
      },
    } as unknown as Knex;

    await up(knex);

    const constraintSql = String(raw.mock.calls[0]?.[0]);
    expect(constraintSql).toContain('eia_assessment IS NOT NULL');
    expect(constraintSql).toContain('has_eia IS NOT NULL');
    expect(constraintSql).toContain("eia_assessment = N'มี EIA'");
    expect(constraintSql).toContain('has_eia = 1');
    expect(constraintSql).toContain("eia_assessment = N'อื่นๆ'");
    expect(constraintSql).toContain('has_eia = 0');
  });

  it('drops the constraint before removing the snapshot columns', async () => {
    const dropColumn = jest.fn();
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const alterTable = jest.fn(
      (_tableName: string, callback: (table: { dropColumn: typeof dropColumn }) => void) =>
        callback({ dropColumn }),
    );
    const knex = {
      schema: { alterTable, raw },
    } as unknown as Knex;

    await down(knex);

    expect(String(raw.mock.calls[0]?.[0])).toContain(
      'DROP CONSTRAINT ck_connection_requests_eia_assessment',
    );
    expect(dropColumn.mock.calls).toEqual([['eia_other'], ['eia_assessment']]);
  });
});
