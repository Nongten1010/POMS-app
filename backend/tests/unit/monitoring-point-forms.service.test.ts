import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
const mockTransaction = {} as Knex.Transaction;
const mockCanonicalMode = jest.fn(() => false);
const mockLockProfile = jest.fn(async (..._args: unknown[]) => null);
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  lockFactoryProfileInTransaction: mockLockProfile,
}));
jest.mock('../../src/modules/factory-profiles/factory-profile-mode', () => ({
  isCanonicalFactoryProfilesEnabled: mockCanonicalMode,
}));
jest.mock('../../src/config/database', () => ({
  db: {
    transaction: async (callback: (trx: Knex.Transaction) => Promise<unknown>) =>
      callback(mockTransaction),
  },
}));

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
    updateFromMonitoringPointForm: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factory-source-hydration', () => ({
  resolveEligibleFactoryAddressForStorage: jest.fn(
    async (input: { address?: string | null }) => input.address,
  ),
  resolveEligibleFactoryIndustrialEstateForStorage: jest.fn(),
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import {
  resolveEligibleFactoryAddressForStorage,
  resolveEligibleFactoryIndustrialEstateForStorage,
} from '../../src/modules/eligible-factories/eligible-factory-source-hydration';
import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';
import { saveMonitoringPointFormSchema } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.validator';
import type {
  MonitoringPointFormFactoryInput,
  SaveMonitoringPointFormInput,
} from '../../src/modules/monitoring-point-forms/monitoring-point-forms.types';

