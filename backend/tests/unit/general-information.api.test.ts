import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/config/database';
import { signAccessToken } from '../../src/shared/utils/jwt';
import {
  chatFixtureSchemas,
  chatFixtureTables,
  chatFixtureActors,
} from '../helpers/chat-sql-fixture';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';
import { env } from '../../src/config/env';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import type { FactorySummaryDTO } from '../../src/modules/connection-requests/connection-requests.types';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';
import {
  defaultFactoryStatus,
  defaultManagedStatus,
  type StoredFactoryStatus,
} from '../../src/modules/poms-factories/poms-status-management.types';

let fixture: KnexSqliteFixture;
const originalProfileMode = env.FACTORY_PROFILE_MODE;
const app = createApp();
const url = '/api/v1/general-information?systemType=CEMS';
function token(actor: keyof typeof chatFixtureActors) {
  const account = chatFixtureActors[actor];
  return signAccessToken({
    sub: String(account.id),
    userType: account.userType,
    roles: [account.role],
    scopes: {},
  });
}
function insert(table: string, row: Record<string, unknown>) {
  fixture.execute(
    `INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row)
      .map(() => '?')
      .join(',')})`,
    Object.values(row),
  );
}
function factory(id: number, province = 'ระยอง', estate: string | null = null) {
  insert('eligible_factories', {
    id,
    source_factory_id: `FID-${id}`,
    factory_registration_no_new: `REG-${id}`,
    province_name: province,
    industrial_estate_name: estate,
  });
}
function point(id: number, factoryId: number, overrides: Record<string, unknown> = {}) {
  insert('cems_wpms_connected_measurement_points', {
    id,
    eligible_factory_id: factoryId,
    factory_id: `FID-${factoryId}`,
    factory_registration_no: `REG-${factoryId}`,
    source_measurement_point_id: id,
    system_type: 'CEMS',
    point_code: `S${id}`,
    parameters_json: '[]',
    details_json: null,
    updated_at: '2026-11-06T01:00:00Z',
    deleted_at: null,
    ...overrides,
  });
}
function management(factoryId: number, state: StoredFactoryStatus) {
  insert('poms_factory_status_management', {
    eligible_factory_id: factoryId,
    state_json: JSON.stringify(state),
  });
}

beforeEach(async () => {
  const auth = chatFixtureTables();
  const authNames = [
    'users',
    'roles',
    'permissions',
    'user_roles',
    'role_permissions',
    'user_permissions',
    'provinces',
    'industrial_estates',
    'organizations',
    'officer_profiles',
  ];
  fixture = await createKnexSqliteFixture(
    db,
    Object.fromEntries(authNames.map((name) => [name, auth[name]])),
    {
      organizations: chatFixtureSchemas.organizations,
      officer_profiles: chatFixtureSchemas.officer_profiles,
      cems_wpms_connected_measurement_points: [
        'id',
        'eligible_factory_id',
        'factory_id',
        'factory_registration_no',
        'source_measurement_point_id',
        'system_type',
        'point_code',
        'parameters_json',
        'details_json',
        'updated_at',
        'deleted_at',
        'monitoring_point_status',
        'point_name',
        'point_type',
        'source_request_id',
        'instruments_json',
        'factory_front_photos_json',
        'factory_logo_json',
        'documents_json',
      ],
      factories: ['id', 'fid', 'code', 'is_active', 'deleted_at'],
      eligible_factories: [
        'id',
        'source_factory_id',
        'factory_registration_no_new',
        'factory_registration_no_old',
        'province_name',
        'industrial_estate_name',
        'deleted_at',
      ],
      poms_factory_status_management: ['eligible_factory_id', 'state_json'],
    },
  );
});

afterEach(() => {
  fixture.close();
  env.FACTORY_PROFILE_MODE = originalProfileMode;
  jest.restoreAllMocks();
});

