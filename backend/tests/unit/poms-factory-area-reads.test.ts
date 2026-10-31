import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockSourceDb = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSourceDb,
  factorySourceTableName: () => 'dbo.fac_import',
}));
jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: {
    listFactories: jest.fn(),
    findFactoryDetail: jest.fn(),
    findFactoryFormContacts: jest.fn(),
    findEditRequestById: jest.fn(),
    findOpenEditRequestForFactory: jest.fn(),
    createEditRequest: jest.fn(),
  },
}));

import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import type { OperatorFactoryTableRowDTO } from '../../src/modules/connection-requests/connection-requests.types';
import type {
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestDTO,
} from '../../src/modules/poms-factories/poms-factories.types';

const repository = jest.mocked(pomsFactoriesRepository);
const address = '7/507 หมู่ 6 ซอยเอ.6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140';
const registration = '82250600225587';
const area = { PROV: 21, AMP: 6, TUMBOL: 5, AMPNAME: 'ปลวกแดง', TUMNAME: 'มาบยางพร' };

function factoryDetail(): PomsFactoryDetailDTO {
  return {
    eligibleFactoryId: 430,
    factoryId: registration,
    factoryRegistrationNo: registration,
    factoryName: 'บริษัท อมตะ บี.กริม เพาเวอร์ (ระยอง) 5 จำกัด',
    industryMainOrder: '08802',
    industryMainOrderLabel: null,
    industrySubOrder: null,
    businessActivity: null,
    factoryAddress: address,
    provinceName: null,
    industrialEstateName: null,
    latitude: null,
    longitude: null,
    eia: null,
    eiaOther: null,
    projectName: null,
    factoryFrontPhotos: [],
    factoryLogo: null,
    updatedAt: '2026-10-30T00:00:00.1234567Z',
    systemTypes: ['CEMS'],
    measurementPointCount: 1,
    pendingEditRequestCount: 0,
    measurementPoints: [
      {
        connectedPointId: 1,
        sourceMeasurementPointId: 1,
        eligibleFactoryId: 430,
        factoryId: registration,
        factoryName: 'โรงงานทดสอบ',
        systemType: 'CEMS',
        pointName: 'ปล่อง 1',
        pointCode: 'S0001',
        pointType: 'STACK',
        parameters: [],
        monitoringPointStatus: null,
        details: null,
        documentsAndImages: [],
        measurementInstruments: null,
        updatedAt: '2026-10-30T00:00:00Z',
      },
    ],
  };
}

function storedRequest(current: PomsFactoryDetailDTO): PomsFactoryEditRequestDTO {
  return {
    id: 1,
    requestNo: 'POMS-0001/2569',
    eligibleFactoryId: current.eligibleFactoryId,
    factoryId: current.factoryId,
    factoryRegistrationNo: current.factoryRegistrationNo,
    factoryName: current.factoryName,
    formType: 'BASIC_INFO',
    status: 'PENDING_REVIEW',
    statusLabel: 'รอพิจารณา',
    revisionNo: 0,
    isOpen: true,
    requestNote: null,
    revisionReason: null,
    officerNote: null,
    currentFactory: Object.freeze({ ...current }),
    proposedFactory: Object.freeze({ ...current, projectName: 'โครงการใหม่' }),
    currentMeasurementPoints: null,
    proposedMeasurementPoints: null,
    submittedBy: 1,
    reviewedBy: null,
    submittedAt: current.updatedAt,
    reviewedAt: null,
    approvedAt: null,
    createdBy: 1,
    createdAt: current.updatedAt,
    updatedAt: current.updatedAt,
    events: [],
  };
}

describe.each(['legacy', 'canonical'])('POMS blank geography reads in %s mode', (mode) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    mockSourceDb.mockImplementation((table) => {
      if (table !== 'dbo.TUMBOL') throw new Error('Do not use current factory source for history');
      return {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        timeout: jest.fn().mockReturnThis(),
        select: jest.fn(async () => [area]),
      };
    });
    repository.findFactoryDetail.mockResolvedValue(factoryDetail());
    repository.findFactoryFormContacts.mockResolvedValue(null);
    repository.findOpenEditRequestForFactory.mockResolvedValue(null);
    repository.findEditRequestById.mockResolvedValue(storedRequest(factoryDetail()));
    repository.createEditRequest.mockResolvedValue(storedRequest(factoryDetail()));
  });

  it('propagates the resolved province alias without adding fields to the live list contract', async () => {
    const row = {
      id: 430,
      factoryId: registration,
      newRegistrationNo: registration,
      oldRegistrationNo: null,
      address,
      province: '  ',
    } as OperatorFactoryTableRowDTO;
    repository.listFactories.mockResolvedValue([Object.freeze(row)]);
    const result = await pomsFactoriesService.listFactories(1, 'ALL');
    expect(result.data[0]).toEqual({ ...row, province: 'ระยอง' });
    expect(Object.keys(result.data[0]).sort()).toEqual(Object.keys(row).sort());
    expect(row.province).toBe('  ');
  });

  it('fills the live detail province without mutating the persisted profile', async () => {
    const current = Object.freeze(factoryDetail());
    repository.findFactoryDetail.mockResolvedValue(current);
    const result = await pomsFactoriesService.getFactoryDetail(registration, 1, 'ALL');
    expect(result).toEqual({ ...current, provinceName: 'ระยอง' });
    expect(current.provinceName).toBeNull();
  });

  it.each(['current', 'edit'] as const)(
    'fills all existing location name fields on the %s form while preserving address and codes',
    async (kind) => {
      const result =
        kind === 'current'
          ? await pomsFactoriesService.getFactoryForm(registration, 1, 'ALL', {})
          : await pomsFactoriesService.getEditRequestForm(1, 1, 'ALL', {});
      expect(result).toMatchObject({
        address,
        provinceName: 'ระยอง',
        districtName: 'ปลวกแดง',
        subdistrictName: 'มาบยางพร',
        provinceCode: null,
        districtCode: null,
        subdistrictCode: null,
      });
      expect(repository.createEditRequest).not.toHaveBeenCalled();
    },
  );

  it('enriches request response profiles without changing stored history snapshots', async () => {
    const request = Object.freeze(storedRequest(factoryDetail()));
    repository.findEditRequestById.mockResolvedValue(request);
    const result = await pomsFactoriesService.getEditRequest(1, 1, 'ALL');
    expect(result.currentFactory.provinceName).toBe('ระยอง');
    expect(result.proposedFactory.provinceName).toBe('ระยอง');
    expect(result.currentFactory.factoryAddress).toBe(address);
    expect(result.currentFactory).not.toHaveProperty('districtName');
    expect(request.currentFactory.provinceName).toBeNull();
    expect(request.proposedFactory.provinceName).toBeNull();
    expect(request.updatedAt).toBe(result.updatedAt);
  });

  it('keeps write snapshots raw while filling the response province after persistence', async () => {
    const current = Object.freeze(factoryDetail());
    repository.findFactoryDetail.mockResolvedValue(current);
    const result = await pomsFactoriesService.createEditRequest(
      registration,
      { projectName: 'โครงการใหม่' },
      1,
      'ALL',
    );
    expect(repository.createEditRequest.mock.calls[0][0]).toBe(current);
    expect(repository.createEditRequest.mock.calls[0][1].proposedFactory.provinceName).toBeNull();
    expect(result.currentFactory.provinceName).toBe('ระยอง');
    expect(result.proposedFactory.provinceName).toBe('ระยอง');
  });
});
