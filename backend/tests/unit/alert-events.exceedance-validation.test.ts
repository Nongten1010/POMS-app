import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/alert-events/alert-events.repository', () => ({
  alertEventsRepository: {
    findByIdempotencyKey: jest.fn(),
    findConnectedMeasurementPointByStation: jest.fn(),
    createFromIntegration: jest.fn(),
  },
}));

import { alertEventsRepository } from '../../src/modules/alert-events/alert-events.repository';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import { createIntegrationAlertEventSchema } from '../../src/modules/alert-events/alert-events.validator';
import { integrationsRoutes } from '../../src/modules/integrations/integrations.routes';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';

const repository = jest.mocked(alertEventsRepository);
const previousApiKeys = process.env.ALERT_EVENT_API_KEYS;
const thresholdTypes = ['STANDARD', 'EIA'] as const;
const payload = {
  systemType: 'CEMS',
  stationId: 'S0001',
  parameterCode: 'so2',
  unit: 'ppm',
  eventDate: '2026-10-05',
  time: '11:00',
  measuredValue: 125,
  thresholdValue: 120,
  thresholdType: 'STANDARD',
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/integrations', integrationsRoutes);
  app.use(errorHandler);
  return app;
}

function expectNoRepositoryAccess() {
  expect(repository.findByIdempotencyKey).not.toHaveBeenCalled();
  expect(repository.findConnectedMeasurementPointByStation).not.toHaveBeenCalled();
  expect(repository.createFromIntegration).not.toHaveBeenCalled();
}

describe('integration alert exceedance validation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ALERT_EVENT_API_KEYS = 'test-exceedance-api-key';
    repository.findByIdempotencyKey.mockResolvedValue(null);
    repository.findConnectedMeasurementPointByStation.mockResolvedValue({
      id: 55,
      factoryId: 'test-factory',
      factoryName: 'โรงงานทดสอบ',
      factoryRegistrationNo: 'test-registration',
      pointCode: 'S0001',
      pointName: 'จุดทดสอบ',
      pointType: 'STACK',
    });
    repository.createFromIntegration.mockImplementation(
      async (input) =>
        ({
          ...input,
          id: 42,
        }) as AlertEventDTO,
    );
  });

  afterAll(() => {
    if (previousApiKeys === undefined) delete process.env.ALERT_EVENT_API_KEYS;
    else process.env.ALERT_EVENT_API_KEYS = previousApiKeys;
  });

  describe.each(thresholdTypes)('%s threshold', (thresholdType) => {
    it.each([100, 120])(
      'rejects measuredValue %s before any repository access',
      async (measuredValue) => {
        const response = await request(createApp())
          .post('/api/v1/integrations/alert-events')
          .set('X-API-Key', 'test-exceedance-api-key')
          .send({ events: [{ ...payload, thresholdType, measuredValue }] });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            details: { events: ['measuredValue must be greater than thresholdValue'] },
            issues: [
              {
                code: 'custom',
                path: ['events', 0, 'measuredValue'],
                pathString: 'events.0.measuredValue',
                message: 'measuredValue must be greater than thresholdValue',
              },
            ],
          },
        });
        expectNoRepositoryAccess();
      },
    );

    it('passes a truly exceeded event to the repository using the real controller and service', async () => {
      const response = await request(createApp())
        .post('/api/v1/integrations/alert-events')
        .set('X-API-Key', 'test-exceedance-api-key')
        .send({ events: [{ ...payload, thresholdType }] });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ total: 1, created: 1, failed: 0 });
      expect(repository.createFromIntegration).toHaveBeenCalledTimes(1);
      expect(repository.createFromIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          measuredValue: 125,
          thresholdValue: 120,
          alertType: thresholdType === 'STANDARD' ? 'STANDARD_EXCEEDED' : 'EIA_EXCEEDED',
          connectedMeasurementPointId: 55,
          parameterLabel: 'SO2 (ppm)',
        }),
      );
    });
  });

  it('rejects the entire HTTP batch when a later item is not exceeded', async () => {
    const response = await request(createApp())
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-exceedance-api-key')
      .send({ events: [payload, { ...payload, time: '12:00', measuredValue: 120 }] });

    expect(response.status).toBe(400);
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ pathString: 'events.1.measuredValue' })]),
    );
    expectNoRepositoryAccess();
  });

  it.each([
    { measuredValue: '125', thresholdValue: '120' },
    { measuredValue: ' 1.25e2 ', thresholdValue: ' 120 ' },
    { measuredValue: 120.000001, thresholdValue: 120 },
  ])('compares valid numeric inputs without rounding: %j', (values) => {
    const result = createIntegrationAlertEventSchema.safeParse({ ...payload, ...values });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.measuredValue).toBe('number');
      expect(typeof result.data.thresholdValue).toBe('number');
    }
  });

  it.each([
    { measuredValue: '9', thresholdValue: '120' },
    { measuredValue: '120.0', thresholdValue: '1.2e2' },
  ])('rejects numeric strings that are not exceeded: %j', (values) => {
    expect(createIntegrationAlertEventSchema.safeParse({ ...payload, ...values }).success).toBe(
      false,
    );
  });

  describe.each(['measuredValue', 'thresholdValue'] as const)('%s numeric boundary', (field) => {
    it.each([null, true, false, '', '   ', [], [125], {}, 'not-a-number', 'Infinity'])(
      'rejects invalid JSON value %j rather than coercing it into an exceedance',
      async (value) => {
        const response = await request(createApp())
          .post('/api/v1/integrations/alert-events')
          .set('X-API-Key', 'test-exceedance-api-key')
          .send({ events: [{ ...payload, thresholdValue: -120, [field]: value }] });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expectNoRepositoryAccess();
      },
    );

    it.each([NaN, Infinity, -Infinity])('rejects non-finite value %s in the validator', (value) => {
      expect(
        createIntegrationAlertEventSchema.safeParse({ ...payload, [field]: value }).success,
      ).toBe(false);
    });
  });

  it.each([100, 120, NaN, Infinity])(
    'guards service calls with measuredValue %s before duplicate lookup',
    async (measuredValue) => {
      const input = createIntegrationAlertEventSchema.parse(payload);
      await expect(
        alertEventsService.createFromIntegration({ ...input, measuredValue }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expectNoRepositoryAccess();
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    'guards service calls with non-finite thresholdValue %s',
    async (thresholdValue) => {
      const input = createIntegrationAlertEventSchema.parse(payload);
      await expect(
        alertEventsService.createFromIntegration({ ...input, thresholdValue }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expectNoRepositoryAccess();
    },
  );

  it('requires a valid integration key before processing values', async () => {
    const response = await request(createApp())
      .post('/api/v1/integrations/alert-events')
      .send({ events: [payload] });
    expect(response.status).toBe(401);
    expectNoRepositoryAccess();
  });
});
