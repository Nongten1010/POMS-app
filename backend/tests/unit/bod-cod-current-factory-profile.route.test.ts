import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import type { PermissionScopeDetails } from '../../src/modules/auth/permissions';
import { bodCodDeviationReportsRoutes } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { createKnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
const endpoint = '/api/v1/bod-cod-deviation-reports/factories';
const app = express();
app.use(express.json());
app.use('/api/v1/bod-cod-deviation-reports', bodCodDeviationReportsRoutes);
app.use(errorHandler);

let fixture: Awaited<ReturnType<typeof createKnexSqliteFixture>>;

beforeEach(async () => {
  env.FACTORY_PROFILE_MODE = 'legacy';
  fixture = await createKnexSqliteFixture(db, factoryTables(), {
    bod_cod_deviation_reports: [
      'id',
      'factory_id',
      'connected_measurement_point_id',
      'point_code',
      'factory_registration_no',
      'report_round',
      'report_year',
      'report_no',
      'status',
      'created_at',
      'deleted_at',
      'report_sequence_no',
      'numbering_region_code',
      'numbering_sequence',
      'point_name',
      'factory_name',
      'business_activity',
      'address',
      'province_name',
      'approval_track',
      'selected_parameter_code',
      'wastewater_flow_m3_per_hour',
      'sampler_name',
      'officer_registration_no',
      'laboratory_name',
      'laboratory_registration_no',
      'lab_report_no',
      'analysis_method',
      'device_brand',
      'device_model',
      'device_serial_no',
      'reporter_name',
      'reporter_position',
      'submitted_at',
      'created_by',
      'updated_by',
      'updated_at',
    ],
    bod_cod_deviation_report_sequences: [
      'region_code',
      'report_year',
      'last_sequence',
      'updated_at',
    ],
    bod_cod_deviation_measurements: [
      'id',
      'report_id',
      'parameter_code',
      'sample_date',
      'sample_time',
      'device_value_mg_l',
      'lab_value_mg_l',
      'standard_deviation_mg_l',
      'is_within_standard',
      'sort_order',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    bod_cod_approval_steps: [
      'id',
      'report_id',
      'track',
      'step_no',
      'role_code',
      'role_label',
      'status',
      'revision_no',
      'is_current',
      'created_at',
      'updated_at',
      'created_by',
      'updated_by',
      'deleted_at',
      'actor_user_id',
      'actor_name',
      'actor_position',
      'decision',
      'comment',
      'decided_at',
    ],
    users: ['id', 'prename_th', 'first_name', 'last_name', 'username'],
    bod_cod_approval_events: ['id', 'report_id', 'action', 'note', 'actor_user_id', 'created_at'],
    user_juristics: ['user_id', 'juristic_id', 'revoked_at'],
    user_factory_access: ['user_id', 'factory_id', 'revoked_at'],
  });
  fixture.execute(
    'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
  );
  fixture.execute('CREATE VIEW current_eligible_factories AS SELECT * FROM eligible_factories');
});

afterEach(() => {
  fixture?.close();
  env.FACTORY_PROFILE_MODE = originalMode;
  jest.useRealTimers();
});

describe.each(['legacy', 'canonical'] as const)(
  'BOD/COD current factory data in %s mode',
  (mode) => {
    beforeEach(() => {
      env.FACTORY_PROFILE_MODE = mode;
    });
    it('returns the current Rayong province and new registration despite obsolete master and point data', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${viewToken()}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        meta: { total: 1 },
        data: [
          {
            factoryId: 'UBE-FID',
            factoryRegistration: '91090100125393',
            newRegistrationNo: '91090100125393',
            oldRegistrationNo: 'ข3-44-1/39รย',
            province: 'ระยอง',
            provinceName: 'ระยอง',
            regionName: 'ภาคตะวันออก',
            eligibleFactoryId: 17,
            monitoringPointCount: 1,
            measurementPoints: [{ id: 12, pointCode: 'P0155' }],
          },
        ],
      });
    });

    it.each([
      { scope: { scope: 'IN_PROVINCE', province: 'ระยอง' }, total: 1 },
      { scope: { scope: 'IN_PROVINCE', province: 'กรุงเทพมหานคร' }, total: 0 },
      { scope: { scope: 'IN_PROVINCE' }, total: 0 },
      { scope: { scope: 'IN_REGION', region: 'ภาคตะวันออก' }, total: 1 },
      { scope: { scope: 'IN_REGION', region: 'ภาคกลาง' }, total: 0 },
      { scope: { scope: 'IN_REGION' }, total: 0 },
    ] as Array<{ scope: PermissionScopeDetails; total: number }>)(
      'applies current location access for $scope, returning $total factories',
      async ({ scope, total }) => {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${viewToken(scope)}`);

        expect(response.status).toBe(200);
        expect(response.body.meta.total).toBe(total);
        expect(response.body.data).toHaveLength(total);
      },
    );

    it('does not substitute another eligible factory when the linked factory is deleted', async () => {
      fixture.execute('UPDATE eligible_factories SET deleted_at = ? WHERE id = ?', [
        '2026-10-04',
        17,
      ]);
      fixture.execute(
        'INSERT INTO eligible_factories (id, source_factory_id, factory_registration_no_new, province_name) VALUES (?, ?, ?, ?)',
        [18, 'UBE-FID', '91090100125393', 'กรุงเทพมหานคร'],
      );

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${viewToken()}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ data: [], meta: { total: 0 } });
    });

    it.each([
      { field: 'factoryRegistrationNo', value: 'ข3-44-1/39รย' },
      { field: 'provinceName', value: 'กรุงเทพมหานคร' },
    ])(
      'rejects a submission with obsolete $field without creating a report',
      async ({ field, value }) => {
        freezeReportTime();
        const response = await request(app)
          .post('/api/v1/bod-cod-deviation-reports')
          .set('Authorization', `Bearer ${editToken()}`)
          .send({ ...reportPayload(), [field]: value });
        expect(response.status).toBe(400);

        const reports = await request(app)
          .get('/api/v1/bod-cod-deviation-reports')
          .set('Authorization', `Bearer ${viewToken()}`);
        expect(reports.body).toMatchObject({ data: [], meta: { total: 0 } });
      },
    );

    it('keeps a pending legacy report under its old registration from being bypassed by the new registration', async () => {
      freezeReportTime();
      fixture.execute(
        'INSERT INTO bod_cod_deviation_reports (id, factory_id, point_code, factory_registration_no, report_year, selected_parameter_code, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [24, 9, 'P0155', 'ข3-44-1/39รย', 2569, 'BOD', 'SUBMITTED'],
      );

      const response = await request(app)
        .post('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${editToken()}`)
        .send(reportPayload());
      expect(response.status).toBe(409);
      expect(response.body.error.details).toMatchObject({
        reason: 'PENDING_REPORT_EXISTS',
        reportId: 24,
      });
    });

    it('accepts a report submitted using the current registration and province shown in the factory list', async () => {
      jest
        .useFakeTimers({
          doNotFake: [
            'nextTick',
            'setImmediate',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
          ],
        })
        .setSystemTime(new Date('2026-10-05T00:00:00Z'));
      const listed = await request(app).get(endpoint).set('Authorization', `Bearer ${viewToken()}`);
      const factory = listed.body.data[0];
      const response = await request(app)
        .post('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${editToken()}`)
        .send({
          factoryId: factory.factoryId,
          factoryName: factory.factoryName,
          factoryRegistrationNo: factory.newRegistrationNo,
          provinceName: factory.provinceName,
          connectedMeasurementPointId: factory.measurementPoints[0].id,
          selectedParameterCode: 'BOD',
          reportRoundNo: 2,
          reportYear: 2569,
          measurements: [
            {
              sampleDate: '2026-10-01',
              sampleTime: '09:30',
              deviceValueMgL: 12,
              labValueMgL: 10,
            },
          ],
          attachments: [],
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: { reportNo: 'E-03-0001/2569', reportSequenceNo: 1, approvalTrack: 'REGIONAL' },
      });
    });

    it('keeps a new report attached to its connected factory when another master has the new registration code', async () => {
      freezeReportTime();
      fixture.execute('INSERT INTO factories (id, fid, code, province_id) VALUES (?, ?, ?, ?)', [
        1,
        'OTHER-FID',
        '91090100125393',
        1,
      ]);
      const created = await request(app)
        .post('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${editToken()}`)
        .send(reportPayload());
      expect(created.status).toBe(201);

      const reports = await request(app)
        .get('/api/v1/bod-cod-deviation-reports?factoryId=UBE-FID')
        .set('Authorization', `Bearer ${viewToken()}`);
      expect(reports.status).toBe(200);
      expect(reports.body).toMatchObject({
        meta: { total: 1 },
        data: [{ id: created.body.data.id, factoryId: 'UBE-FID' }],
      });
      const allReports = await request(app)
        .get('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${viewToken()}`);
      expect(allReports.body).toMatchObject({ meta: { total: 1 } });
      expect(allReports.body.data).toHaveLength(1);
    });

    it('does not expose a saved report to an operator assigned to a different factory with a matching registration code', async () => {
      freezeReportTime();
      const created = await request(app)
        .post('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${editToken()}`)
        .send(reportPayload());
      expect(created.status).toBe(201);
      fixture.execute('INSERT INTO factories (id, fid, code, province_id) VALUES (?, ?, ?, ?)', [
        1,
        'OTHER-FID',
        '91090100125393',
        1,
      ]);
      fixture.execute(
        'INSERT INTO user_factory_access (user_id, factory_id) VALUES (?, ?)',
        [88, 1],
      );
      const token = signAccessToken({
        sub: '88',
        userType: 'operator',
        roles: ['factory_operator'],
        scopes: { 'bod_cod_errors:view': 'OWN_FACTORY', 'bod_cod_errors:edit': 'OWN_FACTORY' },
      });
      const response = await request(app)
        .get('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ data: [], meta: { total: 0 } });

      const detail = await request(app)
        .get(`/api/v1/bod-cod-deviation-reports/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(detail.status).toBe(404);
      const cancellation = await request(app)
        .post(`/api/v1/bod-cod-deviation-reports/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(cancellation.status).toBe(404);

      const stillSubmitted = await request(app)
        .get('/api/v1/bod-cod-deviation-reports')
        .set('Authorization', `Bearer ${viewToken()}`);
      expect(stillSubmitted.body.data[0].statusCode).toBe('SUBMITTED');
    });

    it('continues to resolve a legacy report without an internal factory id by its old registration', async () => {
      fixture.execute(
        'INSERT INTO bod_cod_deviation_reports (id, factory_registration_no, factory_name, province_name, report_year, selected_parameter_code, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [24, 'ข3-44-1/39รย', 'อูเบะ', 'ระยอง', 2569, 'BOD', 'SUBMITTED'],
      );
      const response = await request(app)
        .get('/api/v1/bod-cod-deviation-reports?factoryId=UBE-FID')
        .set('Authorization', `Bearer ${viewToken()}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        meta: { total: 1 },
        data: [{ id: 24, factoryId: 'UBE-FID' }],
      });
    });
  },
);

function freezeReportTime() {
  jest
    .useFakeTimers({
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
      ],
    })
    .setSystemTime(new Date('2026-10-05T00:00:00Z'));
}

function reportPayload() {
  return {
    factoryId: 'UBE-FID',
    factoryName: 'บริษัท อูเบะ เคมิคอลส์ (เอเซีย) จำกัด (มหาชน)',
    factoryRegistrationNo: '91090100125393',
    provinceName: 'ระยอง',
    connectedMeasurementPointId: 12,
    selectedParameterCode: 'BOD',
    reportRoundNo: 2,
    reportYear: 2569,
    measurements: [
      { sampleDate: '2026-10-01', sampleTime: '09:30', deviceValueMgL: 12, labValueMgL: 10 },
    ],
    attachments: [],
  };
}

function viewToken(scope: PermissionScopeDetails = { scope: 'ALL' }) {
  return signAccessToken({
    sub: '77',
    userType: 'officer',
    roles: ['admin'],
    scopes: { 'bod_cod_errors:view': scope.scope },
    scopeDetails: { 'bod_cod_errors:view': scope },
    regionalAccess: scope.region ? { regions: [scope.region] } : undefined,
  });
}

function editToken() {
  return signAccessToken({
    sub: '77',
    userType: 'officer',
    roles: ['admin'],
    scopes: { 'bod_cod_errors:view': 'ALL', 'bod_cod_errors:edit': 'ALL' },
  });
}

function factoryTables() {
  return {
    cems_wpms_connected_measurement_points: [
      {
        id: 12,
        source_request_id: 3,
        source_measurement_point_id: 5,
        eligible_factory_id: 17,
        factory_id: 'UBE-FID',
        factory_name: 'บริษัท อูเบะ เคมิคอลส์ (เอเซีย) จำกัด (มหาชน)',
        factory_registration_no: 'ข3-44-1/39รย',
        factory_address: '140/6 หมู่ 4 ตำบลตะพง อำเภอเมืองระยอง จังหวัดระยอง 21000',
        point_code: 'P0155',
        point_name: 'จุดที่ 1',
        point_type: 'EXIT',
        system_type: 'WPMS',
        parameters_json: '["BOD","COD"]',
        connected_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      },
    ],
    eligible_factories: [
      {
        id: 17,
        source_factory_id: 'UBE-FID',
        factory_registration_no_new: '91090100125393',
        factory_registration_no_old: 'ข3-44-1/39รย',
        province_name: 'ระยอง',
        industrial_estate_name: null,
        address: '140/6 หมู่ 4 ตำบลตะพง อำเภอเมืองระยอง จังหวัดระยอง 21000',
        business_activity: 'ผลิตสารคาโปรแลคตัม',
        factory_type_sequence: '00042',
        deleted_at: null,
      },
    ],
    factories: [
      {
        id: 9,
        fid: 'UBE-FID',
        code: 'ข3-44-1/39รย',
        juristic_id: 700,
        system_detail: 'อุตสาหกรรมเคมี',
        province_id: 1,
        industrial_estate_id: null,
        deleted_at: null,
      },
    ],
    provinces: [
      { id: 1, name_th: 'กรุงเทพมหานคร', region: 'ภาคกลาง' },
      { id: 2, name_th: 'ระยอง', region: 'ภาคตะวันออก' },
    ],
    industrial_estates: [{ id: 1, name_th: 'นิคมทดสอบ', code: 'FIXTURE' }],
    bod_cod_deviation_reports: [],
  };
}
