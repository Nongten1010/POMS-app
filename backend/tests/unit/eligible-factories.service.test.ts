import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    findByRegistrationNoNew: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
  },
}));

import { ConflictError } from '../../src/shared/errors/AppError';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { eligibleFactoriesService } from '../../src/modules/eligible-factories/eligible-factories.service';
import type { CreateEligibleFactoryInput } from '../../src/modules/eligible-factories/eligible-factories.types';

const mockedRepository = jest.mocked(eligibleFactoriesRepository);

describe('eligibleFactoriesService', () => {
  const payload: CreateEligibleFactoryInput = {
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNoNew: '3-106-33/50สบ',
    provinceName: 'สมุทรปราการ',
    businessActivity: 'ผลิตชิ้นส่วนโลหะ',
    operationStatus: 'แจ้งประกอบแล้ว',
    hasEia: false,
    selectedReason: 'เข้าข่ายตามเงื่อนไขระบบ',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an eligible factory selection with the actor user id', async () => {
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      sourceSystem: 'external_factory_db',
      sourceFactoryId: null,
      factoryRegistrationNoNew: payload.factoryRegistrationNoNew,
      factoryRegistrationNoOld: null,
      factoryName: payload.factoryName,
      factoryTypeSequence: null,
      address: null,
      provinceName: payload.provinceName,
      industrialEstateName: null,
      coordinates: null,
      businessActivity: 'ผลิตชิ้นส่วนโลหะ',
      operationStatus: payload.operationStatus,
      capitalAmount: null,
      machineryHorsepower: null,
      productionCapacity: null,
      wastewaterDischargeInfo: null,
      boilerCount: null,
      boilerSizeEach: null,
      fuelUsed: null,
      hasEia: false,
      selectedReason: 'เข้าข่ายตามเงื่อนไขระบบ',
      selectedBy: 42,
      selectedAt: '2026-05-24T14:00:00.000Z',
      createdAt: '2026-05-24T14:00:00.000Z',
      updatedAt: '2026-05-24T14:00:00.000Z',
    });

    const result = await eligibleFactoriesService.create(payload, 42);

    expect(mockedRepository.create).toHaveBeenCalledWith(payload, 42);
    expect(result.factoryRegistrationNoNew).toBe(payload.factoryRegistrationNoNew);
  });

  it('returns mock candidates from the external factory source', async () => {
    const result = await eligibleFactoriesService.listCandidates({});

    expect(result.meta).toEqual({
      total: 60000,
      page: 1,
      perPage: 25,
      totalPages: 2400,
      source: 'mock',
    });
    expect(result.data).toHaveLength(25);
  });

  it('filters mock candidates by province and EIA flag', async () => {
    const result = await eligibleFactoriesService.listCandidates({
      provinceName: 'ระยอง',
      hasEia: true,
      perPage: 100,
    });

    expect(result.meta.total).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((factory) => factory.provinceName === 'ระยอง')).toBe(true);
    expect(result.data.every((factory) => factory.hasEia === true)).toBe(true);
  });

  it('paginates mock candidates', async () => {
    const result = await eligibleFactoriesService.listCandidates({
      page: 2,
      perPage: 10,
    });

    expect(result.meta).toMatchObject({
      total: 60000,
      page: 2,
      perPage: 10,
      totalPages: 6000,
    });
    expect(result.data).toHaveLength(10);
    expect(result.data[0]).toMatchObject({
      sourceFactoryId: 'mock-factory-000011',
    });
  });

  it('searches mock candidates across factory fields', async () => {
    const result = await eligibleFactoriesService.listCandidates({
      search: 'ระยองพาวเวอร์บอยเลอร์',
      perPage: 5,
    });

    expect(result.meta.total).toBeGreaterThan(0);
    expect(result.data[0]).toMatchObject({
      factoryName: expect.stringContaining('ระยองพาวเวอร์บอยเลอร์'),
      provinceName: 'ระยอง',
    });
  });

  it('rejects duplicate active selections by new factory registration number', async () => {
    mockedRepository.findByRegistrationNoNew.mockResolvedValue({
      id: 99,
      factoryRegistrationNoNew: payload.factoryRegistrationNoNew,
    });

    await expect(eligibleFactoriesService.create(payload, 42)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(mockedRepository.create).not.toHaveBeenCalled();
  });
});
