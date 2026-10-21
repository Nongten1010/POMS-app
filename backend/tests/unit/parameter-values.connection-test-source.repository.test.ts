import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import type { ConnectionTestAccessContext } from '../../src/modules/parameter-values/parameter-values.types';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
const operatorAccess: ConnectionTestAccessContext = {
  actorUserId: 42,
  scope: 'ALL',
  permission: 'cems_wpms_requests:view',
};
const reviewAccess: ConnectionTestAccessContext = {
  ...operatorAccess,
  permission: 'cems_wpms_requests:approve',
};
const provinceReviewAccess: ConnectionTestAccessContext = {
  ...reviewAccess,
  scope: { scope: 'IN_PROVINCE', province: 'นครปฐม' },
};
let fixture: KnexSqliteFixture;

describe('connection-test measurement source', () => {
  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    const currentProtocols = [
      'MODBUS_RTU',
      'MODBUS_TCP',
      'DCON_ASCII',
      'POMS_BOX',
      'MSSQL',
      'MYSQL',
    ];
    const currentStations = [
      ...currentProtocols,
      'NO_CONFIG',
      'DELETED_CONFIG',
      'DELETED_POINT',
      'MIXED',
      'OUTSIDE_LIVE',
      'LIVE_ALIAS',
      'NAME_COLLISION',
    ];
    const requestStations = [
      'WAITING',
      'CONFIRMED',
      'CANCELED',
      'DELETED_REQUEST',
      'DELETED_REQUEST_POINT',
      'DELETED_REQUEST_CONFIG',
      'SHARED',
      'SHARED',
      'ALIAS_CODE',
      null,
      'DELETED_SNAPSHOT',
    ];
    fixture = await createKnexSqliteFixture(db, {
      cems_wpms_connected_measurement_points: currentStations.map((stationId, index) => ({
        id: index + 1,
        point_code: stationId,
        point_name: stationId === 'NAME_COLLISION' ? 'OUTSIDE_LIVE' : `${stationId}_NAME`,
        eligible_factory_id: stationId === 'OUTSIDE_LIVE' ? 2 : 1,
        factory_id: stationId === 'OUTSIDE_LIVE' ? 'FACTORY-B' : 'FACTORY-A',
        created_by: 42,
        deleted_at: stationId === 'DELETED_POINT' ? '2026-10-21' : null,
      })),
      cems_wpms_connection_requests: requestStations.map((stationId, index) => ({
        id: index + 1,
        factory_id: 'FACTORY-A',
        created_by: 42,
        status:
          stationId === 'CONFIRMED'
            ? 'CONNECTION_CONFIRMED'
            : stationId === 'CANCELED'
              ? 'CANCELED'
              : 'WAITING_CONNECTION',
        deleted_at: stationId === 'DELETED_REQUEST' ? '2026-10-21' : null,
      })),
      cems_wpms_measurement_points: requestStations.map((stationId, index) => ({
        id: index + 1,
        request_id: index + 1,
        point_code: stationId,
        point_name: stationId === null ? 'LEGACY_NAME' : `${stationId}_NAME`,
        deleted_at: stationId === 'DELETED_REQUEST_POINT' ? '2026-10-21' : null,
      })),
      cems_wpms_request_factory_snapshots: requestStations.map((stationId, index) => ({
        id: index + 1,
        request_id: index + 1,
        province_name: index === 7 ? 'กรุงเทพมหานคร' : 'นครปฐม',
        province_code: index === 7 ? '10' : '73',
        industrial_estate_code: index === 7 ? 'IE-OUTSIDE' : 'IE-01',
        deleted_at: stationId === 'DELETED_SNAPSHOT' ? '2026-10-21' : null,
      })),
      device_connection_configs: [
        ...currentProtocols.map((protocol, index) => ({
          id: index + 1,
          station_id: protocol,
          protocol,
          request_id: null,
          deleted_at: null,
        })),
        ...['DELETED_CONFIG', 'DELETED_POINT', 'MIXED', 'OUTSIDE_LIVE'].map((stationId, index) => ({
          id: index + 10,
          station_id: stationId,
          protocol: 'MODBUS_TCP',
          request_id: null,
          deleted_at: stationId === 'DELETED_CONFIG' ? '2026-10-21' : null,
        })),
        { id: 20, station_id: 'MIXED', protocol: 'POMS_BOX', request_id: null, deleted_at: null },
        {
          id: 21,
          station_id: 'LIVE_ALIAS',
          protocol: 'DCON_ASCII',
          request_id: null,
          deleted_at: null,
        },
        ...requestStations.map((stationId, index) => ({
          id: index + 30,
          station_id: stationId === null ? 'LEGACY_NAME' : stationId,
          protocol: index === 6 ? 'POMS_BOX' : 'MODBUS_TCP',
          request_id: index + 1,
          deleted_at: stationId === 'DELETED_REQUEST_CONFIG' ? '2026-10-21' : null,
        })),
        {
          id: 50,
          station_id: 'NO_CONFIG',
          protocol: 'DCON_ASCII',
          request_id: 999,
          deleted_at: null,
        },
        {
          id: 51,
          station_id: 'WAITING',
          protocol: 'MODBUS_RTU',
          request_id: 2,
          deleted_at: null,
        },
      ],
      eligible_factories: [
        {
          id: 1,
          source_factory_id: 'FACTORY-A',
          factory_registration_no_new: 'FACTORY-A',
          province_name: 'นครปฐม',
          deleted_at: null,
        },
        {
          id: 2,
          source_factory_id: 'FACTORY-B',
          factory_registration_no_new: 'FACTORY-B',
          province_name: 'กรุงเทพมหานคร',
          deleted_at: null,
        },
      ],
      factories: [
        {
          id: 1,
          fid: 'FACTORY-A',
          code: 'FACTORY-A',
          province_id: 73,
          industrial_estate_id: 1,
          deleted_at: null,
        },
        {
          id: 2,
          fid: 'FACTORY-B',
          code: 'FACTORY-B',
          province_id: 10,
          industrial_estate_id: null,
          deleted_at: null,
        },
      ],
      provinces: [
        { id: 73, name_th: 'นครปฐม' },
        { id: 10, name_th: 'กรุงเทพมหานคร' },
      ],
      industrial_estates: [{ id: 1, code: 'IE-01', name_th: 'Estate 1', deleted_at: null }],
    });
  });

  afterEach(() => {
    fixture?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
  });

  it.each(['MODBUS_RTU', 'MODBUS_TCP', 'DCON_ASCII'])(
    'uses realtime for current %s configuration',
    async (protocol) => {
      await expect(
        parameterValuesRepository.connectionTestInterval(protocol, operatorAccess),
      ).resolves.toBe('real');
    },
  );

  it.each(['POMS_BOX', 'MSSQL', 'MYSQL', 'NO_CONFIG', 'UNKNOWN'])(
    'uses one-minute data for %s',
    async (stationId) => {
      await expect(
        parameterValuesRepository.connectionTestInterval(stationId, operatorAccess),
      ).resolves.toBe('1m');
    },
  );

  it.each([
    { scope: 'IN_PROVINCE', province: '73' },
    { scope: 'IN_ESTATE', estateCode: 'IE-01' },
    { scope: 'IN_ESTATE', estate: 'IE-01' },
    { scope: 'IN_ESTATE', industrialEstateCode: 'IE-01' },
    { scope: 'IN_ESTATE', estateId: 'IE-01' },
    { scope: 'IN_ESTATE', industrialEstateId: 'IE-01' },
  ] as const)(
    'uses the live approval scope %j when choosing the realtime source',
    async (scope) => {
      const access = { ...reviewAccess, scope };
      for (const stationId of ['MODBUS_RTU', 'MODBUS_TCP', 'DCON_ASCII']) {
        await expect(
          parameterValuesRepository.connectionTestInterval(stationId, access),
        ).resolves.toBe('real');
      }
      await expect(
        parameterValuesRepository.connectionTestInterval('OUTSIDE_LIVE', access),
      ).resolves.toBe('1m');
    },
  );

  it.each(['MODBUS_RTU', 'MODBUS_TCP', 'DCON_ASCII'])(
    'uses realtime for accessible waiting-request %s configuration',
    async (protocol) => {
      fixture.execute('UPDATE device_connection_configs SET protocol = ? WHERE id = 30', [
        protocol,
      ]);
      await expect(
        parameterValuesRepository.connectionTestInterval('WAITING', operatorAccess),
      ).resolves.toBe('real');
    },
  );

  it('uses one-minute data when a waiting request has another protocol', async () => {
    fixture.execute('UPDATE device_connection_configs SET protocol = ? WHERE id = 30', ['MYSQL']);
    await expect(
      parameterValuesRepository.connectionTestInterval('WAITING', operatorAccess),
    ).resolves.toBe('1m');
  });

  it('allows confirmed-request configuration only for the approval permission', async () => {
    await expect(
      parameterValuesRepository.connectionTestInterval('CONFIRMED', operatorAccess),
    ).resolves.toBe('1m');
    await expect(
      parameterValuesRepository.connectionTestInterval('CONFIRMED', provinceReviewAccess),
    ).resolves.toBe('real');
  });

  it.each([
    'CANCELED',
    'DELETED_REQUEST',
    'DELETED_REQUEST_POINT',
    'DELETED_REQUEST_CONFIG',
    'DELETED_CONFIG',
    'DELETED_POINT',
  ])('ignores deleted or canceled data for %s', async (stationId) => {
    for (const access of [operatorAccess, reviewAccess]) {
      await expect(
        parameterValuesRepository.connectionTestInterval(stationId, access),
      ).resolves.toBe('1m');
    }
  });

  it('ignores out-of-scope request configuration sharing the station code', async () => {
    await expect(
      parameterValuesRepository.connectionTestInterval('SHARED', provinceReviewAccess),
    ).resolves.toBe('1m');
    await expect(
      parameterValuesRepository.connectionTestInterval('SHARED', reviewAccess),
    ).resolves.toBe('real');
  });

  it('ignores out-of-scope current points and deleted approval snapshots', async () => {
    for (const stationId of ['OUTSIDE_LIVE', 'DELETED_SNAPSHOT']) {
      await expect(
        parameterValuesRepository.connectionTestInterval(stationId, provinceReviewAccess),
      ).resolves.toBe('1m');
    }
  });

  it('does not use another station configuration when a point name matches its code', async () => {
    await expect(
      parameterValuesRepository.connectionTestInterval('NAME_COLLISION', provinceReviewAccess),
    ).resolves.toBe('1m');
  });

  it('fails closed for an unsupported approval scope', async () => {
    await expect(
      parameterValuesRepository.connectionTestInterval('MODBUS_TCP', {
        ...reviewAccess,
        scope: 'OWN_FACTORY',
      }),
    ).resolves.toBe('1m');
  });

  it('resolves stored station aliases while retaining the approval station matching rules', async () => {
    for (const stationId of ['LIVE_ALIAS', 'ALIAS_CODE', 'LEGACY_NAME']) {
      await expect(
        parameterValuesRepository.connectionTestInterval(stationId, provinceReviewAccess),
      ).resolves.toBe('real');
    }
    await expect(
      parameterValuesRepository.connectionTestInterval('ALIAS_CODE_NAME', provinceReviewAccess),
    ).resolves.toBe('1m');
  });

  it('uses realtime when an accessible station has mixed protocols', async () => {
    await expect(
      parameterValuesRepository.connectionTestInterval('MIXED', operatorAccess),
    ).resolves.toBe('real');
  });
});
