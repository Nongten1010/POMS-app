import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.service', () => ({
  bodCodDeviationReportsService: {
    listFactories: jest.fn(),
    listReports: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { bodCodDeviationReportsService } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.service';

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
          latestReportStatusLabel: 'ส่งรายงานแล้ว',
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
              round1Status: 'ส่งรายงานแล้ว',
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
                  statusLabel: 'ส่งรายงานแล้ว',
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
          round1Status: 'ส่งรายงานแล้ว',
          round2Status: 'ยังไม่ยื่น',
          reportSlots: expect.arrayContaining([
            expect.objectContaining({ roundNo: 1, statusLabel: 'ส่งรายงานแล้ว' }),
            expect.objectContaining({ roundNo: 2, statusLabel: 'ยังไม่ยื่น' }),
          ]),
        }),
      ]),
      latestReportStatusLabel: 'ส่งรายงานแล้ว',
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
});

function operatorToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'bod_cod_errors:view': 'OWN_FACTORY',
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
