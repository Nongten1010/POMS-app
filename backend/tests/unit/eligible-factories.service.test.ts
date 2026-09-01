import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    findByRegistrationNoNew: jest.fn(),
    findByMonitoringPointFormId: jest.fn(),
    attachMonitoringPointForm: jest.fn(),
    canAccessInput: jest.fn(),
    create: jest.fn(),
    createAddRequest: jest.fn(),
    listAddRequests: jest.fn(),
    findOpenAddRequestByFactoryMasterId: jest.fn(),
    findAddRequestById: jest.fn(),
    findAccessibleById: jest.fn(),
    reviewAddRequest: jest.fn(),
    list: jest.fn(),
    softDelete: jest.fn(),
    softDeleteAccessible: jest.fn(),
  },
}));

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findFactorySummaryForAccess: jest.fn(),
    findFactoryGeneral: jest.fn(),
  },
}));

jest.mock('../../src/modules/eligible-factories/eligible-factory-candidates.repository', () => ({
  eligibleFactoryCandidatesRepository: {
    list: jest.fn(),
    findByRegistrationNo: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factory-source-hydration', () => ({
  resolveEligibleFactoryAddressForStorage: jest.fn(
    async (input: { address?: string | null }) => input.address,
  ),
}));

import { ConflictError } from '../../src/shared/errors/AppError';
import { eligibleFactoryCandidatesRepository } from '../../src/modules/eligible-factories/eligible-factory-candidates.repository';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { eligibleFactoriesService } from '../../src/modules/eligible-factories/eligible-factories.service';
import { resolveEligibleFactoryAddressForStorage } from '../../src/modules/eligible-factories/eligible-factory-source-hydration';
import type { CreateEligibleFactoryInput } from '../../src/modules/eligible-factories/eligible-factories.types';

const mockedRepository = jest.mocked(eligibleFactoriesRepository);
const mockedCandidatesRepository = jest.mocked(eligibleFactoryCandidatesRepository);
const mockedConnectionRequestsRepository = jest.mocked(connectionRequestsRepository);
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
    mockedRepository.canAccessInput.mockResolvedValue(true);
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
    mockedRepository.canAccessInput.mockResolvedValue(true);
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
    mockedRepository.canAccessInput.mockResolvedValue(true);
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
          eia: null,
          eiaOther: null,
          hasEia: null,
          projectName: null,
          selectedReason: null,
          selectedBy: 7,
          selectedAt: '2026-05-26T20:18:00.143Z',
          createdAt: '2026-05-26T20:18:00.143Z',
          updatedAt: '2026-05-26T20:18:00.143Z',
          measurementPoints: [
            {
              id: 11,
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
              attachmentLinks: [],
              attachments: [],
              details: null,
            },
            {
              id: 12,
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
              attachmentLinks: [],
              attachments: [],
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
          eia: null,
          eiaOther: null,
          hasEia: null,
          projectName: null,
          monitoringPointFormId: null,
          cemsConnectionStatusSummary: 'ยังไม่แล้วเสร็จ',
          wpmsConnectionStatusSummary: 'ยังไม่แล้วเสร็จ',
          measurementPoints: [
            expect.objectContaining({ systemType: 'CEMS', pointCode: 'CEMS-1' }),
            expect.objectContaining({ systemType: 'WPMS', pointCode: 'WPMS-1' }),
          ],
        },
      ],
      meta: { total: 1 },
    });
    expect(Object.keys(result.data[0] ?? {})).toHaveLength(28);
  });

  it('returns incomplete summaries and an empty point list when stored points are absent', async () => {
    mockedRepository.list.mockResolvedValue({
      rows: [
        {
          id: 2,
          monitoringPointFormId: null,
          factoryName: 'โรงงานไม่มีจุดตรวจวัด',
          factoryRegistrationNoNew: 'factory-without-points',
          factoryRegistrationNoOld: null,
          factoryTypeSequence: null,
          coordinates: null,
          eia: null,
          eiaOther: null,
          hasEia: null,
          projectName: null,
        } as never,
      ],
      total: 1,
    });

    const result = await eligibleFactoriesService.list({});

    expect(result.data[0]).toMatchObject({
      cemsConnectionStatusSummary: 'ยังไม่แล้วเสร็จ',
      wpmsConnectionStatusSummary: 'ยังไม่แล้วเสร็จ',
      measurementPoints: [],
    });
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

    expect(mockedCandidatesRepository.list).toHaveBeenCalledWith({}, undefined);
    expect(result.meta).toEqual({
      total: 60000,
      source: 'external',
    });
    expect(result.data).toHaveLength(60000);
    expect(Object.keys(result.data[0] ?? {})).toHaveLength(20);
  });

  it('forwards read access context to the selected eligible factory list', async () => {
    mockedRepository.list.mockResolvedValue({ rows: [], total: 0 });

    await eligibleFactoriesService.list(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_PROVINCE', province: 'ระยอง', region: null },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_PROVINCE', province: 'ระยอง', region: null },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    );
  });

  it('forwards read access context to the external candidate list', async () => {
    mockedCandidatesRepository.list.mockResolvedValue({
      data: [],
      meta: { total: 0, source: 'external' },
    });

    await eligibleFactoriesService.listCandidates(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_ESTATE', estateCode: 'MTP' } as never,
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    );

    expect(mockedCandidatesRepository.list).toHaveBeenCalledWith(
      {},
      {
        actorUserId: 42,
        scope: expect.objectContaining({ scope: 'IN_ESTATE', estateCode: 'MTP' }),
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    );
  });

  it('returns one Fac60k factory by registration number and forwards read access context', async () => {
    mockedCandidatesRepository.findByRegistrationNo.mockResolvedValue(sourceFactoryCandidate());
    const access = {
      actorUserId: 42,
      scope: { scope: 'IN_PROVINCE', province: 'ระยอง', region: null } as const,
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    };

    const result = await eligibleFactoriesService.getSourceFactory('real-reg-17', access);

    expect(mockedCandidatesRepository.findByRegistrationNo).toHaveBeenCalledWith(
      'real-reg-17',
      access,
    );
    expect(result).toEqual(sourceFactoryCandidate());
  });

  it('throws not found when no Fac60k factory matches the registration number and read scope', async () => {
    mockedCandidatesRepository.findByRegistrationNo.mockResolvedValue(null);

    await expect(
      eligibleFactoriesService.getSourceFactory('missing-reg', {
        actorUserId: 42,
        scope: { scope: 'IN_PROVINCE', province: 'ระยอง', region: null },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects create when the target factory is outside the actor access scope', async () => {
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedRepository.canAccessInput.mockResolvedValue(false);

    await expect(
      eligibleFactoriesService.create(payload, 42, {
        actorUserId: 42,
        scope: { scope: 'IN_PROVINCE', province: 'ชลบุรี' },
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(mockedRepository.create).not.toHaveBeenCalled();
  });

  it('passes mutation access context when removing a selected eligible factory', async () => {
    mockedRepository.softDeleteAccessible.mockResolvedValue(true);

    await eligibleFactoriesService.remove(12, 42, {
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE', estateCode: 'MTP' } as never,
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    });

    expect(mockedRepository.softDeleteAccessible).toHaveBeenCalledWith(12, 42, {
      actorUserId: 42,
      scope: expect.objectContaining({ scope: 'IN_ESTATE', estateCode: 'MTP' }),
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    });
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

  it('creates an add-factory request from a factory inside both view and edit scopes', async () => {
    const factory = ownedFactorySummary();
    mockedConnectionRequestsRepository.findFactorySummaryForAccess.mockResolvedValue(factory);
    mockedConnectionRequestsRepository.findFactoryGeneral.mockResolvedValue({
      ...factory,
      eligibleFactoryId: null,
      juristicId: '0100000000000',
      juristicName: 'บริษัท ทดสอบ จำกัด',
      systemId: 1,
      systemDetail: 'ผลิตพลังงาน',
      verifyStatus: 1,
      authorizeStart: null,
      authorizeEnd: null,
      operationStatus: 'แจ้งประกอบแล้ว',
      capitalAmount: 5000000,
      machineryHorsepower: 120,
      productionCapacity: '10 MW',
      wastewaterDischargeInfo: null,
      boilerCount: 1,
      boilerSizeEach: '5 ton/hour',
      fuelUsed: 'ก๊าซธรรมชาติ',
      formDefaults: {
        factoryId: factory.factoryId,
        factoryName: factory.factoryName,
        factoryRegistrationNo: factory.newRegistrationNo,
      },
    } as never);
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedRepository.findOpenAddRequestByFactoryMasterId.mockResolvedValue(null);
    mockedRepository.createAddRequest.mockResolvedValue(pendingAddRequest());

    const access = addRequestAccess();
    const result = await eligibleFactoriesService.createAddRequest(
      { factoryId: factory.factoryId, reason: 'ต้องการเข้าระบบ CEMS' },
      42,
      access,
    );

    expect(mockedConnectionRequestsRepository.findFactorySummaryForAccess).toHaveBeenNthCalledWith(
      1,
      factory.factoryId,
      access.view,
    );
    expect(mockedConnectionRequestsRepository.findFactorySummaryForAccess).toHaveBeenNthCalledWith(
      2,
      factory.factoryId,
      access.edit,
    );
    expect(mockedRepository.createAddRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryMasterId: 12,
        requestedFactory: expect.objectContaining({
          sourceSystem: 'eligible_factory_add_requests',
          operationStatus: 'แจ้งประกอบแล้ว',
          capitalAmount: 5000000,
          machineryHorsepower: 120,
          selectedReason: 'ต้องการเข้าระบบ CEMS',
        }),
      }),
      42,
    );
    expect(result.status).toBe('PENDING_REVIEW');
  });

  it('returns not found when the factory is outside either required scope', async () => {
    mockedConnectionRequestsRepository.findFactorySummaryForAccess
      .mockResolvedValueOnce(ownedFactorySummary())
      .mockResolvedValueOnce(null);

    await expect(
      eligibleFactoriesService.createAddRequest(
        { factoryId: '10550000125197', reason: 'ต้องการเข้าระบบ CEMS' },
        42,
        addRequestAccess(),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockedRepository.createAddRequest).not.toHaveBeenCalled();
  });

  it('returns conflict for an existing open request', async () => {
    mockedConnectionRequestsRepository.findFactorySummaryForAccess.mockResolvedValue(
      ownedFactorySummary(),
    );
    mockedConnectionRequestsRepository.findFactoryGeneral.mockResolvedValue(null);
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedRepository.findOpenAddRequestByFactoryMasterId.mockResolvedValue({
      id: 88,
      factoryMasterId: 12,
    });

    await expect(
      eligibleFactoriesService.createAddRequest(
        { factoryId: '10550000125197', reason: 'ต้องการเข้าระบบ CEMS' },
        42,
        addRequestAccess(),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('maps a concurrent open-request unique violation to conflict', async () => {
    mockedConnectionRequestsRepository.findFactorySummaryForAccess.mockResolvedValue(
      ownedFactorySummary(),
    );
    mockedConnectionRequestsRepository.findFactoryGeneral.mockResolvedValue(null);
    mockedRepository.findByRegistrationNoNew.mockResolvedValue(null);
    mockedRepository.findOpenAddRequestByFactoryMasterId.mockResolvedValue(null);
    mockedRepository.createAddRequest.mockRejectedValue({
      originalError: { info: { number: 2601 } },
    });

    await expect(
      eligibleFactoriesService.createAddRequest(
        { factoryId: '10550000125197', reason: 'ต้องการเข้าระบบ CEMS' },
        42,
        addRequestAccess(),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('lists add-factory requests without status or pagination metadata', async () => {
    const approved = {
      ...pendingAddRequest(),
      status: 'APPROVED' as const,
      statusLabel: 'อนุมัติแล้ว',
      reviewedBy: 7,
      reviewedAt: '2026-08-10T01:00:00.000Z',
    };
    mockedRepository.listAddRequests.mockResolvedValue({
      rows: [pendingAddRequest(), approved],
      total: 2,
    });
    const access = {
      actorUserId: 7,
      scope: { scope: 'ALL' } as never,
      regionalAccess: null,
    };

    const result = await eligibleFactoriesService.listAddRequests({ search: 'โรงงาน' }, access);

    expect(mockedRepository.listAddRequests).toHaveBeenCalledWith({ search: 'โรงงาน' }, access);
    expect(result).toEqual({ data: [pendingAddRequest(), approved], meta: { total: 2 } });
  });

  it('passes both access scopes to a status-only approval review', async () => {
    mockedRepository.reviewAddRequest.mockResolvedValue({
      ...pendingAddRequest(),
      status: 'APPROVED',
      statusLabel: 'อนุมัติแล้ว',
      reviewedBy: 7,
      reviewedAt: '2026-08-10T01:00:00.000Z',
      eligibleFactoryId: null,
    });
    const access = {
      view: { actorUserId: 7, scope: { scope: 'ALL' } as never, regionalAccess: null },
      approve: { actorUserId: 7, scope: { scope: 'ALL' } as never, regionalAccess: null },
    };

    const result = await eligibleFactoriesService.reviewAddRequest(
      88,
      { decision: 'APPROVE', officerNote: null },
      7,
      access,
    );

    expect(mockedRepository.reviewAddRequest).toHaveBeenCalledWith(
      88,
      { decision: 'APPROVE', officerNote: null },
      7,
      [access.view, access.approve],
    );
    expect(result.status).toBe('APPROVED');
    expect(result.eligibleFactoryId).toBeNull();
  });
});

function ownedFactorySummary() {
  return {
    id: 12,
    factoryId: '10550000125197',
    factoryName: 'โรงงานร้องขอ',
    newRegistrationNo: '10550000125197',
    oldRegistrationNo: null,
    industryType: 'ผลิตพลังงาน',
    industryMainOrder: '88',
    industrySubOrder: '02',
    businessActivity: 'ผลิตไฟฟ้า',
    eia: null,
    hasEia: null,
    projectName: null,
    address: '99 หมู่ 1',
    latitude: '13.1',
    longitude: '100.1',
    provinceName: 'น่าน',
    province: 'น่าน',
    industrialEstateName: null,
    isEligible: false,
    eligibilityStatus: 'ไม่เข้าข่าย',
    isActive: true,
  } as const;
}

function pendingAddRequest() {
  return {
    id: 88,
    factoryId: '10550000125197',
    factoryName: 'โรงงานร้องขอ',
    factoryRegistrationNo: '10550000125197',
    provinceName: 'น่าน',
    reason: 'ต้องการเข้าระบบ CEMS',
    status: 'PENDING_REVIEW' as const,
    statusLabel: 'รอพิจารณา',
    submittedBy: 42,
    submittedAt: '2026-08-10T00:00:00.000Z',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    eligibleFactoryId: null,
  };
}

function addRequestAccess() {
  return {
    view: { actorUserId: 42, scope: { scope: 'OWN_FACTORY' } as never, regionalAccess: null },
    edit: { actorUserId: 42, scope: { scope: 'OWN_FACTORY' } as never, regionalAccess: null },
  };
}

function sourceFactoryCandidate() {
  return {
    factoryName: 'โรงงานจาก Fac60k',
    factoryId: 'real-17',
    factoryRegistrationNo: 'real-reg-17',
    factoryClass: '00100',
    factorySubclass: '00201',
    address: '99 หมู่ 1 จังหวัดระยอง',
    provinceName: 'ระยอง',
    industrialEstateName: 'มาบตาพุด',
    longitude: 101.2,
    latitude: 12.7,
    businessActivity: 'ผลิตเคมีภัณฑ์',
    operationStatus: 'แจ้งประกอบแล้ว',
    machineryHorsepower: 250,
    productionCapacity: '100 ตัน/วัน',
    boilerSizeEach: null,
    fuelUsed: null,
    eia: null,
    hasEia: null,
  };
}