describe('GET /api/v1/general-information', () => {
  it('requires authentication before returning national aggregates', async () => {
    const response = await request(app).get(url);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks operators and citizens even if the token claims admin privileges', async () => {
    const accessToken = signAccessToken({
      sub: '101',
      userType: 'operator',
      roles: ['admin'],
      scopes: { 'factories:view': 'ALL' },
    });
    const response = await request(app).get(url).auth(accessToken, { type: 'bearer' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect((await request(app).get(url).auth(token('citizen'), { type: 'bearer' })).status).toBe(
      403,
    );
  });

  it('returns six zero regions and null flow rates when no point has ever connected', async () => {
    const response = await request(app).get(url).auth(token('provinceOfficer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data).toMatchObject({
      systemType: 'CEMS',
      total: { label: 'ทั่วประเทศ', factoryCount: 0, pointCount: 0 },
      parameters: [],
      flowTotal: { label: 'ทั่วประเทศ', average: null, min: null, max: null },
      estates: [
        { label: 'ในนิคมฯ', factoryCount: 0, pointCount: 0 },
        { label: 'นอกนิคมฯ', factoryCount: 0, pointCount: 0 },
      ],
    });
    expect(response.body.data.regions.map((row: { label: string }) => row.label)).toEqual([
      'ภาคเหนือ',
      'ภาคกลาง',
      'ภาคตะวันออกเฉียงเหนือ',
      'ภาคตะวันตก',
      'ภาคตะวันออก',
      'ภาคใต้',
    ]);
    expect(response.body.data.flowRates).toHaveLength(6);
    expect(response.body.data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('requires one supported systemType and rejects extra scope/filter inputs', async () => {
    for (const query of [
      '',
      '?systemType=cems',
      '?systemType=CEMS&systemType=WPMS',
      '?systemType=CEMS&province=ระยอง',
      '?systemType=CEMS%27%3BDROP%20TABLE%20users',
    ]) {
      const response = await request(app)
        .get(`/api/v1/general-information${query}`)
        .auth(token('officer'), { type: 'bearer' });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    const wpms = await request(app)
      .get('/api/v1/general-information?systemType=WPMS')
      .auth(token('admin'), { type: 'bearer' });
    expect(wpms.status).toBe(200);
    expect(wpms.body.data.systemType).toBe('WPMS');
  });

  it('counts current factories and latest points, excluding deleted points and eligible profiles', async () => {
    factory(1, 'ระยอง', 'นิคมสมมติ');
    factory(2, 'กรุงเทพมหานคร', '-');
    factory(3); // eligible only: never installed
    point(1, 1);
    point(2, 1, { deleted_at: '2026-11-06T02:00:00Z' });
    point(3, 2);
    point(4, 1, { system_type: 'WPMS' });
    point(5, 1, {
      point_code: 'S1',
      source_measurement_point_id: 1,
      updated_at: '2026-11-06T03:00:00Z',
    });
    fixture.execute('UPDATE eligible_factories SET deleted_at = ? WHERE id = 2', [
      '2026-11-06T04:00:00Z',
    ]);
    const response = await request(app).get(url).auth(token('provinceOfficer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toEqual({
      label: 'ทั่วประเทศ',
      factoryCount: 1,
      pointCount: 1,
    });
    expect(
      response.body.data.regions.find((row: { label: string }) => row.label === 'ภาคกลาง'),
    ).toEqual({ label: 'ภาคกลาง', factoryCount: 0, pointCount: 0 });
    expect(response.body.data.estates).toEqual([
      { label: 'ในนิคมฯ', factoryCount: 1, pointCount: 1 },
      { label: 'นอกนิคมฯ', factoryCount: 0, pointCount: 0 },
    ]);
    const admin = await request(app).get(url).auth(token('admin'), { type: 'bearer' });
    expect(admin.body.data.regions).toEqual(response.body.data.regions);
    const wpms = await request(app)
      .get('/api/v1/general-information?systemType=WPMS')
      .auth(token('officer'), { type: 'bearer' });
    expect(wpms.body.data.total).toEqual({ label: 'ทั่วประเทศ', factoryCount: 1, pointCount: 1 });
  });

  it.each([
    ['CEMS', 'ได้รับการยกเว้นทั้งหมด'],
    ['WPMS', 'ได้รับการยกเว้นทั้งหมด'],
    ['CEMS', 'อยู่ระหว่างขยายเวลา'],
    ['WPMS', 'อยู่ระหว่างขยายเวลา'],
  ])('excludes %s points with status %s even when parameters exist', async (systemType, status) => {
    factory(1);
    point(1, 1, {
      system_type: systemType,
      monitoring_point_status: status,
      parameters_json: '["CO (ppm)"]',
      details_json: JSON.stringify({ averageFlowRate: 999, averageWastewaterDischarge: 999 }),
    });
    const response = await request(app)
      .get(`/api/v1/general-information?systemType=${systemType}`)
      .auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 0, pointCount: 0 });
    expect(
      response.body.data.regions.every((row: { pointCount: number }) => row.pointCount === 0),
    ).toBe(true);
    expect(
      response.body.data.estates.every((row: { pointCount: number }) => row.pointCount === 0),
    ).toBe(true);
    expect(response.body.data.parameters).toEqual([]);
    expect(response.body.data.flowTotal).toMatchObject({ average: null, min: null, max: null });
  });

  it.each(['CEMS', 'WPMS'] as const)(
    'matches dashboard and public map counts for the same current %s points',
    async (systemType) => {
      const label = systemType === 'CEMS' ? 'CO (ppm)' : 'BOD (mg/l)';
      for (const id of [1, 2, 3, 4]) factory(id, 'ระยอง', 'นิคมสมมติ');
      const common = {
        system_type: systemType,
        parameters_json: JSON.stringify([label, 'NOx (ppm)']),
      };
      point(1, 1, {
        ...common,
        details_json: JSON.stringify({ averageFlowRate: 10, averageWastewaterDischarge: 10 }),
      });
      point(2, 1, { ...common, monitoring_point_status: 'ได้รับการยกเว้นทั้งหมด' });
      point(3, 1, { ...common, monitoring_point_status: 'อยู่ระหว่างขยายเวลา' });
      point(4, 1, { ...common, deleted_at: '2026-11-10T01:00:00Z' });
      point(5, 1, common); // disconnected point
      point(6, 1, common); // hidden point
      point(7, 2, {
        ...common,
        monitoring_point_status: 'อยู่ระหว่างขยายเวลา',
        parameters_json: '[]',
      });
      point(8, 3, common); // visible child of hidden factory
      point(9, 4, common); // visible child of disconnected factory
      const state = defaultFactoryStatus();
      state.measurementPoints['1'] = {
        ...defaultManagedStatus(),
        parameters: { 'NOx (ppm)': 'HIDDEN' },
      };
      state.measurementPoints['5'] = {
        ...defaultManagedStatus(),
        connectionStatus: 'DISCONNECTED',
        parameters: {},
      };
      state.measurementPoints['6'] = {
        ...defaultManagedStatus(),
        visibility: 'HIDDEN',
        parameters: {},
      };
      management(1, state);
      const hidden = defaultFactoryStatus();
      hidden.factory.visibility = 'HIDDEN';
      hidden.measurementPoints['8'] = { ...defaultManagedStatus(), parameters: {} };
      management(3, hidden);
      const disconnected = defaultFactoryStatus();
      disconnected.factory.connectionStatus = 'DISCONNECTED';
      disconnected.measurementPoints['9'] = { ...defaultManagedStatus(), parameters: {} };
      management(4, disconnected);
      const homeFactories: FactorySummaryDTO[] = [1, 2, 3, 4].map((id) => ({
        id,
        eligibleFactoryId: id,
        factoryId: `FID-${id}`,
        factoryName: `โรงงาน ${id}`,
        newRegistrationNo: `REG-${id}`,
        oldRegistrationNo: null,
        industryType: null,
        industryMainOrder: null,
        industrySubOrder: null,
        businessActivity: null,
        eia: null,
        projectName: null,
        address: null,
        latitude: null,
        longitude: null,
        province: 'ระยอง',
        isEligible: true,
        isActive: true,
      }));
      jest
        .spyOn(connectionRequestsRepository, 'listFactoriesForAccess')
        .mockResolvedValue(homeFactories);
      jest
        .spyOn(connectionRequestsRepository, 'listFactoryMainTypeLabels')
        .mockResolvedValue(new Map());
      jest.spyOn(connectionRequestsRepository, 'listFavoriteFactoryIds').mockResolvedValue([]);
      jest.spyOn(parameterValuesService, 'latestHourly').mockImplementation(async (stationId) => ({
        data: [],
        meta: {
          stationId,
          interval: '60m',
          schemaName: 'ingest',
          tableName: `${stationId}_data_60m`,
          count: 0,
          registeredParameters: [label],
          returnedColumns: [],
        },
      }));
      const response = await request(app)
        .get(`/api/v1/general-information?systemType=${systemType}`)
        .auth(token('officer'), { type: 'bearer' });
      expect(response.status).toBe(200);
      const dashboard = await connectionRequestsService.listOperatorFactoryDashboard(42, 'ALL');
      const map = await connectionRequestsService.listPublicFactoryMapPoints();
      for (const home of [dashboard, map]) {
        expect(home.meta.total).toBe(1);
        expect(home.data[0].measurementPoints.map((point) => point.stationId)).toEqual(['S1']);
        expect(home.data[0].measurementPoints[0].parameters).toEqual([label]);
        expect(response.body.data.total).toMatchObject({
          factoryCount: home.meta.total,
          pointCount: home.data.reduce(
            (total, factory) => total + factory.measurementPoints.length,
            0,
          ),
        });
      }
      expect(response.body.data.parameters).toEqual([
        expect.objectContaining({ displayName: label, factoryCount: 1, pointCount: 1 }),
      ]);
      expect(
        response.body.data.regions.find((row: { label: string }) => row.label === 'ภาคตะวันออก'),
      ).toMatchObject({ factoryCount: 1, pointCount: 1 });
      expect(response.body.data.estates[0]).toMatchObject({ factoryCount: 1, pointCount: 1 });
      expect(response.body.data.flowTotal).toMatchObject({ average: 10, min: null, max: null });
    },
  );

  it('excludes inactive supporting factory identities without requiring a master row for membership', async () => {
    factory(1);
    factory(2);
    point(1, 1);
    point(2, 2);
    insert('factories', { id: 1, fid: 'FID-1', code: 'REG-1', is_active: false });
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 1, pointCount: 1 });
  });

  it('groups units per parameter, distinguishes CO/CO2 and counts each factory/point once using latest data', async () => {
    factory(1);
    factory(2);
    point(1, 1, { parameters_json: JSON.stringify(['CO (ppm)', 'CO (%)', 'CO2 (ppm)']) });
    point(2, 1, { parameters_json: JSON.stringify(['CO (ppm)']) });
    point(3, 2, {
      parameters_json: JSON.stringify(['CO (ppm)', 'NOx (ppm)']),
      updated_at: '2026-10-01T00:00:00Z',
    });
    point(4, 2, { point_code: 'S3', parameters_json: JSON.stringify(['CO2 (ppm)']) });
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.parameters).toEqual([
      {
        label: 'CO',
        displayName: 'CO (%, ppm)',
        units: ['%', 'ppm'],
        factoryCount: 1,
        pointCount: 2,
      },
      { label: 'CO2', displayName: 'CO2 (ppm)', units: ['ppm'], factoryCount: 2, pointCount: 2 },
    ]);
    expect(response.body.data.total).toMatchObject({ factoryCount: 2, pointCount: 3 });
  });

  it.each(['CEMS', 'WPMS'] as const)(
    'excludes hidden factories and points from every %s summary, including flow rates',
    async (systemType) => {
      factory(1, 'ระยอง', 'นิคมสมมติ');
      factory(2, 'กรุงเทพมหานคร');
      const details = (value: number) =>
        JSON.stringify(
          systemType === 'CEMS'
            ? { averageFlowRate: value, minFlowRate: value, maxFlowRate: value }
            : {
                averageWastewaterDischarge: value,
                minWastewaterDischarge: value,
                maxWastewaterDischarge: value,
              },
        );
      point(1, 1, {
        system_type: systemType,
        parameters_json: '["CO (ppm)"]',
        details_json: details(10),
      });
      point(2, 1, {
        system_type: systemType,
        parameters_json: '["CO2 (ppm)"]',
        details_json: details(100),
      });
      point(3, 2, {
        system_type: systemType,
        parameters_json: '["NOx (ppm)"]',
        details_json: details(1000),
      });
      const partial = defaultFactoryStatus();
      partial.measurementPoints['2'] = {
        ...defaultManagedStatus(),
        visibility: 'HIDDEN',
        parameters: { 'CO2 (ppm)': 'HIDDEN' },
      };
      management(1, partial);
      const hidden = defaultFactoryStatus();
      hidden.factory.visibility = 'HIDDEN';
      management(2, hidden);

      const response = await request(app)
        .get(`/api/v1/general-information?systemType=${systemType}`)
        .auth(token('officer'), { type: 'bearer' });
      expect(response.status).toBe(200);
      expect(response.body.data.total).toEqual({
        label: 'ทั่วประเทศ',
        factoryCount: 1,
        pointCount: 1,
      });
      expect(response.body.data.regions).toEqual(
        expect.arrayContaining([
          { label: 'ภาคตะวันออก', factoryCount: 1, pointCount: 1 },
          { label: 'ภาคกลาง', factoryCount: 0, pointCount: 0 },
        ]),
      );
      expect(response.body.data.estates).toEqual([
        { label: 'ในนิคมฯ', factoryCount: 1, pointCount: 1 },
        { label: 'นอกนิคมฯ', factoryCount: 0, pointCount: 0 },
      ]);
      expect(response.body.data.parameters).toEqual([
        { label: 'CO', displayName: 'CO (ppm)', units: ['ppm'], factoryCount: 1, pointCount: 1 },
      ]);
      expect(response.body.data.flowTotal).toEqual({
        label: 'ทั่วประเทศ',
        average: 10,
        min: 10,
        max: 10,
      });
      expect(response.body.data.flowRates).toEqual(
        expect.arrayContaining([
          { label: 'ภาคตะวันออก', average: 10, min: 10, max: 10 },
          { label: 'ภาคกลาง', average: null, min: null, max: null },
        ]),
      );
    },
  );

  it('does not revive an older visible revision when the latest point is hidden', async () => {
    factory(1);
    point(1, 1, { deleted_at: '2026-11-06T02:00:00Z' });
    point(2, 1, { point_code: 'S1', updated_at: '2026-11-06T03:00:00Z' });
    point(3, 1);
    const state = defaultFactoryStatus();
    state.measurementPoints['2'] = {
      ...defaultManagedStatus(),
      visibility: 'HIDDEN',
      parameters: {},
    };
    management(1, state);
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 1, pointCount: 1 });
    expect(response.body.data.parameters).toEqual([]);
    expect(response.body.data.flowTotal).toMatchObject({ average: null, min: null, max: null });
  });

  it('does not allow visible children in either system to reopen a hidden parent', async () => {
    factory(1);
    point(1, 1);
    point(2, 1, { system_type: 'WPMS' });
    point(3, 1, { deleted_at: '2026-11-06T02:00:00Z' });
    const state = defaultFactoryStatus();
    state.factory.visibility = 'HIDDEN';
    state.measurementPoints['1'] = {
      ...defaultManagedStatus(),
      connectionStatus: 'DISCONNECTED',
      parameters: {},
    };
    state.measurementPoints['2'] = { ...defaultManagedStatus(), parameters: {} };
    management(1, state);
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 0, pointCount: 0 });
  });

  it('hides points whose current parameters are all hidden, without allowing removed children to reopen the factory', async () => {
    factory(1);
    point(1, 1, { parameters_json: '["CO (ppm)"]' });
    point(2, 1, { deleted_at: '2026-11-06T02:00:00Z' });
    const state = defaultFactoryStatus();
    state.measurementPoints['1'] = {
      ...defaultManagedStatus(),
      parameters: { 'CO (ppm)': 'HIDDEN' },
    };
    management(1, state);
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 0, pointCount: 0 });
  });

  it('does not read management data from factories with no points in the requested system', async () => {
    factory(1);
    point(1, 1);
    factory(2);
    point(2, 2, { system_type: 'WPMS', parameters_json: '{broken' });
    management(2, defaultFactoryStatus());
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 1, pointCount: 1 });
  });

  it('does not validate flow or region data from hidden points', async () => {
    factory(1, 'ไม่ทราบจังหวัด');
    point(1, 1, { details_json: '{broken' });
    const state = defaultFactoryStatus();
    state.factory.visibility = 'HIDDEN';
    management(1, state);
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toMatchObject({ factoryCount: 0, pointCount: 0 });
    expect(response.body.data.flowTotal).toMatchObject({ average: null, min: null, max: null });
  });

  it.each(['{broken', 'null', '[]', 'false'])(
    'rejects invalid management state %s rather than counting hidden points as visible',
    async (stateJson) => {
      factory(1);
      point(1, 1);
      insert('poms_factory_status_management', { eligible_factory_id: 1, state_json: stateJson });
      const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('GENERAL_INFORMATION_DATA_INCOMPLETE');
    },
  );

  it('normalizes saved discharge units, preserves zero/missing values and weights national means by points', async () => {
    factory(1);
    factory(2, 'กรุงเทพมหานคร');
    point(1, 1, {
      details_json: JSON.stringify({ averageFlowRate: 0, minFlowRate: 0, maxFlowRate: 30 }),
    });
    point(2, 1, { details_json: JSON.stringify({ averageFlowRate: '20', minFlowRate: 10 }) });
    point(3, 2, {
      details_json: JSON.stringify({
        averageFlowRate: 96,
        minFlowRate: 48,
        maxFlowRate: 240,
        flowRateUnit: 'm³/d',
      }),
    });
    point(4, 2, { details_json: JSON.stringify({ averageFlowRate: '', minFlowRate: null }) });
    point(5, 1, {
      system_type: 'WPMS',
      details_json: JSON.stringify({
        averageWastewaterDischarge: 1,
        minWastewaterDischarge: 0,
        maxWastewaterDischarge: 4,
        wastewaterDischargeUnit: 'm3/hr',
      }),
    });
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.flowTotal).toEqual({
      label: 'ทั่วประเทศ',
      average: 8,
      min: 0,
      max: 30,
    });
    expect(
      response.body.data.flowRates.find((row: { label: string }) => row.label === 'ภาคตะวันออก'),
    ).toEqual({ label: 'ภาคตะวันออก', average: 10, min: 0, max: 30 });
    expect(response.body.data.flowRates[0]).toEqual({
      label: 'ภาคเหนือ',
      average: null,
      min: null,
      max: null,
    });
    const wpms = await request(app)
      .get('/api/v1/general-information?systemType=WPMS')
      .auth(token('officer'), { type: 'bearer' });
    expect(wpms.body.data.flowTotal).toEqual({ label: 'ทั่วประเทศ', average: 24, min: 0, max: 96 });
  });

  it('refuses incomplete source data instead of silently dropping points or serializing NaN as null', async () => {
    factory(1);
    point(1, 1);
    for (const details of [
      '{broken',
      '[]',
      JSON.stringify({ averageFlowRate: true }),
      JSON.stringify({ averageFlowRate: 'NaN' }),
      JSON.stringify({ averageFlowRate: -1 }),
      JSON.stringify({ averageFlowRate: 2, flowRateUnit: 'unknown' }),
    ]) {
      fixture.execute('UPDATE cems_wpms_connected_measurement_points SET details_json = ?', [
        details,
      ]);
      const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'GENERAL_INFORMATION_DATA_INCOMPLETE',
          message: 'ข้อมูลต้นทางไม่ครบถ้วนสำหรับสรุปข้อมูลทั่วไป',
        },
      });
    }
    fixture.execute(
      'UPDATE cems_wpms_connected_measurement_points SET details_json = NULL, parameters_json = ?',
      ['{}'],
    );
    expect((await request(app).get(url).auth(token('officer'), { type: 'bearer' })).status).toBe(
      503,
    );
    fixture.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      '[""]',
    ]);
    expect((await request(app).get(url).auth(token('officer'), { type: 'bearer' })).status).toBe(
      503,
    );
    fixture.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      '[]',
    ]);
    fixture.execute('UPDATE eligible_factories SET province_name = ?', ['ไม่ทราบจังหวัด']);
    expect((await request(app).get(url).auth(token('officer'), { type: 'bearer' })).status).toBe(
      503,
    );
  });

  it('uses current profiles in canonical mode and never treats placeholder estate names as real estates', async () => {
    factory(1, 'ระยอง', 'นิคมสมมติ');
    point(1, 1);
    point(2, 1);
    const state = defaultFactoryStatus();
    state.measurementPoints['2'] = {
      ...defaultManagedStatus(),
      visibility: 'HIDDEN',
      parameters: {},
    };
    management(1, state);
    fixture.execute(
      'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
    );
    fixture.execute(
      "CREATE VIEW current_eligible_factories AS SELECT id, source_factory_id, deleted_at, factory_registration_no_new, 'อุทัยธานี' AS province_name, '—' AS industrial_estate_name FROM eligible_factories",
    );
    env.FACTORY_PROFILE_MODE = 'canonical';
    const response = await request(app).get(url).auth(token('provinceOfficer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.regions[1]).toEqual({
      label: 'ภาคกลาง',
      factoryCount: 1,
      pointCount: 1,
    });
    expect(response.body.data.estates).toEqual([
      { label: 'ในนิคมฯ', factoryCount: 0, pointCount: 0 },
      { label: 'นอกนิคมฯ', factoryCount: 1, pointCount: 1 },
    ]);
  });

  it('publishes its query, aggregate schemas, role restriction and errors through the HTTP OpenAPI document', async () => {
    const response = await request(app).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    const operation = response.body.paths['/general-information']?.get;
    expect(operation).toMatchObject({ tags: ['ข้อมูลทั่วไป'], security: [{ bearerAuth: [] }] });
    expect(operation.parameters).toContainEqual(
      expect.objectContaining({
        name: 'systemType',
        in: 'query',
        required: true,
        schema: { type: 'string', enum: ['CEMS', 'WPMS'] },
      }),
    );
    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '429',
      '500',
      '503',
    ]);
    expect(operation.description).toContain('ทั่วประเทศ');
    expect(operation.description).toContain('ไม่นับโรงงานหรือจุดตรวจวัดที่ซ่อน');
    expect(operation.description).toContain('ได้รับการยกเว้นทั้งหมด');
    expect(operation.description).toContain('อยู่ระหว่างขยายเวลา');
    expect(operation.description).toContain('connectionStatus=DISCONNECTED');
    expect(operation.description).toContain('deleted_at เป็น null');
    const schemas = response.body.components.schemas;
    expect(schemas.GeneralInformation.required).toEqual(
      expect.arrayContaining([
        'systemType',
        'generatedAt',
        'regions',
        'total',
        'estates',
        'parameters',
        'flowRates',
        'flowTotal',
      ]),
    );
    expect(schemas.GeneralInformationParameter.required).toEqual(
      expect.arrayContaining(['label', 'displayName', 'units', 'factoryCount', 'pointCount']),
    );
    expect(schemas.GeneralInformationFlow.properties.average).toMatchObject({
      type: 'number',
      nullable: true,
      minimum: 0,
    });
  });

  it('does not invent an estate category or merge points whose factory identity is missing', async () => {
    factory(1, 'ระยอง', 'ไม่ทราบ');
    point(1, 1);
    const unknown = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(unknown.status).toBe(503);
    fixture.execute(
      "UPDATE eligible_factories SET industrial_estate_name = NULL, factory_registration_no_new = ''",
    );
    fixture.execute(
      "UPDATE cems_wpms_connected_measurement_points SET factory_id = '', factory_registration_no = ''",
    );
    const missing = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(missing.status).toBe(503);
  });

  it('merges Flow aliases into one named group and rejects a unit without a parameter name', async () => {
    factory(1);
    point(1, 1, { parameters_json: JSON.stringify(['Flow Rate (m3/hr)', 'flow (m3/d)']) });
    const response = await request(app).get(url).auth(token('officer'), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.parameters).toEqual([
      {
        label: 'Flow Rate',
        displayName: 'Flow Rate (m3/d, m3/hr)',
        units: ['m3/d', 'm3/hr'],
        factoryCount: 1,
        pointCount: 1,
      },
    ]);
    fixture.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      '["(ppm)"]',
    ]);
    expect((await request(app).get(url).auth(token('officer'), { type: 'bearer' })).status).toBe(
      503,
    );
  });
});
