import { describe, expect, it } from '@jest/globals';
import { buildDeviceConnectionAccessQueryForTests } from '../../src/modules/device-connections/device-connections.repository';

describe('device connection repository access filters', () => {
  it('uses regionalAccess when the IN_REGION scope has no explicit region', () => {
    const compiled = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION' },
      regionalAccess: { regions: ['ภาคตะวันตก'] },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('cems_wpms_connected_measurement_points');
    expect(sql).toContain('cems_wpms_request_factory_snapshots');
    expect(sql).toContain('region_name');
    expect(compiled.bindings).toContain('ภาคตะวันตก');
  });

  it('fails closed on a conflicting explicit and profile region', () => {
    const compiled = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
      regionalAccess: { regions: ['ภาคใต้'] },
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = 0');
  });

  it('filters province and estate scopes by request or factory location', () => {
    const province = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_PROVINCE', province: 'ระยอง' },
    }).toSQL();
    const estate = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE', estateCode: 'MTP' },
    }).toSQL();

    expect(province.sql.toLowerCase()).toContain('province_name');
    expect(province.bindings).toContain('ระยอง');
    expect(estate.sql.toLowerCase()).toContain('industrial_estate_code');
    expect(estate.bindings).toContain('MTP');
  });

  it('enforces OWN_FACTORY using assigned factory access', () => {
    const compiled = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'OWN_FACTORY' },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(compiled.bindings).toContain(42);
  });

  it('fails closed when a required qualifier is missing', () => {
    const compiled = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE' },
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = 0');
  });

  it('filters ERC device configuration reads by factory type 88', () => {
    const compiled = buildDeviceConnectionAccessQueryForTests({
      actorUserId: 88,
      scope: { scope: 'FACTORY_TYPE_88' },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('eligible_factories');
    expect(sql).toContain('[ef].[factory_type_sequence]');
    expect(sql).toContain('[fs].[factory_main_type_code]');
    expect(compiled.bindings).toContain('00088');
  });
});
