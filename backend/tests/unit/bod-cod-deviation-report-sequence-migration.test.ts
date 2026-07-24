import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0082_create_bod_cod_deviation_report_sequences';

describe('BOD/COD deviation report sequence migration', () => {
  it('adds scoped sequences and minimal numbering snapshots without rewriting legacy numbers', async () => {
    const sequenceSpecificType = jest.fn();
    const sequencePrimary = jest.fn();
    const reportSpecificType = jest.fn();
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const createTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
      callback({ specificType: sequenceSpecificType, primary: sequencePrimary });
    });
    const alterTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) => {
      callback({ specificType: reportSpecificType });
    });
    const knex = {
      schema: { createTable, alterTable, raw },
    } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(createTable).toHaveBeenCalledWith(
      'bod_cod_deviation_report_sequences',
      expect.any(Function),
    );
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(1, 'region_code', 'CHAR(2) NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(2, 'report_year', 'INT NOT NULL');
    expect(sequenceSpecificType).toHaveBeenNthCalledWith(
      3,
      'last_sequence',
      expect.stringContaining('DEFAULT 0'),
    );
    expect(sequencePrimary).toHaveBeenCalledWith(['region_code', 'report_year'], {
      constraintName: 'pk_bod_cod_deviation_report_sequences',
    });
    expect(alterTable).toHaveBeenCalledWith('bod_cod_deviation_reports', expect.any(Function));
    expect(reportSpecificType).toHaveBeenCalledWith('numbering_region_code', 'CHAR(2) NULL');
    expect(reportSpecificType).toHaveBeenCalledWith('numbering_sequence', 'INT NULL');

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("region_code IN ('02', '03', '04', '05', '06', '07')");
    expect(sql).toContain('report_year BETWEEN 2500 AND 2700');
    expect(sql).toContain('last_sequence BETWEEN 0 AND 9999');
    expect(sql).toContain('ck_bod_cod_deviation_reports_numbering_snapshot');
    expect(sql).toContain('numbering_region_code IS NULL');
    expect(sql).toContain('numbering_region_code IS NOT NULL');
    expect(sql).toMatch(/report_no = CONCAT\(\s*'Error-', numbering_region_code/);
    expect(sql).not.toContain('UPDATE bod_cod_deviation_reports');
  });

  it('drops only the new constraint, snapshot columns, and sequence table on rollback', async () => {
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
      expect.stringContaining('DROP CONSTRAINT ck_bod_cod_deviation_reports_numbering_snapshot'),
    );
    expect(alterTable).toHaveBeenCalledWith('bod_cod_deviation_reports', expect.any(Function));
    expect(dropColumn).toHaveBeenCalledWith('numbering_region_code');
    expect(dropColumn).toHaveBeenCalledWith('numbering_sequence');
    expect(dropTableIfExists).toHaveBeenCalledWith('bod_cod_deviation_report_sequences');
  });
});
