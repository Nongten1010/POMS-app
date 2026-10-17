import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import type { ChatAccess } from '../../src/modules/chat/chat.types';
import {
  findChatFactory,
  findChatMeasurementPoint,
  listChatFactories,
  listChatMeasurementPoints,
} from '../../src/modules/chat/chat-factories.repository';
import { createChatSqlFixture, type ChatSqlFixture } from '../helpers/chat-sql-fixture';

const operator: ChatAccess = {
  actorUserId: 101,
  userType: 'operator',
  roles: ['factory_operator'],
  factoryScope: { scope: 'OWN_FACTORY' },
  regionalAccess: null,
  canCreateTicket: true,
  canWrite: true,
};
const allOfficer: ChatAccess = {
  ...operator,
  actorUserId: 201,
  userType: 'officer',
  roles: ['diw_central'],
  factoryScope: { scope: 'ALL' },
  canCreateTicket: false,
};
describe('chat factory and measurement-point repository', () => {
  let fixture: ChatSqlFixture;
  const originalProfileMode = env.FACTORY_PROFILE_MODE;

  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    fixture = await createChatSqlFixture(db);
  });
  afterEach(() => {
    fixture?.close();
    env.FACTORY_PROFILE_MODE = originalProfileMode;
  });

  it('lists an operator’s active assigned factories including one without any monitoring points', async () => {
    const result = await listChatFactories(operator, { page: 1, pageSize: 20 });

    expect(result.data.map((factory) => factory.id)).toEqual([10, 30]);
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it('limits an officer’s factory list and total to the explicit province', async () => {
    const result = await listChatFactories(
      {
        ...allOfficer,
        factoryScope: { scope: 'IN_PROVINCE', province: 'กรุงเทพมหานคร' },
      },
      { page: 1, pageSize: 20 },
    );

    expect(result.data.map((factory) => factory.id)).toEqual([20]);
    expect(result.pagination.total).toBe(1);
  });

  it('uses an explicit region before profile defaults and denies unresolved region scope', async () => {
    const regional = {
      ...allOfficer,
      factoryScope: { scope: 'IN_REGION', region: 'ภาคกลาง' } as const,
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    };
    expect(
      (await listChatFactories(regional, { page: 1, pageSize: 20 })).data.map((row) => row.id),
    ).toEqual([20]);
    expect(
      (
        await listChatFactories(
          { ...regional, factoryScope: { scope: 'IN_REGION' }, regionalAccess: null },
          { page: 1, pageSize: 20 },
        )
      ).data,
    ).toEqual([]);
  });

  it('selects only factories in the assigned industrial estate and denies a missing assignment', async () => {
    expect(
      (
        await listChatFactories(
          { ...allOfficer, factoryScope: { scope: 'IN_ESTATE', estateCode: 'IE-TEST' } },
          { page: 1, pageSize: 20 },
        )
      ).data.map((row) => row.id),
    ).toEqual([10]);
    expect(
      (
        await listChatFactories(
          { ...allOfficer, factoryScope: { scope: 'IN_ESTATE' } },
          { page: 1, pageSize: 20 },
        )
      ).data,
    ).toEqual([]);
  });

  it('shares current factory access between the picker and direct lookup, including revoked access', async () => {
    expect(await findChatFactory(operator, 10)).toEqual({
      id: 10,
      name: 'โรงงานสมมติ 10',
      registrationNo: 'REG-10',
      provinceName: 'ระยอง',
      regionName: 'ภาคตะวันออก',
    });
    expect(await findChatFactory(operator, 20)).toBeNull();
    fixture.execute(
      'UPDATE user_factory_access SET revoked_at = ? WHERE user_id = ? AND factory_id = ?',
      ['2026-01-01', 101, 10],
    );
    expect(await findChatFactory(operator, 10)).toBeNull();
    expect(
      (await listChatFactories(operator, { page: 1, pageSize: 20 })).data.map((row) => row.id),
    ).toEqual([30]);
  });

  it('searches names and registrations literally before counting and paginating authorized factories', async () => {
    const matches = await listChatFactories(allOfficer, { page: 1, pageSize: 1, q: 'REG-2' });
    expect(matches.data.map((row) => row.id)).toEqual([20]);
    expect(matches.pagination).toEqual({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    expect((await listChatFactories(allOfficer, { page: 1, pageSize: 20, q: '%' })).data).toEqual(
      [],
    );
  });

  it('returns typed eligible and connected point choices without merging equal point codes', async () => {
    fixture.execute('UPDATE factory_monitoring_points SET point_code = ? WHERE id = ?', [
      'C10',
      1000,
    ]);
    expect(await listChatMeasurementPoints(operator, 10)).toEqual([
      {
        kind: 'eligible',
        id: 1000,
        systemType: 'CEMS',
        pointCode: 'C10',
        pointName: 'จุดเข้าข่าย 10',
      },
      {
        kind: 'connected',
        id: 2000,
        systemType: 'CEMS',
        pointCode: 'C10',
        pointName: 'จุดเชื่อมต่อสมมติ',
      },
    ]);
    expect(await listChatMeasurementPoints(operator, 30)).toEqual([]);
    await expect(listChatMeasurementPoints(operator, 20)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('validates point kind, active row and factory membership when resolving a ticket selection', async () => {
    expect(
      await findChatMeasurementPoint(operator, 10, { kind: 'eligible', id: 1000 }),
    ).toMatchObject({ kind: 'eligible', id: 1000 });
    expect(
      await findChatMeasurementPoint(operator, 10, { kind: 'connected', id: 2000 }),
    ).toMatchObject({ kind: 'connected', id: 2000 });
    expect(await findChatMeasurementPoint(operator, 10, { kind: 'eligible', id: 2000 })).toBeNull();
    expect(
      await findChatMeasurementPoint(allOfficer, 20, { kind: 'connected', id: 2000 }),
    ).toBeNull();
    fixture.execute(
      'UPDATE cems_wpms_connected_measurement_points SET deleted_at = ? WHERE id = ?',
      ['2026-01-01', 2000],
    );
    expect(
      await findChatMeasurementPoint(operator, 10, { kind: 'connected', id: 2000 }),
    ).toBeNull();
    fixture.execute('UPDATE factory_monitoring_point_forms SET deleted_at = ? WHERE id = ?', [
      '2026-01-01',
      100,
    ]);
    expect(await findChatMeasurementPoint(operator, 10, { kind: 'eligible', id: 1000 })).toBeNull();
  });

  it('applies factory-type 88 scope while retaining the permitted factory without monitoring points', async () => {
    fixture.execute('UPDATE eligible_factories SET factory_type_sequence = ? WHERE id = ?', [
      '00099',
      20,
    ]);
    const result = await listChatFactories(
      { ...allOfficer, factoryScope: { scope: 'FACTORY_TYPE_88' } },
      { page: 1, pageSize: 20 },
    );
    expect(result.data.map((row) => row.id)).toEqual([10, 30]);
  });

  it('fails closed for absent persona, citizen persona and missing scoped permission even with an admin role', async () => {
    for (const access of [
      { ...allOfficer, roles: [] },
      { ...allOfficer, userType: 'citizen' as const, roles: ['public_user'] },
      { ...allOfficer, userType: 'admin' as const, roles: ['admin'], factoryScope: undefined },
    ]) {
      expect((await listChatFactories(access, { page: 1, pageSize: 20 })).data).toEqual([]);
      expect(await findChatFactory(access, 10)).toBeNull();
    }
  });

  it('treats an explicit estate code as a code, even if another estate uses it as a display name', async () => {
    fixture.execute('INSERT INTO industrial_estates (id, code, name_th) VALUES (?, ?, ?)', [
      2,
      'OTHER',
      'IE-TEST',
    ]);
    fixture.execute('UPDATE eligible_factories SET industrial_estate_name = ? WHERE id = ?', [
      'IE-TEST',
      20,
    ]);
    const result = await listChatFactories(
      { ...allOfficer, factoryScope: { scope: 'IN_ESTATE', estateCode: 'IE-TEST' } },
      { page: 1, pageSize: 20 },
    );
    expect(result.data.map((row) => row.id)).toEqual([10]);
  });

  it('keeps operators restricted to current assignments even when their effective factory scope is ALL', async () => {
    fixture.execute('UPDATE factories SET juristic_id = ? WHERE id = ?', [10, 20]);
    const access = { ...operator, factoryScope: { scope: 'ALL' } as const };
    expect(
      (await listChatFactories(access, { page: 1, pageSize: 20 })).data.map((row) => row.id),
    ).toEqual([10, 30]);
    expect(await findChatFactory(access, 20)).toBeNull();
    fixture.execute(
      'INSERT INTO user_juristics (user_id, juristic_id, revoked_at) VALUES (?, ?, ?)',
      [101, 10, null],
    );
    expect(await findChatFactory(access, 20)).toMatchObject({ id: 20 });
    fixture.execute('UPDATE user_juristics SET revoked_at = ? WHERE user_id = ?', [
      '2026-01-01',
      101,
    ]);
    expect(await findChatFactory(access, 20)).toBeNull();
  });

  it('includes eligible factories without a master identity for an authorized officer but does not invent operator ownership', async () => {
    fixture.execute('DELETE FROM factories WHERE id = ?', [10]);
    expect(await findChatFactory(allOfficer, 10)).toMatchObject({ id: 10 });
    expect(await findChatFactory(operator, 10)).toBeNull();
    expect((await listChatMeasurementPoints(allOfficer, 10)).length).toBe(2);
  });

  it('uses current canonical profile views for both factory scope and connected point labels', async () => {
    fixture.execute('DROP VIEW current_eligible_factories');
    fixture.execute(`CREATE VIEW current_eligible_factories AS SELECT id, source_factory_id,
      factory_registration_no_new, factory_registration_no_old, industrial_estate_name,
      factory_type_sequence, monitoring_point_form_id, deleted_at,
      'โรงงานข้อมูลปัจจุบัน' AS factory_name, 'กรุงเทพมหานคร' AS province_name FROM eligible_factories`);
    fixture.execute('DROP VIEW current_connected_measurement_points');
    fixture.execute(`CREATE VIEW current_connected_measurement_points AS SELECT id, eligible_factory_id,
      system_type, point_code, deleted_at, 'จุดข้อมูลปัจจุบัน' AS point_name FROM cems_wpms_connected_measurement_points`);
    env.FACTORY_PROFILE_MODE = 'canonical';
    const access = {
      ...allOfficer,
      factoryScope: { scope: 'IN_REGION', region: 'ภาคกลาง' } as const,
    };
    expect(await findChatFactory(access, 10)).toMatchObject({
      name: 'โรงงานข้อมูลปัจจุบัน',
      provinceName: 'กรุงเทพมหานคร',
      regionName: 'ภาคกลาง',
    });
    expect(
      await findChatMeasurementPoint(access, 10, { kind: 'connected', id: 2000 }),
    ).toMatchObject({ pointName: 'จุดข้อมูลปัจจุบัน' });
  });

  it('removes retired factories from lookup and never substitutes another factory with the same registration', async () => {
    fixture.execute('UPDATE eligible_factories SET deleted_at = ? WHERE id = ?', [
      '2026-01-01',
      10,
    ]);
    fixture.execute('UPDATE eligible_factories SET factory_registration_no_new = ? WHERE id = ?', [
      'REG-10',
      30,
    ]);
    expect(await findChatFactory(allOfficer, 10)).toBeNull();
    expect(
      await findChatMeasurementPoint(allOfficer, 10, { kind: 'connected', id: 2000 }),
    ).toBeNull();
    expect(await findChatFactory(allOfficer, 30)).toMatchObject({
      id: 30,
      registrationNo: 'REG-10',
    });
  });

  it('does not grant operator access when source identity and registration match conflicting factory masters', async () => {
    fixture.execute('UPDATE factories SET code = ? WHERE id = ?', ['REG-20', 10]);
    expect(await findChatFactory(operator, 20)).toBeNull();
    expect(await findChatFactory(allOfficer, 20)).toMatchObject({ id: 20 });
  });

  it('does not reassign a retired source factory to an operator whose active master reuses its registration', async () => {
    fixture.execute('UPDATE factories SET code = ? WHERE id = ?', ['REG-20', 10]);
    fixture.execute('UPDATE factories SET deleted_at = ? WHERE id = ?', ['2026-01-01', 20]);
    expect(await findChatFactory(operator, 20)).toBeNull();
  });

  it('denies recycled registration identities even when the eligible factory has no known source master', async () => {
    fixture.execute('UPDATE factories SET code = ? WHERE id = ?', ['REG-20', 10]);
    fixture.execute('UPDATE factories SET deleted_at = ? WHERE id = ?', ['2026-01-01', 20]);
    for (const source of [null, 'UNMAPPED-EXTERNAL-SOURCE']) {
      fixture.execute('UPDATE eligible_factories SET source_factory_id = ? WHERE id = ?', [
        source,
        20,
      ]);
      expect(await findChatFactory(operator, 20)).toBeNull();
    }
  });

  it('permits a unique active registration association when the external source has never mapped to a master', async () => {
    fixture.execute('UPDATE eligible_factories SET source_factory_id = ? WHERE id = ?', [
      'UNMAPPED-EXTERNAL-SOURCE',
      10,
    ]);
    expect(await findChatFactory(operator, 10)).toMatchObject({ id: 10 });
  });
});
