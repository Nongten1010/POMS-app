import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { pomsFactoriesRoutes } from '../../src/modules/poms-factories/poms-factories.routes';
import { POMS_FACTORY_EDIT_REQUEST_FORM_TYPE } from '../../src/modules/poms-factories/poms-factories.types';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/poms-factories/poms-factories.service', () => ({
  pomsFactoriesService: {
    listFactories: jest.fn(),
    getFactoryDetail: jest.fn(),
    createEditRequest: jest.fn(),
    listEditRequests: jest.fn(),
    getEditRequest: jest.fn(),
    resubmitEditRequest: jest.fn(),
    reviewEditRequest: jest.fn(),
  },
}));

import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';

const mockedService = jest.mocked(pomsFactoriesService);
const viewScope = { scope: 'IN_PROVINCE' as const, province: 'ระยอง' };
const editScope = { scope: 'OWN_FACTORY' as const };
const approveScope = { scope: 'IN_REGION' as const, region: 'ภาคตะวันออก' };

describe('POMS factory routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.listFactories.mockResolvedValue({ data: [factorySummary()], meta: { total: 1 } });
    mockedService.getFactoryDetail.mockResolvedValue(factoryDetail());
    mockedService.createEditRequest.mockResolvedValue(editRequest('PENDING_REVIEW'));
    mockedService.listEditRequests.mockResolvedValue({
      data: [editRequest('PENDING_REVIEW')],
      meta: { total: 1 },
    });
    mockedService.getEditRequest.mockResolvedValue(editRequest('PENDING_REVIEW'));
    mockedService.resubmitEditRequest.mockResolvedValue(editRequest('REVISED_PENDING_REVIEW'));
    mockedService.reviewEditRequest.mockResolvedValue(editRequest('APPROVED'));
  });

  it('lists live POMS factories', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/poms-factories?search=ทดสอบ')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'factories:view': 'IN_PROVINCE' },
          scopeDetails: { 'factories:view': viewScope },
        })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
    expect(mockedService.listFactories).toHaveBeenCalledWith(42, viewScope, 'ทดสอบ', null);
  });

  it('returns a factory detail with measurement points', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/poms-factories/factory-001')
      .set('Authorization', `Bearer ${accessToken({ scopes: { 'factories:view': 'ALL' } })}`);

    expect(response.status).toBe(200);
    expect(response.body.data.measurementPoints).toHaveLength(1);
    expect(mockedService.getFactoryDetail).toHaveBeenCalledWith(
      'factory-001',
      42,
      { scope: 'ALL' },
      null,
    );
  });

  it('requires factories:edit to create an edit request', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/poms-factories/factory-001/edit-requests')
      .set('Authorization', `Bearer ${accessToken({ scopes: { 'factories:view': 'ALL' } })}`)
      .send({ factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)' });

    expect(response.status).toBe(403);
    expect(mockedService.createEditRequest).not.toHaveBeenCalled();
  });

  it('creates an edit request', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/poms-factories/factory-001/edit-requests')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'factories:view': 'ALL', 'factories:edit': 'OWN_FACTORY' },
          scopeDetails: {
            'factories:view': { scope: 'ALL' },
            'factories:edit': editScope,
          },
        })}`,
      )
      .send({
        factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
        factoryAddress: 'นิคมอุตสาหกรรมมาบตาพุด',
        latitude: 12.7,
        longitude: 101.1,
        projectName: 'โครงการใหม่',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PENDING_REVIEW');
    expect(mockedService.createEditRequest).toHaveBeenCalledWith(
      'factory-001',
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
        factoryAddress: 'นิคมอุตสาหกรรมมาบตาพุด',
      }),
      42,
      editScope,
      null,
    );
  });

  it('lists edit requests before the factory-id route can capture the literal path', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/poms-factories/edit-requests')
      .set('Authorization', `Bearer ${accessToken({ scopes: { 'factories:view': 'ALL' } })}`);

    expect(response.status).toBe(200);
    expect(mockedService.listEditRequests).toHaveBeenCalledWith({}, 42, { scope: 'ALL' }, null);
    expect(mockedService.getFactoryDetail).not.toHaveBeenCalled();
  });

  it('gets edit-request detail before the factory-id route can capture the literal path', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/poms-factories/edit-requests/11')
      .set('Authorization', `Bearer ${accessToken({ scopes: { 'factories:view': 'ALL' } })}`);

    expect(response.status).toBe(200);
    expect(mockedService.getEditRequest).toHaveBeenCalledWith(11, 42, { scope: 'ALL' }, null);
    expect(mockedService.getFactoryDetail).not.toHaveBeenCalled();
  });

  it('requires factories:edit to resubmit an edit request', async () => {
    const response = await request(createTestApp())
      .put('/api/v1/poms-factories/edit-requests/11/resubmission')
      .set('Authorization', `Bearer ${accessToken({ scopes: { 'factories:view': 'ALL' } })}`)
      .send({ factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไขแล้ว)' });

    expect(response.status).toBe(403);
    expect(mockedService.resubmitEditRequest).not.toHaveBeenCalled();
  });

  it('resubmits a revised edit request', async () => {
    const response = await request(createTestApp())
      .put('/api/v1/poms-factories/edit-requests/11/resubmission')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'factories:view': 'ALL', 'factories:edit': 'OWN_FACTORY' },
          scopeDetails: {
            'factories:view': { scope: 'ALL' },
            'factories:edit': editScope,
          },
        })}`,
      )
      .send({
        factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไขแล้ว)',
        factoryLogo: null,
        note: 'แก้ไขตามข้อสังเกตแล้ว',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('REVISED_PENDING_REVIEW');
    expect(mockedService.resubmitEditRequest).toHaveBeenCalledWith(
      11,
      {
        factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไขแล้ว)',
        factoryLogo: null,
        note: 'แก้ไขตามข้อสังเกตแล้ว',
      },
      42,
      editScope,
      null,
    );
  });

  it('requires factories:approve to review a request', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/poms-factories/edit-requests/11/review')
      .set('Authorization', `Bearer ${accessToken({ scopes: { 'factories:view': 'ALL' } })}`)
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(403);
    expect(mockedService.reviewEditRequest).not.toHaveBeenCalled();
  });

  it('rejects a monitoring officer even when the token has factories:approve', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/poms-factories/edit-requests/11/review')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          sub: '77',
          userType: 'officer',
          roles: ['monitoring_kpm'],
          scopes: { 'factories:view': 'ALL', 'factories:approve': 'IN_REGION' },
          scopeDetails: {
            'factories:view': { scope: 'ALL' },
            'factories:approve': approveScope,
          },
        })}`,
      )
      .send({ decision: 'APPROVE', officerNote: 'ข้อมูลครบถ้วน' });

    expect(response.status).toBe(403);
    expect(mockedService.reviewEditRequest).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'admin user type without the admin role',
      userType: 'admin' as const,
      roles: ['monitoring_kpm'],
    },
    {
      label: 'admin role without the admin user type',
      userType: 'officer' as const,
      roles: ['admin'],
    },
  ])('rejects $label', async ({ userType, roles }) => {
    const response = await request(createTestApp())
      .post('/api/v1/poms-factories/edit-requests/11/review')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          sub: '77',
          userType,
          roles,
          scopes: { 'factories:view': 'ALL', 'factories:approve': 'ALL' },
          scopeDetails: {
            'factories:view': { scope: 'ALL' },
            'factories:approve': { scope: 'ALL' },
          },
        })}`,
      )
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(403);
    expect(mockedService.reviewEditRequest).not.toHaveBeenCalled();
  });

  it('allows an authenticated admin with view and approve permissions to review a request', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/poms-factories/edit-requests/11/review')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          sub: '99',
          userType: 'admin',
          roles: ['admin'],
          scopes: { 'factories:view': 'ALL', 'factories:approve': 'ALL' },
          scopeDetails: {
            'factories:view': { scope: 'ALL' },
            'factories:approve': { scope: 'ALL' },
          },
        })}`,
      )
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('APPROVED');
    expect(mockedService.reviewEditRequest).toHaveBeenCalledWith(
      11,
      { decision: 'APPROVE' },
      99,
      { userType: 'admin', roles: ['admin'] },
      { scope: 'ALL' },
      null,
    );
  });
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/poms-factories', pomsFactoriesRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function accessToken(overrides: Partial<Parameters<typeof signAccessToken>[0]> = {}): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {},
    ...overrides,
  });
}

function factorySummary() {
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
    factoryFrontPhotos: [],
    factoryLogo: null,
    updatedAt: '2026-08-24T00:00:00.000Z',
    systemTypes: ['CEMS' as const],
    measurementPointCount: 1,
    pendingEditRequestCount: 0,
  };
}

function factoryDetail() {
  return {
    ...factorySummary(),
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
        monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ' as const,
        details: null,
        documentsAndImages: [],
        measurementInstruments: null,
        updatedAt: '2026-08-24T00:00:00.000Z',
      },
    ],
  };
}

function editRequest(status: 'PENDING_REVIEW' | 'REVISED_PENDING_REVIEW' | 'APPROVED') {
  return {
    id: 11,
    requestNo: 'PFE-20260824-ABC12345',
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO,
    status,
    statusLabel: status === 'APPROVED' ? 'อนุมัติแล้ว' : 'รอพิจารณา',
    revisionNo: 0,
    isOpen: status !== 'APPROVED',
    requestNote: 'ขอแก้ไขข้อมูลพื้นฐาน',
    revisionReason: null,
    officerNote: status === 'APPROVED' ? 'ข้อมูลครบถ้วน' : null,
    currentFactory: factorySummary(),
    proposedFactory: { ...factorySummary(), factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)' },
    currentMeasurementPoints: null,
    proposedMeasurementPoints: null,
    submittedBy: 42,
    reviewedBy: status === 'APPROVED' ? 77 : null,
    submittedAt: '2026-08-24T00:00:00.000Z',
    reviewedAt: status === 'APPROVED' ? '2026-08-24T01:00:00.000Z' : null,
    approvedAt: status === 'APPROVED' ? '2026-08-24T01:00:00.000Z' : null,
    createdBy: 42,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T01:00:00.000Z',
    events: [],
  };
}
