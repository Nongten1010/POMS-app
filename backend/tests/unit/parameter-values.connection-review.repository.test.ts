import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import {
  buildConnectionReviewStationAccessQueryForTests,
  parameterValuesRepository,
} from '../../src/modules/parameter-values/parameter-values.repository';
import type { ParameterValueAccessContext } from '../../src/modules/parameter-values/parameter-values.types';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
let fixture: KnexSqliteFixture;
const provinceAccess: ParameterValueAccessContext = {
  actorUserId: 42,
  scope: { scope: 'IN_PROVINCE', province: 'นครปฐม' },
};

describe('connection-test approval station access', () => {
  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    const statuses = [
      'WAITING_CONNECTION',
      'CONNECTION_CONFIRMED',
      'PENDING_DESIGN_REVIEW',
      'REVISED_PENDING_DESIGN_REVIEW',
      'WAITING_FACTORY_REVISION',
      'REJECTED',
      'CANCELED',
      'CONNECTED',
      'CONNECTION_CONFIRMED',
      'CONNECTION_CONFIRMED',
      'CONNECTION_CONFIRMED',
      'CONNECTION_CONFIRMED',
      'CONNECTION_CONFIRMED',
    ];
    fixture = await createKnexSqliteFixture(db, {
      cems_wpms_connection_requests: statuses.map((status, index) => ({
        id: index + 1,
        factory_id: 'FACTORY-A',
        status,
        deleted_at: index === 9 ? '2026-10-19' : null,
        created_by: 7,
      })),
      cems_wpms_measurement_points: statuses.map((_, index) => ({
        id: index + 1,
        request_id: index + 1,
        point_code: index === 1 || index === 12 ? 'S2007' : `S-${index + 1}`,
        point_name: `Point ${index + 1}`,
        parameters_json: JSON.stringify([index === 12 ? 'SECRET (ppm)' : 'NOx (ppm)']),
        instruments_json: null,
        deleted_at: index === 8 ? '2026-10-19' : null,
      })),
      cems_wpms_request_factory_snapshots: statuses.flatMap((_, index) =>
        index === 11
          ? []
          : [
              {
                id: index + 1,
                request_id: index + 1,
                province_name: index === 12 ? 'กรุงเทพมหานคร' : 'นครปฐม',
                province_code: index === 12 ? '10' : '73',
                region_name: index === 12 ? 'ภาคตะวันออก' : 'ภาคกลาง',
                region_code: index === 12 ? 'E' : 'C',
                industrial_estate_code: index === 12 ? 'IE-OUTSIDE' : 'IE-01',
                factory_main_type_code: '00088',
                deleted_at: index === 10 ? '2026-10-19' : null,
              },
            ],
      ),
      cems_wpms_connected_measurement_points: [
        {
          id: 101,
          point_code: 'LIVE',
          point_name: 'Live point',
          eligible_factory_id: 1,
          factory_id: 'FACTORY-A',
          parameters_json: JSON.stringify(['CO (ppm)']),
          instruments_json: null,
          created_by: 42,
          deleted_at: null,
        },
        {
          id: 102,
          point_code: 'DELETED-LIVE',
          point_name: 'Deleted live point',
          eligible_factory_id: 1,
          factory_id: 'FACTORY-A',
          parameters_json: JSON.stringify(['CO (ppm)']),
          instruments_json: null,
          created_by: 42,
          deleted_at: '2026-10-19',
        },
      ],
      eligible_factories: [
        {
          id: 1,
          source_factory_id: 'FACTORY-A',
          factory_registration_no_new: 'FACTORY-A',
          province_name: 'นครปฐม',
          industrial_estate_name: 'Estate 1',
          factory_type_sequence: '00088',
          deleted_at: null,
        },
      ],
      factories: [
        {
          id: 1,
          fid: 'FACTORY-A',
          code: 'FACTORY-A',
          province_id: 10,
          industrial_estate_id: 1,
          deleted_at: null,
        },
      ],
      provinces: [
        { id: 10, name_th: 'กรุงเทพมหานคร', region: 'ภาคตะวันออก' },
        { id: 73, name_th: 'นครปฐม', region: 'ภาคกลาง' },
      ],
      industrial_estates: [{ id: 1, code: 'IE-01', name_th: 'Estate 1', deleted_at: null }],
    });
  });

  afterEach(() => {
    fixture?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
  });

  it.each(['S-1', 'S2007', 'LIVE'])(
    'allows %s in the approval province and returns its registered labels with units',
    async (stationId) => {
      await expect(
        parameterValuesRepository.canAccessStationForConnectionReview(stationId, provinceAccess),
      ).resolves.toBe(true);
      await expect(
        parameterValuesRepository.listRegisteredParametersForConnectionReview(
          stationId,
          provinceAccess,
        ),
      ).resolves.toEqual([stationId === 'LIVE' ? 'CO (ppm)' : 'NOx (ppm)']);
    },
  );

  it.each([
    'S-3',
    'S-4',
    'S-5',
    'S-6',
    'S-7',
    'S-8',
    'S-9',
    'S-10',
    'S-11',
    'S-12',
    'DELETED-LIVE',
    'UNKNOWN',
  ])('denies %s and returns no parameter labels', async (stationId) => {
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview(stationId, provinceAccess),
    ).resolves.toBe(false);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionReview(
        stationId,
        provinceAccess,
      ),
    ).resolves.toEqual([]);
  });

  it.each([
    { scope: 'IN_PROVINCE', province: '73' },
    { scope: 'IN_REGION', region: 'ภาคกลาง' },
    { scope: 'IN_REGION', region: 'C' },
    { scope: 'IN_ESTATE', estateCode: 'IE-01' },
    { scope: 'IN_ESTATE', estate: 'IE-01' },
    { scope: 'IN_ESTATE', industrialEstateCode: 'IE-01' },
    { scope: 'IN_ESTATE', estateId: 'IE-01' },
    { scope: 'IN_ESTATE', industrialEstateId: 'IE-01' },
  ] as const)(
    'uses the request snapshot for %j despite a different factory master location',
    async (scope) => {
      const access = { actorUserId: 42, scope };
      await expect(
        parameterValuesRepository.canAccessStationForConnectionReview('S-1', access),
      ).resolves.toBe(true);
    },
  );

  it.each(['legacy', 'canonical'] as const)(
    'accepts live approval province codes and estate aliases in %s mode without changing device-setting access',
    async (mode) => {
      if (mode === 'canonical') {
        fixture.execute(
          'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
        );
        fixture.execute(
          'CREATE VIEW current_eligible_factories AS SELECT * FROM eligible_factories',
        );
      }
      env.FACTORY_PROFILE_MODE = mode;
      for (const scope of [
        { scope: 'IN_PROVINCE', province: '73' },
        { scope: 'IN_ESTATE', industrialEstateCode: 'IE-01' },
        { scope: 'IN_ESTATE', estateId: 'IE-01' },
        { scope: 'IN_ESTATE', industrialEstateId: 'IE-01' },
      ] as const) {
        const access = { actorUserId: 42, scope };
        await expect(
          parameterValuesRepository.canAccessStationForConnectionReview('LIVE', access),
        ).resolves.toBe(true);
        await expect(
          parameterValuesRepository.listRegisteredParametersForConnectionReview('LIVE', access),
        ).resolves.toEqual(['CO (ppm)']);
        await expect(
          parameterValuesRepository.canAccessStationForConnectionTest('LIVE', access),
        ).resolves.toBe(false);
        await expect(
          parameterValuesRepository.listRegisteredParametersForConnectionTest('LIVE', access),
        ).resolves.toEqual([]);
      }
    },
  );

  it.each([
    { scope: 'IN_ESTATE', estateId: '1' },
    { scope: 'IN_ESTATE', estateId: 1 },
    { scope: 'IN_ESTATE', industrialEstateId: '1' },
    { scope: 'IN_ESTATE', industrialEstateId: 1 },
  ] as const)(
    'matches the legacy estate qualifier %j to estate codes for requests and live points',
    async (scope) => {
      fixture.execute(
        'UPDATE cems_wpms_request_factory_snapshots SET industrial_estate_code = ? WHERE id IN (1, 2)',
        ['1'],
      );
      fixture.execute('UPDATE industrial_estates SET code = ? WHERE id = 1', ['1']);
      const access = { actorUserId: 42, scope };
      for (const stationId of ['S-1', 'S2007', 'LIVE']) {
        await expect(
          parameterValuesRepository.canAccessStationForConnectionReview(stationId, access),
        ).resolves.toBe(true);
        await expect(
          parameterValuesRepository.listRegisteredParametersForConnectionReview(stationId, access),
        ).resolves.toEqual([stationId === 'LIVE' ? 'CO (ppm)' : 'NOx (ppm)']);
      }
    },
  );

  it.each([
    { scope: 'IN_ESTATE', estateCode: '1' },
    { scope: 'IN_ESTATE', estateId: 1 },
    { scope: 'IN_ESTATE', industrialEstateId: '1' },
    { scope: 'IN_ESTATE', industrialEstateId: 1 },
  ] as const)(
    'does not interpret the estate qualifier %j as a master primary key',
    async (scope) => {
      const access = { actorUserId: 42, scope };
      await expect(
        parameterValuesRepository.canAccessStationForConnectionReview('LIVE', access),
      ).resolves.toBe(false);
      await expect(
        parameterValuesRepository.listRegisteredParametersForConnectionReview('LIVE', access),
      ).resolves.toEqual([]);
    },
  );

  it('does not infer a live region code from a historical request or profile default', async () => {
    const access = {
      actorUserId: 42,
      scope: { scope: 'IN_REGION' as const, region: 'C' },
      regionalAccess: { regions: ['ภาคกลาง'] },
    };
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('S-1', access),
    ).resolves.toBe(true);
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('LIVE', access),
    ).resolves.toBe(false);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionReview('LIVE', access),
    ).resolves.toEqual([]);
  });

  it('uses regionalAccess only when the approval menu has no explicit region', async () => {
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('S-1', {
        actorUserId: 42,
        scope: { scope: 'IN_REGION' },
        regionalAccess: { regions: ['ภาคกลาง'] },
      }),
    ).resolves.toBe(true);
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('S-1', {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
        regionalAccess: { regions: ['ภาคกลาง'] },
      }),
    ).resolves.toBe(false);
  });

  it.each([
    undefined,
    null,
    'OWN_FACTORY',
    'UNKNOWN',
    { scope: null },
    { scope: 'IN_PROVINCE' },
    { scope: 'IN_REGION' },
    { scope: 'IN_ESTATE' },
    { scope: 'IN_PROVINCE', province: 'เชียงใหม่' },
    { scope: 'IN_PROVINCE', province: '50' },
    { scope: 'IN_REGION', region: 'ภาคเหนือ' },
    { scope: 'IN_ESTATE', estateCode: 'IE-OUTSIDE' },
    { scope: 'IN_ESTATE', industrialEstateCode: 'IE-OUTSIDE' },
    { scope: 'IN_ESTATE', industrialEstateId: 'IE-OUTSIDE' },
    { scope: 'IN_ESTATE', industrialEstateId: 999 },
  ] as const)(
    'fails closed for approval scope %j, even for an actor-owned live point',
    async (scope) => {
      const access: ParameterValueAccessContext = { actorUserId: 42, scope };
      for (const stationId of ['S-1', 'LIVE']) {
        await expect(
          parameterValuesRepository.canAccessStationForConnectionReview(stationId, access),
        ).resolves.toBe(false);
        await expect(
          parameterValuesRepository.listRegisteredParametersForConnectionReview(stationId, access),
        ).resolves.toEqual([]);
      }
    },
  );

  it('keeps confirmed requests unavailable to the legacy device-setting access helper', async () => {
    const access = { actorUserId: 42, scope: 'ALL' };
    await expect(
      parameterValuesRepository.canAccessStationForConnectionTest('S2007', access),
    ).resolves.toBe(false);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionTest('S2007', access),
    ).resolves.toEqual([]);
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('S2007', access),
    ).resolves.toBe(true);
  });

  it('does not authorize another station code through an in-scope pending point name', async () => {
    fixture.execute(
      'UPDATE cems_wpms_measurement_points SET point_code = ?, point_name = ? WHERE id = 2',
      ['SAFE-PENDING', 'OUTSIDE-PENDING'],
    );
    fixture.execute('UPDATE cems_wpms_measurement_points SET point_code = ? WHERE id = 13', [
      'OUTSIDE-PENDING',
    ]);
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview(
        'OUTSIDE-PENDING',
        provinceAccess,
      ),
    ).resolves.toBe(false);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionReview(
        'OUTSIDE-PENDING',
        provinceAccess,
      ),
    ).resolves.toEqual([]);
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('SAFE-PENDING', provinceAccess),
    ).resolves.toBe(true);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionReview(
        'SAFE-PENDING',
        provinceAccess,
      ),
    ).resolves.toEqual(['NOx (ppm)']);
  });

  it('does not authorize another station code through an in-scope connected point name', async () => {
    fixture.execute(
      'UPDATE cems_wpms_connected_measurement_points SET point_name = ? WHERE id = 101',
      ['OUTSIDE-LIVE'],
    );
    fixture.execute(
      'INSERT INTO cems_wpms_connected_measurement_points (id, point_code, point_name, eligible_factory_id, factory_id, parameters_json, instruments_json, created_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [103, 'OUTSIDE-LIVE', 'Foreign point', 999, 'FOREIGN', '["SECRET (ppm)"]', null, 7, null],
    );
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('OUTSIDE-LIVE', provinceAccess),
    ).resolves.toBe(false);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionReview(
        'OUTSIDE-LIVE',
        provinceAccess,
      ),
    ).resolves.toEqual([]);
    await expect(
      parameterValuesRepository.canAccessStationForConnectionReview('LIVE', provinceAccess),
    ).resolves.toBe(true);
    await expect(
      parameterValuesRepository.listRegisteredParametersForConnectionReview('LIVE', provinceAccess),
    ).resolves.toEqual(['CO (ppm)']);
  });

  it('keeps legacy name identifiers available only for points without a point code', async () => {
    fixture.execute(
      'UPDATE cems_wpms_measurement_points SET point_code = NULL, point_name = ? WHERE id = 2',
      ['LEGACY-PENDING'],
    );
    fixture.execute(
      'UPDATE cems_wpms_connected_measurement_points SET point_code = NULL, point_name = ? WHERE id = 101',
      ['LEGACY-LIVE'],
    );
    for (const stationId of ['LEGACY-PENDING', 'LEGACY-LIVE']) {
      await expect(
        parameterValuesRepository.canAccessStationForConnectionReview(stationId, provinceAccess),
      ).resolves.toBe(true);
      await expect(
        parameterValuesRepository.listRegisteredParametersForConnectionReview(
          stationId,
          provinceAccess,
        ),
      ).resolves.toEqual([stationId === 'LEGACY-LIVE' ? 'CO (ppm)' : 'NOx (ppm)']);
    }
  });

  it('retains the normalized factory-type-88 filter on the request snapshot', () => {
    const compiled = buildConnectionReviewStationAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'FACTORY_TYPE_88' },
    }).toSQL();
    expect(compiled.sql).toContain('[fs].[factory_main_type_code]');
    expect(compiled.sql).toContain("RIGHT(REPLICATE('0', 5)");
    expect(compiled.bindings).toEqual(['WAITING_CONNECTION', 'CONNECTION_CONFIRMED', '00088']);
  });
});