const mockedRepository = jest.mocked(monitoringPointFormsRepository);
const mockedEligibleRepository = jest.mocked(eligibleFactoriesRepository);
const mockedResolveAddress = jest.mocked(resolveEligibleFactoryAddressForStorage);
const mockedResolveIndustrialEstate = jest.mocked(resolveEligibleFactoryIndustrialEstateForStorage);

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
    eiaOther: factory.eiaOther ?? null,
    projectName: factory.projectName ?? null,
    address: factory.address ?? null,
    businessActivity: factory.businessActivity ?? null,
    machineryHorsepower: factory.machineryHorsepower ?? null,
    latitude: factory.latitude ?? null,
    longitude: factory.longitude ?? null,
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
      machineryHorsepower: 121.8,
      latitude: 18.29512,
      longitude: 99.50672,
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
    jest.resetAllMocks();
    mockCanonicalMode.mockReturnValue(false);
    mockedResolveAddress.mockImplementation(async (value) => value.address);
  });

  it('preserves explicitly cleared canonical address and returns the shared profile after syncing', async () => {
    mockCanonicalMode.mockReturnValue(true);
    const form = {
      id: 1,
      factory: toFactoryDTO(input.factory),
      points: [],
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
    };
    mockedRepository.update.mockResolvedValue(form);
    mockedRepository.findById.mockResolvedValue(form);
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
      createEligibleFactoryDTO(),
    );
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
      createEligibleFactoryDTO(),
    );
    mockedResolveAddress.mockResolvedValueOnce('External replacement');
    mockedResolveIndustrialEstate.mockResolvedValueOnce('External estate');

    const result = await monitoringPointFormsService.update(1, input, 42);

    expect(mockLockProfile).toHaveBeenCalledWith(mockTransaction, 88);
    expect(mockLockProfile.mock.invocationCallOrder[0]).toBeLessThan(
      Number(mockedRepository.update.mock.invocationCallOrder[0]),
    );
    expect(mockedResolveAddress).not.toHaveBeenCalled();
    expect(mockedResolveIndustrialEstate).not.toHaveBeenCalled();
    expect(
      mockedEligibleRepository.updateFromMonitoringPointForm.mock.calls[0]?.[1].address,
    ).toBeNull();
    expect(mockedRepository.findById).toHaveBeenCalledWith(1, undefined, mockTransaction);
    expect(result).toBe(form);
  });

  it.each(['create', 'update'] as const)(
    'rejects unsupported canonical EIA before %s can overwrite the linked form',
    async (action) => {
      mockCanonicalMode.mockReturnValue(true);
      const invalidInput = { ...input, factory: { ...input.factory, eiaInfo: 'มีรายงานแนบ' } };
      mockedRepository.list.mockResolvedValue([]);
      mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
        createEligibleFactoryDTO(),
      );
      const saved = {
        id: 1,
        factory: toFactoryDTO(invalidInput.factory),
        points: [],
        createdAt: '2026-09-11',
        updatedAt: '2026-09-11',
      };
      mockedRepository.create.mockResolvedValue(saved);
      mockedRepository.update.mockResolvedValue(saved);
      mockedRepository.findById.mockResolvedValue(saved);
      mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
        createEligibleFactoryDTO(),
      );
      const operation =
        action === 'create'
          ? monitoringPointFormsService.create(invalidInput, 42)
          : monitoringPointFormsService.update(1, invalidInput, 42);
      await expect(operation).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
        details: { field: 'factory.eiaInfo' },
      });
      expect(mockedRepository.create).not.toHaveBeenCalled();
      expect(mockedRepository.update).not.toHaveBeenCalled();
      expect(mockedEligibleRepository.updateFromMonitoringPointForm).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'refuses selecting unsupported canonical EIA without modifying data (linked: %s)',
    async (linked) => {
      mockCanonicalMode.mockReturnValue(true);
      const saved = {
        id: 1,
        factory: toFactoryDTO({ ...input.factory, eiaInfo: 'มีรายงานแนบ' }),
        points: [],
        createdAt: '2026-09-11',
        updatedAt: '2026-09-11',
      };
      mockedRepository.findById.mockResolvedValue(saved);
      mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
        linked ? createEligibleFactoryDTO() : null,
      );
      await expect(monitoringPointFormsService.selectEligible(1, 42)).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
        details: { field: 'factory.eiaInfo' },
      });
      expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
      expect(mockedEligibleRepository.updateFromMonitoringPointForm).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined, ''])(
    'rejects clearing linked canonical registration with %s before form persistence',
    async (registration) => {
      mockCanonicalMode.mockReturnValue(true);
      const submitted = {
        ...input,
        factory: { ...input.factory, factoryRegistrationNoNew: registration },
      };
      const saved = {
        id: 1,
        factory: toFactoryDTO(submitted.factory),
        points: [],
        createdAt: '2026-09-11',
        updatedAt: '2026-09-11',
      };
      mockedRepository.update.mockResolvedValue(saved);
      mockedRepository.findById.mockResolvedValue(saved);
      mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
        createEligibleFactoryDTO(),
      );
      await expect(monitoringPointFormsService.update(1, submitted, 42)).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
        details: { field: 'factory.factoryRegistrationNoNew' },
      });
      expect(mockedRepository.update).not.toHaveBeenCalled();
      expect(mockedEligibleRepository.updateFromMonitoringPointForm).not.toHaveBeenCalled();
    },
  );

  it('keeps free-text EIA on an unregistered canonical draft', async () => {
    mockCanonicalMode.mockReturnValue(true);
    const draft = {
      factory: { factoryRegistrationNoNew: null, eiaInfo: 'มีรายงานแนบ' },
      points: [],
    };
    const saved = {
      id: 1,
      factory: toFactoryDTO(draft.factory),
      points: [],
      createdAt: '2026-09-11',
      updatedAt: '2026-09-11',
    };
    mockedRepository.create.mockResolvedValue(saved);
    mockedRepository.findById.mockResolvedValue(saved);
    expect((await monitoringPointFormsService.create(draft, 42)).factory.eiaInfo).toBe(
      'มีรายงานแนบ',
    );
    expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    'distinguishes canonical EIA %s after HTTP validation',
    async (eiaInfo) => {
      mockCanonicalMode.mockReturnValue(true);
      const parsed = saveMonitoringPointFormSchema.parse({
        factory: { ...input.factory, ...(eiaInfo === undefined ? {} : { eiaInfo }) },
        points: [],
      });
      const saved = {
        id: 1,
        factory: toFactoryDTO(parsed.factory),
        points: [],
        createdAt: '2026-09-11',
        updatedAt: '2026-09-11',
      };
      mockedRepository.update.mockResolvedValue(saved);
      mockedRepository.findById.mockResolvedValue(saved);
      mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
        createEligibleFactoryDTO(),
      );
      mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
        createEligibleFactoryDTO(),
      );
      await monitoringPointFormsService.update(1, parsed, 42);
      const patch = mockedEligibleRepository.updateFromMonitoringPointForm.mock.calls[0]?.[1];
      if (eiaInfo === undefined) {
        expect(parsed.factory.eiaInfo).toBeUndefined();
        expect(patch).not.toHaveProperty('eia');
        expect(patch).not.toHaveProperty('hasEia');
      } else {
        expect(patch).toMatchObject({ eia: null, eiaOther: null, hasEia: null });
      }
    },
  );

  it('keeps an already linked canonical selection idempotent after a concurrent profile approval', async () => {
    mockCanonicalMode.mockReturnValue(true);
    const earlier = {
      id: 1,
      factory: toFactoryDTO({ ...input.factory, factoryName: 'Earlier name' }),
      points: [],
      createdAt: '2026-09-11',
      updatedAt: '2026-09-11',
    };
    const current = {
      ...earlier,
      factory: { ...earlier.factory, factoryName: 'Approved new name' },
    };
    const selected = createEligibleFactoryDTO({ factoryName: 'Approved new name' });
    mockedRepository.findById.mockResolvedValueOnce(earlier).mockResolvedValueOnce(current);
    mockedEligibleRepository.findByMonitoringPointFormId
      .mockResolvedValueOnce(createEligibleFactoryDTO({ factoryName: 'Earlier name' }))
      .mockResolvedValueOnce(selected);
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(selected);
    const result = await monitoringPointFormsService.selectEligible(1, 42);
    expect(result.factoryName).toBe('Approved new name');
    expect(mockLockProfile).toHaveBeenCalledWith(mockTransaction, 88);
    expect(mockedRepository.findById).toHaveBeenCalledTimes(2);
    expect(mockLockProfile.mock.invocationCallOrder[0]).toBeLessThan(
      Number(mockedRepository.findById.mock.invocationCallOrder[1]),
    );
    expect(mockedEligibleRepository.updateFromMonitoringPointForm).not.toHaveBeenCalled();
    expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
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
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(null);
    mockedEligibleRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedEligibleRepository.create.mockResolvedValue(createEligibleFactoryDTO());

    const result = await monitoringPointFormsService.create(input, 42);

    expect(mockedRepository.list).toHaveBeenCalledWith({
      factoryRegistrationNoNew: '10520000225172',
    });
    expect(mockedRepository.create).toHaveBeenCalledWith(input, 42, mockTransaction);
    expect(mockedEligibleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSystem: 'monitoring_point_forms',
        sourceFactoryId: '10520000225172',
        monitoringPointFormId: 1,
        factoryRegistrationNoNew: '10520000225172',
        machineryHorsepower: 121.8,
        coordinates: {
          latitude: 18.29512,
          longitude: 99.50672,
        },
      }),
      42,
      mockTransaction,
    );
    expect(result.id).toBe(1);
  });

  it('persists the source industrial estate when selecting a connected POMS factory', async () => {
    mockedRepository.list.mockResolvedValue([]);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(input.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });
    mockedResolveIndustrialEstate.mockResolvedValue('นิคมอุตสาหกรรมมาบตาพุด');
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(null);
    mockedEligibleRepository.findByRegistrationNoNew.mockResolvedValue({
      id: 88,
      factoryRegistrationNoNew: '10520000225172',
      monitoringPointFormId: null,
    });
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
      createEligibleFactoryDTO({
        id: 88,
        industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
      }),
    );

    await monitoringPointFormsService.create(input, 42);

    expect(mockedResolveIndustrialEstate).toHaveBeenCalledWith({
      sourceFactoryId: '10520000225172',
      factoryRegistrationNoNew: '10520000225172',
    });
    expect(mockedEligibleRepository.updateFromMonitoringPointForm).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
      }),
      42,
      mockTransaction,
    );
  });

  it('stores the province in the monitoring-form address while keeping provinceName', async () => {
    const addressInput: SaveMonitoringPointFormInput = {
      ...input,
      factory: {
        ...input.factory,
        address: '99 หมู่ 1 ตำบลสบตุ๋ย อำเภอเมืองลำปาง 52100',
      },
    };
    mockedRepository.list.mockResolvedValue([]);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(addressInput.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(null);
    mockedEligibleRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedEligibleRepository.create.mockResolvedValue(createEligibleFactoryDTO());

    await monitoringPointFormsService.create(addressInput, 42);

    expect(mockedRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        factory: expect.objectContaining({
          address: '99 หมู่ 1 ตำบลสบตุ๋ย อำเภอเมืองลำปาง จังหวัดลำปาง 52100',
          provinceName: 'ลำปาง',
        }),
      }),
      42,
      mockTransaction,
    );
  });

  it('synchronizes explicit project and Other EIA fields to the eligible factory', async () => {
    const projectInput: SaveMonitoringPointFormInput = {
      ...input,
      factory: {
        ...input.factory,
        eiaInfo: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        projectName: 'โครงการขยายกำลังผลิต',
      },
    };
    mockedRepository.list.mockResolvedValue([]);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(projectInput.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(null);
    mockedEligibleRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedEligibleRepository.create.mockResolvedValue(createEligibleFactoryDTO());

    await monitoringPointFormsService.create(projectInput, 42);

    expect(mockedEligibleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eia: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        hasEia: false,
        projectName: 'โครงการขยายกำลังผลิต',
      }),
      42,
      mockTransaction,
    );
  });

  it('does not partially synchronize a legacy free-text EIA value', async () => {
    const legacyInput: SaveMonitoringPointFormInput = {
      ...input,
      factory: {
        ...input.factory,
        eiaInfo: 'มีรายงานแนบ',
      },
    };
    mockedRepository.list.mockResolvedValue([]);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO(legacyInput.factory),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(null);
    mockedEligibleRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedEligibleRepository.create.mockResolvedValue(createEligibleFactoryDTO());

    await monitoringPointFormsService.create(legacyInput, 42);

    const eligibleInput = mockedEligibleRepository.create.mock.calls[0]?.[0];
    expect(eligibleInput).not.toHaveProperty('eia');
    expect(eligibleInput).not.toHaveProperty('eiaOther');
    expect(eligibleInput).not.toHaveProperty('hasEia');
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
    expect(mockedRepository.create).toHaveBeenCalledWith(blankInput, 42, mockTransaction);
    expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
    expect(mockedEligibleRepository.findByRegistrationNoNew).not.toHaveBeenCalled();
    expect(result.id).toBe(8);
  });

  it('updates the linked eligible factory when editing a monitoring point form', async () => {
    mockedRepository.update.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO({ ...input.factory, provinceName: 'เชียงใหม่' }),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z',
    });
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
      createEligibleFactoryDTO({ id: 88, provinceName: 'ลำปาง' }),
    );
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
      createEligibleFactoryDTO({ id: 88, provinceName: 'เชียงใหม่' }),
    );

    const result = await monitoringPointFormsService.update(1, input, 42);

    expect(mockedEligibleRepository.updateFromMonitoringPointForm).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        sourceFactoryId: '10520000225172',
        monitoringPointFormId: 1,
        provinceName: 'เชียงใหม่',
        machineryHorsepower: 121.8,
        coordinates: {
          latitude: 18.29512,
          longitude: 99.50672,
        },
      }),
      42,
      mockTransaction,
    );
    expect(result.id).toBe(1);
  });

  it('stores resolved Thai area names instead of numeric DIW area codes', async () => {
    const numericAddress = '4 หมู่ 6 ตำบล10 อำเภอ4 24130';
    const resolvedAddress = '4 หมู่ 6 ตำบลท่าข้าม อำเภอบางปะกง 24130';
    mockedRepository.update.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO({ ...input.factory, address: numericAddress }),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z',
    });
    mockedResolveAddress.mockResolvedValueOnce(resolvedAddress);
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
      createEligibleFactoryDTO({ id: 88, address: resolvedAddress }),
    );
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
      createEligibleFactoryDTO({ id: 88, address: resolvedAddress }),
    );

    await monitoringPointFormsService.update(1, input, 42);

    expect(mockedResolveAddress).toHaveBeenCalledWith({
      sourceFactoryId: '10520000225172',
      factoryRegistrationNoNew: '10520000225172',
      address: numericAddress,
      provinceName: 'ลำปาง',
    });
    expect(mockedEligibleRepository.updateFromMonitoringPointForm).toHaveBeenCalledWith(
      88,
      expect.objectContaining({ address: resolvedAddress }),
      42,
      mockTransaction,
    );
  });

  it('omits an unresolved numeric address so it cannot overwrite the stored readable address', async () => {
    const numericAddress = '4 หมู่ 6 ตำบล10 อำเภอ4 24130';
    const readableAddress = '4 หมู่ 6 ตำบลท่าข้าม อำเภอบางปะกง 24130';
    mockedRepository.update.mockResolvedValue({
      id: 1,
      factory: toFactoryDTO({ ...input.factory, address: numericAddress }),
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z',
    });
    mockedResolveAddress.mockResolvedValueOnce(undefined);
    mockedEligibleRepository.findByMonitoringPointFormId.mockResolvedValue(
      createEligibleFactoryDTO({ id: 88, address: readableAddress }),
    );
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(
      createEligibleFactoryDTO({ id: 88, address: readableAddress }),
    );

    await monitoringPointFormsService.update(1, input, 42);

    const updateInput = mockedEligibleRepository.updateFromMonitoringPointForm.mock.calls[0]?.[1];
    expect(updateInput?.address).toBeUndefined();
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
          attachmentLinks: [],
          attachments: [],
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
        sourceFactoryId: '10520000225172',
        monitoringPointFormId: 1,
        factoryRegistrationNoNew: '10520000225172',
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        provinceName: 'ลำปาง',
        operationStatus: '-',
        machineryHorsepower: 121.8,
        productionCapacity: '10 ตัน/ชั่วโมง',
        fuelUsed: 'ก๊าซธรรมชาติ',
      }),
      42,
      mockTransaction,
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
    mockedEligibleRepository.updateFromMonitoringPointForm.mockResolvedValue(existing);

    const result = await monitoringPointFormsService.selectEligible(1, 42);

    expect(result.id).toBe(99);
    expect(mockedEligibleRepository.updateFromMonitoringPointForm).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ monitoringPointFormId: 1 }),
      42,
      mockTransaction,
    );
    expect(mockedEligibleRepository.create).not.toHaveBeenCalled();
  });
});
