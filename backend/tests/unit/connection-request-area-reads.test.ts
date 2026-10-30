import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockSourceDb = jest.fn();
const mockList = jest.fn();
const mockFindRequest = jest.fn();
const mockPrevious = jest.fn();
const mockFactoryMap = jest.fn();
const mockGeneral = jest.fn();
const mockListFactories = jest.fn();
const mockCreate = jest.fn();
const mockReplace = jest.fn();
const mockDeviceConfigs = jest.fn();
const mockRequestsForFactories = jest.fn();
const mockConnectedPoints = jest.fn();
const mockEmails = jest.fn();
const mockOpenEligibility = jest.fn();

jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSourceDb,
  factorySourceTableName: () => 'dbo.fac_import',
}));
jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    list: mockList,
    findByIdForReadAccess: mockFindRequest,
    findPreviousRequestForReadAccess: mockPrevious,
    findFactorySummariesForRequests: mockFactoryMap,
    findFactoryGeneral: mockGeneral,
    listFactoriesForAccess: mockListFactories,
    listRequestsForFactories: mockRequestsForFactories,
    listConnectedMeasurementPointsForFactories: mockConnectedPoints,
    listOfficerNotificationEmailsForFactories: mockEmails,
    listOpenEligibleFactoryAddRequestsForFactoryMasterIds: mockOpenEligibility,
    create: mockCreate,
    replaceForm: mockReplace,
  },
}));
jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: { listByRequestId: mockDeviceConfigs },
}));
jest.mock('../../src/modules/parameter-values/parameter-values.service', () => ({
  evaluateHomeMeasurementRows: jest.fn(),
  parameterValuesService: {},
}));
jest.mock('../../src/modules/eligible-factories/eligible-factories.service', () => ({
  eligibleFactoriesService: {},
}));

import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const registration = '82250600225587';
const numericAddress = '7/507 หมู่ 6 ตำบล5 อำเภอ6 จังหวัดระยอง 21140 (ประตู 2)';
const readableAddress = '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140 (ประตู 2)';
const master = { PROV: 21, AMP: 6, TUMBOL: 5, AMPNAME: 'ปลวกแดง', TUMNAME: 'มาบยางพร' };

