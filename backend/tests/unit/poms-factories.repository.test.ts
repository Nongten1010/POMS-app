import { describe, expect, it } from '@jest/globals';
import {
  buildApprovedPomsFactoryProfilePatchesForTests,
  buildApprovedMeasurementPointWritePatchForTests,
  buildConnectedFactoryRowsQueryForTests,
  buildEditRequestsQueryForTests,
  buildPendingRequestCountsQueryForTests,
  summarizeConnectedFactoryRowsForTests,
  toPomsFactoryDetailForTests,
  toPomsParameterDisplayNamesForTests,
} from '../../src/modules/poms-factories/poms-factories.repository';

describe('pomsFactoriesRepository access and approved profile patches', () => {
  it('reads live factories from active connected POMS rows', () => {
    const sql = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 77,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).toContain('inner join [eligible_factories] as [ef]');
    expect(sql).toContain('[cp].[deleted_at] is null');
    expect(sql).toContain('[ef].[factory_registration_no_new]');
    expect(sql).toContain('[ef].[factory_registration_no_old]');
    expect(sql).toContain('[ef].[business_activity]');
    expect(sql).toContain('[ef].[factory_type_sequence]');
    expect(sql).not.toContain('cems_wpms_connection_requests');
    expect(sql).not.toContain('user_juristics');
  });

  it('searches by both current/live and eligible registration numbers', () => {
    const compiled = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 77,
      scope: 'ALL',
    }, '3-106')
      .toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[cp].[factory_registration_no] like ?');
    expect(sql).toContain('[ef].[factory_registration_no_new] like ?');
    expect(sql).toContain('[ef].[factory_registration_no_old] like ?');
    expect(compiled.bindings).toContain('%3-106%');
  });

  it('maps connected POMS rows to the exact operator-factories row contract', () => {
    const rows = [
      connectedFactoryRow({
        connected_point_id: 15,
        point_name: 'ปล่อง A',
        point_code: 'S0001',
        factory_name: 'ชื่อเก่า',
        factory_address: '98 หมู่ 1',
        updated_at: '2026-08-24T00:00:00.000Z',
      }),
      connectedFactoryRow({
        connected_point_id: 16,
        source_measurement_point_id: 3,
        point_name: 'ปล่อง B',
        point_code: 'S0002',
        factory_name: 'บริษัท ทดสอบ จำกัด',
        factory_address: '99 หมู่ 1',
        updated_at: '2026-09-01T00:00:00.000Z',
      }),
    ];

    const result = summarizeConnectedFactoryRowsForTests(rows);

    expect(result).toEqual([
      {
        id: 7,
        factoryId: 'factory-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        newRegistrationNo: '3-106-33/50สบ',
        oldRegistrationNo: '3-106-33/49สบ',
        industryType: 'ผลิตเคมีภัณฑ์',
        industryMainOrder: '00042',
        industrySubOrder: '04201',
        businessActivity: 'ผลิตเคมีภัณฑ์',
        eia: 'มี EIA',
        projectName: 'โครงการเดิม',
        address: '99 หมู่ 1',
        latitude: '12.7',
        longitude: '101.1',
        province: 'ระยอง',
        officerNotificationEmails: [],
        isEligible: true,
        eligibilityStatus: 'เข้าข่าย',
        monitoringPointCount: 2,
        requestStatusCode: 'CONNECTED',
        eligibilityRequest: null,
        canRequestEligibility: false,
        status: 'แสดง',
      },
    ]);
    for (const legacyField of LEGACY_POMS_FACTORY_LIST_FIELDS) {
      expect(result[0]).not.toHaveProperty(legacyField);
    }
  });

  it('keeps eligible-factory industry fields in the live POMS factory detail', () => {
    const result = toPomsFactoryDetailForTests([connectedFactoryRow()], 0);

    expect(result).toEqual(
      expect.objectContaining({
        industryMainOrder: '00042',
        industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 00042',
        industrySubOrder: '04201',
        businessActivity: 'ผลิตเคมีภัณฑ์',
      }),
    );
  });

  it('limits OWN_FACTORY reads and edit requests to assigned juristics or direct grants', () => {
    const factorySql = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    })
      .toSQL()
      .sql.toLowerCase();
    const requestSql = buildEditRequestsQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    })
      .toSQL()
      .sql.toLowerCase();

    for (const sql of [factorySql, requestSql]) {
      expect(sql).toContain('user_juristics');
      expect(sql).toContain('user_factory_access');
      expect(sql).toContain('[uj].[user_id]');
    }
  });

  it('filters province scope and fails closed when estate details are missing', () => {
    const province = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_PROVINCE', province: 'ระยอง' },
    }).toSQL();
    const missingEstate = buildEditRequestsQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_ESTATE' },
    }).toSQL();

    expect(province.sql.toLowerCase()).toContain('[ef].[province_name] = ?');
    expect(province.bindings).toContain('ระยอง');
    expect(missingEstate.sql.toLowerCase()).toContain('1 = 0');
  });

  it('fails closed when a requested region is outside the actor regional assignment', () => {
    const compiled = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = 0');
    expect(compiled.bindings).not.toContain('ภาคเหนือ');
  });

  it('limits ERC reads to eligible factories with factory type 88', () => {
    const compiled = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 88,
      scope: { scope: 'FACTORY_TYPE_88' },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[ef].[factory_type_sequence]');
    expect(compiled.bindings).toContain('00088');
    expect(sql).not.toContain('user_juristics');
  });

  it('applies only editable fields from legacy snapshots to connected-POMS and eligible factories', () => {
    const patches = buildApprovedPomsFactoryProfilePatchesForTests({
      eligibleFactoryId: 7,
      factoryId: 'factory-001',
      factoryRegistrationNo: '1012345678901',
      factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
      industryMainOrder: '00042',
      industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 42',
      industrySubOrder: '04201',
      businessActivity: 'ผลิตเคมีภัณฑ์',
      factoryAddress: '100 หมู่ 2',
      provinceName: 'ระยอง',
      industrialEstateName: null,
      latitude: 12.7,
      longitude: 101.1,
      eia: 'อื่นๆ',
      eiaOther: 'รายงานเฉพาะโครงการ',
      projectName: 'โครงการใหม่',
      factoryFrontPhotos: [
        {
          title: 'ภาพด้านหน้า',
          description: null,
          link: null,
          fileName: 'front.jpg',
          fileUrl: 'https://example.com/front.jpg',
          fileType: 'image/jpeg',
          fileSize: 100,
        },
      ],
      factoryLogo: null,
      updatedAt: '2026-08-24T00:00:00.000Z',
    });

    expect(patches.connected).toMatchObject({
      factory_latitude: 12.7,
      factory_longitude: 101.1,
      factory_project_name: 'โครงการใหม่',
      factory_eia_assessment: 'อื่นๆ',
      factory_eia_other: 'รายงานเฉพาะโครงการ',
      factory_has_eia: false,
      factory_logo_json: null,
    });
    expect(patches.eligible).toMatchObject({
      latitude: 12.7,
      longitude: 101.1,
      project_name: 'โครงการใหม่',
      eia_assessment: 'อื่นๆ',
      eia_other: 'รายงานเฉพาะโครงการ',
      has_eia: false,
    });
    expect(JSON.parse(patches.connected.factory_front_photos_json!)).toEqual([
      expect.objectContaining({ fileName: 'front.jpg' }),
    ]);
    for (const field of ['factory_id', 'factory_name', 'factory_address']) {
      expect(patches.connected).not.toHaveProperty(field);
    }
    for (const field of ['factory_name', 'address']) {
      expect(patches.eligible).not.toHaveProperty(field);
    }
    expect(Object.keys(patches.eligible)).not.toContain('factory_registration_no_new');
    expect(Object.keys(patches.eligible)).not.toEqual(
      expect.arrayContaining(['factory_type_sequence', 'business_activity']),
    );
  });

  it('returns display labels with units without collapsing parameters that use explicit units', () => {
    expect(
      toPomsParameterDisplayNamesForTests(['CO2', 'BOD', 'CO (ppm)', 'CO (%)', 'Custom'], {
        parameters: [{ parameter: 'Custom (kg/h)' }],
      }),
    ).toEqual(['CO2 (ppm)', 'BOD (mg/L)', 'CO (ppm)', 'CO (%)', 'Custom (kg/h)']);
  });

  it('builds measurement-point updates from the safe allowlist only', () => {
    const patch = buildApprovedMeasurementPointWritePatchForTests({
      ...measurementPoint(),
      pointName: 'ปล่อง A (แก้ไข)',
      monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
      details: { latitude: 12.7, longitude: 101.1 },
      documentsAndImages: [],
      measurementInstruments: null,
    });

    expect(patch).toEqual(
      expect.objectContaining({
        point_name: 'ปล่อง A (แก้ไข)',
        monitoring_point_status: 'อยู่ระหว่างเชื่อมต่อ',
      }),
    );
    expect(Object.keys(patch)).not.toEqual(
      expect.arrayContaining(['point_code', 'point_type', 'parameters_json', 'system_type']),
    );
  });

  it('counts every open request regardless of formType', () => {
    const compiled = buildPendingRequestCountsQueryForTests([7, 8]);

    expect(compiled.sql.toLowerCase()).toContain('from [poms_factory_edit_requests]');
    expect(compiled.sql.toLowerCase()).toContain('[is_open] = ?');
    expect(compiled.sql.toLowerCase()).not.toContain('[form_type]');
    expect(compiled.bindings).toContain(true);
  });
});

