import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    findByRegistrationNoNew: jest.fn(),
    findByMonitoringPointFormId: jest.fn(),
    attachMonitoringPointForm: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    softDelete: jest.fn(),
  },
}));

jest.mock('../../src/modules/eligible-factories/eligible-factory-candidates.repository', () => ({
  eligibleFactoryCandidatesRepository: {
    list: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factory-source-hydration', () => ({
  resolveEligibleFactoryAddressForStorage: jest.fn(
    async (input: { address?: string | null }) => input.address,
  ),
}));

import { ConflictError } from '../../src/shared/errors/AppError';
import { eligibleFactoryCandidatesRepository } from '../../src/modules/eligible-factories/eligible-factory-candidates.repository';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { eligibleFactoriesService } from '../../src/modules/eligible-factories/eligible-factories.service';
import { resolveEligibleFactoryAddressForStorage } from '../../src/modules/eligible-factories/eligible-factory-source-hydration';
import type { CreateEligibleFactoryInput } from '../../src/modules/eligible-factories/eligible-factories.types';

const mockedRepository = jest.mocked(eligibleFactoriesRepository);
const mockedCandidatesRepository = jest.mocked(eligibleFactoryCandidatesRepository);
const mockedResolveAddress = jest.mocked(resolveEligibleFactoryAddressForStorage);

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
      monitoringPointFormId: null,
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

  it('resolves numeric administrative labels before direct eligible-factory create', async () => {
    const numericAddress = '4 หมู่ 6 ตำบล10 อำเภอ4 24130';
    const resolvedAddress = '4 หมู่ 6 ตำบลท่าข้าม อำเภอบางปะกง 24130';
    const numericPayload = {
      ...payload,
      sourceFactoryId: '10240000325407',
      factoryRegistrationNoNew: '10240000325407',
      address: numericAddress,
    };
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedResolveAddress.mockResolvedValueOnce(resolvedAddress);
    mockedRepository.create.mockResolvedValue({ address: resolvedAddress } as never);

    await eligibleFactoriesService.create(numericPayload, 42);

    expect(mockedRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ address: resolvedAddress }),
      42,
    );
  });

  it('does not persist unresolved numeric labels from direct eligible-factory create', async () => {
    const numericPayload = {
      ...payload,
      sourceFactoryId: '10240000325407',
      factoryRegistrationNoNew: '10240000325407',
      address: '4 หมู่ 6 ตำบล10 อำเภอ4 24130',
    };
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedResolveAddress.mockResolvedValueOnce(undefined);
    mockedRepository.create.mockResolvedValue({ address: null } as never);

    await eligibleFactoriesService.create(numericPayload, 42);

    expect(mockedRepository.create.mock.calls[0]?.[0].address).toBeUndefined();
  });

  it('removes an eligible factory selection by id with the actor user id', async () => {
    mockedRepository.softDelete.mockResolvedValue(true);

    await eligibleFactoriesService.remove(12, 42);

    expect(mockedRepository.softDelete).toHaveBeenCalledWith(12, 42);
  });

  it('lists selected eligible factories with the same fields as candidate rows plus id', async () => {
    mockedRepository.list.mockResolvedValue({
      rows: [
        {
          id: 1,
          sourceSystem: 'diw.fac_import',
          sourceFactoryId: '10550000125197',
          monitoringPointFormId: null,
          factoryRegistrationNoNew: '10550000125197',
          factoryRegistrationNoOld: '3-1-1/19นน',
          factoryName: 'ห้างหุ้นส่วนสามัญ สถานีบ่มใบยาสบหนอง',
          factoryTypeSequence: null,
          address: '189 หมู่ 10 ถนนวรนคร',
          provinceName: 'น่าน',
          industrialEstateName: null,
          coordinates: {
            latitude: 0,
            longitude: 0,
          },
          businessActivity: 'บ่มใบยาสูบ',
          operationStatus: 'แจ้งประกอบแล้ว',
          capitalAmount: null,
          machineryHorsepower: null,
          productionCapacity: '0',
          wastewaterDischargeInfo: null,
          boilerCount: null,
          boilerSizeEach: null,
          fuelUsed: null,
          hasEia: null,
          selectedReason: null,
          selectedBy: 7,
          selectedAt: '2026-05-26T20:18:00.143Z',
          createdAt: '2026-05-26T20:18:00.143Z',
          updatedAt: '2026-05-26T20:18:00.143Z',
          measurementPoints: [
            {
              systemType: 'CEMS',
              pointCode: 'CEMS-1',
              pointName: 'ปล่องหลัก',
              productionUnitType: null,
              productionCapacity: null,
              cemsInstallationRequiredBy: null,
              cemsInstallationRequiredOther: null,
              legalAnnexNo: [],
              accountingConnectionStatus: null,
              eligibleParameters: [],
              exemptedParameters: [],
              connectedParameters: [],
              pendingParameters: [],
              primaryFuel: null,
              primaryFuelOther: null,
              secondaryFuel: null,
              secondaryFuelOther: null,
              details: null,
            },
            {
              systemType: 'WPMS',
              pointCode: 'WPMS-1',
              pointName: 'น้ำทิ้ง',
              productionUnitType: null,
              productionCapacity: null,
              cemsInstallationRequiredBy: null,
              cemsInstallationRequiredOther: null,
              legalAnnexNo: [],
              accountingConnectionStatus: null,
              eligibleParameters: [],
              exemptedParameters: [],
              connectedParameters: [],
              pendingParameters: [],
              primaryFuel: null,
              primaryFuelOther: null,
              secondaryFuel: null,
              secondaryFuelOther: null,
              details: null,
            },
          ],
        },
      ],
      total: 1,
    });

    const result = await eligibleFactoriesService.list({});

    expect(result).toEqual({
      data: [
        {
          id: 1,
          factoryName: 'ห้างหุ้นส่วนสามัญ สถานีบ่มใบยาสบหนอง',
          factoryId: '10550000125197',
          factoryRegistrationNo: '3-1-1/19นน',
          factoryClass: null,
          factorySubclass: null,
          address: '189 หมู่ 10 ถนนวรนคร',
          provinceName: 'น่าน',
          industrialEstateName: null,
          longitude: 0,
          latitude: 0,
          businessActivity: 'บ่มใบยาสูบ',
          operationStatus: 'แจ้งประกอบแล้ว',
          capitalAmount: null,
          machineryHorsepower: null,
          productionCapacity: '0',
          wastewaterDischargeInfo: null,
          boilerCount: null,
          boilerSizeEach: null,
          fuelUsed: null,
          hasEia: null,
          monitoringPointFormId: null,
          measurementPoints: [
            expect.objectContaining({ systemType: 'CEMS', pointCode: 'CEMS-1' }),
            expect.objectContaining({ systemType: 'WPMS', pointCode: 'WPMS-1' }),
          ],
        },
      ],
      meta: { total: 1 },
    });
    expect(Object.keys(result.data[0] ?? {})).toHaveLength(23);
  });

  it('throws not found when removing an unknown eligible factory selection', async () => {
    mockedRepository.softDelete.mockResolvedValue(false);

    await expect(eligibleFactoriesService.remove(999, 42)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns candidates from the external factory source', async () => {
    mockedCandidatesRepository.list.mockResolvedValue({
      data: new Array(60000).fill(null).map((_, index) => ({
        factoryName: `โรงงานจริง ${index + 1}`,
        factoryId: `real-factory-${String(index + 1).padStart(6, '0')}`,
        factoryRegistrationNo: `real-${index + 1}`,
        factoryClass: 'หลัก',
        factorySubclass: 'รอง',
        address: null,
        provinceName: 'ระยอง',
        industrialEstateName: null,
        longitude: null,
        latitude: null,
        businessActivity: null,
        operationStatus: 'แจ้งประกอบแล้ว',
        capitalAmount: null,
        machineryHorsepower: null,
        productionCapacity: null,
        wastewaterDischargeInfo: null,
        boilerCount: null,
        boilerSizeEach: null,
        fuelUsed: null,
        hasEia: null,
      })),
      meta: {
        total: 60000,
        source: 'external',
      },
    });

    const result = await eligibleFactoriesService.listCandidates({});

    expect(mockedCandidatesRepository.list).toHaveBeenCalledWith({});
    expect(result.meta).toEqual({
      total: 60000,
      source: 'external',
    });
    expect(result.data).toHaveLength(60000);
    expect(Object.keys(result.data[0] ?? {})).toHaveLength(20);
  });

  it('rejects duplicate active selections by new factory registration number', async () => {
    mockedRepository.findByRegistrationNoNew.mockResolvedValue({
      id: 99,
      factoryRegistrationNoNew: payload.factoryRegistrationNoNew,
      monitoringPointFormId: null,
    });

    await expect(eligibleFactoriesService.create(payload, 42)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(mockedRepository.create).not.toHaveBeenCalled();
  });
});
