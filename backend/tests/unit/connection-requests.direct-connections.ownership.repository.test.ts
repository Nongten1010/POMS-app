import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import {
  buildDirectConnectionFactoryQueryForTests,
  connectionRequestsRepository,
} from '../../src/modules/connection-requests/connection-requests.repository';
import { createKnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
let fixture: Awaited<ReturnType<typeof createKnexSqliteFixture>>;

beforeEach(async () => {
  env.FACTORY_PROFILE_MODE = 'legacy';
  const eligible = [17, 18, 19, 20].map((id) => ({
    id,
    source_factory_id: `FID-${id}`,
    source_system: 'diw',
    factory_registration_no_new: `REG-${id}`,
    factory_registration_no_old: `OLD-${id}`,
    factory_name: `Factory ${id}`,
    province_name: 'assigned province',
    industrial_estate_name: null,
    deleted_at: null,
  }));
  fixture = await createKnexSqliteFixture(db, {
    eligible_factories: eligible,
    current_eligible_factories: eligible,
    factories: [
      { id: 1, fid: 'FID-17', code: 'OLD-17', juristic_id: 'J-1', deleted_at: null },
      { id: 2, fid: 'FID-18', code: 'REG-18', juristic_id: 'J-1', deleted_at: null },
      { id: 3, fid: 'FID-19', code: 'REG-19', juristic_id: 'J-2', deleted_at: null },
      { id: 4, fid: 'FID-20', code: 'REG-20', juristic_id: 'J-3', deleted_at: 'deleted' },
    ],
    user_factory_access: [
      { user_id: 42, factory_id: 1, revoked_at: null },
      { user_id: 44, factory_id: 1, revoked_at: 'revoked' },
      { user_id: 46, factory_id: 4, revoked_at: null },
    ],
    user_juristics: [
      { user_id: 43, juristic_id: 'J-1', revoked_at: null },
      { user_id: 45, juristic_id: 'J-1', revoked_at: 'revoked' },
    ],
    provinces: [{ name_th: 'assigned province', region: 'assigned region' }],
    industrial_estates: [{ id: 1, code: 'IE-1', name_th: 'fixture estate' }],
  });
});

afterEach(() => {
  fixture?.close();
  env.FACTORY_PROFILE_MODE = originalMode;
});

describe('direct eligible-factory OWN_FACTORY access', () => {
  it.each(['legacy', 'canonical'] as const)(
    'permits the current direct assignment after registration correction in %s mode',
    async (mode) => {
      env.FACTORY_PROFILE_MODE = mode;
      await expect(lookup(17, 42)).resolves.toMatchObject({
        eligibleFactoryId: 17,
        newRegistrationNo: 'REG-17',
      });
    },
  );

  it('permits a live juristic assignment for both of its active factories', async () => {
    await expect(lookup(17, 43)).resolves.toMatchObject({ eligibleFactoryId: 17 });
    await expect(lookup(18, 43)).resolves.toMatchObject({ eligibleFactoryId: 18 });
  });

  it('does not expand a direct factory grant to a sibling of the same juristic', async () => {
    await expect(lookup(17, 42)).resolves.toMatchObject({ eligibleFactoryId: 17 });
    await expect(lookup(18, 42)).resolves.toBeNull();
  });

  it.each([44, 45, 99])(
    'denies revoked or missing assignment for actor %s',
    async (actorUserId) => {
      await expect(lookup(17, actorUserId)).resolves.toBeNull();
    },
  );

  it('denies a deleted supporting factory even when its explicit assignment remains', async () => {
    await expect(lookup(20, 46)).resolves.toBeNull();
  });

  it('denies an archived eligible factory even when its explicit assignment remains', async () => {
    fixture.execute("UPDATE eligible_factories SET deleted_at = 'deleted' WHERE id = 17");
    await expect(lookup(17, 42)).resolves.toBeNull();
  });

  it('keeps the selected identity when the display registration identifies another factory', async () => {
    const access = { actorUserId: 42, scope: 'OWN_FACTORY' };
    await expect(
      connectionRequestsRepository.findDirectConnectionFactory(
        { factoryId: 'FID-18', factoryRegistrationNo: 'REG-17' },
        access,
      ),
    ).resolves.toBeNull();
    await expect(
      connectionRequestsRepository.findDirectConnectionFactory(
        { factoryId: 'FID-17', factoryRegistrationNo: 'REG-18' },
        access,
      ),
    ).resolves.toMatchObject({ eligibleFactoryId: 17 });
  });

  it('uses current ownership without a legacy profile-region clamp', async () => {
    await expect(
      connectionRequestsRepository.findDirectConnectionFactory(
        { factoryId: 'FID-17', factoryRegistrationNo: 'OLD-17' },
        {
          actorUserId: 42,
          scope: { scope: 'OWN_FACTORY' },
          regionalAccess: { regions: ['different legacy profile region'] },
        },
      ),
    ).resolves.toMatchObject({ eligibleFactoryId: 17 });
  });

  it('correlates the active eligible row with active factory assignments in SQL', () => {
    const compiled = buildDirectConnectionFactoryQueryForTests(
      { factoryId: 'FID-17', factoryRegistrationNo: 'OLD-17' },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    ).toSQL();
    expect(compiled.sql).toContain('from [factories] as [f]');
    expect(compiled.sql).toContain('[f].[deleted_at] is null');
    expect(compiled.sql).toContain('[ef].[deleted_at] is null');
    expect(compiled.sql).toContain('user_juristics');
    expect(compiled.sql).toContain('user_factory_access');
    expect(compiled.sql).toContain('[uj].[revoked_at] is null');
    expect(compiled.sql).toContain('[ufa].[revoked_at] is null');
    expect(compiled.bindings.filter((value) => value === 42)).toHaveLength(2);
  });
});

function lookup(factory: number, actorUserId: number) {
  return connectionRequestsRepository.findDirectConnectionFactory(
    { factoryId: `FID-${factory}`, factoryRegistrationNo: `OLD-${factory}` },
    { actorUserId, scope: 'OWN_FACTORY' },
  );
}
