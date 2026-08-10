import { describe, expect, it } from '@jest/globals';
import { buildFormsQueryForTests } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';

describe('monitoring point form repository access filters', () => {
  it('uses regionalAccess when IN_REGION has no explicit region', () => {
    const compiled = buildFormsQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION' },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[pr].[region]');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
  });

  it('fails closed when explicit region conflicts with regionalAccess', () => {
    const compiled = buildFormsQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
        regionalAccess: { regions: ['ภาคใต้'] },
      },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = 0');
  });

  it('fails closed when province or estate qualifiers are missing', () => {
    const missingProvince = buildFormsQueryForTests(
      {},
      { actorUserId: 42, scope: { scope: 'IN_PROVINCE' } },
    ).toSQL();
    const missingEstate = buildFormsQueryForTests(
      {},
      { actorUserId: 42, scope: { scope: 'IN_ESTATE' } },
    ).toSQL();

    expect(missingProvince.sql.toLowerCase()).toContain('1 = 0');
    expect(missingEstate.sql.toLowerCase()).toContain('1 = 0');
  });

  it('filters estate access through the factory registration and estate code', () => {
    const compiled = buildFormsQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_ESTATE', estateCode: 'MTP' },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('industrial_estates');
    expect(sql).toContain('factory_registration_no_new');
    expect(compiled.bindings).toContain('MTP');
  });

  it('enforces OWN_FACTORY through the assigned factory relation', () => {
    const compiled = buildFormsQueryForTests(
      {},
      { actorUserId: 42, scope: { scope: 'OWN_FACTORY' } },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(compiled.bindings).toContain(42);
  });
});
