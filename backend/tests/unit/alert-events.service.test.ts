import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/alert-events/alert-events.repository', () => ({
  alertEventsRepository: {
    findByIdempotencyKey: jest.fn(),
    findConnectedMeasurementPointByStation: jest.fn(),
    createFromIntegration: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

import { alertEventsRepository } from '../../src/modules/alert-events/alert-events.repository';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import type {
  AlertEventDTO,
  CreateIntegrationAlertEventInput,
  ListAlertEventsQuery,
} from '../../src/modules/alert-events/alert-events.types';

const mockedRepository = jest.mocked(alertEventsRepository);

describe('alertEventsService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('enriches external events with trusted connected measurement point factory data', async () => {
    mockedRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue({
      id: 55,
      factoryId: 'real-factory-001',
      factoryName: 'บริษัท จริง จำกัด',
      factoryRegistrationNo: '3-106-33/50สบ',
      pointCode: 'S0001',
      pointName: 'Stack จริง',
      pointType: 'STACK',
    });
    mockedRepository.createFromIntegration.mockImplementation(async (input) =>
      alertEventFixture({
        factoryId: input.factoryId ?? null,
        factoryName: input.factoryName ?? '',
        factoryRegistrationNo: input.factoryRegistrationNo ?? null,
        pointCode: input.pointCode ?? null,
        pointName: input.pointName,
        pointType: input.pointType ?? null,
      }),
    );

    const result = await alertEventsService.createFromIntegration({
      ...integrationPayload(),
      factoryId: 'payload-factory',
      factoryName: 'ชื่อจาก payload',
      factoryRegistrationNo: 'payload-reg',
      pointName: 'ชื่อจุดจาก payload',
    });

    expect(result.created).toBe(true);
    expect(mockedRepository.findConnectedMeasurementPointByStation).toHaveBeenCalledWith({
      systemType: 'CEMS',
      stationId: 'S0001',
      pointCode: 'S0001',
    });
    expect(mockedRepository.createFromIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        connectedMeasurementPointId: 55,
        factoryId: 'real-factory-001',
        factoryName: 'บริษัท จริง จำกัด',
        factoryRegistrationNo: '3-106-33/50สบ',
        pointCode: 'S0001',
        pointName: 'Stack จริง',
        pointType: 'STACK',
      }),
    );
  });

  it('returns duplicate events without looking up connected factory data again', async () => {
    mockedRepository.findByIdempotencyKey.mockResolvedValue(alertEventFixture());

    const result = await alertEventsService.createFromIntegration(integrationPayload());

    expect(result).toMatchObject({ created: false, duplicate: true });
    expect(mockedRepository.findConnectedMeasurementPointByStation).not.toHaveBeenCalled();
    expect(mockedRepository.createFromIntegration).not.toHaveBeenCalled();
  });

  it('returns legacy-key duplicates only when the stored unit matches the normalized incoming unit', async () => {
    const input = { ...integrationPayload(), idempotencyKey: 'v2:new-key', unit: ' mg/L ' };
    const legacyKey = 'CEMS:S0001:so2:STANDARD_EXCEEDED:2026-03-02T20:00:00+07:00';
    const existing = alertEventFixture({ idempotencyKey: legacyKey, unit: 'mg/l' });
    mockedRepository.findByIdempotencyKey.mockImplementation(async (key) =>
      key === legacyKey ? existing : null,
    );

    const result = await alertEventsService.createFromIntegration(input);

    expect(result).toEqual({ created: false, duplicate: true, event: existing });
    expect(mockedRepository.findByIdempotencyKey).toHaveBeenNthCalledWith(1, 'v2:new-key');
    expect(mockedRepository.findByIdempotencyKey).toHaveBeenNthCalledWith(2, legacyKey);
    expect(mockedRepository.findConnectedMeasurementPointByStation).not.toHaveBeenCalled();
    expect(mockedRepository.createFromIntegration).not.toHaveBeenCalled();
  });

  it.each(['%', null])(
    'creates a new unit-aware event when the legacy row unit is %s',
    async (legacyUnit) => {
      const input = { ...integrationPayload(), idempotencyKey: 'v2:new-key', unit: 'ppm' };
      const legacyKey = 'CEMS:S0001:so2:STANDARD_EXCEEDED:2026-03-02T20:00:00+07:00';
      mockedRepository.findByIdempotencyKey.mockImplementation(async (key) =>
        key === legacyKey ? alertEventFixture({ unit: legacyUnit }) : null,
      );
      mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(
        connectedPointFixture(),
      );
      mockedRepository.createFromIntegration.mockResolvedValue(
        alertEventFixture({ idempotencyKey: input.idempotencyKey }),
      );

      const result = await alertEventsService.createFromIntegration(input);

      expect(result).toMatchObject({ created: true, duplicate: false });
      expect(mockedRepository.createFromIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'v2:new-key',
          unit: 'ppm',
        }),
      );
    },
  );

  it.each([2601, 2627])(
    'returns a concurrent unique-key insert collision %s as a duplicate',
    async (number) => {
      const input = { ...integrationPayload(), idempotencyKey: 'v2:new-key' };
      const existing = alertEventFixture({ idempotencyKey: input.idempotencyKey });
      mockedRepository.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(
        connectedPointFixture(),
      );
      mockedRepository.createFromIntegration.mockRejectedValue(
        Object.assign(new Error('duplicate'), { number }),
      );

      const result = await alertEventsService.createFromIntegration(input);

      expect(result).toEqual({ created: false, duplicate: true, event: existing });
      expect(mockedRepository.findByIdempotencyKey).toHaveBeenLastCalledWith('v2:new-key');
    },
  );

  it('recognizes a unique-key error wrapped by the SQL Server driver', async () => {
    const input = { ...integrationPayload(), idempotencyKey: 'v2:new-key' };
    const existing = alertEventFixture({ idempotencyKey: input.idempotencyKey });
    mockedRepository.findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(
      connectedPointFixture(),
    );
    mockedRepository.createFromIntegration.mockRejectedValue({
      originalError: { info: { number: 2627 } },
    });

    await expect(alertEventsService.createFromIntegration(input)).resolves.toEqual({
      created: false,
      duplicate: true,
      event: existing,
    });
  });

  it('creates exactly one event for two overlapping requests for the same identity', async () => {
    const input = { ...integrationPayload(), idempotencyKey: 'v2:new-key' };
    let inserted: AlertEventDTO | null = null;
    mockedRepository.findByIdempotencyKey.mockImplementation(async (key) =>
      key === input.idempotencyKey ? inserted : null,
    );
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(
      connectedPointFixture(),
    );
    mockedRepository.createFromIntegration.mockImplementation(async () => {
      if (inserted) throw Object.assign(new Error('duplicate'), { number: 2627 });
      inserted = alertEventFixture({ idempotencyKey: input.idempotencyKey });
      return inserted;
    });

    const results = await Promise.all([
      alertEventsService.createFromIntegration(input),
      alertEventsService.createFromIntegration(input),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(1);
    expect(results[0].event.id).toBe(results[1].event.id);
  });

  it('propagates a unique-key failure when the expected event is absent', async () => {
    mockedRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(
      connectedPointFixture(),
    );
    const error = Object.assign(new Error('duplicate unrelated key'), { number: 2627 });
    mockedRepository.createFromIntegration.mockRejectedValue(error);

    await expect(alertEventsService.createFromIntegration(integrationPayload())).rejects.toBe(
      error,
    );
  });

  it('does not hide ordinary database insert errors as duplicate events', async () => {
    mockedRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(
      connectedPointFixture(),
    );
    const error = Object.assign(new Error('database unavailable'), { number: 4060 });
    mockedRepository.createFromIntegration.mockRejectedValue(error);

    await expect(alertEventsService.createFromIntegration(integrationPayload())).rejects.toBe(
      error,
    );
    expect(mockedRepository.findByIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it('rejects new external events when station cannot be matched to a connected point', async () => {
    mockedRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(null);

    await expect(
      alertEventsService.createFromIntegration(integrationPayload()),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Alert event stationId must match a connected measurement point',
    });

    expect(mockedRepository.createFromIntegration).not.toHaveBeenCalled();
  });

  it('creates a batch and reports created, duplicate, and failed rows separately', async () => {
    mockedRepository.findByIdempotencyKey.mockImplementation(async (key) =>
      key.includes('S0002') ? alertEventFixture({ id: 1002, stationId: 'S0002' }) : null,
    );
    mockedRepository.findConnectedMeasurementPointByStation
      .mockResolvedValueOnce({
        id: 55,
        factoryId: 'real-factory-001',
        factoryName: 'บริษัท จริง จำกัด',
        factoryRegistrationNo: '3-106-33/50สบ',
        pointCode: 'S0001',
        pointName: 'Stack จริง',
        pointType: 'STACK',
      })
      .mockResolvedValueOnce(null);
    mockedRepository.createFromIntegration.mockResolvedValueOnce(alertEventFixture({ id: 1001 }));

    const result = await alertEventsService.createBatchFromIntegration([
      integrationPayload(),
      {
        ...integrationPayload(),
        idempotencyKey: 'CEMS:S0002:SO2:STANDARD_EXCEEDED:2026-03-02:20',
        stationId: 'S0002',
        pointCode: 'S0002',
      },
      {
        ...integrationPayload(),
        idempotencyKey: 'CEMS:S9999:SO2:STANDARD_EXCEEDED:2026-03-02:20',
        stationId: 'S9999',
        pointCode: 'S9999',
      },
    ]);

    expect(result).toMatchObject({
      total: 3,
      created: 1,
      duplicate: 1,
      failed: 1,
      results: [
        { index: 0, success: true, created: true, duplicate: false },
        { index: 1, success: true, created: false, duplicate: true },
        {
          index: 2,
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Alert event stationId must match a connected measurement point',
          },
        },
      ],
    });
  });

  it('redacts database details when an unexpected failure is reported for a batch item', async () => {
    mockedRepository.findByIdempotencyKey.mockRejectedValue(
      new Error('SQL diagnostic with private details'),
    );

    const result = await alertEventsService.createBatchFromIntegration([integrationPayload()]);

    expect(result).toMatchObject({
      total: 1,
      created: 0,
      duplicate: 0,
      failed: 1,
      results: [
        {
          index: 0,
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create alert event' },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('SQL diagnostic');
  });

  it('passes notification scope and actor context into alert event listing', async () => {
    mockedRepository.list.mockResolvedValue({
      rows: [alertEventFixture()],
      total: 1,
    });

    const result = await alertEventsService.list(
      { page: 1, pageSize: 20 } as ListAlertEventsQuery,
      42,
      { scope: 'IN_REGION', region: 'ภาคตะวันออก', province: null },
      { regions: ['ภาคตะวันออก'] },
      false,
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: 'ภาคตะวันออก', province: null },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    );
    expect(result.pagination.total).toBe(1);
  });

  it('redacts notification status fields in list results without notifications:view_status', async () => {
    mockedRepository.list.mockResolvedValue({
      rows: [alertEventFixture()],
      total: 1,
    });

    const result = await alertEventsService.list(
      { page: 1, pageSize: 20 } as ListAlertEventsQuery,
      42,
      { scope: 'ALL' },
      undefined,
      false,
    );

    expect(result.data[0]).toMatchObject({
      id: 1001,
      notificationStatus: null,
      notificationStatusLabel: null,
    });
  });

  it('keeps notification status fields visible in list results for notifications:view_status', async () => {
    mockedRepository.list.mockResolvedValue({
      rows: [alertEventFixture()],
      total: 1,
    });

    const result = await alertEventsService.list(
      { page: 1, pageSize: 20 } as ListAlertEventsQuery,
      42,
      { scope: 'ALL' },
      undefined,
      true,
    );

    expect(result.data[0]).toMatchObject({
      id: 1001,
      notificationStatus: 'AUTO',
      notificationStatusLabel: 'อัตโนมัติ',
    });
  });

  it('does not leak out-of-scope alert event lookups', async () => {
    mockedRepository.findById.mockResolvedValue(null);

    await expect(
      alertEventsService.getById(
        1001,
        42,
        { scope: 'IN_REGION', region: 'ภาคตะวันออก', province: null },
        { regions: ['ภาคตะวันออก'] },
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Alert event not found',
    });
  });

  it('redacts notification status fields in detail results without notifications:view_status', async () => {
    mockedRepository.findById.mockResolvedValue(alertEventFixture());

    const result = await alertEventsService.getById(1001, 42, { scope: 'ALL' }, undefined, false);

    expect(result).toMatchObject({
      id: 1001,
      notificationStatus: null,
      notificationStatusLabel: null,
    });
  });

  it('keeps notification status fields visible in detail results for notifications:view_status', async () => {
    mockedRepository.findById.mockResolvedValue(alertEventFixture());

    const result = await alertEventsService.getById(1001, 42, { scope: 'ALL' }, undefined, true);

    expect(result).toMatchObject({
      id: 1001,
      notificationStatus: 'AUTO',
      notificationStatusLabel: 'อัตโนมัติ',
    });
  });

  it('does not leak out-of-scope alert event status updates', async () => {
    mockedRepository.updateStatus.mockResolvedValue(null);

    await expect(
      alertEventsService.updateStatus(
        1001,
        { notificationStatus: 'ACKNOWLEDGED' },
        42,
        { scope: 'IN_REGION', region: 'ภาคตะวันออก', province: null },
        { regions: ['ภาคตะวันออก'] },
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Alert event not found',
    });
  });

  it('returns the acknowledged event after an in-scope status update', async () => {
    const acknowledged = alertEventFixture({ notificationStatus: 'ACKNOWLEDGED' });
    mockedRepository.updateStatus.mockResolvedValue(acknowledged);

    await expect(
      alertEventsService.updateStatus(1001, { notificationStatus: 'ACKNOWLEDGED' }, 42, {
        scope: 'ALL',
      }),
    ).resolves.toBe(acknowledged);
  });
});

function connectedPointFixture() {
  return {
    id: 55,
    factoryId: 'real-factory-001',
    factoryName: 'บริษัท จริง จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    pointCode: 'S0001',
    pointName: 'Stack จริง',
    pointType: 'STACK' as const,
  };
}

function integrationPayload(): CreateIntegrationAlertEventInput {
  return {
    idempotencyKey: 'CEMS:S0001:SO2:STANDARD_EXCEEDED:2026-03-02:20',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    alertType: 'STANDARD_EXCEEDED',
    factoryId: 'factory-001',
    factoryName: 'บริษัท 2584 จำกัด',
    factoryRegistrationNo: '3-xx-xx',
    stationId: 'S0001',
    pointCode: 'S0001',
    pointName: 'Stack 1',
    pointType: 'STACK',
    parameterCode: 'so2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    eventDate: '2026-03-02',
    startedAt: '2026-03-02T20:00:00+07:00',
    endedAt: '2026-03-02T20:59:59+07:00',
    measuredValue: 150,
    thresholdValue: 60,
    thresholdType: 'STANDARD',
    notificationStatus: 'AUTO',
  };
}

function alertEventFixture(overrides: Partial<AlertEventDTO> = {}): AlertEventDTO {
  return {
    id: 1001,
    idempotencyKey: 'CEMS:S0001:SO2:STANDARD_EXCEEDED:2026-03-02:20',
    alertType: 'STANDARD_EXCEEDED',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'factory-001',
    factoryName: 'บริษัท 2584 จำกัด',
    factoryRegistrationNo: '3-xx-xx',
    stationId: 'S0001',
    pointCode: 'S0001',
    pointName: 'Stack 1',
    pointType: 'STACK',
    parameterCode: 'so2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    eventDate: '2026-03-02',
    eventDateText: '2-Mar-69',
    timeRange: '20.00 - 20.59',
    startedAt: '2026-03-02T20:00:00+07:00',
    endedAt: '2026-03-02T20:59:59+07:00',
    measuredValue: 150,
    thresholdValue: 60,
    thresholdType: 'STANDARD',
    thresholdLabel: 'ค่ามาตรฐาน',
    completenessPercent: null,
    completenessPercentText: null,
    consecutiveDays: null,
    abnormalType: null,
    abnormalLabel: null,
    abnormalStreakCount: null,
    firstAbnormalAt: null,
    confirmedAbnormalAt: null,
    notificationStatus: 'AUTO',
    notificationStatusLabel: 'อัตโนมัติ',
    sourcePayload: null,
    detectedAt: '2026-03-03T08:30:05.000Z',
    ...overrides,
  };
}
