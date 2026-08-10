import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/eligible-factories/eligible-factories.service', () => ({
  eligibleFactoriesService: {
    listCandidates: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  },
}));

import { eligibleFactoriesRoutes } from '../../src/modules/eligible-factories/eligible-factories.routes';
import { eligibleFactoriesService } from '../../src/modules/eligible-factories/eligible-factories.service';

const mockedEligibleFactoriesService = jest.mocked(eligibleFactoriesService);

describe('eligible factory routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEligibleFactoriesService.listCandidates.mockResolvedValue({
      data: [],
      meta: { total: 0, source: 'external' },
    });
    mockedEligibleFactoriesService.list.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });
    mockedEligibleFactoriesService.create.mockResolvedValue({
      id: 17,
      sourceSystem: 'diw.fac_import',
      sourceFactoryId: 'real-17',
      monitoringPointFormId: null,
      factoryRegistrationNoNew: 'real-reg-17',
      factoryRegistrationNoOld: null,
      factoryName: 'โรงงานเข้าข่าย',
      factoryTypeSequence: null,
      address: null,
      provinceName: 'ระยอง',
      industrialEstateName: 'มาบตาพุด',
      coordinates: null,
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
      selectedReason: null,
      selectedBy: 42,
      selectedAt: '2026-08-10T00:00:00.000Z',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    } as never);
    mockedEligibleFactoriesService.remove.mockResolvedValue(undefined);
  });

  it('uses eligible_factories:view for candidate reads and forwards scope details', async () => {
    const response = await request(createEligibleFactoriesApp())
      .get('/api/v1/eligible-factories/candidates?page=1&perPage=50')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'eligible_factories:view': 'IN_ESTATE' },
          scopeDetails: {
            'eligible_factories:view': {
              scope: 'IN_ESTATE',
              estateCode: 'MTP',
            } as never,
          },
          regionalAccess: { regions: ['ภาคตะวันออก'] },
        })}`,
      );

    expect(response.status).toBe(200);
    expect(mockedEligibleFactoriesService.listCandidates).toHaveBeenCalledWith(
      { page: 1, perPage: 50 },
      {
        actorUserId: 42,
        scope: expect.objectContaining({ scope: 'IN_ESTATE', estateCode: 'MTP' }),
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    );
  });

  it('rejects candidate reads when the token only has eligible_factories:edit', async () => {
    const response = await request(createEligibleFactoriesApp())
      .get('/api/v1/eligible-factories/candidates')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'eligible_factories:edit': 'ALL' },
        })}`,
      );

    expect(response.status).toBe(403);
    expect(mockedEligibleFactoriesService.listCandidates).not.toHaveBeenCalled();
  });

  it('uses eligible_factories:view for selected-factory reads', async () => {
    const response = await request(createEligibleFactoriesApp())
      .get('/api/v1/eligible-factories')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'eligible_factories:view': 'IN_PROVINCE' },
          scopeDetails: {
            'eligible_factories:view': {
              scope: 'IN_PROVINCE',
              province: 'ระยอง',
              region: null,
            },
          },
        })}`,
      );

    expect(response.status).toBe(200);
    expect(mockedEligibleFactoriesService.list).toHaveBeenCalledWith(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_PROVINCE', province: 'ระยอง', region: null },
        regionalAccess: null,
      },
    );
  });

  it('uses eligible_factories:edit for create mutations', async () => {
    const response = await request(createEligibleFactoriesApp())
      .post('/api/v1/eligible-factories')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'eligible_factories:edit': 'ALL' },
          scopeDetails: { 'eligible_factories:edit': { scope: 'ALL' } },
        })}`,
      )
      .send({
        factoryName: 'โรงงานเข้าข่าย',
        factoryId: 'real-17',
        factoryRegistrationNo: 'real-reg-17',
        factoryClass: null,
        factorySubclass: null,
        address: null,
        provinceName: 'ระยอง',
        industrialEstateName: 'มาบตาพุด',
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
      });

    expect(response.status).toBe(201);
    expect(mockedEligibleFactoriesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFactoryId: 'real-17',
        factoryRegistrationNoNew: 'real-reg-17',
        provinceName: 'ระยอง',
      }),
      42,
      {
        actorUserId: 42,
        scope: { scope: 'ALL' },
        regionalAccess: null,
      },
    );
  });

  it('rejects create mutations when the token only has eligible_factories:view', async () => {
    const response = await request(createEligibleFactoriesApp())
      .post('/api/v1/eligible-factories')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'eligible_factories:view': 'ALL' },
        })}`,
      )
      .send({
        factoryName: 'โรงงานเข้าข่าย',
        factoryId: 'real-17',
        factoryRegistrationNo: 'real-reg-17',
        factoryClass: null,
        factorySubclass: null,
        address: null,
        provinceName: 'ระยอง',
        industrialEstateName: 'มาบตาพุด',
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
      });

    expect(response.status).toBe(403);
    expect(mockedEligibleFactoriesService.create).not.toHaveBeenCalled();
  });

  it('uses eligible_factories:edit for delete mutations and forwards scope details', async () => {
    const response = await request(createEligibleFactoriesApp())
      .delete('/api/v1/eligible-factories/17')
      .set(
        'Authorization',
        `Bearer ${accessToken({
          scopes: { 'eligible_factories:edit': 'IN_ESTATE' },
          scopeDetails: {
            'eligible_factories:edit': {
              scope: 'IN_ESTATE',
              estateCode: 'MTP',
            } as never,
          },
          regionalAccess: { regions: ['ภาคตะวันออก'] },
        })}`,
      );

    expect(response.status).toBe(204);
    expect(mockedEligibleFactoriesService.remove).toHaveBeenCalledWith(17, 42, {
      actorUserId: 42,
      scope: expect.objectContaining({ scope: 'IN_ESTATE', estateCode: 'MTP' }),
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    });
  });
});

function accessToken(overrides: Partial<Parameters<typeof signAccessToken>[0]> = {}): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: {
      'eligible_factories:view': 'ALL',
      'eligible_factories:edit': 'ALL',
    },
    ...overrides,
  });
}

function createEligibleFactoriesApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/eligible-factories', eligibleFactoriesRoutes);
  app.use(
    (
      err: Error & { statusCode?: number; status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.statusCode ?? err.status ?? 500).json({
        success: false,
        message: err.message,
      });
    },
  );
  return app;
}
