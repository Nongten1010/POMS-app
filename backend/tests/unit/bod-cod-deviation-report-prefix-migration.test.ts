import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0102_change_bod_cod_report_number_prefix_to_e';

describe('BOD/COD deviation report prefix migration', () => {
  it('converts numbered reports from Error- to E- and installs the new constraint', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = String(raw.mock.calls[0]?.[0]);
    const collisionIndex = sql.indexOf('BOD_COD_REPORT_NO_PREFIX_COLLISION');
    const dropConstraintIndex = sql.indexOf(
      'DROP CONSTRAINT ck_bod_cod_deviation_reports_numbering_snapshot',
    );
    const updateIndex = sql.indexOf("SET report_no = STUFF(report_no, 1, 6, 'E-')");
    const addConstraintIndex = sql.indexOf(
      'ADD CONSTRAINT ck_bod_cod_deviation_reports_numbering_snapshot',
    );

    expect(sql).toContain("occupied_report.report_no = STUFF(report.report_no, 1, 6, 'E-')");
    expect(sql).toContain('numbering_region_code IS NOT NULL');
    expect(sql).toContain("report_no = CONCAT(\n          'E-', numbering_region_code");
    expect(collisionIndex).toBeGreaterThanOrEqual(0);
    expect(dropConstraintIndex).toBeGreaterThan(collisionIndex);
    expect(updateIndex).toBeGreaterThan(dropConstraintIndex);
    expect(addConstraintIndex).toBeGreaterThan(updateIndex);
  });

  it('restores Error- for every numbered report on rollback', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = String(raw.mock.calls[0]?.[0]);
    expect(sql).toContain("occupied_report.report_no = STUFF(report.report_no, 1, 2, 'Error-')");
    expect(sql).toContain("SET report_no = STUFF(report_no, 1, 2, 'Error-')");
    expect(sql).toContain("report_no = CONCAT(\n          'Error-', numbering_region_code");
    expect(sql).toContain('BOD_COD_REPORT_NO_PREFIX_ROLLBACK_COLLISION');
  });
});
