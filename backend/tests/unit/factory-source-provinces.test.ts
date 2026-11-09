import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: jest.fn(),
  factorySourceTableName: () => 'dbo.fac_import',
}));

import { db } from '../../src/config/database';
import { factorySourceDb } from '../../src/config/factory-source-database';
import { resolveFactorySourceProvinces } from '../../src/shared/services/factory-source-provinces';

const source = factorySourceDb as unknown as jest.Mock<(tableName: string) => unknown>;

describe('resolveFactorySourceProvinces', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(db).mockReturnValue({
      select: async () => [
        { id: '1000', name_th: 'กรุงเทพมหานคร' },
        { id: '1074', name_th: 'สมุทรสาคร' },
        { id: '1021', name_th: 'ระยอง' },
      ],
    } as never);
  });

  function sourceRows(rows: Array<{ FID: string; PROV: string | number | null }>) {
    const whereIn = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    source.mockReturnValue({ whereIn, select, timeout: async () => rows } as never);
    return whereIn;
  }

  it('maps actual source PROV through province master, including genuine Bangkok', async () => {
    const whereIn = sourceRows([
      { FID: 'F1', PROV: 74 },
      { FID: 'F2', PROV: '21' },
      { FID: 'F3', PROV: 10 },
    ]);
    const result = await resolveFactorySourceProvinces(['F1', 'F2', 'F3', 'F1']);
    expect([...result.values()].map((p) => p.provinceId)).toEqual(['1074', '1021', '1000']);
    expect(whereIn).toHaveBeenCalledWith('FID', ['F1', 'F2', 'F3']);
  });

  it.each([
    { rows: [] },
    { rows: [{ FID: 'F1', PROV: null }] },
    { rows: [{ FID: 'F1', PROV: 99 }] },
    {
      rows: [
        { FID: 'F1', PROV: 74 },
        { FID: 'F1', PROV: 21 },
      ],
    },
  ])('rejects missing, invalid or ambiguous source data without guessing: %j', async ({ rows }) => {
    sourceRows(rows);
    await expect(resolveFactorySourceProvinces(['F1'])).rejects.toMatchObject({
      statusCode: 503,
      code: 'FACTORY_PROVINCE_UNAVAILABLE',
    });
  });

  it('does not expose a database failure or its credentials', async () => {
    source.mockImplementation(() => {
      throw new Error('sensitive database connection detail');
    });
    await expect(resolveFactorySourceProvinces(['F1'])).rejects.toMatchObject({
      statusCode: 503,
      code: 'FACTORY_PROVINCE_UNAVAILABLE',
      message: 'Factory province could not be verified with DIW. Please try again later.',
    });
  });

  it('does not query the source when there are no factories', async () => {
    expect(await resolveFactorySourceProvinces([])).toEqual(new Map());
    expect(source).not.toHaveBeenCalled();
  });
});
