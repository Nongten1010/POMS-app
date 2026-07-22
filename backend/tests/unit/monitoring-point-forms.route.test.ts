import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/monitoring-point-forms/monitoring-point-forms.service', () => ({
  monitoringPointFormsService: {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    selectEligible: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';

const mockedService = jest.mocked(monitoringPointFormsService);

describe('monitoring point form routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts and returns project fields through the create endpoint', async () => {
    const serviceResponse = {
      id: 12,
      factory: {
        eiaInfo: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        projectName: 'โครงการขยายกำลังผลิต',
      },
      points: [],
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
    mockedService.create.mockResolvedValue(serviceResponse as never);

    const response = await request(createApp())
      .post('/api/v1/monitoring-point-forms')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        factory: {
          eiaInfo: 'อื่นๆ',
          eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
          projectName: 'โครงการขยายกำลังผลิต',
        },
        points: [],
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/monitoring-point-forms/12');
    expect(response.body).toEqual({ success: true, data: serviceResponse });
    expect(mockedService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        factory: expect.objectContaining({
          eiaInfo: 'อื่นๆ',
          eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
          projectName: 'โครงการขยายกำลังผลิต',
        }),
      }),
      42,
    );
  });

  it('returns the field path when Other EIA detail is missing', async () => {
    const response = await request(createApp())
      .post('/api/v1/monitoring-point-forms')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        factory: {
          eiaInfo: 'อื่นๆ',
          eiaOther: null,
          projectName: 'โครงการขยายกำลังผลิต',
        },
        points: [],
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        issues: [
          expect.objectContaining({
            path: ['factory', 'eiaOther'],
            pathString: 'factory.eiaOther',
          }),
        ],
      },
    });
    expect(mockedService.create).not.toHaveBeenCalled();
  });

  it('passes project fields through the update endpoint', async () => {
    mockedService.update.mockResolvedValue({ id: 12 } as never);

    const response = await request(createApp())
      .put('/api/v1/monitoring-point-forms/12')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        factory: {
          eiaInfo: 'มี EIA',
          eiaOther: 'ข้อความที่ต้องถูกล้าง',
          projectName: 'โครงการฉบับแก้ไข',
        },
        points: [],
      });

    expect(response.status).toBe(200);
    expect(mockedService.update).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        factory: expect.objectContaining({
          eiaInfo: 'มี EIA',
          eiaOther: null,
          projectName: 'โครงการฉบับแก้ไข',
        }),
      }),
      42,
    );
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'cems_wpms_requests:edit': 'OWN_FACTORY',
    },
  });
}
