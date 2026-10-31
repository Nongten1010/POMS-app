import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockSourceDb = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSourceDb,
  factorySourceTableName: () => 'dbo.fac_import',
}));

import {
  normalizeFactoryAreaNamesForRead,
  normalizeFactoryAreaNamesForWrite,
} from '../../src/modules/eligible-factories/factory-area-names';
import {
  hasNumericFactoryAddressAreas,
  withoutNumericFactoryAddressAreas,
} from '../../src/modules/eligible-factories/factory-address';

const numericAddress = '7/507 หมู่ 6 ตำบล5 อำเภอ6 จังหวัดระยอง 21140 (ประตู 2)';
const readableAddress = '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140 (ประตู 2)';
const master = { PROV: 21, AMP: 6, TUMBOL: 5, TUMNAME: 'มาบยางพร', AMPNAME: 'ปลวกแดง' };
const factory = {
  FID: '82250600225587',
  FACREG: '82250600225587',
  DISPFACREG: 'น.88',
  PROV: 21,
  AMP: 6,
  TUMBOL: 5,
};
let areas: unknown[];
let sources: unknown[];
let failure: boolean;
function query(rows: unknown[]) {
  return {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    timeout: jest.fn().mockReturnThis(),
    select: jest.fn(async () => {
      if (failure) throw new Error('source unavailable');
      return rows;
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  areas = [master];
  sources = [factory];
  failure = false;
  mockSourceDb.mockImplementation((table) =>
    query(String(table).endsWith('.TUMBOL') ? areas : sources),
  );
});

describe.each(['legacy', 'canonical'])('shared area names in %s mode', (mode) => {
  beforeEach(() => {
    mockEnv.FACTORY_PROFILE_MODE = mode;
  });

  it('normalizes numeric labels and name fields, preserving street details and code fields', async () => {
    const input = {
      address: numericAddress,
      provinceName: 'ระยอง',
      districtCode: '6',
      districtName: '6',
      subdistrictCode: '5',
      subdistrictName: '5',
      custom: 123,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      address: readableAddress,
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    });
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
  });

  it('preserves readable text and canonical nulls without querying a source', async () => {
    const input = {
      address: readableAddress,
      districtCode: '6',
      subdistrictCode: '5',
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toBe(input);
    expect(
      await normalizeFactoryAreaNamesForWrite({
        address: null,
        districtName: null,
        subdistrictName: null,
      }),
    ).toEqual({ address: null, districtName: null, subdistrictName: null });
    expect(mockSourceDb).not.toHaveBeenCalled();
  });

  it('uses recorded codes rather than the current location of a moved factory', async () => {
    sources = [{ ...factory, PROV: 10, AMP: 1, TUMBOL: 1 }];
    const input = { factoryId: factory.FID, address: numericAddress, provinceName: 'ระยอง' };
    expect((await normalizeFactoryAreaNamesForWrite(input)).address).toBe(readableAddress);
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
    expect(mockSourceDb).toHaveBeenCalledWith('dbo.TUMBOL');
  });

  it('preserves internal POMS province IDs while resolving by the recorded province name', async () => {
    const input = {
      address: numericAddress,
      provinceCode: '1021',
      provinceName: 'ระยอง',
      districtName: '6',
      subdistrictName: '5',
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      address: readableAddress,
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    });
    expect((await normalizeFactoryAreaNamesForRead([input]))[0].provinceCode).toBe('1021');
  });

  it('resolves missing province context from the exact factory identity', async () => {
    const input = { factoryId: factory.FID, address: '7/507 หมู่ 6 ตำบล5 อำเภอ6 21140' };
    expect((await normalizeFactoryAreaNamesForWrite(input)).address).toBe(
      '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง 21140',
    );
    expect(mockSourceDb).toHaveBeenCalledTimes(2);
  });

  it('does not mistake a stale source ID for another factory registration number', async () => {
    sources = [{ ...factory, FID: 'other-factory', FACREG: 'stale-fid', PROV: 10 }, factory];
    const result = await normalizeFactoryAreaNamesForWrite({
      sourceFactoryId: 'stale-fid',
      factoryRegistrationNoNew: factory.FID,
      address: 'ตำบล5 อำเภอ6',
    });
    expect(result.address).toBe('ตำบลมาบยางพร อำเภอปลวกแดง');
  });

  it('rejects conflicting strong source identity and registration instead of choosing either factory', async () => {
    sources = [
      factory,
      { ...factory, FID: 'different-factory', FACREG: 'different-registration', PROV: 10 },
    ];
    await expect(
      normalizeFactoryAreaNamesForWrite({
        sourceFactoryId: factory.FID,
        factoryRegistrationNoNew: 'different-registration',
        address: 'ตำบล5 อำเภอ6',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects embedded readable-name conflicts and corrupt numeric master labels', async () => {
    await expect(
      normalizeFactoryAreaNamesForWrite({
        address: 'ตำบล5 อำเภอเมืองระยอง จังหวัดระยอง',
        districtCode: '6',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      (
        await normalizeFactoryAreaNamesForRead([
          { address: 'ตำบล5 อำเภอเมืองระยอง จังหวัดระยอง', districtCode: '6' },
        ])
      )[0].address,
    ).toBe('อำเภอเมืองระยอง จังหวัดระยอง');
    expect(
      (await normalizeFactoryAreaNamesForWrite({ address: 'ตำบล5 อำเภอปลวกแดง จังหวัดระยอง' }))
        .address,
    ).toBe('ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง');
    areas = [{ ...master, TUMNAME: 'ตำบล5' }];
    await expect(
      normalizeFactoryAreaNamesForWrite({ address: numericAddress }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects mismatched area codes instead of guessing another district', async () => {
    await expect(
      normalizeFactoryAreaNamesForWrite({
        address: numericAddress,
        provinceName: 'ระยอง',
        districtCode: '9',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      details: { path: 'address', reason: 'UNRESOLVED_ADMINISTRATIVE_AREA' },
    });
  });

  it('rejects unknown and ambiguous master names', async () => {
    areas = [];
    await expect(
      normalizeFactoryAreaNamesForWrite({ address: numericAddress }),
    ).rejects.toMatchObject({ statusCode: 400 });
    areas = [master, { ...master, TUMNAME: 'ชื่อขัดแย้ง' }];
    await expect(
      normalizeFactoryAreaNamesForWrite({ address: numericAddress }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('never accepts Thai digits as human-readable master names', async () => {
    areas = [{ ...master, AMPNAME: '๖', TUMNAME: '๕' }];
    await expect(
      normalizeFactoryAreaNamesForWrite({ address: numericAddress }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await normalizeFactoryAreaNamesForRead([{ address: numericAddress }]))[0].address).toBe(
      '7/507 หมู่ 6 จังหวัดระยอง 21140 (ประตู 2)',
    );
  });

  it('rejects source outages before a write and suppresses numeric display names on reads', async () => {
    failure = true;
    const input = {
      address: numericAddress,
      provinceName: 'ระยอง',
      districtName: '6',
      subdistrictName: '5',
    };
    await expect(normalizeFactoryAreaNamesForWrite(input)).rejects.toMatchObject({
      statusCode: 503,
      code: 'FACTORY_AREA_LOOKUP_UNAVAILABLE',
    });
    expect(await normalizeFactoryAreaNamesForRead([input])).toEqual([
      {
        ...input,
        address: '7/507 หมู่ 6 จังหวัดระยอง 21140 (ประตู 2)',
        districtName: null,
        subdistrictName: null,
      },
    ]);
  });

  it('normalizes Thai digits, abbreviated labels, Bangkok labels, and full administrative codes', async () => {
    const input = {
      address: '7/507 หมู่ ๖ ต.๕ อ.๖ จังหวัดระยอง 21140 (ประตู 2)',
      districtName: '๖',
      subdistrictName: '๕',
    };
    expect((await normalizeFactoryAreaNamesForWrite(input)).address).toBe(
      '7/507 หมู่ ๖ ต.มาบยางพร อ.ปลวกแดง จังหวัดระยอง 21140 (ประตู 2)',
    );
    expect(
      (await normalizeFactoryAreaNamesForWrite({ address: 'ตำบล210605 อำเภอ2106 จังหวัดระยอง' }))
        .address,
    ).toBe('ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง');
    areas = [{ PROV: 10, AMP: 9, TUMBOL: 10, AMPNAME: 'พระโขนง', TUMNAME: 'พระโขนงใต้' }];
    expect(
      (
        await normalizeFactoryAreaNamesForWrite({
          address: '210 หมู่ 1 แขวง๑๐ เขต๙ กรุงเทพมหานคร 10260',
        })
      ).address,
    ).toBe('210 หมู่ 1 แขวงพระโขนงใต้ เขตพระโขนง กรุงเทพมหานคร 10260');
  });

  it('normalizes prefixed numeric names and adjacent administrative labels', async () => {
    expect(
      await normalizeFactoryAreaNamesForWrite({
        provinceName: 'ระยอง',
        districtName: 'อำเภอ๖',
        subdistrictName: 'ตำบล๕',
      }),
    ).toEqual({ provinceName: 'ระยอง', districtName: 'ปลวกแดง', subdistrictName: 'มาบยางพร' });
    expect(
      (await normalizeFactoryAreaNamesForWrite({ address: 'ตำบล5อำเภอ6จังหวัดระยอง21140' }))
        .address,
    ).toBe('ตำบลมาบยางพรอำเภอปลวกแดงจังหวัดระยอง21140');
    expect(
      (await normalizeFactoryAreaNamesForWrite({ address: 'ต.๕อ.๖จังหวัดระยอง21140' })).address,
    ).toBe('ต.มาบยางพรอ.ปลวกแดงจังหวัดระยอง21140');
    await expect(
      normalizeFactoryAreaNamesForWrite({ provinceName: 'ระยอง', districtName: 'ตำบล5' }),
    ).rejects.toMatchObject({ statusCode: 400, details: { path: 'districtName' } });
  });

  it('resolves a numeric district field alone without guessing any subdistrict field', async () => {
    areas = [master, { ...master, TUMBOL: 6, TUMNAME: 'ตำบลอื่น' }];
    expect(
      await normalizeFactoryAreaNamesForWrite({ provinceName: 'ระยอง', districtName: '6' }),
    ).toEqual({ provinceName: 'ระยอง', districtName: 'ปลวกแดง' });
  });

  it('rejects conflicting province/name context and readable names conflicting with numeric labels', async () => {
    await expect(
      normalizeFactoryAreaNamesForWrite({ address: numericAddress, provinceName: 'น่าน' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      normalizeFactoryAreaNamesForWrite({ address: numericAddress, districtName: 'เมืองระยอง' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('batches rows into one master lookup without modifying numeric codes', async () => {
    const inputs = Array.from({ length: 20 }, (_, id) => ({
      id,
      address: numericAddress,
      districtCode: '6',
      subdistrictCode: '5',
    }));
    const result = await normalizeFactoryAreaNamesForRead(inputs);
    expect(result).toHaveLength(20);
    expect(
      result.every(
        (x) => x.address === readableAddress && x.districtCode === '6' && x.subdistrictCode === '5',
      ),
    ).toBe(true);
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
  });

  it('does not return a numeric-only name when identity and location cannot be verified', async () => {
    const input = { districtName: '6', subdistrictName: '5', address: '7/507 หมู่ 6 21140' };
    await expect(normalizeFactoryAreaNamesForWrite(input)).rejects.toMatchObject({
      statusCode: 400,
      details: { path: 'districtName' },
    });
    expect(await normalizeFactoryAreaNamesForRead([input])).toEqual([
      { ...input, districtName: null, subdistrictName: null },
    ]);
  });
});

it('does not confuse house numbers, postal codes or road names with area codes', () => {
  expect(hasNumericFactoryAddressAreas('7/507 หมู่ 6 ซอย 5 ถนน 6 ระยอง 21140 (ประตู 2)')).toBe(
    false,
  );
  expect(hasNumericFactoryAddressAreas('ตำบลชื่อจริง อำเภอชื่อจริง')).toBe(false);
  expect(withoutNumericFactoryAddressAreas('7/507 ต.๕ อ.๖ 21140')).toBe('7/507 21140');
});

describe.each(['legacy', 'canonical'])('street word boundaries in %s mode', (mode) => {
  beforeEach(() => {
    mockEnv.FACTORY_PROFILE_MODE = mode;
  });

  it('preserves Thai vowels inside street names without a master lookup', async () => {
    const input = { address: '7/507 ซอยเอ.6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140' };
    expect(hasNumericFactoryAddressAreas(input.address)).toBe(false);
    expect(await normalizeFactoryAreaNamesForWrite(input)).toBe(input);
    expect(mockSourceDb).not.toHaveBeenCalled();
  });

  it('repairs genuine adjacent Thai-digit labels while preserving the street name', async () => {
    const input = { address: '7/507 ซอยเอ.6 ต.๕อ.๖ จังหวัดระยอง 21140', provinceName: 'ระยอง' };
    const result = await normalizeFactoryAreaNamesForWrite(input);
    expect(result.address).toBe('7/507 ซอยเอ.6 ต.มาบยางพรอ.ปลวกแดง จังหวัดระยอง 21140');
    expect(input.address).toBe('7/507 ซอยเอ.6 ต.๕อ.๖ จังหวัดระยอง 21140');
  });

  it('preserves the street name when suppressing unresolved numeric administrative labels', async () => {
    failure = true;
    const [result] = await normalizeFactoryAreaNamesForRead([
      { address: '7/507 ซอยเอ.6 ต.5 อ.6 จังหวัดระยอง 21140', provinceName: 'ระยอง' },
    ]);
    expect(result.address).toBe('7/507 ซอยเอ.6 จังหวัดระยอง 21140');
  });
});

describe.each(['legacy', 'canonical'])('blank factory area names in %s mode', (mode) => {
  beforeEach(() => {
    mockEnv.FACTORY_PROFILE_MODE = mode;
  });

  it('fills present blank names from readable recorded address and preserves machine codes and input', async () => {
    const input = {
      address: readableAddress,
      provinceName: null,
      districtName: '  ',
      subdistrictName: undefined,
      provinceCode: '1021',
      districtCode: null,
      subdistrictCode: null,
    };
    const expected = {
      ...input,
      provinceName: 'ระยอง',
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual(expected);
    expect(await normalizeFactoryAreaNamesForRead([input])).toEqual([expected]);
    expect(input).toEqual({
      address: readableAddress,
      provinceName: null,
      districtName: '  ',
      subdistrictName: undefined,
      provinceCode: '1021',
      districtCode: null,
      subdistrictCode: null,
    });
    expect(mockSourceDb).toHaveBeenCalledTimes(2);
    expect(mockSourceDb).not.toHaveBeenCalledWith('dbo.fac_import');
  });

  it('does not add absent name fields or infer historic names from identity alone', async () => {
    const input = { address: readableAddress, factoryId: factory.FID };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toBe(input);
    const unknown = {
      address: '99 หมู่ 1 ซอย 3',
      factoryId: factory.FID,
      provinceCode: '1021',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(unknown)).toBe(unknown);
    expect(await normalizeFactoryAreaNamesForRead([unknown])).toEqual([unknown]);
    expect(mockSourceDb).not.toHaveBeenCalled();
  });

  it('uses recorded names instead of the current location of a moved factory', async () => {
    sources = [{ ...factory, PROV: 10, AMP: 9, TUMBOL: 10 }];
    const input = {
      address: readableAddress,
      factoryId: factory.FID,
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      provinceName: 'ระยอง',
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    });
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
    expect(mockSourceDb).toHaveBeenCalledWith('dbo.TUMBOL');
  });

  it('fills a mapped province alone without querying or guessing district names', async () => {
    const input = {
      address: '99 หมู่ 1',
      provinceCode: '21',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      provinceName: 'ระยอง',
    });
    expect(mockSourceDb).not.toHaveBeenCalled();
  });

  it('resolves full administrative codes with a street-only address', async () => {
    const input = {
      address: '99 หมู่ 1 ซอย 3 21140',
      subdistrictCode: '210605',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      provinceName: 'ระยอง',
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    });
  });

  it('infers the province from verified recorded district and subdistrict names', async () => {
    const input = {
      address: '7/507 ตำบลมาบยางพร อำเภอปลวกแดง 21140',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      provinceName: 'ระยอง',
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    });
  });

  it('supports abbreviated and bare recorded province names', async () => {
    for (const address of [
      'ต.มาบยางพร อ.ปลวกแดง จ.ระยอง 21140',
      'ตำบลมาบยางพร อำเภอปลวกแดง ระยอง 21140',
    ]) {
      const input = { address, provinceName: null, districtName: null, subdistrictName: null };
      expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
        ...input,
        provinceName: 'ระยอง',
        districtName: 'ปลวกแดง',
        subdistrictName: 'มาบยางพร',
      });
    }
  });

  it('fills only names common to all matches and leaves ambiguous subdistrict blank', async () => {
    areas = [master, { ...master, TUMBOL: 6, TUMNAME: 'ตำบลอื่น' }];
    const input = {
      provinceCode: '21',
      districtCode: '6',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      provinceName: 'ระยอง',
      districtName: 'ปลวกแดง',
    });
  });

  it('does not guess ambiguous provinces or fill names contradicting recorded geography', async () => {
    areas = [master, { PROV: 10, AMP: 6, TUMBOL: 5, AMPNAME: 'ปลวกแดง', TUMNAME: 'มาบยางพร' }];
    const ambiguous = { districtCode: '6', subdistrictCode: '5', provinceName: null };
    expect(await normalizeFactoryAreaNamesForWrite(ambiguous)).toBe(ambiguous);
    const conflicting = {
      address: readableAddress,
      provinceName: 'น่าน',
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(conflicting)).toBe(conflicting);
    expect(await normalizeFactoryAreaNamesForRead([conflicting])).toEqual([conflicting]);
    const nameConflict = {
      address: readableAddress,
      provinceName: null,
      districtName: 'เมืองระยอง',
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(nameConflict)).toBe(nameConflict);
  });

  it('preserves readable name fields and every address detail', async () => {
    const input = {
      address: readableAddress,
      districtName: 'ปลวกแดง',
      subdistrictName: null,
      provinceName: 'ระยอง',
      provinceCode: '1021',
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      subdistrictName: 'มาบยางพร',
    });
  });

  it('keeps optional blanks on read or name-only lookup outage', async () => {
    failure = true;
    const input = {
      address: readableAddress,
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForRead([input])).toEqual([input]);
    await expect(normalizeFactoryAreaNamesForWrite(input)).rejects.toMatchObject({
      statusCode: 503,
      code: 'FACTORY_AREA_LOOKUP_UNAVAILABLE',
    });
    const weak = {
      address: 'ตำบลมาบยางพร',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(weak)).toBe(weak);
  });

  it('rejects code-backed write outages rather than persisting resolvable blank names', async () => {
    failure = true;
    const input = {
      provinceCode: '21',
      districtCode: '6',
      subdistrictCode: '5',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    await expect(normalizeFactoryAreaNamesForWrite(input)).rejects.toMatchObject({
      statusCode: 503,
      code: 'FACTORY_AREA_LOOKUP_UNAVAILABLE',
    });
    expect(await normalizeFactoryAreaNamesForRead([input])).toEqual([input]);
    await expect(
      normalizeFactoryAreaNamesForWrite({
        subdistrictCode: '210605',
        provinceName: null,
        districtName: null,
        subdistrictName: null,
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it('batches blank-name rows into one master lookup', async () => {
    const input = Array.from({ length: 20 }, (_, id) => ({
      id,
      address: readableAddress,
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    }));
    const result = await normalizeFactoryAreaNamesForRead(input);
    expect(
      result.every(
        (x) =>
          x.provinceName === 'ระยอง' &&
          x.districtName === 'ปลวกแดง' &&
          x.subdistrictName === 'มาบยางพร',
      ),
    ).toBe(true);
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
  });

  it('does not parse industrial-estate and street เขต descriptions as administrative district names', async () => {
    areas = [
      { PROV: 21, AMP: 1, TUMBOL: 3, AMPNAME: 'เมืองระยอง', TUMNAME: 'ตะพง' },
      { PROV: 25, AMP: 2, TUMBOL: 11, AMPNAME: 'กบินทร์บุรี', TUMNAME: 'หนองกี่' },
    ];
    for (const [address, provinceName, districtName, subdistrictName] of [
      [
        '140/6 หมู่4 ซอยเขตประกอบการฯ ทีพีไอ ถนนสุขุมวิท ตำบลตะพง อำเภอเมืองระยอง จังหวัดระยอง21000',
        'ระยอง',
        'เมืองระยอง',
        'ตะพง',
      ],
      [
        '444(เขตอุตสาหกรรมกบินทร์บุรี) หมู่9 ตำบลหนองกี่ อำเภอกบินทร์บุรี จังหวัดปราจีนบุรี25110',
        'ปราจีนบุรี',
        'กบินทร์บุรี',
        'หนองกี่',
      ],
    ]) {
      const input = { address, provinceName: null, districtName: null, subdistrictName: null };
      expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
        ...input,
        provinceName,
        districtName,
        subdistrictName,
      });
    }
  });
});

describe.each(['legacy', 'canonical'])('literal district-word suffixes in %s mode', (mode) => {
  beforeEach(() => {
    mockEnv.FACTORY_PROFILE_MODE = mode;
  });
  it('preserves เขต inside official subdistrict names instead of treating the suffix as a label', async () => {
    areas = [
      { PROV: 24, AMP: 1, TUMBOL: 17, AMPNAME: 'เมืองฉะเชิงเทรา', TUMNAME: 'คลองนครเนื่องเขต' },
      { PROV: 31, AMP: 23, TUMBOL: 2, AMPNAME: 'เฉลิมพระเกียรติ', TUMNAME: 'อีสานเขต' },
    ];
    for (const [address, provinceName, districtName, subdistrictName] of [
      [
        'ตำบลคลองนครเนื่องเขต อำเภอเมืองฉะเชิงเทรา จังหวัดฉะเชิงเทรา',
        'ฉะเชิงเทรา',
        'เมืองฉะเชิงเทรา',
        'คลองนครเนื่องเขต',
      ],
      [
        'ตำบลอีสานเขต อำเภอเฉลิมพระเกียรติ จังหวัดบุรีรัมย์',
        'บุรีรัมย์',
        'เฉลิมพระเกียรติ',
        'อีสานเขต',
      ],
    ]) {
      const input = { address, provinceName: null, districtName: null, subdistrictName: null };
      const expected = { ...input, provinceName, districtName, subdistrictName };
      expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual(expected);
      expect(await normalizeFactoryAreaNamesForRead([input])).toEqual([expected]);
    }
  });
  it('still reads real boundary-delimited Bangkok แขวง and เขต labels', async () => {
    areas = [{ PROV: 10, AMP: 9, TUMBOL: 10, AMPNAME: 'พระโขนง', TUMNAME: 'พระโขนงใต้' }];
    const input = {
      address: '210 ซอยสุขุมวิท 64 แขวงพระโขนงใต้ เขตพระโขนง กรุงเทพมหานคร 10260',
      provinceName: null,
      districtName: null,
      subdistrictName: null,
    };
    expect(await normalizeFactoryAreaNamesForWrite(input)).toEqual({
      ...input,
      provinceName: 'กรุงเทพมหานคร',
      districtName: 'พระโขนง',
      subdistrictName: 'พระโขนงใต้',
    });
  });
});
