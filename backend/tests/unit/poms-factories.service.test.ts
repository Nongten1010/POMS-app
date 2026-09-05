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

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/shared/errors/AppError';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import type {
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestDTO,
  PomsFactoryEditRequestStatus,
  PomsFactoryProfileDTO,
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

  it('returns the exact operator-factories table row contract for live POMS factories', async () => {
    const row = factoryOperatorTableRow();
    mockedRepository.listFactories.mockResolvedValue([row]);

    const result = await pomsFactoriesService.listFactories(42, ownFactoryScope, 'ทดสอบ', null);

    expect(mockedRepository.listFactories).toHaveBeenCalledWith(
      { actorUserId: 42, scope: ownFactoryScope, regionalAccess: null },
      'ทดสอบ',
    );
    expect(result).toEqual({ data: [row], meta: { total: 1 } });
    expect(Object.keys(result.data[0]).sort()).toEqual(
      Object.keys(factoryOperatorTableRow()).sort(),
    );
    for (const legacyField of LEGACY_POMS_FACTORY_LIST_FIELDS) {
      expect(result.data[0]).not.toHaveProperty(legacyField);
    }
  });

  it('builds a POMS form with the exact connection-request field names and live values', async () => {
    const result = await pomsFactoriesService.getFactoryForm(
      'factory-001',
      42,
      ownFactoryScope,
      { formType: 'BASIC_INFO', systemType: 'CEMS' },
      null,
    );

    expect(result).toEqual(
      expect.objectContaining({
        factoryId: 'factory-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        factoryRegistrationNo: '3-106-33/50สบ',
        industryMainOrder: '00042',
        industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 00042',
        industrySubOrder: '04201',
        businessActivity: 'ผลิตเคมีภัณฑ์',
        address: '99 หมู่ 1',
        systemType: 'CEMS',
        contactName: '',
        contactPhone: '',
        measurementPoints: [
          expect.objectContaining({
            pointName: 'ปล่อง A',
            pointCode: 'S0001',
            pointType: 'STACK',
            latitude: null,
            longitude: null,
            parameters: ['CO (ppm)'],
            description: null,
            documentsAndImages: [
              expect.objectContaining({
                title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
                fileName: 'front.jpg',
              }),
            ],
          }),
        ],
      }),
    );
    expect(result).not.toHaveProperty('formType');
    expect(result).not.toHaveProperty('formDefaults');
    expect(result).not.toHaveProperty('factoryAddress');
    expect(result).not.toHaveProperty('systemTypes');
    expect(result.measurementPoints[0]).not.toHaveProperty('connectedPointId');
    expect(result.measurementPoints[0]).not.toHaveProperty('sourceMeasurementPointId');
  });

  it('keeps eligible-factory industry fields in the WPMS measurement-points form', async () => {
    const detail = factoryDetail();
    mockedRepository.findFactoryDetail.mockResolvedValue({
      ...detail,
      factoryId: '91090100125393',
      factoryRegistrationNo: '91090100125393',
      industryMainOrder: '09109',
      industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 09109',
      industrySubOrder: '00125,00393',
      businessActivity: 'ประกอบกิจการทดสอบ',
      systemTypes: ['WPMS'],
      measurementPoints: detail.measurementPoints.map((point) => ({
        ...point,
        factoryId: '91090100125393',
        systemType: 'WPMS',
        pointType: 'WASTEWATER',
      })),
    });
    const result = await pomsFactoriesService.getFactoryForm(
      '91090100125393',
      42,
      ownFactoryScope,
      { formType: 'MEASUREMENT_POINTS', systemType: 'WPMS' },
      null,
    );

    expect(result).toEqual(
      expect.objectContaining({
        industryMainOrder: '09109',
        industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 09109',
        industrySubOrder: '00125,00393',
        businessActivity: 'ประกอบกิจการทดสอบ',
        systemType: 'WPMS',
      }),
    );
  });

  it('requires systemType when a live factory has both CEMS and WPMS points', async () => {
    const detail = factoryDetail();
    mockedRepository.findFactoryDetail.mockResolvedValue({
      ...detail,
      systemTypes: ['CEMS', 'WPMS'],
      measurementPointCount: 2,
      measurementPoints: [
        ...detail.measurementPoints,
        {
          ...detail.measurementPoints[0],
          connectedPointId: 16,
          sourceMeasurementPointId: 3,
          systemType: 'WPMS',
          pointName: 'จุดระบายน้ำ A',
          pointCode: 'P0001',
          pointType: 'WASTEWATER',
        },
      ],
    });

    await expect(
      pomsFactoriesService.getFactoryForm(
        'factory-001',
        42,
        ownFactoryScope,
        { formType: 'MEASUREMENT_POINTS' },
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('prefills only editable proposed values and keeps live identity from legacy requests', async () => {
    const {
      industryMainOrder: _industryMainOrder,
      industryMainOrderLabel: _industryMainOrderLabel,
      industrySubOrder: _industrySubOrder,
      businessActivity: _businessActivity,
      ...legacyProfile
    } = factoryDetail();
    const proposedFactory = {
      ...legacyProfile,
      factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไข)',
      factoryAddress: '100 หมู่ 2',
      projectName: 'โครงการที่แก้ไข',
      latitude: 13.1,
    } as unknown as PomsFactoryProfileDTO;
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest('REVISION_REQUESTED', {
        requestNote: 'แก้ไขข้อมูลตามเอกสารล่าสุด',
        proposedFactory,
      }),
    );

    const result = await pomsFactoriesService.getEditRequestForm(
      11,
      42,
      ownFactoryScope,
      { systemType: 'CEMS' },
      null,
    );

    expect(result.factoryName).toBe('บริษัท ทดสอบ จำกัด');
    expect(result.address).toBe('99 หมู่ 1');
    expect(result.projectName).toBe('โครงการที่แก้ไข');
    expect(result.latitude).toBe(13.1);
    expect(result.industryMainOrder).toBe('00042');
    expect(result.industrySubOrder).toBe('04201');
    expect(result.businessActivity).toBe('ผลิตเคมีภัณฑ์');
    expect(result.remarks).toBe('แก้ไขข้อมูลตามเอกสารล่าสุด');
    expect(result).not.toHaveProperty('revisionReason');
    expect(result).not.toHaveProperty('requestNo');
  });

  it('creates PENDING_REVIEW from current live POMS data and preserves omitted fields', async () => {
    const result = await pomsFactoriesService.createEditRequest(
      'factory-001',
      {
        projectName: null,
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
          factoryName: 'บริษัท ทดสอบ จำกัด',
          factoryAddress: '99 หมู่ 1',
          projectName: null,
          factoryFrontPhotos: [expect.objectContaining({ fileName: 'front.jpg' })],
        }),
        proposedMeasurementPoints: null,
      }),
      null,
      42,
    );
    const payload = mockedRepository.createEditRequest.mock.calls[0]?.[1];
    expect(payload?.proposedFactory).not.toHaveProperty('measurementPoints');
    expect(payload?.proposedFactory).not.toHaveProperty('systemTypes');
    expect(payload?.proposedFactory).not.toHaveProperty('pendingEditRequestCount');
  });

  it('ignores forged read-only profile fields and request notes before creating a request', async () => {
    const input = {
      projectName: 'โครงการใหม่',
      factoryName: 'ชื่อที่ไม่ได้รับอนุญาต',
      factoryAddress: 'ที่อยู่ที่ไม่ได้รับอนุญาต',
      factoryRegistrationNo: 'ทะเบียนที่ไม่ได้รับอนุญาต',
      note: 'หมายเหตุที่ไม่ได้รับอนุญาต',
    };

    await pomsFactoriesService.createEditRequest('factory-001', input, 42, ownFactoryScope, null);

    expect(mockedRepository.createEditRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        proposedFactory: expect.objectContaining({
          factoryName: 'บริษัท ทดสอบ จำกัด',
          factoryAddress: '99 หมู่ 1',
          factoryRegistrationNo: '3-106-33/50สบ',
          projectName: 'โครงการใหม่',
        }),
      }),
      null,
      42,
    );
  });

  it('rejects requests with no changes to editable profile fields', async () => {
    await expect(
      pomsFactoriesService.createEditRequest(
        'factory-001',
        { projectName: 'โครงการเดิม' },
        42,
        ownFactoryScope,
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mockedRepository.createEditRequest).not.toHaveBeenCalled();
  });

  it('rejects a second open request for the same factory', async () => {
    mockedRepository.findOpenEditRequestForFactory.mockResolvedValue(
      editRequest('REVISION_REQUESTED'),
    );

    await expect(
      pomsFactoriesService.createEditRequest(
        'factory-001',
        { projectName: 'โครงการใหม่' },
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
        { projectName: 'โครงการนอกขอบเขต' },
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
        projectName: 'โครงการที่แก้ไขแล้ว',
        factoryLogo: null,
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
          factoryName: 'บริษัท ทดสอบ จำกัด',
          factoryAddress: '99 หมู่ 1',
          projectName: 'โครงการที่แก้ไขแล้ว',
          factoryLogo: null,
        }),
      }),
      null,
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

  it.each(['create', 'resubmit'] as const)(
    'allows a general-factory-only change on measurement-point %s',
    async (operation) => {
      const current = factoryDetail();
      mockedRepository.findEditRequestById.mockResolvedValue(
        editRequest('REVISION_REQUESTED', {
          formType: 'MEASUREMENT_POINTS',
          currentMeasurementPoints: current.measurementPoints,
          proposedMeasurementPoints: current.measurementPoints,
        }),
      );
      const input = {
        formType: 'MEASUREMENT_POINTS' as const,
        projectName: 'โครงการใหม่',
        factoryFrontPhotos: [],
        factoryLogo: null,
        measurementPoints: [
          { connectedPointId: 15, pointName: current.measurementPoints[0].pointName },
        ],
      };
      if (operation === 'create') {
        await pomsFactoriesService.createEditRequest(
          'factory-001',
          input,
          42,
          ownFactoryScope,
          null,
        );
      } else {
        await pomsFactoriesService.resubmitEditRequest(11, input, 42, ownFactoryScope, null);
      }
      const payload =
        operation === 'create'
          ? mockedRepository.createEditRequest.mock.calls[0]?.[1]
          : mockedRepository.resubmitEditRequest.mock.calls[0]?.[1];
      expect(payload?.proposedFactory).toMatchObject({
        projectName: 'โครงการใหม่',
        factoryFrontPhotos: [],
        factoryLogo: null,
        factoryName: current.factoryName,
        factoryAddress: current.factoryAddress,
        latitude: current.latitude,
        longitude: current.longitude,
      });
      expect(payload?.proposedMeasurementPoints).toEqual(current.measurementPoints);
    },
  );

  it('prefills proposed general factory values and documents in a measurement-point revision', async () => {
    const current = factoryDetail();
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest('REVISION_REQUESTED', {
        formType: 'MEASUREMENT_POINTS',
        proposedFactory: {
          ...current,
          projectName: 'โครงการใหม่',
          latitude: 13.1,
          factoryFrontPhotos: [],
          factoryLogo: null,
        },
        currentMeasurementPoints: current.measurementPoints,
        proposedMeasurementPoints: current.measurementPoints,
      }),
    );
    const result = await pomsFactoriesService.getEditRequestForm(11, 42, ownFactoryScope, {
      systemType: 'CEMS',
    });
    expect(result).toMatchObject({
      projectName: 'โครงการใหม่',
      latitude: 13.1,
      factoryName: current.factoryName,
      address: current.factoryAddress,
    });
    expect(result.measurementPoints[0].documentsAndImages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fileName: 'front.jpg' })]),
    );
  });

  it('rejects a measurement-point request when neither factory nor point data changed', async () => {
    const current = factoryDetail();
    await expect(
      pomsFactoriesService.createEditRequest(
        'factory-001',
        {
          formType: 'MEASUREMENT_POINTS',
          projectName: current.projectName,
          measurementPoints: [
            { connectedPointId: 15, pointName: current.measurementPoints[0].pointName },
          ],
        },
        42,
        ownFactoryScope,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mockedRepository.createEditRequest).not.toHaveBeenCalled();
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
          { projectName: 'โครงการใหม่' },
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
    industryMainOrder: '00042',
    industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 00042',
    industrySubOrder: '04201',
    businessActivity: 'ผลิตเคมีภัณฑ์',
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
        title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
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

const LEGACY_POMS_FACTORY_LIST_FIELDS = [
  'eligibleFactoryId',
  'factoryRegistrationNo',
  'factoryAddress',
  'provinceName',
  'industrialEstateName',
  'eiaOther',
  'factoryFrontPhotos',
  'factoryLogo',
  'systemTypes',
  'measurementPointCount',
  'pendingEditRequestCount',
  'updatedAt',
] as const;

function factoryOperatorTableRow() {
  return {
    id: 7,
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    newRegistrationNo: '3-106-33/50สบ',
    oldRegistrationNo: null,
    industryType: 'ผลิตเคมีภัณฑ์',
    industryMainOrder: '00042',
    industrySubOrder: '01',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี EIA' as const,
    projectName: 'โครงการเดิม',
    address: '99 หมู่ 1',
    latitude: '12.7',
    longitude: '101.1',
    province: 'ระยอง',
    officerNotificationEmails: [],
    isEligible: true,
    eligibilityStatus: 'เข้าข่าย' as const,
    monitoringPointCount: 1,
    requestStatusCode: 'CONNECTED' as const,
    eligibilityRequest: null,
    canRequestEligibility: false,
    status: 'แสดง' as const,
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
