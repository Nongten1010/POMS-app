import { describe, expect, it } from '@jest/globals';
import {
  connectionTestQuerySchema,
  latestParameterValueQuerySchema,
  listParameterValuesQuerySchema,
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
});