function measurementPoint() {
  return {
    connectedPointId: 15,
    sourceMeasurementPointId: 150,
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    systemType: 'CEMS' as const,
    pointName: 'ปล่อง A',
    pointCode: 'S0001',
    pointType: 'STACK' as const,
    parameters: ['CO (ppm)'],
    monitoringPointStatus: null,
    details: null,
    documentsAndImages: [],
    measurementInstruments: {
      parameters: [{ parameter: 'CO (ppm)' }],
    },
    updatedAt: '2026-09-01T00:00:00.000Z',
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

function connectedFactoryRow(overrides: Record<string, unknown> = {}) {
  return {
    connected_point_id: 15,
    source_measurement_point_id: 2,
    eligible_factory_id: 7,
    factory_id: 'factory-001',
    factory_name: 'บริษัท ทดสอบ จำกัด',
    factory_registration_no: 'POMS-REG-001',
    factory_address: '99 หมู่ 1',
    factory_latitude: 12.7,
    factory_longitude: 101.1,
    factory_eia_assessment: 'มี EIA' as const,
    factory_eia_other: null,
    factory_project_name: 'โครงการเดิม',
    factory_front_photos_json: null,
    factory_logo_json: null,
    province_name: 'ระยอง',
    industrial_estate_name: null,
    factory_registration_no_new: '3-106-33/50สบ',
    factory_registration_no_old: '3-106-33/49สบ',
    business_activity: 'ผลิตเคมีภัณฑ์',
    factory_type_sequence: '42 / 4201',
    system_type: 'CEMS' as const,
    point_name: 'ปล่อง A',
    point_code: 'S0001',
    point_type: 'STACK' as const,
    parameters_json: '["CO"]',
    monitoring_point_status: 'เชื่อมต่อครบแล้ว' as const,
    details_json: null,
    documents_json: null,
    instruments_json: null,
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}
