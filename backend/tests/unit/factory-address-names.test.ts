import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockSourceDb = jest.fn();
const mockFindDetail = jest.fn();
const mockFindContacts = jest.fn();
const mockListFactories = jest.fn();
const mockFindEditRequest = jest.fn();
const mockCreateEditRequest = jest.fn();
const mockFindOpenRequest = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSourceDb,
  factorySourceTableName: () => 'dbo.fac_import',
}));
jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: {
    findFactoryDetail: mockFindDetail,
    findFactoryFormContacts: mockFindContacts,
    listFactories: mockListFactories,
    findEditRequestById: mockFindEditRequest,
    findOpenEditRequestForFactory: mockFindOpenRequest,
    createEditRequest: mockCreateEditRequest,
  },
}));

import {
  hydrateEligibleFactoriesFromSource,
  resolveLegacyFactoryAddressNames,
} from '../../src/modules/eligible-factories/eligible-factory-source-hydration';
import type { EligibleFactoryDTO } from '../../src/modules/eligible-factories/eligible-factories.types';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import type {
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestDTO,
  PomsFactoryProfileDTO,
} from '../../src/modules/poms-factories/poms-factories.types';

const numericAddress = '7/507 หมู่ 6 ตำบล5 อำเภอ6 จังหวัดระยอง 21140 (ประตู 2)';
const readableAddress = '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140 (ประตู 2)';
const source = {
  FID: '82250600225587',
  FACREG: '82250600225587',
  DISPFACREG: 'น.88(2)-2/2558-นอต.',
  FADDR: '7/507',
  FMOO: '6',
  PROV: 21,
  AMP: 6,
  TUMBOL: 5,
  ZIPCODE: '21140',
};

function query(rows: unknown[]) {
  return {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    timeout: jest.fn().mockReturnThis(),
    select: jest.fn(async () => rows),
  };
}

function eligible(address: string | null = numericAddress): EligibleFactoryDTO {
  return {
    id: 1,
    sourceSystem: 'diw.fac_import',
    sourceFactoryId: source.FID,
    monitoringPointFormId: null,
    factoryRegistrationNoNew: source.FID,
    factoryRegistrationNoOld: source.DISPFACREG,
    factoryName: 'โรงงานทดสอบ',
    factoryTypeSequence: '08802',
    address,
    provinceName: 'ระยอง',
    industrialEstateName: null,
    coordinates: null,
    businessActivity: null,
    operationStatus: 'operating',
    capitalAmount: null,
    machineryHorsepower: null,
    productionCapacity: null,
    wastewaterDischargeInfo: null,
    boilerCount: null,
    boilerSizeEach: null,
    fuelUsed: null,
    hasEia: null,
    selectedReason: null,
    selectedBy: 1,
    selectedAt: '2026-10-30',
    createdAt: '2026-10-30',
    updatedAt: '2026-10-30',
  };
}

function detail(): PomsFactoryDetailDTO {
  return {
    ...eligible(),
    eligibleFactoryId: 1,
    factoryId: source.FID,
    factoryRegistrationNo: source.DISPFACREG,
    industryMainOrder: '08802',
    industryMainOrderLabel: null,
    industrySubOrder: null,
    factoryAddress: numericAddress,
    latitude: null,
    longitude: null,
    eia: null,
    eiaOther: null,
    projectName: null,
    factoryFrontPhotos: [],
    factoryLogo: null,
    systemTypes: ['CEMS'],
    measurementPointCount: 1,
    pendingEditRequestCount: 0,
    measurementPoints: [
      {
        connectedPointId: 1,
        sourceMeasurementPointId: 1,
        eligibleFactoryId: 1,
        factoryId: source.FID,
        factoryName: 'โรงงานทดสอบ',
        systemType: 'CEMS',
        pointName: 'A',
        pointCode: 'S0001',
        pointType: 'STACK',
        parameters: [],
        details: null,
        documentsAndImages: [],
        monitoringPointStatus: 'เชื่อมต่อครบแล้ว',
        measurementInstruments: null,
        updatedAt: '2026-10-30',
      },
    ],
  };
}

