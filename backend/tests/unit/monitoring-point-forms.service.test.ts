import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/monitoring-point-forms/monitoring-point-forms.repository', () => ({
  monitoringPointFormsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    attachMonitoringPointForm: jest.fn(),
    create: jest.fn(),
    findByMonitoringPointFormId: jest.fn(),
    findByRegistrationNoNew: jest.fn(),
  },
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';
import type {
  MonitoringPointFormFactoryInput,
  SaveMonitoringPointFormInput,
} from '../../src/modules/monitoring-point-forms/monitoring-point-forms.types';

const mockedRepository = jest.mocked(monitoringPointFormsRepository);
const mockedEligibleRepository = jest.mocked(eligibleFactoriesRepository);

function toFactoryDTO(factory: MonitoringPointFormFactoryInput) {
  return {
    factoryName: factory.factoryName ?? null,
    factoryRegistrationNoNew: factory.factoryRegistrationNoNew ?? null,
    factoryRegistrationNoOld: factory.factoryRegistrationNoOld ?? null,
    provinceName: factory.provinceName ?? null,
    factoryTypeMain: factory.factoryTypeMain ?? null,
    factoryTypeSub: factory.factoryTypeSub ?? null,
    operationStatus: factory.operationStatus ?? null,
    eiaInfo: factory.eiaInfo ?? null,
    address: factory.address ?? null,
    businessActivity: factory.businessActivity ?? null,
  };
}

function createEligibleFactoryDTO(overrides = {}) {
  return {
    id: 88,
    sourceSystem: 'monitoring_point_forms',
    sourceFactoryId: '1',
    monitoringPointFormId: 1,
    factoryRegistrationNoNew: '10520000225172',
    factoryRegistrationNoOld: '3-1-2/17ลป',
    factoryName: 'สถานีบ่มใบยาสบหนอง',
    factoryTypeSequence: null,
    address: null,
    provinceName: 'ลำปาง',
    industrialEstateName: null,
    coordinates: null,
    businessActivity: null,
    operationStatus: '-',
    capitalAmount: null,
    machineryHorsepower: null,
    productionCapacity: null,
    wastewaterDischargeInfo: null,
    boilerCount: null,
    boilerSizeEach: null,
    fuelUsed: null,
    hasEia: null,
    selectedReason: 'selected_from_monitoring_point_form',
    selectedBy: 42,
    selectedAt: '2026-06-22T00:00:00.000Z',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('monitoringPointFormsService', () => {
  const input: SaveMonitoringPointFormInput = {
    factory: {
      factoryName: 'สถานีบ่มใบยาสบหนอง',
      factoryRegistrationNoNew: '10520000225172',
      factoryRegistrationNoOld: '3-1-2/17ลป',
      provinceName: 'ลำปาง',
    },
    points: [
      {
        systemType: 'CEMS',
        pointCode: 'S0001',
        pointName: 'ปล่องหลัก',
        eligibleParameters: ['NOx (ppm)'],
      },
      {
        systemType: 'WPMS',
        pointCode: 'P0001',
        pointName: 'จุดระบายน้ำทิ้ง',
        eligibleParameters: ['BOD (mg/l)'],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a form when the factory does not already have one', async () => {
    mockedRepository.list.mockResolvedValue([]);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(input.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });

    const result = await monitoringPointFormsService.create(input, 42);

    expect(mockedRepository.list).toHaveBeenCalledWith({
      factoryRegistrationNoNew: '10520000225172',
    });
    expect(mockedRepository.create).toHaveBeenCalledWith(input, 42);
    expect(result.id).toBe(1);
  });

  it('rejects duplicate factory forms so users edit the existing set', async () => {
    mockedRepository.list.mockResolvedValue([
      {
        id: 7,
        factory: toFactoryDTO(input.factory),
        pointCount: 1,
        cemsPointCount: 1,
        wpmsPointCount: 0,
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ]);

    await expect(monitoringPointFormsService.create(input, 42)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mockedRepository.create).not.toHaveBeenCalled();
  });

  it('creates a blank form without duplicate lookup when registration is blank', async () => {
    const blankInput: SaveMonitoringPointFormInput = {
      factory: {
        factoryName: null,
        factoryRegistrationNoNew: null,
      },
      points: [],
    };
    mockedRepository.create.mockResolvedValue({
      id: 8,
      factory: toFactoryDTO(blankInput.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });

    const result = await monitoringPointFormsService.create(blankInput, 42);

    expect(mockedRepository.list).not.toHaveBeenCalled();
    expect(mockedRepository.create).toHaveBeenCalledWith(blankInput, 42);
    expect(result.id).toBe(8);
  });

  it('throws not found when updating an unknown form', async () => {
    mockedRepository.update.mockResolvedValue(null);

    await expect(monitoringPointFormsService.update(99, input, 42)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('selects a monitoring point form into eligible factories', async () => {
    mockedRepository.findById.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(input.factory),
      points: [
        {
          id: 10,
          formId: 1,
          systemType: 'CEMS',
          pointCode: 'S0001',
          pointName: 'ปล่องหลัก',
          productionUnitType: null,
          productionCapacity: '10 ตัน/ชั่วโมง',
          cemsInstallationRequiredBy: null,
          cemsInstallationRequiredOther: null,
          legalAnnexNo: [],
          accountingConnectionStatus: null,
          eligibleParameters: [],
          exemptedParameters: [],
          connectedParameters: [],
          pendingParameters: [],
          primaryFuel: 'ก๊าซธรรมชาติ',
          primaryFuelOther: null,
          secondaryFuel: null,
          secondaryFuelOther: null,
          details: null,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
      ],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(null);
    mockedEligibleRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedEligibleRepository.create.mockResolvedValue(createEligibleFactoryDTO());

    const result = await monitoringPointFormsService.selectEligible(1, 42);

    expect(mockedEligibleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSystem: 'monitoring_point_forms',
        sourceFactoryId: '1',
        monitoringPointFormId: 1,
        factoryRegistrationNoNew: '10520000225172',
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        provinceName: 'ลำปาง',
        operationStatus: '-',
        productionCapacity: '10 ตัน/ชั่วโมง',
        fuelUsed: 'ก๊าซธรรมชาติ',
      }),
      42,
    );
    expect(result.id).toBe(88);
  });

  it('rejects selecting an unidentifiable monitoring point form', async () => {
    mockedRepository.findById.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO({ factoryRegistrationNoNew: null }),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });

    await expect(monitoringPointFormsService.selectEligible(1, 42)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
  });

  it('returns an existing eligible factory when the form is already selected', async () => {
    const existing = createEligibleFactoryDTO({ id: 99 });
    mockedRepository.findById.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(input.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(existing);

    const result = await monitoringPointFormsService.selectEligible(1, 42);

    expect(result.id).toBe(99);
    expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
  });
});
