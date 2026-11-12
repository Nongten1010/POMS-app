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
const date = '2026-11-12';

function hourRow(hour: number, status: unknown = 'Normal', value: number | null = 30) {
  return {
    cdate: date,
    ctime: `${String(hour).padStart(2, '0')}:00:00`,
    udate: date,
    utime: `${String(hour).padStart(2, '0')}:59:00`,
    co_value: value,
    co_status: status,
  };
}

function loadRows(rows: Record<string, unknown>[]) {
  repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows });
}

async function results() {
  const statistics = await parameterValuesService.measurementStatistics(
    { stationId: 'S1125', date },
    access,
  );
  const calendar = await parameterValuesService.calendarStatus(
    { stationId: 'S1125', month: '2026-11', endDate: date },
    access,
  );
  expect(statistics.data.summary).toEqual(calendar.data.summary);
  return { statistics, calendar };
}

describe('reporting completeness excluding shutdown hours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T06:30:00Z'));
    repository.canAccessStation.mockResolvedValue(true);
    repository.tableExists.mockResolvedValue(true);
    repository.earliestMeasurementDate.mockResolvedValue(date);
    repository.listRegisteredParameters.mockResolvedValue(['CO (ppm)']);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('excludes one shutdown hour from a two-hour reporting denominator', async () => {
    jest.setSystemTime(new Date('2026-11-11T19:30:00Z'));
    loadRows([hourRow(0, 'Shut Down', null), hourRow(1)]);
    const { statistics, calendar } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(100);
    expect(calendar.data.monthlySummary[0].todayDataCompletenessPercent).toBe(100);
  });

  it.each(
    [6, '6', 'Shut Down', 'SHUTDOWN'].flatMap((status) => [
      { status, value: null },
      { status, value: 0 },
    ]),
  )('reports the screenshot as 100 percent for shutdown %j', async ({ status, value }) => {
    loadRows(
      Array.from({ length: 13 }, (_, hour) =>
        hour < 8 ? hourRow(hour, status, value) : hourRow(hour),
      ),
    );
    const { statistics, calendar } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 100,
      lateDataPercent: 0,
    });
    expect(calendar.data.monthlySummary[0].todayDataCompletenessPercent).toBe(100);
    expect(calendar.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: 100,
      dataCompletenessStatus: 'highData',
    });
    expect(statistics.data.measurementPoints[0].rows[0].values['CO (ppm)']).toEqual({
      value: null,
      displayValue: 'Shut Down',
      status: 'invalid',
    });
    expect(statistics.data.measurementPoints[0].rows[13].values['CO (ppm)'].status).toBe('noData');
  });

  it('excludes late shutdowns while using the reduced denominator for normal late receipts', async () => {
    loadRows(
      Array.from({ length: 13 }, (_, hour) => {
        const row = hour < 8 ? hourRow(hour, 6, 0) : hourRow(hour);
        return hour === 0 || hour === 12
          ? { ...row, utime: `${String(hour + 2).padStart(2, '0')}:00:00` }
          : row;
      }),
    );
    const { statistics, calendar } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 80,
      lateDataPercent: 20,
    });
    expect(calendar.data.monthlySummary[0]).toMatchObject({
      todayDataCompletenessPercent: 80,
      lateDataPercent: 20,
    });
    expect(statistics.data.measurementPoints[0].rows[0].values['CO (ppm)']).toEqual({
      value: null,
      displayValue: 'Shut Down',
      status: 'lateData',
    });
  });

  it('keeps missing hours in the denominator after excluding shutdown', async () => {
    loadRows(
      Array.from({ length: 12 }, (_, hour) => (hour < 8 ? hourRow(hour, 6, null) : hourRow(hour))),
    );
    const { statistics } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 80,
      lateDataPercent: 0,
    });
  });

  it.each([false, true])(
    'returns null when every expected hour is shutdown (historical: %s)',
    async (historical) => {
      if (historical) jest.setSystemTime(new Date('2026-11-13T06:30:00Z'));
      loadRows(Array.from({ length: historical ? 24 : 13 }, (_, hour) => hourRow(hour, 6, null)));
      const { statistics, calendar } = await results();
      expect(statistics.data.summary).toMatchObject({
        todayDataCompletenessPercent: null,
        lateDataPercent: null,
        lowDataDays: 0,
      });
      expect(calendar.data.calendar.days[0]).toMatchObject({
        dataCompletenessPercent: null,
        lateDataPercent: null,
        dataCompletenessStatus: null,
      });
      expect(calendar.data.monthlySummary[0]).toMatchObject({
        todayDataCompletenessPercent: null,
        lateDataPercent: null,
        lowDataDays: 0,
      });
    },
  );

  it('subtracts shutdown per parameter in both hourly and daily percentages', async () => {
    jest.setSystemTime(new Date('2026-11-11T19:30:00Z'));
    repository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    loadRows([{ ...hourRow(0, 6, null), nox_value: 30, nox_status: 'Normal' }, hourRow(1)]);
    const { statistics, calendar } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(66.67);
    expect(calendar.data.monthlySummary.map((item) => item.todayDataCompletenessPercent)).toEqual([
      100, 50,
    ]);
    expect(
      statistics.data.measurementPoints[0].rows
        .slice(0, 2)
        .map((row) => row.dataCompletenessPercent),
    ).toEqual([100, 50]);
  });

  it('uses the reduced historical denominator for low-data days and their details', async () => {
    jest.setSystemTime(new Date('2026-11-13T06:30:00Z'));
    loadRows(
      Array.from({ length: 20 }, (_, hour) => (hour < 8 ? hourRow(hour, 6, null) : hourRow(hour))),
    );
    const { statistics, calendar } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 75,
      lowDataDays: 1,
    });
    expect(calendar.data.monthlySummary[0].lowDataDays).toBe(1);
    const details = await parameterValuesService.calendarStatusDetails(
      {
        stationId: 'S1125',
        year: '2026',
        endDate: date,
        summaryType: 'lowData',
        parameterCode: 'CO',
      },
      access,
    );
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 75 }]);
  });

  it.each([6, 'Normal'])(
    'uses the latest parameter status %s when an hour has duplicates',
    async (latestStatus) => {
      jest.setSystemTime(new Date('2026-11-11T19:30:00Z'));
      loadRows([
        hourRow(0, latestStatus === 6 ? 'Normal' : 6, 0),
        { ...hourRow(0, latestStatus, latestStatus === 6 ? null : 30), utime: '01:00:00' },
      ]);
      const { statistics } = await results();
      expect(statistics.data.summary.todayDataCompletenessPercent).toBe(
        latestStatus === 6 ? 0 : 50,
      );
      expect(statistics.data.measurementPoints[0].rows[0].dataCompletenessPercent).toBe(
        latestStatus === 6 ? 0 : 100,
      );
    },
  );

  it('does not exempt a shutdown status belonging to a conflicting unit', async () => {
    jest.setSystemTime(new Date('2026-11-11T19:30:00Z'));
    loadRows([{ ...hourRow(0, 6, null), co_units: '%' }, hourRow(1)]);
    const { statistics } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(50);
  });

  it('exempts a status-only shutdown even when its receipt time is missing', async () => {
    jest.setSystemTime(new Date('2026-11-11T19:30:00Z'));
    loadRows([{ ...hourRow(0, 6, null), udate: null, utime: null }, hourRow(1)]);
    const { statistics } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(100);
  });

  it('stops a low-data streak at a completed day with only shutdown hours', async () => {
    jest.setSystemTime(new Date('2026-11-13T06:30:00Z'));
    repository.earliestMeasurementDate.mockResolvedValue('2026-11-11');
    loadRows([
      { ...hourRow(0), cdate: '2026-11-11', udate: '2026-11-11' },
      ...Array.from({ length: 24 }, (_, hour) => hourRow(hour, 6, null)),
    ]);
    const { statistics, calendar } = await results();
    expect(statistics.data.summary.lowDataDays).toBe(0);
    expect(calendar.data.monthlySummary[0].lowDataDays).toBe(0);
    const details = await parameterValuesService.calendarStatusDetails(
      {
        stationId: 'S1125',
        year: '2026',
        endDate: date,
        summaryType: 'lowData',
        parameterCode: 'CO',
      },
      access,
    );
    expect(details.data.rows).toEqual([]);
  });
});