function editRequest(
  currentFactory: PomsFactoryProfileDTO = detail(),
  proposedFactory: PomsFactoryProfileDTO = detail(),
): PomsFactoryEditRequestDTO {
  return {
    id: 1,
    requestNo: 'POMS-0001/2569',
    eligibleFactoryId: 1,
    factoryId: source.FID,
    factoryRegistrationNo: source.DISPFACREG,
    factoryName: 'โรงงานทดสอบ',
    formType: 'BASIC_INFO',
    status: 'PENDING_REVIEW',
    statusLabel: 'รอพิจารณา',
    revisionNo: 0,
    isOpen: true,
    currentFactory,
    proposedFactory,
    currentMeasurementPoints: null,
    proposedMeasurementPoints: null,
    requestNote: null,
    revisionReason: null,
    officerNote: null,
    submittedBy: 1,
    reviewedBy: null,
    submittedAt: '2026-10-30',
    reviewedAt: null,
    approvedAt: null,
    createdBy: 1,
    createdAt: '2026-10-30',
    updatedAt: '2026-10-30',
    events: [],
  };
}

describe.each(['legacy', 'canonical'])('factory address names in %s mode', (mode) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    mockSourceDb.mockImplementation((table) =>
      query(
        table === 'dbo.TUMBOL'
          ? [{ PROV: 21, AMP: 6, TUMBOL: 5, TUMNAME: 'มาบยางพร', AMPNAME: 'ปลวกแดง' }]
          : [source],
      ),
    );
    mockFindDetail.mockImplementation(async () => detail());
    mockFindContacts.mockImplementation(async () => null);
    mockFindOpenRequest.mockImplementation(async () => null);
    mockFindEditRequest.mockImplementation(async () => editRequest());
    mockCreateEditRequest.mockImplementation(async () => editRequest());
    mockListFactories.mockImplementation(async () => [
      {
        factoryId: source.FID,
        newRegistrationNo: source.FID,
        oldRegistrationNo: source.DISPFACREG,
        address: numericAddress,
        province: 'ระยอง',
      },
    ]);
  });

  it('repairs eligible-factory names without losing extra stored address details', async () => {
    const [row] = await hydrateEligibleFactoriesFromSource([eligible()]);
    expect(row.address).toBe(readableAddress);
  });

  it('returns readable POMS detail and form addresses without changing the stored profile', async () => {
    const stored = detail();
    mockFindDetail.mockImplementation(async () => stored);
    const result = await pomsFactoriesService.getFactoryDetail(source.FID, 1, 'ALL');
    const form = await pomsFactoriesService.getFactoryForm(source.FID, 1, 'ALL', {});
    expect(result.factoryAddress).toBe(readableAddress);
    expect(form.address).toBe(readableAddress);
    expect(stored.factoryAddress).toBe(numericAddress);
  });

  it('uses readable live addresses when reopening an existing edit-request form', async () => {
    const form = await pomsFactoriesService.getEditRequestForm(1, 1, 'ALL', {});
    expect(form.address).toBe(readableAddress);
  });

  it('retains raw persisted addresses in write snapshots instead of display enrichment', async () => {
    const stored = Object.freeze(detail());
    const saved = Object.freeze(
      editRequest(stored, Object.freeze({ ...stored, projectName: 'New project' })),
    );
    mockFindDetail.mockImplementation(async () => stored);
    mockCreateEditRequest.mockImplementation(async () => saved);
    const result = await pomsFactoriesService.createEditRequest(
      source.FID,
      { projectName: 'New project' },
      1,
      'ALL',
    );
    expect(mockCreateEditRequest).toHaveBeenCalledWith(
      expect.objectContaining({ factoryAddress: numericAddress }),
      expect.objectContaining({
        proposedFactory: expect.objectContaining({ factoryAddress: numericAddress }),
      }),
      null,
      1,
    );
    expect(stored.factoryAddress).toBe(numericAddress);
    expect(saved.currentFactory.factoryAddress).toBe(numericAddress);
    expect(saved.proposedFactory.factoryAddress).toBe(numericAddress);
    expect(result.currentFactory.factoryAddress).toBe(readableAddress);
    expect(result.proposedFactory.factoryAddress).toBe(readableAddress);
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
    expect(mockSourceDb).toHaveBeenCalledWith('dbo.TUMBOL');
    expect(mockSourceDb).not.toHaveBeenCalledWith('dbo.fac_import');
  });

  it('resolves list addresses in a batch', async () => {
    const rows = Array.from({ length: 3 }, () => ({
      factoryId: source.FID,
      newRegistrationNo: source.FID,
      address: numericAddress,
      province: 'ระยอง',
    }));
    mockListFactories.mockImplementation(async () => rows);
    const { data } = await pomsFactoriesService.listFactories(1, 'ALL');
    expect(data.map((row) => row.address)).toEqual(Array(3).fill(readableAddress));
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
  });

  it('does not expose numeric area labels when the source cannot be reached', async () => {
    mockSourceDb.mockImplementation(() => {
      throw new Error('source unavailable');
    });
    const form = await pomsFactoriesService.getFactoryForm(source.FID, 1, 'ALL', {});
    expect(form.address).toBe('7/507 หมู่ 6 จังหวัดระยอง 21140 (ประตู 2)');
  });

  it('preserves readable canonical addresses and explicitly cleared addresses', async () => {
    const rows = await hydrateEligibleFactoriesFromSource([
      eligible(readableAddress),
      eligible(null),
    ]);
    expect(rows[0].address).toBe(readableAddress);
    if (mode === 'canonical') expect(rows[1].address).toBeNull();
  });

  it('does not query Fac60k for an already readable POMS address', async () => {
    mockFindDetail.mockImplementation(async () => ({
      ...detail(),
      factoryAddress: readableAddress,
    }));
    const form = await pomsFactoriesService.getFactoryForm(source.FID, 1, 'ALL', {});
    expect(form.address).toBe(readableAddress);
    expect(form.districtName).toBe('ปลวกแดง');
    expect(form.subdistrictName).toBe('มาบยางพร');
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
    expect(mockSourceDb).toHaveBeenCalledWith('dbo.TUMBOL');
    expect(mockSourceDb).not.toHaveBeenCalledWith('dbo.fac_import');
  });

  it('refuses persistent repairs when the stored area codes differ from Fac60k', async () => {
    await expect(
      resolveLegacyFactoryAddressNames([eligible(numericAddress.replace('อำเภอ6', 'อำเภอ9'))], {
        strict: true,
      }),
    ).rejects.toThrow('Cannot safely resolve');
  });

  it('repairs only numeric labels and preserves names that are already readable', async () => {
    const [result] = await resolveLegacyFactoryAddressNames(
      [eligible(numericAddress.replace('อำเภอ6', 'อำเภอปลวกแดง'))],
      { strict: true },
    );
    expect(result.address).toBe(readableAddress);
  });

  it('uses FID before a colliding registration alias and includes province in the area key', async () => {
    mockSourceDb.mockImplementation((table) =>
      query(
        table === 'dbo.TUMBOL'
          ? [
              { PROV: 20, AMP: 6, TUMBOL: 5, TUMNAME: 'ผิดจังหวัด', AMPNAME: 'ผิดอำเภอ' },
              { PROV: 21, AMP: 6, TUMBOL: 5, TUMNAME: 'มาบยางพร', AMPNAME: 'ปลวกแดง' },
            ]
          : [source, { ...source, FID: 'OTHER', FACREG: source.FID, PROV: 20 }],
      ),
    );
    const [result] = await hydrateEligibleFactoriesFromSource([eligible()]);
    expect(result.address).toBe(readableAddress);
  });
});
