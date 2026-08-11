import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0092_add_kwp05_calibration_item_parameters';

describe('KWP05 calibration item parameters migration', () => {
  it('adds nullable JSON-array storage without backfilling legacy rows', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(config).toEqual({ transaction: true });
    expect(sql).toContain('ADD parameters_json NVARCHAR(MAX) NULL');
    expect(sql).toContain('ck_kwp05_calibration_items_parameters_json');
    expect(sql).toContain('parameters_json IS NULL');
    expect(sql).toContain('ISJSON(parameters_json) = 1');
    expect(sql).toContain("LEFT(LTRIM(parameters_json), 1) = N'['");
    expect(sql).toContain("RIGHT(RTRIM(parameters_json), 1) = N']'");
    expect(sql).not.toMatch(/\bUPDATE\s+kwp05_calibration_items\b/i);
    expect(sql).not.toContain("DEFAULT N'[]'");
  });

  it('drops the JSON-array constraint before dropping its column', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    const constraintIndex = sql.indexOf(
      'DROP CONSTRAINT ck_kwp05_calibration_items_parameters_json',
    );
    const columnIndex = sql.indexOf('DROP COLUMN parameters_json');
    expect(constraintIndex).toBeGreaterThanOrEqual(0);
    expect(columnIndex).toBeGreaterThan(constraintIndex);
  });
});
