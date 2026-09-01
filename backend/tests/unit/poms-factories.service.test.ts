import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: {
    listFactories: jest.fn(),
    findFactoryDetail: jest.fn(),
    findOpenEditRequestForFactory: jest.fn(),
    createEditRequest: jest.fn(),
    listEditRequests: jest.fn(),
    findEditRequestById: jest.fn(),
    resubmitEditRequest: jest.fn(),
    reviewEditRequest: jest.fn(),
  },
}));

import { ConflictError, ForbiddenError, NotFoundError } from '../../src/shared/errors/AppError';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import type {
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestDTO,
  PomsFactoryEditRequestStatus,
} from '../../src/modules/poms-factories/poms-factories.types';

const mockedRepository = jest.mocked(pomsFactoriesRepository);
const ownFactoryScope = { scope: 'OWN_FACTORY' as const };

describe('pomsFactoriesService edit-request workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.findFactoryDetail.mockResolvedValue(factoryDetail());
    mockedRepository.findOpenEditRequestForFactory.mockResolvedValue(null);
    mockedRepository.createEditRequest.mockResolvedValue(editRequest('PENDING_REVIEW'));
    mockedRepository.findEditRequestById.mockResolvedValue(editRequest('PENDING_REVIEW'));
    mockedRepository.resubmitEditRequest.mockResolvedValue(
      editRequest('REVISED_PENDING_REVIEW', { revisionNo: 1 }),
    );
    mockedRepository.reviewEditRequest.mockResolvedValue(editRequest('APPROVED'));
  });

  it('creates PENDING_REVIEW from current live POMS data and preserves omitted fields', async () => {
    const result = await pomsFactoriesService.createEditRequest(
      'factory-001',
      {
        factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
        projectName: null,
        note: 'ขอเปลี่ยนชื่อและล้างชื่อโครงการ',
      },
      42,
      ownFactoryScope,
      null,
    );

    expect(result.status).toBe('PENDING_REVIEW');
    expect(mockedRepository.createEditRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        factoryAddress: '99 หมู่ 1',
        projectName: 'โครงการเดิม',
      }),
      expect.objectContaining({
        formType: 'BASIC_INFO',
        proposedFactory: expect.objectContaining({
          factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
          factoryAddress: '99 หมู่ 1',
          projectName: null,
          factoryFrontPhotos: [expect.objectContaining({ fileName: 'front.jpg' })],
        }),
        proposedMeasurementPoints: null,
      }),
      'ขอเปลี่ยนชื่อและล้างชื่อโครงการ',
      42,
    );
    const payload = mockedRepository.createEditRequest.mock.calls[0]?.[1];
    expect(payload?.proposedFactory).not.toHaveProperty('measurementPoints');
    expect(payload?.proposedFactory).not.toHaveProperty('systemTypes');
    expect(payload?.proposedFactory).not.toHaveProperty('pendingEditRequestCount');
  });

  it('rejects a second open request for the same factory', async () => {
    mockedRepository.findOpenEditRequestForFactory.mockResolvedValue(
      editRequest('REVISION_REQUESTED'),
    );

    await expect(
      pomsFactoriesService.createEditRequest(
        'factory-001',
        { factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)' },
        42,
        ownFactoryScope,
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mockedRepository.createEditRequest).not.toHaveBeenCalled();
  });

  it('returns not found when the factory is outside factories:view scope', async () => {
    mockedRepository.findFactoryDetail.mockResolvedValue(null);

    await expect(
      pomsFactoriesService.createEditRequest(
        'factory-outside-scope',
        { factoryName: 'โรงงานนอกขอบเขต' },
        42,
        ownFactoryScope,
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('resubmits only REVISION_REQUESTED and moves it to REVISED_PENDING_REVIEW', async () => {
    mockedRepository.findEditRequestById.mockResolvedValue(editRequest('REVISION_REQUESTED'));

    const result = await pomsFactoriesService.resubmitEditRequest(
      11,
      {
        factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไขแล้ว)',
        factoryLogo: null,
        note: 'แก้ไขตามข้อสังเกตแล้ว',
      },
      42,
      ownFactoryScope,
      null,
    );

    expect(result.status).toBe('REVISED_PENDING_REVIEW');
    expect(result.revisionNo).toBe(1);
    expect(mockedRepository.resubmitEditRequest).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        formType: 'BASIC_INFO',
        proposedFactory: expect.objectContaining({
          factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไขแล้ว)',
          factoryLogo: null,
        }),
      }),
      'แก้ไขตามข้อสังเกตแล้ว',
      42,
    );
  });

  it('creates a measurement-point edit request from current live POMS points', async () => {
    await pomsFactoriesService.createEditRequest(
      'factory-001',
      {
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [
          {
            connectedPointId: 15,
            pointName: 'ปล่อง A (แก้ไข)',
            monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
          },
        ],
        note: 'ขอแก้ไขสถานะจุดตรวจวัด',
      },
      42,
      ownFactoryScope,
      null,
    );

    expect(mockedRepository.findOpenEditRequestForFactory).toHaveBeenCalledWith(
      7,
      'MEASUREMENT_POINTS',
    );
    expect(mockedRepository.createEditRequest).toHaveBeenCalledWith(
      expect.objectContaining({ eligibleFactoryId: 7 }),
      expect.objectContaining({
        formType: 'MEASUREMENT_POINTS',
        proposedFactory: expect.objectContaining({ factoryName: 'บริษัท ทดสอบ จำกัด' }),
        proposedMeasurementPoints: [
          expect.objectContaining({
            connectedPointId: 15,
            pointName: 'ปล่อง A (แก้ไข)',
            pointCode: 'S0001',
            pointType: 'STACK',
            parameters: ['CO (ppm)'],
            monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
          }),
        ],
      }),
      'ขอแก้ไขสถานะจุดตรวจวัด',
      42,
    );
  });

  it('resubmits a measurement-point request without allowing the form type to change', async () => {
    const measurementPoints = factoryDetail().measurementPoints;
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest('REVISION_REQUESTED', {
        formType: 'MEASUREMENT_POINTS',
        currentMeasurementPoints: measurementPoints,
        proposedMeasurementPoints: measurementPoints,
      }),
    );

    await pomsFactoriesService.resubmitEditRequest(
      11,
      {
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [
          {
            connectedPointId: 15,
            details: { stackHeight: 40 },
          },
        ],
      },
      42,
      ownFactoryScope,
      null,
    );

    expect(mockedRepository.resubmitEditRequest).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        formType: 'MEASUREMENT_POINTS',
        proposedMeasurementPoints: [
          expect.objectContaining({
            connectedPointId: 15,
            pointCode: 'S0001',
            pointType: 'STACK',
            parameters: ['CO (ppm)'],
            details: { stackHeight: 40 },
          }),
        ],
      }),
      null,
      42,
    );
  });

  it.each(['PENDING_REVIEW', 'REVISED_PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const)(
    'rejects resubmission from %s',
    async (status) => {
      mockedRepository.findEditRequestById.mockResolvedValue(editRequest(status));

      await expect(
        pomsFactoriesService.resubmitEditRequest(
          11,
          { factoryName: 'บริษัท ทดสอบ จำกัด' },
          42,
          ownFactoryScope,
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockedRepository.resubmitEditRequest).not.toHaveBeenCalled();
    },
  );

  it('prevents the current submitter from reviewing their own request', async () => {
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest('PENDING_REVIEW', { submittedBy: 42 }),
    );

    await expect(
      pomsFactoriesService.reviewEditRequest(
        11,
        { decision: 'APPROVE', officerNote: null },
        42,
        { userType: 'admin', roles: ['admin'] },
        { scope: 'ALL' },
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockedRepository.reviewEditRequest).not.toHaveBeenCalled();
  });

  it('prevents the original creator from reviewing after another user resubmits', async () => {
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest('REVISED_PENDING_REVIEW', { createdBy: 42, submittedBy: 55 }),
    );

    await expect(
      pomsFactoriesService.reviewEditRequest(
        11,
        { decision: 'APPROVE', officerNote: null },
        42,
        { userType: 'admin', roles: ['admin'] },
        { scope: 'ALL' },
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockedRepository.reviewEditRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['PENDING_REVIEW', 'APPROVE', 'APPROVED'],
    ['PENDING_REVIEW', 'REQUEST_REVISION', 'REVISION_REQUESTED'],
    ['PENDING_REVIEW', 'REJECT', 'REJECTED'],
    ['REVISED_PENDING_REVIEW', 'APPROVE', 'APPROVED'],
    ['REVISED_PENDING_REVIEW', 'REQUEST_REVISION', 'REVISION_REQUESTED'],
    ['REVISED_PENDING_REVIEW', 'REJECT', 'REJECTED'],
  ] as const)('allows %s --%s--> %s', async (fromStatus, decision, expectedStatus) => {
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest(fromStatus, { submittedBy: 42 }),
    );
    mockedRepository.reviewEditRequest.mockResolvedValue(
      editRequest(expectedStatus, { submittedBy: 42, reviewedBy: 77 }),
    );
    const input =
      decision === 'REQUEST_REVISION'
        ? {
            decision,
            revisionReason: 'กรุณาแนบภาพด้านหน้าใหม่',
            officerNote: null,
          }
        : {
            decision,
            revisionReason: null,
            officerNote: decision === 'REJECT' ? 'ข้อมูลไม่ตรงกับหลักฐาน' : null,
          };

    const result = await pomsFactoriesService.reviewEditRequest(
      11,
      input,
      77,
      { userType: 'admin', roles: ['admin'] },
      { scope: 'ALL' },
      null,
    );

    expect(result.status).toBe(expectedStatus);
    expect(mockedRepository.reviewEditRequest).toHaveBeenCalledWith(11, input, 77);
  });

  it.each(['REVISION_REQUESTED', 'APPROVED', 'REJECTED'] as const)(
    'rejects review from %s',
    async (status) => {
      mockedRepository.findEditRequestById.mockResolvedValue(
        editRequest(status, { submittedBy: 42 }),
      );

      await expect(
        pomsFactoriesService.reviewEditRequest(
          11,
          { decision: 'APPROVE', officerNote: null },
          77,
          { userType: 'admin', roles: ['admin'] },
          { scope: 'ALL' },
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockedRepository.reviewEditRequest).not.toHaveBeenCalled();
    },
  );

  it('rejects review when the approver is not admin even if they have approve permission', async () => {
    await expect(
      pomsFactoriesService.reviewEditRequest(
        11,
        { decision: 'APPROVE', officerNote: 'ข้อมูลครบถ้วน' },
        77,
        { userType: 'officer', roles: ['monitoring_kpm'] },
        { scope: 'ALL' },
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockedRepository.reviewEditRequest).not.toHaveBeenCalled();
  });
});

function factoryDetail(): PomsFactoryDetailDTO {
  return {
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryAddress: '99 หมู่ 1',
    provinceName: 'ระยอง',
    industrialEstateName: null,
    latitude: 12.7,
    longitude: 101.1,
    eia: 'มี EIA' as const,
    eiaOther: null,
    projectName: 'โครงการเดิม',
    factoryFrontPhotos: [
      {
        title: 'ภาพด้านหน้า',
        fileName: 'front.jpg',
        fileUrl: 'https://example.com/front.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
      },
    ],
    factoryLogo: null,
    systemTypes: ['CEMS'],
    measurementPointCount: 1,
    pendingEditRequestCount: 0,
    updatedAt: '2026-08-24T00:00:00.000Z',
    measurementPoints: [
      {
        connectedPointId: 15,
        sourceMeasurementPointId: 2,
        eligibleFactoryId: 7,
        factoryId: 'factory-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        systemType: 'CEMS' as const,
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        pointType: 'STACK' as const,
        parameters: ['CO (ppm)'],
        monitoringPointStatus: 'เชื่อมต่อครบแล้ว' as const,
        details: null,
        documentsAndImages: [],
        measurementInstruments: null,
        updatedAt: '2026-08-24T00:00:00.000Z',
      },
    ],
  };
}

function editRequest(
  status: PomsFactoryEditRequestStatus,
  overrides: Partial<PomsFactoryEditRequestDTO> = {},
): PomsFactoryEditRequestDTO {
  return {
    id: 11,
    requestNo: 'PFE-20260824-ABC12345',
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
    formType: 'BASIC_INFO',
    status,
    statusLabel: status,
    revisionNo: 0,
    isOpen: !['APPROVED', 'REJECTED'].includes(status),
    requestNote: null,
    revisionReason: status === 'REVISION_REQUESTED' ? 'แก้ไขหลักฐาน' : null,
    officerNote: null,
    currentFactory: factoryDetail(),
    proposedFactory: factoryDetail(),
    currentMeasurementPoints: null,
    proposedMeasurementPoints: null,
    submittedBy: 42,
    reviewedBy: null,
    submittedAt: '2026-08-24T00:00:00.000Z',
    reviewedAt: null,
    approvedAt: null,
    createdBy: 42,
    events: [],
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}
