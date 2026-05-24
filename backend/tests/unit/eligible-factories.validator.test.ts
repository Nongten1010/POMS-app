import { describe, expect, it } from '@jest/globals';
import {
  createEligibleFactorySchema,
  listEligibleFactoryCandidatesQuerySchema,
  listEligibleFactoriesQuerySchema,
} from '../../src/modules/eligible-factories/eligible-factories.validator';

describe('eligible factories validators', () => {
  const validPayload = {
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNoNew: '3-106-33/50สบ',
    factoryRegistrationNoOld: 'รง.4-12345',
    factoryTypeSequence: 'ลำดับหลัก',
    address: '99 หมู่ 1',
    provinceName: 'สมุทรปราการ',
    industrialEstateName: 'นิคมอุตสาหกรรมบางปู',
    coordinates: { latitude: 13.5123456, longitude: 100.6123456 },
    businessActivity: 'ผลิตชิ้นส่วนโลหะ',
    operationStatus: 'แจ้งประกอบแล้ว',
    capitalAmount: 1000000,
    machineryHorsepower: 250,
    productionCapacity: '100 ตัน/วัน',
    wastewaterDischargeInfo: 'มีการระบายน้ำทิ้งออกนอกโรงงาน',
    boilerCount: 2,
    boilerSizeEach: '10 ตัน/ชั่วโมง',
    fuelUsed: 'ก๊าซธรรมชาติ',
    hasEia: true,
    selectedReason: 'มีหม้อน้ำและระบายน้ำทิ้ง',
  };

  it('accepts the required Excel-derived factory fields', () => {
    const result = createEligibleFactorySchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        factoryRegistrationNoNew: validPayload.factoryRegistrationNoNew,
        hasEia: true,
      });
    }
  });

  it('rejects unknown fields', () => {
    const result = createEligibleFactorySchema.safeParse({
      ...validPayload,
      rawSql: 'DROP TABLE factories',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid coordinates', () => {
    const result = createEligibleFactorySchema.safeParse({
      ...validPayload,
      coordinates: { latitude: 99, longitude: 100.6123456 },
    });

    expect(result.success).toBe(false);
  });

  it('normalizes list pagination defaults when requested', () => {
    const result = listEligibleFactoriesQuerySchema.parse({ page: '2' });

    expect(result).toEqual({ page: 2, perPage: 25 });
  });

  it('accepts candidate filters', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.parse({
      search: 'เคมี',
      provinceName: 'พระนครศรีอยุธยา',
      hasEia: 'true',
    });

    expect(result).toEqual({
      search: 'เคมี',
      provinceName: 'พระนครศรีอยุธยา',
      hasEia: true,
    });
  });

  it('accepts candidate pagination', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.parse({
      page: '3',
      perPage: '50',
    });

    expect(result).toEqual({ page: 3, perPage: 50 });
  });
});
