import { describe, expect, it } from '@jest/globals';
import {
  buildApprovedPomsFactoryProfilePatchesForTests,
  buildConnectedFactoryRowsQueryForTests,
  buildEditRequestsQueryForTests,
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
    expect(sql).not.toContain('user_juristics');
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

  it('builds separate connected-POMS and eligible-factory patches without touching factories', () => {
    const patches = buildApprovedPomsFactoryProfilePatchesForTests({
      eligibleFactoryId: 7,
      factoryId: 'factory-001',
      factoryRegistrationNo: '1012345678901',
      factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
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
      factory_name: 'บริษัท ทดสอบ จำกัด (ใหม่)',
      factory_eia_assessment: 'อื่นๆ',
      factory_eia_other: 'รายงานเฉพาะโครงการ',
      factory_has_eia: false,
      factory_logo_json: null,
    });
    expect(patches.eligible).toMatchObject({
      factory_name: 'บริษัท ทดสอบ จำกัด (ใหม่)',
      eia_assessment: 'อื่นๆ',
      eia_other: 'รายงานเฉพาะโครงการ',
      has_eia: false,
    });
    expect(Object.keys(patches.connected)).not.toContain('factory_id');
    expect(Object.keys(patches.eligible)).not.toContain('factory_registration_no_new');
  });

  it('returns display labels with units without collapsing parameters that use explicit units', () => {
    expect(
      toPomsParameterDisplayNamesForTests(['CO2', 'BOD', 'CO (ppm)', 'CO (%)', 'Custom'], {
        parameters: [{ parameter: 'Custom (kg/h)' }],
      }),
    ).toEqual(['CO2 (ppm)', 'BOD (mg/L)', 'CO (ppm)', 'CO (%)', 'Custom (kg/h)']);
  });
});
