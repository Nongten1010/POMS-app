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
} from '../../src/modules/alert-events/alert-events.types';

const mockedRepository = jest.mocked(alertEventsRepository);

describe('alertEventsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('rejects new external events when station cannot be matched to a connected point', async () => {
    mockedRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockedRepository.findConnectedMeasurementPointByStation.mockResolvedValue(null);

    await expect(alertEventsService.createFromIntegration(integrationPayload())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Alert event stationId must match a connected measurement point',
    });

    expect(mockedRepository.createFromIntegration).not.toHaveBeenCalled();
  });
});

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
