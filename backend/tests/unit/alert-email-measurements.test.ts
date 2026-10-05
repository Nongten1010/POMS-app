import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('../../src/modules/integrations/integration-device-configs.service', () => ({
  integrationDeviceConfigsService: { getByStationId: jest.fn() },
}));
jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    tableName: jest.fn(() => 'S1_60m'),
    tableExists: jest.fn(),
    listRows: jest.fn(),
  },
}));
jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: { listActiveSettingsForIntegration: jest.fn() },
}));
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import { integrationDeviceConfigsService } from '../../src/modules/integrations/integration-device-configs.service';
import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import { readRegisteredAlertMeasurement } from '../../src/modules/parameter-values/parameter-values.service';
import { loadAlertEmailParameters } from '../../src/modules/alert-emails/alert-email-measurements';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';

const point = { stationId: 'S1', connectedAt: '2025-12-30T00:00:00+07:00' } as AlertEmailPoint;
const policy = { completenessPolicy: 'ON_TIME' } as ActiveAlertEmailPolicy;
const config = jest.mocked(integrationDeviceConfigsService.getByStationId);
const rows = jest.mocked(parameterValuesRepository.listRows);
const table = jest.mocked(parameterValuesRepository.tableExists);
const revisions = jest.mocked(deviceConnectionsService.listActiveSettingsForIntegration);
describe('daily alert measurement adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    table.mockResolvedValue(true);
    revisions.mockResolvedValue([
      {
        deviceCode: 'D1',
        updatedAt: '2025-12-29T00:00:00Z',
        channels: [{ dataType: 'CO (ppm)', testMode: false }],
      },
    ] as never);
    config.mockResolvedValue({
      parameterConfigs: [
        {
          deviceCode: 'D1',
          parameterName: 'CO',
          parameterUnit: 'ppm',
          parameter: 'CO (ppm)',
          testMode: false,
        },
      ],
      deviceConfigs: [{ dbPass: 'never-return-this' }],
    } as never);
    rows.mockResolvedValue({ rows: [], tableName: 'S1_60m' });
  });
  it('preserves raw negative/zero/null values and respects unit distinctions', () => {
    expect(
      readRegisteredAlertMeasurement({ so2_value: 5, so2_units: 'ppm', so2_status: 1 }, 'SO₂ (ppm)')
        .value,
    ).toBe(5);
    expect(
      readRegisteredAlertMeasurement({ co_value: -1, co_units: 'ppm', co_status: 1 }, 'CO (ppm)'),
    ).toEqual({ value: -1, status: 1 });
    expect(
      readRegisteredAlertMeasurement({ co_value: 0, co_units: 'ppm', co_status: 1 }, 'CO (ppm)')
        .value,
    ).toBe(0);
    expect(
      readRegisteredAlertMeasurement({ co_value: null, co_units: 'ppm', co_status: 1 }, 'CO (ppm)')
        .value,
    ).toBeNull();
    expect(
      readRegisteredAlertMeasurement({ co_value: 10, co_units: 'ppm', co_status: 1 }, 'CO (%)')
        .value,
    ).toBeNull();
    expect(() =>
      readRegisteredAlertMeasurement({ co_value: 10, co_status: 1 }, 'CO (ppm)'),
    ).toThrow('unit');
  });
  it('loads explicit Bangkok hour buckets and all full days across a year boundary', async () => {
    rows.mockResolvedValue({
      tableName: 'S1_60m',
      rows: [
        {
          cdate: '2026-01-01',
          ctime: '10:32:00',
          udate: '2026-01-01',
          utime: '10:40:00',
          co_value: -1,
          co_units: 'ppm',
          co_status: 'Normal',
        },
      ],
    });
    const result = await loadAlertEmailParameters(point, '2026-01-01', policy);
    expect(result[0].samples).toEqual([
      {
        measuredAt: '2026-01-01T10:00:00+07:00',
        sourceMeasuredAt: '2026-01-01T10:32:00+07:00',
        reportedAt: '2026-01-01T10:40:00+07:00',
        value: -1,
        status: 1,
      },
    ]);
    expect(result[0].dailySummaries.map((day) => day.date)).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
    ]);
    expect(result[0].dailySummaries[2].receivedCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain('never-return-this');
  });
  it('does not turn unavailable tables or SQL failures into no-report alerts', async () => {
    table.mockResolvedValue(false);
    await expect(loadAlertEmailParameters(point, '2026-01-01', policy)).rejects.toThrow();
    expect(rows).not.toHaveBeenCalled();
    table.mockResolvedValue(true);
    rows.mockRejectedValue(new Error('source unavailable'));
    await expect(loadAlertEmailParameters(point, '2026-01-01', policy)).rejects.toThrow(
      'source unavailable',
    );
  });
  it('omits test channels, missing units, and unknown activation history', async () => {
    config.mockResolvedValue({
      parameterConfigs: [
        { parameterName: 'CO', parameterUnit: 'ppm', parameter: 'CO (ppm)', testMode: true },
        { parameterName: 'BOD', parameterUnit: null, parameter: 'BOD' },
      ],
    } as never);
    expect(await loadAlertEmailParameters(point, '2026-01-01', policy)).toEqual([]);
    expect(
      await loadAlertEmailParameters({ ...point, connectedAt: null }, '2026-01-01', policy),
    ).toEqual([]);
  });
  it('keeps the earliest valid receipt for a duplicate hour so late backfills cannot erase an on-time report', async () => {
    rows.mockResolvedValue({
      tableName: 'S1_60m',
      rows: [
        {
          cdate: '2026-01-01',
          ctime: '10:00',
          udate: '2026-01-02',
          utime: '08:00',
          co_value: 5,
          co_units: 'ppm',
          co_status: 1,
        },
        {
          cdate: '2026-01-01',
          ctime: '10:00',
          udate: '2026-01-01',
          utime: '10:20',
          co_value: 2,
          co_units: 'ppm',
          co_status: 1,
        },
      ],
    });
    const result = await loadAlertEmailParameters(point, '2026-01-01', policy);
    expect(result[0].samples).toHaveLength(1);
    expect(result[0].samples[0].value).toBe(2);
    expect(result[0].dailySummaries[2].receivedCount).toBe(1);
  });
  it('bounds historical completeness by the current configuration revision rather than point connection alone', async () => {
    revisions.mockResolvedValue([
      {
        deviceCode: 'D1',
        updatedAt: '2026-01-01T00:00:00+07:00',
        channels: [{ dataType: 'CO (ppm)', testMode: false }],
      },
    ] as never);
    const result = await loadAlertEmailParameters(point, '2026-01-01', policy);
    expect(result[0].activatedAt).toBe('2026-01-01T00:00:00+07:00');
    expect(result[0].dailySummaries.map((day) => day.date)).toEqual(['2026-01-01']);
  });
  it('does not let an earlier empty duplicate erase a later valid on-time value', async () => {
    rows.mockResolvedValue({
      tableName: 'S1_60m',
      rows: [
        {
          cdate: '2026-01-01',
          ctime: '10:00',
          udate: '2026-01-01',
          utime: '10:01',
          co_value: null,
          co_units: 'ppm',
          co_status: 1,
        },
        {
          cdate: '2026-01-01',
          ctime: '10:00',
          udate: '2026-01-01',
          utime: '10:10',
          co_value: 5,
          co_units: 'ppm',
          co_status: 1,
        },
      ],
    });
    const result = await loadAlertEmailParameters(point, '2026-01-01', policy);
    expect(result[0].dailySummaries[2].receivedCount).toBe(1);
  });
});
