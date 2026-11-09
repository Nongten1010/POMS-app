import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';
import type { CreateDeviceConnectionConfigInput } from '../../src/modules/device-connections/device-connections.types';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const input: CreateDeviceConnectionConfigInput = {
  stationId: 'P0302',
  deviceCode: 'P0302/01',
  protocol: 'MODBUS_TCP',
  settings: {},
  channels: [{ dataType: 'BOD (mg/l)', addressId: 2, offset: 0 }],
};

describe('canceled request device configuration lifecycle', () => {
  let fixture: KnexSqliteFixture;
  beforeEach(async () => {
    fixture = await createKnexSqliteFixture(
      db,
      {
        cems_wpms_connection_requests: [
          {
            id: 10027,
            status: 'WAITING_CONNECTION',
            connection_due_at: '2026-10-01',
            created_by: 247,
            updated_by: 247,
            deleted_at: null,
            revision_reason: null,
            officer_note: null,
            confirmed_at: null,
            updated_at: 'before',
          },
          {
            id: 10639,
            status: 'REVISED_PENDING_DESIGN_REVIEW',
            connection_due_at: null,
            created_by: 247,
            updated_by: 247,
            deleted_at: null,
            revision_reason: null,
            officer_note: null,
            confirmed_at: null,
            updated_at: 'before',
          },
        ],
        device_connection_configs: [
          { id: 3196, request_id: 10027, source_request_id: 10027 },
          { id: 3197, request_id: null, source_request_id: 10027 },
          { id: 3198, request_id: 10639, source_request_id: 10639 },
          { id: 3199, request_id: null, source_request_id: 10639 },
          { id: 3200, request_id: null, source_request_id: null },
        ].map((row) => ({
          ...row,
          station_id: 'P0302',
          deleted_at: null,
          settings_json: '{"port":502}',
          updated_at: 'before',
          updated_by: 247,
        })),
        device_measurement_channels: [3196, 3197, 3198, 3199, 3200].map((id) => ({
          id,
          config_id: id,
          data_type: 'BOD (mg/l)',
          deleted_at: null,
          updated_at: 'before',
          updated_by: 247,
        })),
      },
      {
        cems_wpms_request_status_history: ['id', 'request_id', 'status', 'changed_by', 'note'],
      },
    );
  });
  afterEach(() => fixture?.close());

  it('auto-cancels and retires only its own configs and channels, preserving history and other owners', async () => {
    expect(
      await connectionRequestsRepository.autoCancelExpiredWaitingConnectionRequests('2026-11-09'),
    ).toBe(1);
    const configs = await db('device_connection_configs').orderBy('id');
    expect(configs).toHaveLength(5);
    expect(configs.slice(0, 2).every((row) => row.deleted_at !== null)).toBe(true);
    expect(
      configs.slice(2).every((row) => row.deleted_at === null && row.updated_at === 'before'),
    ).toBe(true);
    expect(configs.every((row) => row.settings_json === '{"port":502}')).toBe(true);
    const channels = await db('device_measurement_channels').orderBy('id');
    expect(channels).toHaveLength(5);
    expect(channels.slice(0, 2).every((row) => row.deleted_at !== null)).toBe(true);
    expect(channels.slice(2).every((row) => row.deleted_at === null)).toBe(true);
    expect(await db('cems_wpms_connection_requests').where('id', 10027).first()).toMatchObject({
      status: 'CANCELED',
    });
    expect(await db('cems_wpms_connection_requests').where('id', 10639).first()).toMatchObject({
      status: 'REVISED_PENDING_DESIGN_REVIEW',
    });
    const history = await db('cems_wpms_request_status_history');
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('CANCELED');
    expect(Number(history[0].request_id)).toBe(10027);
    expect(Number(history[0].changed_by)).toBe(247);
    expect(
      await connectionRequestsRepository.autoCancelExpiredWaitingConnectionRequests('2026-11-09'),
    ).toBe(0);
    expect(await db('cems_wpms_request_status_history')).toHaveLength(1);
  });

  it('rolls back cancellation and config retirement together if channel retirement fails', async () => {
    fixture.execute(`CREATE TRIGGER reject_channel_retirement BEFORE UPDATE ON device_measurement_channels
      BEGIN SELECT RAISE(ABORT, 'channel retirement failed'); END;`);
    await expect(
      connectionRequestsRepository.autoCancelExpiredWaitingConnectionRequests('2026-11-09'),
    ).rejects.toThrow('channel retirement failed');
    expect(await db('cems_wpms_connection_requests').where('id', 10027).first()).toMatchObject({
      status: 'WAITING_CONNECTION',
    });
    expect((await db('device_connection_configs')).every((row) => row.deleted_at === null)).toBe(
      true,
    );
    expect((await db('device_measurement_channels')).every((row) => row.deleted_at === null)).toBe(
      true,
    );
    expect(await db('cems_wpms_request_status_history')).toEqual([]);
  });

  it.each(['create', 'replace', 'replace-current'])(
    'rejects a delayed %s after cancellation before changing any settings',
    async (writer) => {
      await db('cems_wpms_connection_requests').where('id', 10027).update({ status: 'CANCELED' });
      const before = await db('device_connection_configs').orderBy('id');
      const save =
        writer === 'create'
          ? deviceConnectionsRepository.createMany([input], 247, 10027)
          : writer === 'replace'
            ? deviceConnectionsRepository.replaceManyForRequest([input], 247, 10027)
            : deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
                [input],
                247,
                10027,
              );
      await expect(save).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { requestId: 10027, currentStatus: 'CANCELED' },
      });
      expect(await db('device_connection_configs').orderBy('id')).toEqual(before);
    },
  );
});
