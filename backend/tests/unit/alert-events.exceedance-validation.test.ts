import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

const repository = jest.mocked(alertEventsRepository);
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

function expectNoRepositoryAccess() {
  expect(repository.findByIdempotencyKey).not.toHaveBeenCalled();
  expect(repository.findConnectedMeasurementPointByStation).not.toHaveBeenCalled();
  expect(repository.createFromIntegration).not.toHaveBeenCalled();
}

describe('internal alert payload exceedance validation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
      (value) => {
        expect(
          createIntegrationAlertEventSchema.safeParse({
            ...payload,
            thresholdValue: -120,
            [field]: value,
          }).success,
        ).toBe(false);
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
});
