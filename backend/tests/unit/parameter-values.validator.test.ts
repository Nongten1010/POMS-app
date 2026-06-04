import { describe, expect, it } from '@jest/globals';
import {
  latestParameterValueQuerySchema,
  listParameterValuesQuerySchema,
} from '../../src/modules/parameter-values/parameter-values.validator';

describe('parameter value validators', () => {
  it('accepts a station and interval query with pagination defaults', () => {
    const result = listParameterValuesQuerySchema.parse({
      stationId: 'S0001',
      interval: 'real',
    });

    expect(result).toEqual({
      stationId: 'S0001',
      interval: 'real',
      limit: 100,
      offset: 0,
    });
  });

  it('coerces bounded pagination values', () => {
    const result = listParameterValuesQuerySchema.parse({
      stationId: 'S0001',
      interval: '1m',
      limit: '25',
      offset: '50',
    });

    expect(result).toMatchObject({
      limit: 25,
      offset: 50,
    });
  });

  it('rejects unsafe station fragments before table name construction', () => {
    const result = listParameterValuesQuerySchema.safeParse({
      stationId: 'S0001];DROP TABLE users;--',
      interval: 'real',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported intervals', () => {
    const result = listParameterValuesQuerySchema.safeParse({
      stationId: 'S0001',
      interval: '15m',
    });

    expect(result.success).toBe(false);
  });

  it('builds the latest query as a one-row read', () => {
    const result = latestParameterValueQuerySchema.parse({
      stationId: 'S0001',
      interval: '5m',
    });

    expect(result).toEqual({
      stationId: 'S0001',
      interval: '5m',
      limit: 1,
      offset: 0,
    });
  });
});