function sourceQuery(rows: unknown[]) {
  const query = {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    timeout: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return query;
}

function storedRequest(id = 1) {
  return Object.freeze({
    id,
    requestNo: `CEMS-${id}/2569`,
    factoryId: registration,
    factoryRegistrationNo: registration,
    factoryName: 'โรงงานทดสอบ',
    address: numericAddress,
    provinceCode: '21',
    provinceName: 'ระยอง',
    districtCode: '6',
    districtName: '6',
    subdistrictCode: '5',
    subdistrictName: '5',
    status: 'CANCELED',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-30T00:00:00Z',
    measurementPoints: [],
    statusHistory: [],
    contactPersons: [],
    notificationEmails: [],
    officerNotificationEmails: [],
  });
}

function storedFactory() {
  return Object.freeze({
    id: 1,
    factoryId: registration,
    factoryName: 'โรงงานทดสอบ',
    newRegistrationNo: registration,
    oldRegistrationNo: null,
    address: numericAddress,
    province: 'ระยอง',
    districtName: '6',
    districtCode: '6',
    isEligible: true,
    latitude: null,
    longitude: null,
    industryMainOrder: null,
    industrySubOrder: null,
    businessActivity: null,
    eia: null,
    projectName: null,
  });
}

describe.each(['legacy', 'canonical'])('connection request geography reads in %s mode', (mode) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    mockSourceDb.mockImplementation((table) =>
      sourceQuery(
        table === 'dbo.TUMBOL'
          ? [master]
          : [{ FID: registration, FACREG: registration, PROV: 21, AMP: 6, TUMBOL: 5 }],
      ),
    );
    mockList.mockImplementation(async () => ({ rows: [storedRequest()], total: 1 }));
    mockFindRequest.mockImplementation(async () => storedRequest());
    mockPrevious.mockImplementation(async () => storedRequest());
    mockFactoryMap.mockImplementation(async () => new Map([[registration, storedFactory()]]));
    mockGeneral.mockImplementation(async () => storedFactory());
    mockListFactories.mockImplementation(async () => [storedFactory()]);
    mockRequestsForFactories.mockImplementation(async () => []);
    mockConnectedPoints.mockImplementation(async () => []);
    mockEmails.mockImplementation(async () => new Map());
    mockOpenEligibility.mockImplementation(async () => new Map());
    mockDeviceConfigs.mockImplementation(async () => []);
  });

  afterEach(() => {
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('batch resolves list names while preserving stored canceled snapshots and machine codes', async () => {
    const first = storedRequest(1);
    const second = storedRequest(2);
    mockList.mockImplementation(async () => ({ rows: [first, second], total: 2 }));
    const result = await connectionRequestsService.list({}, 42, 'OWN_FACTORY');
    expect(result.meta.total).toBe(2);
    for (const row of result.data) {
      expect(row).toMatchObject({
        address: readableAddress,
        districtName: 'ปลวกแดง',
        subdistrictName: 'มาบยางพร',
        districtCode: '6',
        subdistrictCode: '5',
        status: 'CANCELED',
        updatedAt: first.updatedAt,
      });
      expect(Object.keys(row).sort()).toEqual(Object.keys(first).sort());
    }
    expect(mockSourceDb).toHaveBeenCalledTimes(1);
    expect(first.address).toBe(numericAddress);
    expect(first.districtName).toBe('6');
    expect(second.address).toBe(numericAddress);
  });

  it('returns readable single-request form and previous-request prefill without modifying history', async () => {
    const stored = storedRequest();
    mockFindRequest.mockImplementation(async () => stored);
    mockPrevious.mockImplementation(async () => stored);
    const form = await connectionRequestsService.getForm(1, 42, 'OWN_FACTORY');
    const previous = await connectionRequestsService.getPreviousRequest(
      registration,
      42,
      'OWN_FACTORY',
    );
    for (const result of [form, previous.formData]) {
      expect(result).toMatchObject({
        address: readableAddress,
        districtName: 'ปลวกแดง',
        subdistrictName: 'มาบยางพร',
        districtCode: '6',
        subdistrictCode: '5',
      });
    }
    expect(form.expectedUpdatedAt).toBe(stored.updatedAt);
    expect(stored.address).toBe(numericAddress);
    expect(stored.districtName).toBe('6');
  });

  it('normalizes both request and nested factory detail using province/registration aliases', async () => {
    const result = await connectionRequestsService.getDetail(1, 42, 'OWN_FACTORY');
    expect(result.address).toBe(readableAddress);
    expect(result.factory).toMatchObject({ address: readableAddress, districtName: 'ปลวกแดง' });
    expect(result.factory).not.toHaveProperty('provinceName');
    expect(result.factory).not.toHaveProperty('factoryRegistrationNoNew');
  });

  it('normalizes every item of the detailed list and its nested factory copy', async () => {
    const result = await connectionRequestsService.listDetails({}, 42, 'OWN_FACTORY');
    expect(result.data[0]).toMatchObject({
      address: readableAddress,
      factory: { address: readableAddress, districtName: 'ปลวกแดง' },
    });
  });

  it('normalizes current factory general and operator list address without adding lookup fields', async () => {
    const general = await connectionRequestsService.getFactoryGeneral(
      registration,
      42,
      'OWN_FACTORY',
    );
    const list = await connectionRequestsService.listOperatorFactories(42, 'OWN_FACTORY');
    expect(general.address).toBe(readableAddress);
    expect(general.districtName).toBe('ปลวกแดง');
    expect(general).not.toHaveProperty('provinceName');
    expect(general).not.toHaveProperty('factoryRegistrationNoNew');
    expect(list.data[0].address).toBe(readableAddress);
  });

  it('suppresses unresolved numeric labels and names on a lookup outage without changing persisted values', async () => {
    const stored = storedRequest();
    mockFindRequest.mockImplementation(async () => stored);
    mockSourceDb.mockImplementation(() => {
      throw new Error('Synthetic source outage');
    });
    const result = await connectionRequestsService.getById(1, 42, 'OWN_FACTORY');
    expect(result.address).toBe('7/507 หมู่ 6 จังหวัดระยอง 21140 (ประตู 2)');
    expect(result.districtName).toBeNull();
    expect(result.subdistrictName).toBeNull();
    expect(result.districtCode).toBe('6');
    expect(stored.address).toBe(numericAddress);
    expect(stored.districtName).toBe('6');
  });

  it('does not resolve inaccessible records or look up readable values unnecessarily', async () => {
    mockFindRequest.mockImplementation(async () => null);
    await expect(connectionRequestsService.getById(1, 42, 'OWN_FACTORY')).rejects.toThrow(
      'Connection request not found',
    );
    expect(mockSourceDb).not.toHaveBeenCalled();
    mockFindRequest.mockImplementation(async () => ({
      ...storedRequest(),
      address: readableAddress,
      districtName: 'ปลวกแดง',
      subdistrictName: 'มาบยางพร',
    }));
    const result = await connectionRequestsService.getById(1, 42, 'OWN_FACTORY');
    expect(result.address).toBe(readableAddress);
    expect(mockSourceDb).not.toHaveBeenCalled();
  });
});
