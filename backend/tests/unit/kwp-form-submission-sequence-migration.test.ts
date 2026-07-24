import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0081_create_kwp_form_submission_sequences';

describe('KWP form submission sequence migration', () => {
  it('creates scoped sequences and immutable numbering snapshots without rewriting legacy numbers', async () => {
    const sequenceSpecificType = jest.fn();
    const sequencePrimary = jest.fn();
    const submissionSpecificType = jest.fn();
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const createTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
      callback({ specificType: sequenceSpecificType, primary: sequencePrimary });
    });
    const alterTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
      callback({ specificType: submissionSpecificType });
    });
    const knex = {
      schema: { createTable, alterTable, raw },
    } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(createTable).toHaveBeenCalledWith('kwp_form_submission_sequences', expect.any(Function));
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(1, 'form_type', 'VARCHAR(16) NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(2, 'region_code', 'CHAR(2) NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(3, 'buddhist_year', 'CHAR(4) NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(
      4,
      'last_sequence',
      expect.stringContaining('DEFAULT 0'),
    );
    expect(sequencePrimary).toHaveBeenCalledWith(['form_type', 'region_code', 'buddhist_year'], {
      constraintName: 'pk_kwp_form_submission_sequences',
    });
    expect(alterTable).toHaveBeenCalledWith('kwp_form_submissions', expect.any(Function));
    expect(submissionSpecificType).toHaveBeenCalledWith('submission_region_code', 'CHAR(2) NULL');
    expect(submissionSpecificType).toHaveBeenCalledWith(
      'submission_region_name',
      'NVARCHAR(128) NULL',
    );
    expect(submissionSpecificType).toHaveBeenCalledWith('submission_buddhist_year', 'CHAR(4) NULL');
    expect(submissionSpecificType).toHaveBeenCalledWith('submission_sequence', 'INT NULL');

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("form_type IN ('KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05')");
    expect(sql).toContain("region_code IN ('02', '03', '04', '05', '06', '07')");
    expect(sql).toContain("buddhist_year LIKE '[0-9][0-9][0-9][0-9]'");
    expect(sql).toContain('last_sequence BETWEEN 0 AND 9999');
    expect(sql).toContain('ck_kwp_form_submissions_numbering_snapshot');
    expect(sql).toContain('submission_region_code IS NULL');
    expect(sql).toContain('submission_region_code IS NOT NULL');
    expect(sql).toContain("submission_region_code IN ('02', '03', '04', '05', '06', '07')");
    expect(sql).toContain(
      "(submission_region_code = '02' AND submission_region_name = N'ภาคตะวันตก')",
    );
    expect(sql).toContain(
      "(submission_region_code = '03' AND submission_region_name = N'ภาคตะวันออก')",
    );
    expect(sql).toContain(
      "(submission_region_code = '04' AND submission_region_name = N'ภาคเหนือ')",
    );
    expect(sql).toContain("(submission_region_code = '05' AND submission_region_name = N'ภาคใต้')");
    expect(sql).toMatch(
      /\(\s*submission_region_code = '06'\s+AND submission_region_name = N'ภาคตะวันออกเฉียงเหนือ'\s*\)/,
    );
    expect(sql).toContain(
      "(submission_region_code = '07' AND submission_region_name = N'ภาคกลาง')",
    );
    expect(sql).toContain('submission_no = CONCAT(');
    expect(sql).toContain('RIGHT(form_type, 2)');
    expect(sql).not.toContain('UPDATE kwp_form_submissions');
  });

  it('drops only new snapshot columns and the sequence table on rollback', async () => {
    const dropColumn = jest.fn();
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const alterTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
      callback({ dropColumn });
    });
    const dropTableIfExists = jest.fn().mockResolvedValue(undefined as never);
    const knex = {
      schema: { alterTable, dropTableIfExists, raw },
    } as unknown as Knex;

    await down(knex);

    expect(raw).toHaveBeenCalledWith(
      expect.stringContaining('DROP CONSTRAINT ck_kwp_form_submissions_numbering_snapshot'),
    );
    expect(alterTable).toHaveBeenCalledWith('kwp_form_submissions', expect.any(Function));
    expect(dropColumn).toHaveBeenCalledWith('submission_region_code');
    expect(dropColumn).toHaveBeenCalledWith('submission_region_name');
    expect(dropColumn).toHaveBeenCalledWith('submission_buddhist_year');
    expect(dropColumn).toHaveBeenCalledWith('submission_sequence');
    expect(dropTableIfExists).toHaveBeenCalledWith('kwp_form_submission_sequences');
  });
});
