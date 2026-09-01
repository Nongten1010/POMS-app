import { describe, expect, it } from '@jest/globals';
import {
  createEligibleFactoryAddRequestSchema,
  createEligibleFactorySchema,
  listEligibleFactoryAddRequestsQuerySchema,
  listEligibleFactoryCandidatesQuerySchema,
  listEligibleFactoriesQuerySchema,
  reviewEligibleFactoryAddRequestSchema,
  sourceFactoryRegistrationNoParamsSchema,
} from '../../src/modules/eligible-factories/eligible-factories.validator';

describe('eligible factories validators', () => {
  const validPayload = {
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryId: '10100302325234',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryClass: 'ลำดับหลัก',
    factorySubclass: 'ลำดับรอง',
    address: '99 หมู่ 1',
    provinceName: 'สมุทรปราการ',
    industrialEstateName: 'นิคมอุตสาหกรรมบางปู',
    longitude: 100.6123456,
    latitude: 13.5123456,
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
  };

  it('accepts the required Excel-derived factory fields', () => {
    const result = createEligibleFactorySchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        sourceFactoryId: validPayload.factoryId,
        factoryRegistrationNoNew: validPayload.factoryRegistrationNo,
        factoryTypeSequence: 'ลำดับหลัก / ลำดับรอง',
        coordinates: {
          latitude: validPayload.latitude,
          longitude: validPayload.longitude,
        },
        hasEia: true,
      });
    }
  });

  it('removes duplicated secondary factory type codes before storing selections', () => {
    const result = createEligibleFactorySchema.safeParse({
      ...validPayload,
      factoryClass: '9200',
      factorySubclass: '200,602,605',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.factoryTypeSequence).toBe('09200 / 00200,00602,00605');
    }
  });

  it('rejects unknown fields', () => {
    const result = createEligibleFactorySchema.safeParse({
      ...validPayload,
      rawSql: 'DROP TABLE factories',
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing candidate fields even when their values may be null', () => {
    const { boilerCount: _boilerCount, ...missingBoilerCount } = validPayload;

    const result = createEligibleFactorySchema.safeParse(missingBoilerCount);

    expect(result.success).toBe(false);
  });

  it('rejects invalid coordinates', () => {
    const result = createEligibleFactorySchema.safeParse({
      ...validPayload,
      latitude: 99,
    });

    expect(result.success).toBe(false);
  });

  it('accepts an empty selected eligible factories list query', () => {
    const result = listEligibleFactoriesQuerySchema.parse({});

    expect(result).toEqual({});
  });

  it('rejects list query params because selected eligible factories only support listing all records', () => {
    const result = listEligibleFactoriesQuerySchema.safeParse({
      page: '1',
      perPage: '25',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an empty candidate query as an all-record request', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.parse({});

    expect(result).toEqual({});
  });

  it('rejects unsupported candidate filters', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.safeParse({
      search: 'เคมี',
      provinceName: 'พระนครศรีอยุธยา',
      hasEia: 'true',
    });

    expect(result.success).toBe(false);
  });

  it('accepts candidate pagination', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.parse({
      page: '3',
      perPage: '50',
    });

    expect(result).toEqual({ page: 3, perPage: 50 });
  });

  it('rejects partial candidate pagination', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.safeParse({
      page: '3',
    });

    expect(result.success).toBe(false);
  });

  it('rejects candidate pagination outside supported bounds', () => {
    const result = listEligibleFactoryCandidatesQuerySchema.safeParse({
      page: '0',
      perPage: '1000',
    });

    expect(result.success).toBe(false);
  });

  it('trims and accepts a source-factory registration number path parameter', () => {
    expect(
      sourceFactoryRegistrationNoParamsSchema.parse({
        factoryRegistrationNo: ' 3-106-33/50สบ ',
      }),
    ).toEqual({ factoryRegistrationNo: '3-106-33/50สบ' });
  });

  it('rejects blank or oversized source-factory registration number path parameters', () => {
    expect(
      sourceFactoryRegistrationNoParamsSchema.safeParse({ factoryRegistrationNo: '   ' }).success,
    ).toBe(false);
    expect(
      sourceFactoryRegistrationNoParamsSchema.safeParse({
        factoryRegistrationNo: 'x'.repeat(65),
      }).success,
    ).toBe(false);
  });

  it('trims and accepts a valid add-factory request', () => {
    expect(
      createEligibleFactoryAddRequestSchema.parse({
        factoryId: ' 10550000125197 ',
        reason: ' ต้องการเข้าระบบ CEMS ',
      }),
    ).toEqual({
      factoryId: '10550000125197',
      reason: 'ต้องการเข้าระบบ CEMS',
    });
  });

  it('rejects blank or oversized add-factory reasons', () => {
    expect(
      createEligibleFactoryAddRequestSchema.safeParse({ factoryId: 'F-1', reason: '   ' }).success,
    ).toBe(false);
    expect(
      createEligibleFactoryAddRequestSchema.safeParse({
        factoryId: 'F-1',
        reason: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
  });

  it('accepts only an optional trimmed search for add-request lists', () => {
    expect(listEligibleFactoryAddRequestsQuerySchema.parse({})).toEqual({});
    expect(
      listEligibleFactoryAddRequestsQuerySchema.parse({
        search: ' โรงงาน A ',
      }),
    ).toEqual({ search: 'โรงงาน A' });
  });

  it('rejects removed add-request status and pagination filters', () => {
    expect(
      listEligibleFactoryAddRequestsQuerySchema.safeParse({ status: 'PENDING_REVIEW' }).success,
    ).toBe(false);
    expect(
      listEligibleFactoryAddRequestsQuerySchema.safeParse({ page: '1', perPage: '20' }).success,
    ).toBe(false);
  });

  it('requires a nonblank officer note for rejection', () => {
    expect(reviewEligibleFactoryAddRequestSchema.safeParse({ decision: 'REJECT' }).success).toBe(
      false,
    );
    expect(
      reviewEligibleFactoryAddRequestSchema.safeParse({
        decision: 'REJECT',
        officerNote: '   ',
      }).success,
    ).toBe(false);
    expect(
      reviewEligibleFactoryAddRequestSchema.parse({
        decision: 'REJECT',
        officerNote: ' ข้อมูลยังไม่เพียงพอ ',
      }),
    ).toEqual({ decision: 'REJECT', officerNote: 'ข้อมูลยังไม่เพียงพอ' });
  });

  it('allows approval without an officer note', () => {
    expect(reviewEligibleFactoryAddRequestSchema.parse({ decision: 'APPROVE' })).toEqual({
      decision: 'APPROVE',
    });
  });
});
