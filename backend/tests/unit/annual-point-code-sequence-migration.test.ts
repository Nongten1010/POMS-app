import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0080_create_annual_point_code_sequences';

describe('annual point-code sequence migration', () => {
  it('creates an annual sequence table without rewriting historical point codes', async () => {
    const specificType = jest.fn();
    const primary = jest.fn();
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const createTable = jest.fn(
      async (_tableName: string, callback: (table: unknown) => void) => {
        callback({ specificType, primary });
      },
    );
    const knex = {
      schema: { createTable, raw },
    } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(createTable).toHaveBeenCalledWith(
      'cems_wpms_annual_point_code_sequences',
      expect.any(Function),
    );
    expect(specificType).toHaveBeenNthCalledWith(1, 'system_type', 'VARCHAR(8) NOT NULL');
    expect(specificType).toHaveBeenNthCalledWith(2, 'buddhist_year', 'CHAR(4) NOT NULL');
    expect(specificType).toHaveBeenNthCalledWith(
      3,
      'last_sequence',
      expect.stringContaining('DEFAULT 0'),
    );
    expect(primary).toHaveBeenCalledWith(['system_type', 'buddhist_year'], {
      constraintName: 'pk_cems_wpms_annual_point_code_sequences',
    });

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("system_type IN ('CEMS', 'WPMS')");
    expect(sql).toContain("buddhist_year LIKE '[0-9][0-9][0-9][0-9]'");
    expect(sql).toContain('last_sequence >= 0');
    expect(sql).not.toContain('cems_wpms_measurement_points');
    expect(sql).not.toContain('UPDATE cems_wpms_point_code_sequences');
  });

  it('drops only the annual sequence table on rollback', async () => {
    const dropTableIfExists = jest.fn().mockResolvedValue(undefined as never);
    const knex = {
      schema: { dropTableIfExists },
    } as unknown as Knex;

    await down(knex);

    expect(dropTableIfExists).toHaveBeenCalledWith('cems_wpms_annual_point_code_sequences');
  });
});
