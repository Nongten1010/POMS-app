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
const access = { actorUserId: 42, scope: 'OWN_FACTORY' };
const options = {
  parameterEvaluations: [
    {
      parameter: 'BOD (mg/l)',
      standardCriteria: {
        rows: [
          { level: 'normal', min: 0, max: 9.99 },
          { level: 'warning', min: 10, max: 19.99 },
          { level: 'critical', min: 20, max: null },
        ],
      },
    },
  ],
};

function row(date: string, value = 5) {
  return {
    station_id: 'P0260',
    cdate: date,
    ctime: '00:00:00',
    udate: date,
    utime: '00:59:00',
    bod_value: value,
    bod_units: 'mg/l',
    bod_status: 'Normal',
  };
}

async function calendarStatus(month: string, endDate?: string) {
  const query = calendarStatusQuerySchema.parse({ month, endDate });
  return parameterValuesService.calendarStatus({ stationId: 'P0260', ...query }, access, options);
}

describe('calendar visible days are independent of the selected statistics date', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T03:30:00.000Z'));
    repository.canAccessStation.mockResolvedValue(true);
    repository.tableExists.mockResolvedValue(true);
    repository.earliestMeasurementDate.mockResolvedValue('2026-10-01');
    repository.listRegisteredParameters.mockResolvedValue(['BOD (mg/l)']);
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: Array.from({ length: 7 }, (_, i) => row(`2026-10-0${i + 1}`, i ? 20 : 5)),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps October 1-7 status markers when selecting October 1, 7, then 1 again', async () => {
    for (const endDate of ['2026-10-01', '2026-10-07', '2026-10-01']) {
      const result = await calendarStatus('2026-10', endDate);
      expect(result.data.calendar.days.map((day) => day.date)).toEqual(
        Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`),
      );
      expect(result.data.calendar.days[6].display).toEqual({
        backgroundStatus: 'lowData',
        borderStatus: 'exceeded',
      });
      expect(result.meta.endDate).toBe(endDate);
      expect(result.meta).toHaveProperty('calendarEndDate', '2026-10-07');
      expect(result.data.metadata).toHaveProperty('calendarEndDate', '2026-10-07');
      expect(result.data.summary.exceededDays).toBe(endDate === '2026-10-01' ? 0 : 6);
      expect(result.data.monthlySummary[0]).toMatchObject({
        exceededDays: endDate === '2026-10-01' ? 0 : 6,
        lowDataDays: endDate === '2026-10-01' ? 1 : 7,
        todayDataCompletenessPercent: endDate === '2026-10-01' ? 4.17 : 10,
      });
      expect(repository.listRows).toHaveBeenLastCalledWith({
        stationId: 'P0260',
        interval: '60m',
        startDate: '2026-01-01',
        endDate: '2026-10-07',
      });
    }
  });

  it('keeps an empty selected day empty while showing later measured days', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [row('2026-10-07', 20)],
    });
    const result = await calendarStatus('2026-10', '2026-10-01');
    expect(result.data.summary).toMatchObject({ todayDataCompletenessPercent: 0, exceededDays: 0 });
    expect(result.data.calendar.days[6].display.borderStatus).toBe('exceeded');
  });

  it('shows a historical month through its last day without changing selected-day statistics', async () => {
    repository.earliestMeasurementDate.mockResolvedValue('2026-09-01');
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [row('2026-09-01'), row('2026-09-30', 20), row('2026-10-01', 20)],
    });
    const result = await calendarStatus('2026-09', '2026-09-01');
    expect(result.data.calendar.days).toHaveLength(30);
    expect(result.data.calendar.days[29]).toMatchObject({
      date: '2026-09-30',
      pollutionStatus: 'exceeded',
    });
    expect(result.meta).toMatchObject({
      endDate: '2026-09-01',
      calendarEndDate: '2026-09-30',
      count: 2,
    });
    expect(result.data.summary.exceededDays).toBe(0);
  });

  it('uses the Bangkok date across midnight and excludes future rows and days', async () => {
    jest.setSystemTime(new Date('2026-10-06T17:30:00.000Z'));
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [row('2026-10-06'), row('2026-10-08', 20)],
    });
    const result = await calendarStatus('2026-10', '2026-10-01');
    expect(result.meta).toMatchObject({
      endDate: '2026-10-01',
      calendarEndDate: '2026-10-07',
      count: 1,
    });
    expect(result.data.calendar.days.at(-1)).toMatchObject({
      date: '2026-10-07',
      dataCompletenessPercent: null,
    });
    expect(result.data.calendar.days.map((day) => day.date)).not.toContain('2026-10-08');
  });

  it('keeps a future calendar month empty and preserves month-only requests', async () => {
    const current = await calendarStatus('2026-10');
    expect(current.meta).toMatchObject({ endDate: '2026-10-07', calendarEndDate: '2026-10-07' });
    const future = await calendarStatus('2026-11');
    expect(future.data.calendar.days).toEqual([]);
    expect(future.meta).toMatchObject({ endDate: '2026-10-07', calendarEndDate: '2026-10-07' });
  });
});
