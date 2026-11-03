import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { integrationsRoutes } from '../../src/modules/integrations/integrations.routes';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

let fixture: KnexSqliteFixture;
const payload = {
  systemType: 'CEMS',
  stationId: 'S0001',
  parameterCode: 'so2',
  unit: 'ppm',
  eventDate: '2026-11-03',
  time: '11:00',
  measuredValue: 125,
  thresholdValue: 120,
  thresholdType: 'STANDARD',
};
function app() {
  const result = express();
  result.use(express.json());
  result.use('/api/v1/integrations', integrationsRoutes);
  result.use(errorHandler);
  return result;
}
beforeEach(async () => {
  process.env.ALERT_EVENT_API_KEYS = 'test-receipt-key';
  process.env.INTEGRATION_API_KEYS = 'test-fallback-key';
  process.env.DEVICE_CONFIG_API_KEYS = 'test-device-key';
  fixture = await createKnexSqliteFixture(
    db,
    {},
    {
      integration_alert_receipts: ['receipt_id', 'received_at', 'event_count', 'payload_json'],
      alert_events: ['id'],
      alert_email_batches: ['id'],
      alert_email_deliveries: ['id'],
    },
  );
  jest.spyOn(alertEventsService, 'createBatchFromIntegration');
});
afterEach(() => {
  fixture.close();
  jest.restoreAllMocks();
});

describe('external alerts are stored only through the real HTTP/database path', () => {
  it('accepts the legacy fallback key and a complete 500-object batch', async () => {
    process.env.ALERT_EVENT_API_KEYS = '';
    const response = await request(app())
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-fallback-key')
      .send({ events: Array(500).fill(payload) });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ total: 500, stored: 500, created: 0 });
    expect(response.body.data.results).toHaveLength(500);
    expect(await db('integration_alert_receipts').select('*')).toHaveLength(1);
  });

  it('stores SQL-looking values as data with no effect on the alert table', async () => {
    const parameterCode = "x'); DROP TABLE alert_events;--";
    const response = await request(app())
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-receipt-key')
      .send({ events: [{ ...payload, parameterCode }] });
    expect(response.status).toBe(200);
    expect(
      JSON.parse((await db('integration_alert_receipts').first()).payload_json).events[0]
        .parameterCode,
    ).toBe(parameterCode);
    expect(await db('alert_events').select('*')).toEqual([]);
  });

  it.each([125, 120, 100])(
    'archives measuredValue %s without creating alerts or email',
    async (measuredValue) => {
      const body = { events: [{ ...payload, measuredValue }] };
      const response = await request(app())
        .post('/api/v1/integrations/alert-events')
        .set('X-API-Key', 'test-receipt-key')
        .send(body);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          mode: 'STORE_ONLY',
          total: 1,
          stored: 1,
          created: 0,
          duplicate: 0,
          failed: 0,
          results: [{ index: 0, success: true, created: false, duplicate: false, event: null }],
        },
      });
      const saved = await db('integration_alert_receipts').select('*');
      expect(saved).toHaveLength(1);
      expect(JSON.parse(saved[0].payload_json)).toEqual(body);
      expect(response.body.data.receiptId).toBe(saved[0].receipt_id);
      expect(saved[0].payload_json).not.toContain('test-receipt-key');
      expect(Number(saved[0].event_count)).toBe(1);
      expect(alertEventsService.createBatchFromIntegration).not.toHaveBeenCalled();
      for (const table of ['alert_events', 'alert_email_batches', 'alert_email_deliveries'])
        expect(await db(table).select('*')).toEqual([]);
    },
  );

  it('preserves numeric strings, unregistered stations and unvalidated metadata as received', async () => {
    const body = {
      producerVersion: 'legacy',
      events: [
        {
          ...payload,
          measuredValue: ' 00125 ',
          stationId: 'UNKNOWN',
          time: '11:07',
          eventDate: 'invalid',
          notificationStatus: 'AUTO',
        },
        {
          ...payload,
          systemType: 'WPMS',
          thresholdType: 'EIA',
          measuredValue: null,
          thresholdValue: 'unknown',
        },
      ],
    };
    const response = await request(app())
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-receipt-key')
      .send(body);
    expect(response.status).toBe(200);
    expect(response.body.data.stored).toBe(2);
    expect(JSON.parse((await db('integration_alert_receipts').first()).payload_json)).toEqual(body);
  });

  it('stores repeat requests separately and never consumes alert identities', async () => {
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const response = await request(app())
        .post('/api/v1/integrations/alert-events')
        .set('X-API-Key', 'test-receipt-key')
        .send({ events: [payload] });
      expect(response.status).toBe(200);
      ids.push(response.body.data.receiptId);
    }
    expect(new Set(ids).size).toBe(2);
    expect(await db('integration_alert_receipts').select('*')).toHaveLength(2);
    expect(await db('alert_events').select('*')).toEqual([]);
  });

  it.each([
    {},
    { events: [] },
    { events: [null] },
    { events: [1] },
    { events: Array(501).fill(payload) },
  ])('rejects a structurally invalid envelope before storage', async (body) => {
    const response = await request(app())
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-receipt-key')
      .send(body);
    expect(response.status).toBe(400);
    expect(await db('integration_alert_receipts').select('*')).toEqual([]);
  });
  it.each([undefined, 'wrong-key', 'test-device-key'])(
    'keeps API key authentication: %s',
    async (key) => {
      const call = request(app()).post('/api/v1/integrations/alert-events');
      if (key) call.set('X-API-Key', key);
      expect((await call.send({ events: [payload] })).status).toBe(401);
      expect(await db('integration_alert_receipts').select('*')).toEqual([]);
    },
  );
  it('returns an error without payload/SQL details if the receipt cannot be saved', async () => {
    fixture.execute('DROP TABLE integration_alert_receipts');
    const response = await request(app())
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-receipt-key')
      .send({ events: [payload] });
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('S0001');
    expect(response.body.success).toBe(false);
  });
});
