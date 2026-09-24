import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { parameterSourceDb } from '../../src/config/parameter-source-database';
import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('home historical data boundary', () => {
  it.each([
    ['2025-12-29', '2025-12-29'],
    [null, null],
  ] as const)(
    'reads the earliest source date %s without truncating to the selected year',
    async (stored, expected) => {
      jest.spyOn(parameterSourceDb.client, 'runner').mockImplementation((query: unknown) => ({
        run: async () => {
          const sql = (query as Knex.QueryBuilder).toSQL().sql;
          expect(sql).toMatch(/min\(\[cdate\]\)/i);
          expect(sql).toContain('[S0001_data_60m]');
          expect(sql).not.toMatch(/where/i);
          return { cdate: stored };
        },
      }));
      await expect(parameterValuesRepository.earliestMeasurementDate('S0001')).resolves.toBe(
        expected,
      );
    },
  );
});
