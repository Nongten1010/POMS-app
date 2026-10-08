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

const repository = jest.mocked(parameterValuesRepository);
const access = { actorUserId: 42, scope: 'OWN_FACTORY' };

function hourlyRows(date: string, hours: number) {
  return Array.from({ length: hours }, (_, hour) => ({
    station_id: 'P0260',
    cdate: date,
    ctime: `${String(hour).padStart(2, '0')}:00:00`,
    udate: date,
    utime: `${String(hour).padStart(2, '0')}:59:00`,
    flow_value: 1,
    flow_units: 'm3/hr',
    flow_status: 'Normal',
  }));
}

function details(endDate?: string, year = '2026') {
  return parameterValuesService.calendarStatusDetails(
    {
      stationId: 'P0260',
      year,
      endDate,
      summaryType: 'lowData',
      parameterCode: 'FLOWRATE',
      unit: 'm3/hr',
    },
    access,
  );
}

describe('low-data summaries count only completed Bangkok days', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T03:30:00.000Z'));
    repository.canAccessStation.mockResolvedValue(true);
    repository.tableExists.mockResolvedValue(true);
    repository.earliestMeasurementDate.mockResolvedValue('2026-10-07');
    repository.listRegisteredParameters.mockResolvedValue(['Flow Rate (m3/hr)']);
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [...hourlyRows('2026-10-07', 1), ...hourlyRows('2026-10-08', 1)],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([undefined, '2026-10-08'])(
    'excludes today from details with endDate=%s',
    async (endDate) => {
      const result = await details(endDate);
      expect(result.data.rows).toEqual([{ date: '2026-10-07', dataCompletenessPercent: 4.17 }]);
      expect(result.data.summary.affectedDays).toBe(1);
      expect(result.meta.endDate).toBe('2026-10-08');
    },
  );

  it.each([1, 8, 10])(
    'ignores an unfinished day with %i on-time hours when counting the streak',
    async (hours) => {
      repository.listRows.mockResolvedValue({
        tableName: 'P0260_data_60m',
        rows: [...hourlyRows('2026-10-07', 1), ...hourlyRows('2026-10-08', hours)],
      });
      const calendar = await parameterValuesService.calendarStatus(
        { stationId: 'P0260', month: '2026-10' },
        access,
      );
      const detail = await details();
      const statistics = await parameterValuesService.measurementStatistics(
        { stationId: 'P0260', date: '2026-10-08' },
        access,
      );
      expect(calendar.data.summary.lowDataDays).toBe(1);
      expect(calendar.data.monthlySummary[0]).toMatchObject({
        lowDataDays: 1,
        todayDataCompletenessPercent: hours * 10,
      });
      expect(statistics.data.summary).toMatchObject({
        lowDataDays: 1,
        todayDataCompletenessPercent: hours * 10,
      });
      expect(detail.data.summary.affectedDays).toBe(calendar.data.monthlySummary[0].lowDataDays);
      expect(detail.data.rows.map((row) => row.date)).toEqual(['2026-10-07']);
      expect(calendar.data.calendar.days.at(-1)).toMatchObject({
        date: '2026-10-08',
        dataCompletenessPercent: hours * 10,
      });
    },
  );

  it('does not finalize an empty first day of operation', async () => {
    repository.earliestMeasurementDate.mockResolvedValue('2026-10-08');
    repository.listRows.mockResolvedValue({ tableName: 'P0260_data_60m', rows: [] });
    expect((await details()).data).toMatchObject({ rows: [], summary: { affectedDays: 0 } });
  });

  it('retains the latest measured day when explicitly selecting a completed historical day', async () => {
    const result = await details('2026-10-07');
    expect(result.data.rows).toEqual([{ date: '2026-10-07', dataCompletenessPercent: 4.17 }]);
  });

  it.each(['2026-10-07T17:00:00.000Z', '2026-10-07T18:30:00.000Z'])(
    'uses completed days at Bangkok midnight and before UTC midnight (%s)',
    async (now) => {
      jest.setSystemTime(new Date(now));
      const result = await details();
      expect(result.meta.endDate).toBe('2026-10-08');
      expect(result.data.rows.map((row) => row.date)).toEqual(['2026-10-07']);
    },
  );

  it('includes October 8 as a full day after Bangkok midnight on October 9', async () => {
    jest.setSystemTime(new Date('2026-10-08T17:00:00.000Z'));
    const result = await details();
    expect(result.data.rows).toEqual([
      { date: '2026-10-07', dataCompletenessPercent: 4.17 },
      { date: '2026-10-08', dataCompletenessPercent: 4.17 },
    ]);
  });

  it('retains a completed streak across the year boundary on January 1', async () => {
    jest.setSystemTime(new Date('2025-12-31T17:00:00.000Z'));
    repository.earliestMeasurementDate.mockResolvedValue('2025-12-30');
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [...hourlyRows('2025-12-30', 1), ...hourlyRows('2025-12-31', 1)],
    });
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'P0260', month: '2026-01' },
      access,
    );
    const detail = await details();
    expect(detail.data.rows.map((row) => row.date)).toEqual(['2025-12-30', '2025-12-31']);
    expect(calendar.data.monthlySummary[0].lowDataDays).toBe(detail.data.summary.affectedDays);
  });

  it('stops at a completed day with at least 80% even when today is low-data', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [...hourlyRows('2026-10-07', 20), ...hourlyRows('2026-10-08', 1)],
    });
    expect((await details()).data).toMatchObject({ rows: [], summary: { affectedDays: 0 } });
  });

  it('keeps current-day exceeded results while excluding today from low-data days', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'P0260_data_60m',
      rows: [
        ...hourlyRows('2026-10-07', 1),
        ...hourlyRows('2026-10-08', 1).map((row) => ({ ...row, flow_value: 200 })),
      ],
    });
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'P0260', month: '2026-10' },
      access,
    );
    const exceeded = await parameterValuesService.calendarStatusDetails(
      {
        stationId: 'P0260',
        year: '2026',
        summaryType: 'exceeded',
        parameterCode: 'FLOWRATE',
        unit: 'm3/hr',
      },
      access,
    );
    expect(calendar.data.monthlySummary[0]).toMatchObject({ lowDataDays: 1, exceededDays: 1 });
    expect(exceeded.data.rows).toMatchObject([{ date: '2026-10-08', value: 200 }]);
  });

  it('checks station access before loading measurements', async () => {
    repository.canAccessStation.mockResolvedValue(false);
    await expect(details()).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.listRows).not.toHaveBeenCalled();
  });
});
