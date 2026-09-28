import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    earliestMeasurementDate: jest.fn(),
    listRegisteredParameters: jest.fn(),
    listRows: jest.fn(),
    tableExists: jest.fn(),
    tableName: jest.fn((stationId: string, interval: string) => `${stationId}_data_${interval}`),
  },
}));

import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';
import { calendarStatusQuerySchema } from '../../src/modules/parameter-values/parameter-values.validator';

const repository = jest.mocked(parameterValuesRepository);

function hourlyRows(date: string, hours: number): Record<string, unknown>[] {
  return Array.from({ length: hours }, (_, hour) => ({
    station_id: 'P0260',
    cdate: date,
    ctime: `${String(hour).padStart(2, '0')}:00:00`,
    udate: date,
    utime: `${String(hour).padStart(2, '0')}:59:00`,
    bod_value: 5,
    bod_units: 'mg/l',
    bod_status: 'Normal',
  }));
}

describe('calendar selected-date completeness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T03:30:00.000Z'));
    repository.canAccessStation.mockResolvedValue(true);
    repository.tableExists.mockResolvedValue(true);
    repository.earliestMeasurementDate.mockResolvedValue('2026-09-26');
    repository.listRegisteredParameters.mockResolvedValue(['BOD (mg/l)']);
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [
        ...hourlyRows('2026-09-27', 12),
        {
          ...hourlyRows('2026-09-27', 13)[12],
          utime: '13:00:00',
        },
        ...hourlyRows('2026-09-28', 10),
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function calendarStatus(endDate?: string) {
    const query = calendarStatusQuerySchema.parse({ month: '2026-09', endDate });
    return parameterValuesService.calendarStatus(
      { stationId: 'P0260', ...query },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    );
  }

  it('recalculates completeness and late data when the selected day changes', async () => {
    for (const [endDate, completeness, lateData] of [
      ['2026-09-28', 100, 0],
      ['2026-09-27', 50, 4.17],
      ['2026-09-28', 100, 0],
    ] as const) {
      const result = await calendarStatus(endDate);
      expect(result.data.monthlySummary[0]).toMatchObject({
        parameterLabel: 'BOD (mg/l)',
        todayDataCompletenessPercent: completeness,
        lateDataPercent: lateData,
      });
      expect(result.data.summary).toMatchObject({
        todayDataCompletenessPercent: completeness,
        lateDataPercent: lateData,
      });
      expect(result.meta.endDate).toBe(endDate);
      expect(repository.listRows).toHaveBeenLastCalledWith({
        stationId: 'P0260',
        interval: '60m',
        startDate: '2026-01-01',
        endDate,
      });
    }
  });

  it('uses today when the request supplies only the current month', async () => {
    const query = calendarStatusQuerySchema.parse({ month: '2026-09' });
    const result = await parameterValuesService.calendarStatus(
      { stationId: 'P0260', ...query },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    );

    expect(result.data.monthlySummary[0].todayDataCompletenessPercent).toBe(100);
    expect(result.meta.endDate).toBe('2026-09-28');
  });

  it('does not replace an empty selected day with today or the latest measured day', async () => {
    const result = await calendarStatus('2026-09-26');
    expect(result.data.monthlySummary[0]).toMatchObject({
      todayDataCompletenessPercent: 0,
      lateDataPercent: 0,
    });
    expect(result.meta.endDate).toBe('2026-09-26');
  });
});
