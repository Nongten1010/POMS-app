import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenError } from '../../src/shared/errors/AppError';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.service', () => ({
  bodCodDeviationReportsService: {
    listFactories: jest.fn(),
    listReports: jest.fn(),
    createReport: jest.fn(),
    resubmitReport: jest.fn(),
    changeWorkflowStatus: jest.fn(),
    getReportById: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { bodCodDeviationReportsService } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.service';
import type { CreateBodCodDeviationReportDTO } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.types';

const mockedService = jest.mocked(bodCodDeviationReportsService);

describe('BOD/COD deviation report routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.listFactories.mockResolvedValue({
      data: [
        {
          id: 'FID-001',
          factoryId: 'FID-001',
          factoryName: 'บริษัท ทดสอบน้ำเสีย จำกัด',
          factoryRegistration: '10520000225172',
          newRegistrationNo: '10520000225172',
          oldRegistrationNo: '3-1-2/17ลป',
          province: 'ลำปาง',
          provinceName: 'ลำปาง',
          regionName: 'ภาคเหนือ',
          industrialEstateName: null,
          address: '99 หมู่ 1',
          eligibleFactoryId: 10,
          latestReportId: 5,
          latestReportNo: 'BODCOD-2569-0005',
          latestReportStatus: 'SUBMITTED',
          latestReportStatusLabel: 'รอพิจารณา',
          industryType: 'ผลิตอาหารและเครื่องดื่ม',
          monitoringPointCount: 1,
          measurementPoints: [
            {
              id: 9,
              stationId: 'P0001',
              code: 'P0001',
              name: 'จุดระบายน้ำทิ้ง A',
              type: 'WPMS',
              parameters: 'BOD, COD',
              parameterCodes: ['BOD', 'COD'],
              round1Status: 'รอพิจารณา',
              round2Status: 'ยังไม่ยื่น',
              pointCode: 'P0001',
              pointName: 'จุดระบายน้ำทิ้ง A',
              pointType: 'WASTEWATER',
              systemType: 'WPMS',
              reportSlots: [
                {
                  roundNo: 1,
                  year: 2569,
                  status: 'SUBMITTED',
                  statusLabel: 'รอพิจารณา',
                  reportId: 5,
                  reportNo: 'BODCOD-2569-0005',
                },
                {
                  roundNo: 2,
                  year: 2569,
                  status: 'NOT_SUBMITTED',
                  statusLabel: 'ยังไม่ยื่น',
                  reportId: null,
                  reportNo: null,
                },
              ],
            },
          ],
        },
      ],
      meta: { total: 1 },
    });
    mockedService.listReports.mockResolvedValue({
      data: [
        {
          id: 5,
          reportNo: 'BODCOD-2569-0005',
          reportRound: 'ครั้งที่ 2',
          reportRoundNo: 2,
          reportYear: 2569,
          year: 2569,
          selectedParameterCode: 'BOD',
          selectedParameterLabel: 'BOD (mg/l)',
          factoryId: 'FID-001',
          factoryName: 'บริษัท ทดสอบน้ำเสีย จำกัด',
          factoryRegistration: '10520000225172',
          factoryRegistrationNo: '10520000225172',
          monitoringPointId: 9,
          monitoringPointCode: 'P0001',
          monitoringPointName: 'จุดระบายน้ำทิ้ง A',
          province: 'ลำปาง',
          provinceName: 'ลำปาง',
          approvalTrack: 'REGIONAL',
          status: 'ส่งรายงานแล้ว',
          statusCode: 'SUBMITTED',
          statusLabel: 'ส่งรายงานแล้ว',
          submittedDate: '01/07/2569',
          reviewedDate: '-',
          submittedAt: '2026-07-01T10:00:00.000Z',
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T10:00:00.000Z',
          measurementCount: 1,
        },
      ],
      meta: { total: 1 },
    });
    mockedService.createReport.mockResolvedValue({
      id: 9,
      reportNo: 'BODCOD-2569-0009',
      statusCode: 'SUBMITTED',
      approvalTrack: 'REGIONAL',
      currentStep: {
        stepNo: 1,
        roleCode: 'INSPECTOR',
        roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
        status: 'PENDING',
        isCurrent: true,
      },
      steps: [
        {
          stepNo: 1,
          roleCode: 'INSPECTOR',
          roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
          status: 'PENDING',
          isCurrent: true,
        },
        {
          stepNo: 2,
          roleCode: 'APPROVER',
          roleLabel: 'ผอ.ศูนย์ (อนุมัติ)',
          status: 'WAITING',
          isCurrent: false,
        },
      ],
      allowedActions: ['CANCEL'],
    });
    mockedService.resubmitReport.mockResolvedValue({
      id: 9,
      reportNo: 'BODCOD-2569-0009',
      statusCode: 'REVISED_PENDING_REVIEW',
      approvalTrack: 'REGIONAL',
      currentStep: {
        id: 15,
        stepNo: 1,
        roleCode: 'INSPECTOR',
        roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
        status: 'PENDING',
        isCurrent: true,
      },
      steps: [
        {
          id: 15,
          stepNo: 1,
          roleCode: 'INSPECTOR',
          roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
          status: 'PENDING',
          isCurrent: true,
        },
        {
          id: 16,
          stepNo: 2,
          roleCode: 'APPROVER',
          roleLabel: 'ผอ.ศูนย์ (อนุมัติ)',
          status: 'WAITING',
          isCurrent: false,
        },
      ],
      allowedActions: ['CANCEL'],
    });
    mockedService.changeWorkflowStatus.mockResolvedValue({
      id: 9,
      reportNo: 'BODCOD-2569-0009',
      statusCode: 'WAITING_APPROVAL',
      approvalTrack: 'REGIONAL',
      currentStep: {
        id: 16,
        stepNo: 2,
        roleCode: 'APPROVER',
        roleLabel: 'ผอ.ศูนย์ (อนุมัติ)',
        status: 'PENDING',
        isCurrent: true,
      },
      steps: [
        {
          id: 15,
          stepNo: 1,
          roleCode: 'INSPECTOR',
          roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
          status: 'APPROVED',
          isCurrent: false,
        },
        {
          id: 16,
          stepNo: 2,
          roleCode: 'APPROVER',
          roleLabel: 'ผอ.ศูนย์ (อนุมัติ)',
          status: 'PENDING',
          isCurrent: true,
        },
      ],
      allowedActions: ['APPROVE', 'REQUEST_REVISION', 'REJECT'],
    });
    mockedService.getReportById.mockResolvedValue({
      id: 9,
      reportNo: 'BODCOD-2569-0009',
      reportRound: 'ครั้งที่ 1',
      reportRoundNo: 1,
      reportYear: 2569,
      year: 2569,
      selectedParameterCode: 'BOD',
      selectedParameterLabel: 'BOD (mg/l)',
      factoryId: 'FID-001',
      factoryName: 'บริษัท ทดสอบน้ำเสีย จำกัด',
      factoryRegistration: '10520000225172',
      factoryRegistrationNo: '10520000225172',
      monitoringPointId: 9,
      monitoringPointCode: 'P0001',
      monitoringPointName: 'จุดระบายน้ำทิ้ง A',
      province: 'ลำปาง',
      provinceName: 'ลำปาง',
      approvalTrack: 'REGIONAL',
      status: 'รอพิจารณา',
      statusCode: 'SUBMITTED',
      statusLabel: 'รอพิจารณา',
      submittedDate: '01/07/2569',
      reviewedDate: '-',
      submittedAt: '2026-07-01T10:00:00.000Z',
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      businessActivity: 'ผลิตอาหารและเครื่องดื่ม',
      factoryAddress: '99 หมู่ 1',
      wastewaterFlowM3PerHour: 120.5,
      samplerName: 'นายเก็บ ตัวอย่าง',
      officerRegistrationNo: 'LAB-001',
      laboratoryName: 'ห้องปฏิบัติการกลาง',
      laboratoryRegistrationNo: 'LAB-REG-001',
      labReportNo: 'LAB-REPORT-001',
      analysisMethod: 'Standard Methods',
      deviceBrand: 'Brand A',
      deviceModel: 'Model B',
      deviceSerialNo: 'SN-001',
      reporterName: 'นายรายงาน ผล',
      reporterPosition: 'เจ้าหน้าที่สิ่งแวดล้อม',
      measurements: [
        {
          id: 1,
          parameterCode: 'BOD',
          sampleDate: '2026-07-01',
          sampleTime: '09:30',
          deviceValueMgL: 12.5,
          labValueMgL: 10,
          deviationValueMgL: 2.5,
          standardDeviationMgL: 3,
          isWithinStandard: true,
          sortOrder: 1,
        },
      ],
      attachments: [],
      currentStep: {
        stepNo: 1,
        roleCode: 'INSPECTOR',
        roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
        status: 'PENDING',
        isCurrent: true,
      },
      steps: [
        {
          stepNo: 1,
          roleCode: 'INSPECTOR',
          roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
          status: 'PENDING',
          isCurrent: true,
        },
        {
          stepNo: 2,
          roleCode: 'APPROVER',
          roleLabel: 'ผอ.ศูนย์ (อนุมัติ)',
          status: 'WAITING',
          isCurrent: false,
        },
      ],
      allowedActions: ['CANCEL'],
    });
  });

  it('lists operator factories for the factory table with own-factory scope', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/bod-cod-deviation-reports/factories')
      .set('Authorization', `Bearer ${operatorToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.listFactories).toHaveBeenCalledWith(42, 'OWN_FACTORY', undefined);
    expect(response.body).toEqual({
      success: true,
      data: expect.any(Array),
      meta: { total: 1 },
    });
    expect(response.body.data[0]).toMatchObject({
      factoryId: 'FID-001',
      factoryName: 'บริษัท ทดสอบน้ำเสีย จำกัด',
      newRegistrationNo: '10520000225172',
      oldRegistrationNo: '3-1-2/17ลป',
      province: 'ลำปาง',
      monitoringPointCount: 1,
      measurementPoints: expect.arrayContaining([
        expect.objectContaining({
          code: 'P0001',
          name: 'จุดระบายน้ำทิ้ง A',
          type: 'WPMS',
          parameters: 'BOD, COD',
          round1Status: 'รอพิจารณา',
          round2Status: 'ยังไม่ยื่น',
          reportSlots: expect.arrayContaining([
            expect.objectContaining({ roundNo: 1, statusLabel: 'รอพิจารณา' }),
            expect.objectContaining({ roundNo: 2, statusLabel: 'ยังไม่ยื่น' }),
          ]),
        }),
      ]),
      latestReportStatusLabel: 'รอพิจารณา',
    });
  });

  it('lists report requests for officers using the BOD/COD menu permission scope', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/bod-cod-deviation-reports?status=SUBMITTED&parameterCode=BOD')
      .set('Authorization', `Bearer ${officerToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.listReports).toHaveBeenCalledWith(
      { status: 'SUBMITTED', parameterCode: 'BOD' },
      77,
      'ALL',
      { regions: ['ภาคเหนือ'] },
    );
    expect(response.body.data[0]).toMatchObject({
      reportNo: 'BODCOD-2569-0005',
      factoryRegistration: '10520000225172',
      province: 'ลำปาง',
      reportRound: 'ครั้งที่ 2',
      year: 2569,
      selectedParameterLabel: 'BOD (mg/l)',
      status: 'ส่งรายงานแล้ว',
      statusCode: 'SUBMITTED',
      submittedDate: '01/07/2569',
      reviewedDate: '-',
    });
  });

  it('rejects users without the BOD/COD report menu permission', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/bod-cod-deviation-reports')
      .set('Authorization', `Bearer ${tokenWithoutBodCodPermission()}`);

    expect(response.status).toBe(403);
    expect(mockedService.listReports).not.toHaveBeenCalled();
  });

  it('rejects the removed UNDER_REVIEW status filter for BOD/COD reports', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/bod-cod-deviation-reports?status=UNDER_REVIEW')
      .set('Authorization', `Bearer ${operatorToken()}`);

    expect(response.status).toBe(400);
    expect(mockedService.listReports).not.toHaveBeenCalled();
  });

  it('creates a submitted BOD/COD deviation form and initializes workflow steps', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/bod-cod-deviation-reports')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(createReportPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/bod-cod-deviation-reports/9');
    expect(mockedService.createReport).toHaveBeenCalledWith(createReportPayload(), {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    });
    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 9,
        reportNo: 'BODCOD-2569-0009',
        statusCode: 'SUBMITTED',
        approvalTrack: 'REGIONAL',
        currentStep: expect.objectContaining({
          stepNo: 1,
          roleCode: 'INSPECTOR',
        }),
        allowedActions: ['CANCEL'],
      }),
    });
  });

  it('gets a saved BOD/COD deviation form by id with workflow steps', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/bod-cod-deviation-reports/9')
      .set('Authorization', `Bearer ${operatorToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.getReportById).toHaveBeenCalledWith(9, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: undefined,
    });
    expect(response.body.data).toMatchObject({
      id: 9,
      reportNo: 'BODCOD-2569-0009',
      selectedParameterLabel: 'BOD (mg/l)',
      measurements: [
        expect.objectContaining({
          parameterCode: 'BOD',
          deviationValueMgL: 2.5,
          isWithinStandard: true,
        }),
      ],
      currentStep: expect.objectContaining({
        stepNo: 1,
        roleCode: 'INSPECTOR',
      }),
      allowedActions: ['CANCEL'],
    });
  });

  it('resubmits a returned BOD/COD deviation form with full replacement payload', async () => {
    const app = createApp();
    const payload = {
      ...createReportPayload(),
      revisionNote: 'แก้ไขผลตรวจวัดตามข้อสังเกตของเจ้าหน้าที่',
    };

    const response = await request(app)
      .put('/api/v1/bod-cod-deviation-reports/9/resubmission')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(mockedService.resubmitReport).toHaveBeenCalledWith(9, payload, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    });
    expect(response.body.data).toMatchObject({
      id: 9,
      statusCode: 'REVISED_PENDING_REVIEW',
      currentStep: {
        stepNo: 1,
        status: 'PENDING',
        isCurrent: true,
      },
      allowedActions: ['CANCEL'],
    });
  });

  it('uses the own-factory view data scope when resubmitting with a binary edit grant', async () => {
    mockedService.resubmitReport.mockImplementationOnce(async (_id, _payload, access) => {
      if (access.scope !== 'OWN_FACTORY') {
        throw new ForbiddenError('Only own-factory operators can resubmit BOD/COD reports');
      }
      return {
        id: 9,
        reportNo: 'BODCOD-2569-0009',
        statusCode: 'REVISED_PENDING_REVIEW',
        approvalTrack: 'REGIONAL',
        currentStep: {
          id: 15,
          stepNo: 1,
          roleCode: 'INSPECTOR',
          roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
          status: 'PENDING',
          isCurrent: true,
        },
        steps: [],
        allowedActions: ['CANCEL'],
      };
    });
    const app = createApp();
    const payload = {
      ...createReportPayload(),
      revisionNote: 'แก้ไขผลตรวจวัดตามข้อสังเกตของเจ้าหน้าที่',
    };

    const response = await request(app)
      .put('/api/v1/bod-cod-deviation-reports/9/resubmission')
      .set('Authorization', `Bearer ${operatorBinaryEditToken()}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(mockedService.resubmitReport).toHaveBeenCalledWith(9, payload, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    });
  });

  it('lets officers apply BOD/COD workflow actions', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/bod-cod-deviation-reports/9/workflow-actions')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({
        action: 'APPROVE',
        officerNote: 'ข้อมูลถูกต้อง ส่งต่อผู้อนุมัติ',
      });

    expect(response.status).toBe(200);
    expect(mockedService.changeWorkflowStatus).toHaveBeenCalledWith(
      9,
      {
        action: 'APPROVE',
        officerNote: 'ข้อมูลถูกต้อง ส่งต่อผู้อนุมัติ',
      },
      {
        actorUserId: 77,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคเหนือ'] },
      },
    );
    expect(response.body.data).toMatchObject({
      id: 9,
      statusCode: 'WAITING_APPROVAL',
      currentStep: {
        stepNo: 2,
        status: 'PENDING',
      },
      allowedActions: ['APPROVE', 'REQUEST_REVISION', 'REJECT'],
    });
  });

  it('rejects removed START_REVIEW workflow action before calling service', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/bod-cod-deviation-reports/9/workflow-actions')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({
        action: 'START_REVIEW',
        officerNote: 'รับเรื่องเข้าพิจารณา',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.changeWorkflowStatus).not.toHaveBeenCalled();
  });

  it('requires a revision reason when officers return BOD/COD reports for correction', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/bod-cod-deviation-reports/9/workflow-actions')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({
        action: 'REQUEST_REVISION',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.changeWorkflowStatus).not.toHaveBeenCalled();
  });

  it('rejects operators from BOD/COD officer workflow actions', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/bod-cod-deviation-reports/9/workflow-actions')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        action: 'APPROVE',
        officerNote: 'ข้อมูลถูกต้อง',
      });

    expect(response.status).toBe(403);
    expect(mockedService.changeWorkflowStatus).not.toHaveBeenCalled();
  });
});

function operatorToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'bod_cod_errors:view': 'OWN_FACTORY',
      'bod_cod_errors:edit': 'OWN_FACTORY',
    },
  });
}

function operatorBinaryEditToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'bod_cod_errors:view': 'OWN_FACTORY',
      'bod_cod_errors:edit': null,
    },
  });
}

function officerToken(): string {
  return signAccessToken({
    sub: '77',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: {
      'bod_cod_errors:view': 'ALL',
      'bod_cod_errors:approve': 'ALL',
    },
    regionalAccess: { regions: ['ภาคเหนือ'] },
  });
}

function tokenWithoutBodCodPermission(): string {
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['public_user'],
    scopes: {
      'factories:view': 'ALL',
    },
  });
}

function createReportPayload(): CreateBodCodDeviationReportDTO {
  return {
    reportRoundNo: 1,
    reportYear: 2569,
    factoryId: 'FID-001',
    factoryName: 'บริษัท ทดสอบน้ำเสีย จำกัด',
    factoryRegistrationNo: '10520000225172',
    businessActivity: 'ผลิตอาหารและเครื่องดื่ม',
    factoryAddress: '99 หมู่ 1',
    provinceName: 'ลำปาง',
    connectedMeasurementPointId: 9,
    pointCode: 'P0001',
    pointName: 'จุดระบายน้ำทิ้ง A',
    wastewaterFlowM3PerHour: 120.5,
    samplerName: 'นายเก็บ ตัวอย่าง',
    officerRegistrationNo: 'LAB-001',
    laboratoryName: 'ห้องปฏิบัติการกลาง',
    laboratoryRegistrationNo: 'LAB-REG-001',
    labReportNo: 'LAB-REPORT-001',
    analysisMethod: 'Standard Methods',
    deviceBrand: 'Brand A',
    deviceModel: 'Model B',
    deviceSerialNo: 'SN-001',
    selectedParameterCode: 'BOD',
    reporterName: 'นายรายงาน ผล',
    reporterPosition: 'เจ้าหน้าที่สิ่งแวดล้อม',
    measurements: [
      {
        sampleDate: '2026-07-01',
        sampleTime: '09:30',
        deviceValueMgL: 12.5,
        labValueMgL: 10,
        standardDeviationMgL: 3,
      },
    ],
    attachments: [
      {
        attachmentType: 'LAB_REPORT',
        originalFileName: 'lab-report.pdf',
        storedFileName: 'lab-report-uuid.pdf',
        mimeType: 'application/pdf',
        fileSize: 12000,
        storagePath: 'uploads/bod-cod/lab-report-uuid.pdf',
      },
    ],
  };
}
