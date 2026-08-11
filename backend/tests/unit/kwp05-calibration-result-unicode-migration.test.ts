import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0093_use_nvarchar_for_kwp05_calibration_results';

describe('KWP05 calibration result Unicode migration', () => {
  it('changes result storage to nullable NVARCHAR without guessing corrupted legacy values', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(config).toEqual({ transaction: true });
    expect(sql).toContain('ALTER COLUMN result NVARCHAR(32) NULL');
    expect(sql).not.toMatch(/\bUPDATE\s+kwp05_calibration_items\b/i);
    expect(sql).not.toContain("N'ผ่าน'");
    expect(sql).not.toContain("N'ไม่ผ่าน'");
  });

  it('refuses a lossy rollback before restoring VARCHAR storage', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    const guardIndex = sql.indexOf('CONVERT(VARBINARY(64), result) <>');
    const roundTripIndex = sql.indexOf('CONVERT(NVARCHAR(32), CONVERT(VARCHAR(32), result))');
    const throwIndex = sql.indexOf('THROW 50093');
    const alterIndex = sql.indexOf('ALTER COLUMN result VARCHAR(32) NULL');

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(roundTripIndex).toBeGreaterThan(guardIndex);
    expect(throwIndex).toBeGreaterThan(guardIndex);
    expect(alterIndex).toBeGreaterThan(throwIndex);
  });
});
