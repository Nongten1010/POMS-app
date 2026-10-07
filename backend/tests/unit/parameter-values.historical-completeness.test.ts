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

describe('on-time data completeness', () => {
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

  it('counts only Normal and Shut Down data, excluding numeric placeholders for other statuses', async () => {
    jest.setSystemTime(new Date('2026-10-06T16:15:00Z'));
    repository.listRegisteredParameters.mockResolvedValue([
      'BOD (mg/l)',
      'Watt (kW/hr)',
      'Flow rate (m3/hr)',
    ]);
    loadRows(
      Array.from({ length: 8 }, (_, index) => {
        const hour = index + 15;
        const normal = [18, 20, 21, 22].includes(hour);
        return {
          ...hourRow(hour),
          bod_value: normal ? '5.58' : '0',
          bod_status: normal ? 'Normal' : '8',
          watt_value: '0',
          watt_units: 'kW/hr',
          watt_status: normal ? '1' : 'Etc.',
          flow_value: '0',
          flow_units: 'm3/hr',
          flow_status: hour === 18 ? 'Ok' : [16, 17].includes(hour) ? '8' : '0',
        };
      }),
    );
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 13.04,
      lateDataPercent: 0,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(
      calendar.data.monthlySummary.map((parameter) => parameter.todayDataCompletenessPercent),
    ).toEqual([17.39, 17.39, 4.35]);
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 17.39 }]);
    const rows = statistics.data.measurementPoints[0].rows;
    expect(rows[16].dataCompletenessPercent).toBe(0);
    expect(rows[18].dataCompletenessPercent).toBe(100);
    expect(rows[20].dataCompletenessPercent).toBe(66.67);
    expect(rows[16].values['BOD (mg/l)'].displayValue).toBe('Etc.');
    jest.setSystemTime(new Date('2026-10-06T17:15:00Z'));
    const yesterday = await results();
    expect(
      yesterday.calendar.data.monthlySummary.map(
        (parameter) => parameter.todayDataCompletenessPercent,
      ),
    ).toEqual([16.67, 16.67, 4.17]);
  });

  it('does not count an Etc. numeric placeholder as a received hour', async () => {
    loadRows([{ ...hourRow(0), bod_status: '8' }]);
    const { statistics } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(0);
    expect(statistics.data.measurementPoints[0].rows[0].dataCompletenessPercent).toBe(0);
  });

  it('does not let an ineligible on-time duplicate suppress a valid late reading', async () => {
    loadRows([
      { ...hourRow(0), bod_status: '8' },
      { ...hourRow(0, true), bod_status: 'Normal' },
    ]);
    const { statistics } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 0,
      lateDataPercent: 4.17,
    });
    expect(statistics.data.measurementPoints[0].rows[0].dataCompletenessPercent).toBe(0);
  });

  it.each([
    0,
    2,
    3,
    4,
    5,
    7,
    8,
    9,
    'NoData',
    'Calibration',
    'Defective',
    'Maintenance',
    'Start up',
    'Turnaround',
    'Etc.',
    'No Discharge',
    null,
    'unknown',
  ])('excludes source status %s from both on-time and late totals', async (status) => {
    loadRows([
      { ...hourRow(0), bod_status: status },
      { ...hourRow(1, true), bod_status: status },
    ]);
    const { statistics, calendar } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 0,
      lateDataPercent: 0,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(statistics.data.measurementPoints[0].rows[0].dataCompletenessPercent).toBe(0);
  });

  it.each([1, '1', 'Normal', 'Ok', 6, '6', 'Shut Down'])(
    'counts source status %s with numeric zero, distinguishing on-time and late delivery',
    async (status) => {
      loadRows([
        { ...hourRow(0), bod_status: status },
        { ...hourRow(1, true), bod_status: status },
      ]);
      const { statistics, calendar } = await results();
      expect(statistics.data.summary).toMatchObject({
        todayDataCompletenessPercent: 4.17,
        lateDataPercent: 4.17,
      });
      expect(calendar.data.summary).toEqual(statistics.data.summary);
      expect(statistics.data.measurementPoints[0].rows[0].dataCompletenessPercent).toBe(100);
    },
  );

  it('counts on-time Normal values independently of their pollution level', async () => {
    loadRows([{ ...hourRow(0), bod_value: '99999', bod_status: 'Normal' }]);
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'P0446', date },
      access,
      {
        parameterEvaluations: [
          {
            parameter: 'BOD (mg/l)',
            standardCriteria: {
              rows: [
                { level: 'normal', min: 0, max: 79.99 },
                { level: 'warning', min: 80, max: 99.99 },
                { level: 'critical', min: 100, max: null },
              ],
            },
          },
        ],
      },
    );
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(4.17);
    expect(statistics.data.measurementPoints[0].rows[0].values['BOD (mg/l)'].status).toBe(
      'exceeded',
    );
  });

  it('shows 12/22 on-time normal hours as 54.55 percent while keeping ten late hours visible', async () => {
    jest.setSystemTime(new Date('2026-10-06T15:15:00Z'));
    const lateHours = [3, 4, 5, 6, 7, 13, 14, 15, 16, 21];
    loadRows(
      Array.from({ length: 23 }, (_, hour) => ({
        ...hourRow(hour, lateHours.includes(hour)),
        bod_status: 'Normal',
      })),
    );
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 54.55,
      lateDataPercent: 45.45,
      lowDataDays: 1,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(calendar.data.monthlySummary[0].todayDataCompletenessPercent).toBe(54.55);
    expect(calendar.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: 54.55,
      dataCompletenessStatus: 'lowData',
    });
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 54.55 }]);
    const rows = statistics.data.measurementPoints[0].rows;
    expect(
      rows.flatMap((row, hour) => (row.values['BOD (mg/l)'].status === 'lateData' ? [hour] : [])),
    ).toEqual(lateHours);
    expect(rows[22].values['BOD (mg/l)'].value).toBeNull();
    expect(rows[23].values['BOD (mg/l)'].value).toBeNull();
  });

  it('excludes late hours from current-day delivery regardless of parameter status', async () => {
    jest.setSystemTime(new Date('2026-10-06T15:15:00Z'));
    repository.listRegisteredParameters.mockResolvedValue(['BOD (mg/l)', 'Flow rate (m3/hr)']);
    loadRows(
      Array.from({ length: 21 }, (_, hour) => ({
        ...hourRow(hour, hour === 1 || hour === 2),
        bod_status: hour === 1 ? 'Normal' : hour === 2 ? 'Shut Down' : '6',
        flow_value: '0',
        flow_units: 'm3/hr',
        flow_status: 'Normal',
      })),
    );
    const { statistics, calendar } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 86.36,
      lateDataPercent: 9.09,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(
      calendar.data.monthlySummary.map((summary) => summary.todayDataCompletenessPercent),
    ).toEqual([86.36, 86.36]);
  });

  it.each([
    ['Normal', 100],
    ['Calibration', 0],
    ['6', 100],
    [6, 100],
    ['Shut Down', 100],
  ])(
    'handles all-late status %s today and still counts 24-hour on-time data after midnight',
    async (status, latePercent) => {
      jest.setSystemTime(new Date('2026-10-06T15:15:00Z'));
      loadRows(
        Array.from({ length: 22 }, (_, hour) => ({
          ...hourRow(hour, true),
          bod_status: status,
        })),
      );
      const today = await results();
      expect(today.statistics.data.summary).toMatchObject({
        todayDataCompletenessPercent: 0,
        lateDataPercent: latePercent,
        lowDataDays: 1,
      });
      expect(today.calendar.data.summary).toEqual(today.statistics.data.summary);
      expect(today.calendar.data.calendar.days[0].dataCompletenessPercent).toBe(0);
      jest.setSystemTime(new Date('2026-10-06T17:01:00Z'));
      const yesterday = await results();
      expect(yesterday.statistics.data.summary.todayDataCompletenessPercent).toBe(0);
      expect(yesterday.calendar.data.summary).toEqual(yesterday.statistics.data.summary);
    },
  );

  it('counts the P0446 shutdown day as 22/24 on-time hours and marks delayed values lateData', async () => {
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
      todayDataCompletenessPercent: 91.67,
      lateDataPercent: 4.17,
      lowDataDays: 0,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(calendar.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: 91.67,
      dataCompletenessStatus: 'highData',
    });
    for (const parameter of calendar.data.monthlySummary) {
      expect(parameter).toMatchObject({
        todayDataCompletenessPercent: 91.67,
        lateDataPercent: 4.17,
      });
    }
    expect(statistics.data.measurementPoints[0].rows[17].dataCompletenessPercent).toBe(0);
    for (const value of Object.values(statistics.data.measurementPoints[0].rows[17].values)) {
      expect(value).toEqual({ value: null, displayValue: 'Shut Down', status: 'lateData' });
    }
    expect(statistics.data.measurementPoints[0].rows[5].dataCompletenessPercent).toBe(0);
    expect(details.data.rows).toEqual([]);
  });

  it('counts zero on-time hours for an all-late historical day while retaining lateData pollution status', async () => {
    loadRows(
      Array.from({ length: 24 }, (_, hour) => ({ ...hourRow(hour, true), bod_status: 'Normal' })),
    );
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 0,
      lateDataPercent: 100,
      lowDataDays: 1,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(calendar.data.calendar.days[0].pollutionStatus).toBe('lateData');
    expect(statistics.data.measurementPoints[0].rows[23].values['BOD (mg/l)'].status).toBe(
      'lateData',
    );
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 0 }]);
  });

  it('uses on-time hours for the historical low-data streak and detail percentage', async () => {
    loadRows(Array.from({ length: 17 }, (_, hour) => hourRow(hour, true)));
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 0,
      lowDataDays: 1,
    });
    expect(calendar.data.monthlySummary[0].lowDataDays).toBe(1);
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 0 }]);
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
      todayDataCompletenessPercent: 4.17,
      lateDataPercent: 4.17,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
  });

  it.each(['15', '59'])(
    'counts 21 on-time shutdown hours out of 22 completed hours at 22:%s and masks the unfinished hour',
    async (minute) => {
      repository.listRegisteredParameters.mockResolvedValue([
        'BOD (mg/l)',
        'Flow rate (m3/hr)',
        'Watt (kW/hr)',
      ]);
      loadRows(
        Array.from({ length: 23 }, (_, hour) => ({
          ...hourRow(hour, hour === 1),
          flow_value: '0',
          flow_units: 'm3/hr',
          flow_status: '6',
          watt_value: '0',
          watt_units: 'kW/hr',
          watt_status: '6',
        })),
      );
      jest.setSystemTime(new Date(`2026-10-06T15:${minute}:00Z`));
      const { statistics, calendar } = await results();
      expect(statistics.data.summary).toMatchObject({
        todayDataCompletenessPercent: 95.45,
        lateDataPercent: 4.55,
      });
      expect(calendar.data.summary).toEqual(statistics.data.summary);
      for (const summary of calendar.data.monthlySummary) {
        expect(summary).toMatchObject({
          todayDataCompletenessPercent: 95.45,
          lateDataPercent: 4.55,
        });
      }
      const rows = statistics.data.measurementPoints[0].rows;
      expect(rows).toHaveLength(24);
      expect(rows[21].values['BOD (mg/l)'].displayValue).toBe('Shut Down');
      for (const hour of [22, 23]) {
        expect(rows[hour].dataCompletenessPercent).toBe(0);
        for (const value of Object.values(rows[hour].values)) {
          expect(value).toEqual({ value: null, displayValue: '-', status: 'noData' });
        }
      }
    },
  );

  it('keeps a genuinely missing completed hour below 100 even when the current hour has arrived', async () => {
    loadRows(
      Array.from({ length: 23 }, (_, hour) => hour)
        .filter((hour) => hour !== 5)
        .map((hour) => hourRow(hour, hour === 1)),
    );
    jest.setSystemTime(new Date('2026-10-06T15:15:00Z'));
    const { statistics, calendar } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(90.91);
    expect(calendar.data.summary).toEqual(statistics.data.summary);
  });

  it('reveals hour 22 only once it ends and uses 24 hours when the day becomes historical', async () => {
    loadRows(Array.from({ length: 23 }, (_, hour) => hourRow(hour, hour === 1)));
    jest.setSystemTime(new Date('2026-10-06T16:00:00Z'));
    const at23 = await results();
    expect(at23.statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 95.65,
      lateDataPercent: 4.35,
    });
    expect(
      at23.statistics.data.measurementPoints[0].rows[22].values['BOD (mg/l)'].displayValue,
    ).toBe('Shut Down');
    jest.setSystemTime(new Date('2026-10-06T17:00:00Z'));
    const historical = await results();
    expect(historical.statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 91.67,
      lateDataPercent: 4.17,
    });
    expect(historical.calendar.data.summary).toEqual(historical.statistics.data.summary);
  });

  it('does not count or display current and future hours even when both have arrived', async () => {
    loadRows([hourRow(22), hourRow(23)]);
    jest.setSystemTime(new Date('2026-10-06T15:15:00Z'));
    const { statistics, calendar } = await results();
    expect(statistics.data.summary.todayDataCompletenessPercent).toBe(0);
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    for (const hour of [22, 23]) {
      expect(statistics.data.measurementPoints[0].rows[hour].values['BOD (mg/l)']).toEqual({
        value: null,
        displayValue: '-',
        status: 'noData',
      });
    }
  });

  it('uses completed on-time hours for today low-data streaks and drill-down', async () => {
    loadRows(Array.from({ length: 18 }, (_, hour) => hourRow(hour, hour === 1)));
    jest.setSystemTime(new Date('2026-10-06T15:15:00Z'));
    const { statistics, calendar, details } = await results();
    expect(statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 77.27,
      lowDataDays: 1,
    });
    expect(calendar.data.summary).toEqual(statistics.data.summary);
    expect(calendar.data.monthlySummary[0].lowDataDays).toBe(1);
    expect(details.data.rows).toEqual([{ date, dataCompletenessPercent: 77.27 }]);
  });

  it('uses completed on-time hours today and switches to the full 24-hour denominator after midnight', async () => {
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
    expect(today.statistics.data.measurementPoints[0].rows[10].values['BOD (mg/l)']).toEqual({
      value: null,
      displayValue: '-',
      status: 'noData',
    });
    jest.setSystemTime(new Date('2026-10-06T17:01:00Z'));
    const yesterday = await results();
    expect(yesterday.statistics.data.summary).toMatchObject({
      todayDataCompletenessPercent: 37.5,
      lateDataPercent: 4.17,
    });
    expect(yesterday.calendar.data.summary).toEqual(yesterday.statistics.data.summary);
    expect(yesterday.statistics.data.measurementPoints[0].rows[8].dataCompletenessPercent).toBe(0);
  });
});
