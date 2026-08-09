import { describe, expect, it } from '@jest/globals';
import {
  connectionTestQuerySchema,
  latestParameterValueQuerySchema,
  listParameterValuesQuerySchema,
  measurementCsvExportQuerySchema,
} from '../../src/modules/parameter-values/parameter-values.validator';

describe('parameter value validators', () => {
  it('accepts a station and interval query with a date range', () => {
    const result = listParameterValuesQuerySchema.parse({
      stationId: 'S0001',
      interval: 'real',
      startDate: '2026-06-04',
      endDate: '2026-06-04',
    });

    expect(result).toEqual({
      stationId: 'S0001',
      interval: 'real',
      startDate: '2026-06-04',
      endDate: '2026-06-04',
    });
  });

  it.each(['CEMS-0001/2569', 'WEMS-0003/2571'])(
    'accepts annual point code %s as a safe station identifier',
    (stationId) => {
      const result = connectionTestQuerySchema.parse({ stationId });

      expect(result).toEqual({ stationId });
    },
  );

  it('rejects pagination values because list reads use date ranges', () => {
    const result = listParameterValuesQuerySchema.safeParse({
      stationId: 'S0001',
      interval: '1m',
      limit: '25',
      offset: '50',
      startDate: '2026-06-04',
      endDate: '2026-06-04',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid date ranges', () => {
    const result = listParameterValuesQuerySchema.safeParse({
      stationId: 'S0001',
      interval: '1m',
      startDate: '2026-06-05',
      endDate: '2026-06-04',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsafe station fragments before table name construction', () => {
    const result = listParameterValuesQuerySchema.safeParse({
      stationId: 'S0001];DROP TABLE users;--',
      interval: 'real',
      startDate: '2026-06-04',
      endDate: '2026-06-04',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported intervals', () => {
    const result = listParameterValuesQuerySchema.safeParse({
      stationId: 'S0001',
      interval: '15m',
      startDate: '2026-06-04',
      endDate: '2026-06-04',
    });

    expect(result.success).toBe(false);
  });

  it('builds the latest query without date range or pagination', () => {
    const result = latestParameterValueQuerySchema.parse({
      stationId: 'S0001',
      interval: '5m',
    });

    expect(result).toEqual({
      stationId: 'S0001',
      interval: '5m',
    });
  });

  it('builds a connection test query with only the station id', () => {
    const result = connectionTestQuerySchema.parse({
      stationId: 'S0001',
    });

    expect(result).toEqual({
      stationId: 'S0001',
    });
  });

  it('rejects unsafe station ids for connection test table names', () => {
    const result = connectionTestQuerySchema.safeParse({
      stationId: 'S0001;DROP',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an hourly CSV export query with repeated parameter labels', () => {
    const result = measurementCsvExportQuerySchema.parse({
      frequency: 'hourly',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      parameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
    });

    expect(result).toEqual({
      frequency: 'hourly',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      parameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
    });
  });

  it('rejects hourly CSV export ranges longer than 366 inclusive days', () => {
    const result = measurementCsvExportQuerySchema.safeParse({
      frequency: 'hourly',
      startDate: '2026-01-01',
      endDate: '2027-01-02',
      parameters: 'all',
    });

    expect(result.success).toBe(false);
  });

  it('allows at most ten calendar years for daily CSV exports', () => {
    const parse = (endDate: string) =>
      measurementCsvExportQuerySchema.safeParse({
        frequency: 'daily',
        startDate: '2026-01-01',
        endDate,
        parameters: 'all',
      }).success;

    expect([parse('2035-12-31'), parse('2036-01-01')]).toEqual([true, false]);
  });

  it('rejects calendar dates that match the shape but do not exist', () => {
    const result = measurementCsvExportQuerySchema.safeParse({
      frequency: 'hourly',
      startDate: '2026-02-31',
      endDate: '2026-02-31',
      parameters: 'all',
    });

    expect(result.success).toBe(false);
  });
});
