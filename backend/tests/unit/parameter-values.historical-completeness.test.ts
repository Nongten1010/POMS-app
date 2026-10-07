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
const date = '2026-10-06';

function hourRow(hour: number, late = false): Record<string, unknown> {
  return {
    cdate: date,
    ctime: `${String(hour).padStart(2, '0')}:00:00`,
    udate: late && hour === 23 ? '2026-10-07' : date,
    utime: `${String(late ? (hour + 1) % 24 : hour).padStart(2, '0')}:00:29`,
    bod_value: '0',
    bod_units: 'mg/l',
    bod_status: '6',
  };
}

function loadRows(rows: Record<string, unknown>[]) {
  repository.listRows.mockResolvedValue({ tableName: 'P0446_data_60m', rows });
}

async function results() {
  const statistics = await parameterValuesService.measurementStatistics(
    { stationId: 'P0446', date },
    access,
  );
  const calendar = await parameterValuesService.calendarStatus(
    { stationId: 'P0446', month: '2026-10', endDate: date },
    access,
  );
  const details = await parameterValuesService.calendarStatusDetails(
    {
      stationId: 'P0446',
      year: '2026',
      endDate: date,
      summaryType: 'lowData',
      parameterCode: 'BOD',
    },
    access,
  );
  return { statistics, calendar, details };
}

describe('historical received-data completeness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T03:30:00Z'));
    repository.canAccessStation.mockResolvedValue(true);
    repository.tableExists.mockResolvedValue(true);
    repository.earliestMeasurementDate.mockResolvedValue(date);
    repository.listRegisteredParameters.mockResolvedValue(['BOD (mg/l)']);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts the P0446 shutdown day as 23/24 including the delayed 17:00 hour', async () => {
    const parameters = ['BOD (mg/l)', 'Flow rate (m3/hr)', 'Watt (kW/hr)'];
    repository.listRegisteredParameters.mockResolvedValue(parameters);
    loadRows(
      Array.from({ length: 24 }, (_, hour) => hour)
        .filter((hour) => hour !== 5)
        .map((hour) => ({
          ...hourRow(hour, hour === 17),
          flow_value: '0',
          flow_units: 'm3/hr',
          flow_status: '6',
          watt_value: '0',
          watt_units: 'kW/hr',
          watt_status: '6',
        })),
    );

    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 95.83,
      lateDataPercent: 4.17,
      lowDataDays: 0,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(calendar.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: 95.83,
      dataCompletenessStatus: 'highData',
    });
    for (const parameter of calendar.data.monthlySummary) {
      expect(parameter).toMatchObject({
        todayDataCompletenessPercent: 95.83,
        lateDataPercent: 4.17,
      });
    }
    expect(statistics.data.measurementPoints[0].rows[17].dataCompletenessPercent).toBe(100);
    expect(statistics.data.measurementPoints[0].rows[5].dataCompletenessPercent).toBe(0);
    expect(details.data.rows).toEqual([]);
  });

  it('counts all 24 delayed normal hours while retaining lateData pollution status', async () => {
    loadRows(
      Array.from({ length: 24 }, (_, hour) => ({ ...hourRow(hour, true), bod_status: 'Normal' })),
    );
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 100,
      lateDataPercent: 100,
      lowDataDays: 0,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(calendar.data.calendar.days[0].pollutionStatus).toBe('lateData');
    expect(statistics.data.measurementPoints[0].rows[23].values['BOD (mg/l)'].status).toBe(
      'lateData',
    );
    expect(details.data.rows).toEqual([]);
  });

  it('uses received hours for the historical low-data streak and detail percentage', async () => {
    loadRows(Array.from({ length: 17 }, (_, hour) => hourRow(hour, true)));
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 70.83,
      lowDataDays: 1,
    });
    expect(calendar.data.monthlySummary[0].lowDataDays).toBe(1);
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 70.83 }]);
  });

  it('deduplicates parameter-hours and excludes unknown receipts and status-only values', async () => {
    loadRows([
      hourRow(0, true),
      hourRow(0),
      hourRow(0, true),
      hourRow(1, true),
      { ...hourRow(2), utime: null },
      { ...hourRow(3), bod_value: null },
    ]);
    const { statistics, calendar } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 8.33,
      lateDataPercent: 4.17,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
  });

  it('keeps today on completed on-time hours and switches to 24-hour received totals after midnight', async () => {
    loadRows([
      ...Array.from({ length: 8 }, (_, hour) => hourRow(hour)),
      hourRow(8, true),
      hourRow(10),
    ]);
    jest.setSystemTime(new Date('2026-10-06T03:30:00Z'));
    const today = await results();
    expect(today.statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 80,
      lateDataPercent: 10,
    });
    expect(today.statistics.data.measurementPoints[0].rows[8].dataCompletenessPercent).toBe(0);
    jest.setSystemTime(new Date('2026-10-06T17:01:00Z'));
    const yesterday = await results();
    expect(yesterday.statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 41.67,
      lateDataPercent: 4.17,
    });
    expect(yesterday.calendar.data.summary).toEqual(yesterday.statistics.data.summary);
    expect(yesterday.statistics.data.measurementPoints[0].rows[8].dataCompletenessPercent).toBe(
      100,
    );
  });
});
