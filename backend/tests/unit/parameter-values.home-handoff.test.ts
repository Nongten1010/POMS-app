import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    earliestMeasurementDate: jest.fn(),
    listRegisteredParameters: jest.fn(),
    listRows: jest.fn(),
    latestRowsAtOrBeforeHour: jest.fn(),
    tableExists: jest.fn(),
    tableName: jest.fn((stationId: string, interval: string) => `${stationId}_data_${interval}`),
  },
}));

import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import {
  evaluateHomeMeasurementRow,
  evaluateHomeMeasurementRows,
  parameterValuesService,
} from '../../src/modules/parameter-values/parameter-values.service';

const repository = jest.mocked(parameterValuesRepository);
const access = { actorUserId: 42, scope: 'OWN_FACTORY' };
const criteria = {
  rows: [
    { level: 'normal', min: 0, max: 79.99 },
    { level: 'warning', min: 80, max: 99.99 },
    { level: 'critical', min: 100, max: null },
  ],
};
const options = {
  parameterEvaluations: [{ parameter: 'CO (ppm)', standardCriteria: criteria }],
};

function hourRow(hour: number, value = 50): Record<string, unknown> {
  return {
    station_id: 'S1125',
    cdate: '2026-09-23',
    ctime: `${String(hour).padStart(2, '0')}:00:00`,
    udate: '2026-09-23',
    utime: `${String(hour).padStart(2, '0')}:59:00`,
    co_value: value,
    co_status: 'Normal',
  };
}

describe('home handoff measurement calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-23T03:30:00.000Z'));
    repository.canAccessStation.mockResolvedValue(true);
    repository.tableExists.mockResolvedValue(true);
    repository.earliestMeasurementDate.mockResolvedValue(null);
    repository.listRegisteredParameters.mockResolvedValue(['CO (ppm)']);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts the ten completed hours at 10:30 as 100 percent', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: Array.from({ length: 10 }, (_, hour) => hourRow(hour)),
    });

    const result = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );

    expect(result.data.calendar.days[0].dataCompletenessPercent).toBe(100);
  });

  it('excludes current-hour pollution from calendar while retaining statistic table values', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [...Array.from({ length: 10 }, (_, hour) => hourRow(hour)), hourRow(10, 150)],
    });

    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      options,
    );

    expect(calendar.data.calendar.days[0].pollutionStatus).toBe('normal');
    expect(calendar.data.monthlySummary[0].exceededDays).toBe(0);
    expect(statistics.data.measurementPoints[0].rows[10].values['CO (ppm)']).toMatchObject({
      value: 150,
      status: 'exceeded',
    });
  });

  it('marks only normal late measurements as lateData and keeps warning/exceeded precedence', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        { ...hourRow(6), udate: '2026-09-23', utime: '06:59:59.999' },
        { ...hourRow(7), udate: '2026-09-23', utime: '08:00:00' },
        { ...hourRow(8, 90), udate: '2026-09-23', utime: '09:00:00' },
        { ...hourRow(9, 150), udate: '2026-09-23', utime: '10:00:00' },
      ],
    });

    const result = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      options,
    );
    const rows = result.data.measurementPoints[0].rows;

    expect(rows.slice(6, 10).map((row) => row.values['CO (ppm)'].status)).toEqual([
      'normal',
      'lateData',
      'warning',
      'exceeded',
    ]);
    expect(rows[7].values['CO (ppm)'].value).toBe(50);
  });

  it('uses visible parameter-hours and does not let source percentages or duplicate rows override receipt counts', async () => {
    repository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    const rows = Array.from({ length: 10 }, (_, hour) => ({
      ...hourRow(hour),
      nox_value: hour === 0 ? null : 40,
      nox_status: 'Normal',
      data_completeness_percent: 7,
    }));
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        ...rows,
        { ...hourRow(0), co_value: null, nox_value: 40, nox_status: 'Normal', utime: '01:00:00' },
        { ...hourRow(1), utime: '02:00:00' },
      ],
    });
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      {
        ...options,
        parameterEvaluations: [...options.parameterEvaluations, { parameter: 'NOx (ppm)' }],
      },
    );
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      options,
    );
    expect(calendar.data.summary).toMatchObject({
      todayDataCompletenessPercent: 95,
      lateDataPercent: 5,
      lowDataDays: 0,
    });
    expect(statistics.data.summary).toEqual(calendar.data.summary);
    expect(calendar.data.monthlySummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameterCode: 'CO',
          todayDataCompletenessPercent: 100,
          lateDataPercent: 0,
        }),
        expect.objectContaining({
          parameterCode: 'NOX',
          todayDataCompletenessPercent: 90,
          lateDataPercent: 10,
        }),
      ]),
    );
    expect(statistics.data.measurementPoints[0].rows[0].dataCompletenessPercent).toBe(50);
  });

  it.each([
    ['2026-09-22', '2026-09-22', '23:59:59.999', 'normal', 100, 0],
    ['2026-09-22', '2026-09-23', '00:00:00', 'lateData', 95.83, 4.17],
    ['2026-09-22', '2026-09-23', '23:00:00', 'lateData', 95.83, 4.17],
    ['2026-12-31', '2027-01-01', '00:00:00', 'lateData', 95.83, 4.17],
  ])(
    'compares corrected local timestamps directly for %s 23:00 sent at %s %s',
    async (measuredDate, sentDate, sentTime, expectedStatus, onTimePercent, latePercent) => {
      jest.setSystemTime(new Date('2027-01-01T17:30:00.000Z'));
      const rows = Array.from({ length: 24 }, (_, hour) => ({
        ...hourRow(hour),
        cdate: measuredDate,
        udate: hour === 23 ? sentDate : measuredDate,
        utime: hour === 23 ? sentTime : `${String(hour).padStart(2, '0')}:59:59`,
      }));
      repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows });

      const statistics = await parameterValuesService.measurementStatistics(
        { stationId: 'S1125', date: measuredDate },
        access,
        options,
      );
      const calendar = await parameterValuesService.calendarStatus(
        { stationId: 'S1125', month: measuredDate.slice(0, 7), endDate: measuredDate },
        access,
        options,
      );

      expect(statistics.data.summary).toMatchObject({
        todayDataCompletenessPercent: onTimePercent,
        lateDataPercent: latePercent,
      });
      expect(calendar.data.summary).toEqual(statistics.data.summary);
      expect(statistics.data.measurementPoints[0].rows[23].values['CO (ppm)']).toMatchObject({
        value: 50,
        status: expectedStatus,
      });
      expect(evaluateHomeMeasurementRow(rows[23], ['CO (ppm)'], options)['CO (ppm)']).toEqual(
        statistics.data.measurementPoints[0].rows[23].values['CO (ppm)'],
      );
    },
  );

  it('removes hidden parameters before values, metadata, percentages and pollution are built', async () => {
    repository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: Array.from({ length: 10 }, (_, hour) => ({
        ...hourRow(hour),
        nox_value: 999,
        nox_status: 'Normal',
      })),
    });
    const visibleOptions = { ...options, allowedParameterLabels: ['CO (ppm)'] };
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      visibleOptions,
    );
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      visibleOptions,
    );
    expect(calendar.data.summary).toMatchObject({
      exceededDays: 0,
      todayDataCompletenessPercent: 100,
    });
    expect(calendar.meta.registeredParameters).toEqual(['CO (ppm)']);
    expect(statistics.data.measurementPoints[0].rows[0].values).toEqual({
      'CO (ppm)': { value: 50, displayValue: '50.00', status: 'normal' },
    });
    await expect(
      parameterValuesService.calendarStatusDetails(
        { stationId: 'S1125', year: '2026', summaryType: 'exceeded', parameterCode: 'NOX' },
        access,
        visibleOptions,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('keeps an absent-hour on-time result unchanged when the missing value later arrives late', async () => {
    const rows = Array.from({ length: 9 }, (_, hour) => hourRow(hour));
    repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows });
    const before = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [...rows, { ...hourRow(9), utime: '10:05:00' }],
    });
    const after = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );
    expect(before.data.summary.todayDataCompletenessPercent).toBe(90);
    expect(after.data.summary).toMatchObject({
      todayDataCompletenessPercent: 90,
      lateDataPercent: 10,
    });
    expect(after.data.calendar.days[0].pollutionStatus).toBe('lateData');
  });

  it('uses null instead of a missing-data result before the first hour ends and includes 00:00 once completed', async () => {
    jest.setSystemTime(new Date('2026-09-22T17:01:00.000Z'));
    repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows: [hourRow(0)] });
    const midnight = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );
    expect(midnight.data.summary).toEqual({
      exceededDays: 0,
      lowDataDays: 0,
      todayDataCompletenessPercent: null,
      lateDataPercent: null,
    });
    expect(midnight.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: null,
      lateDataPercent: null,
      dataCompletenessStatus: null,
      pollutionStatus: 'insufficient',
      display: { backgroundStatus: null },
    });
    jest.setSystemTime(new Date('2026-09-22T18:00:00.000Z'));
    const one = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );
    expect(one.data.summary.todayDataCompletenessPercent).toBe(100);
  });

  it('counts a contiguous cross-year low-data streak including missing days but exceeded days only from January 1', async () => {
    const dated = (date: string, hour: number, value = 50) => ({
      ...hourRow(hour, value),
      cdate: date,
      udate: date,
    });
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        ...Array.from({ length: 24 }, (_, hour) => dated('2025-12-28', hour)),
        dated('2025-12-29', 0),
        dated('2025-12-31', 0, 150),
        dated('2026-01-01', 0, 150),
        dated('2026-01-01', 1, 150),
        dated('2026-01-02', 0),
      ],
    });
    const historyOptions = { ...options, expectedStartDate: '2025-12-28' };
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-01', endDate: '2026-01-02' },
      access,
      historyOptions,
    );
    const details = await parameterValuesService.calendarStatusDetails(
      {
        stationId: 'S1125',
        year: '2026',
        endDate: '2026-01-02',
        summaryType: 'lowData',
        parameterCode: 'CO',
      },
      access,
      historyOptions,
    );
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-01-02' },
      access,
      historyOptions,
    );
    expect(repository.listRows).toHaveBeenCalledWith({
      stationId: 'S1125',
      interval: '60m',
      startDate: '2025-12-28',
      endDate: '2026-01-02',
    });
    expect(calendar.data.summary).toMatchObject({
      exceededDays: 1,
      lowDataDays: 5,
      todayDataCompletenessPercent: 4.17,
    });
    expect(statistics.data.summary).toEqual(calendar.data.summary);
    expect(calendar.data.calendar.days.map((day) => day.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(details.data.rows.map((day) => day.date)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(details.data.rows[1]).toEqual({ date: '2025-12-30', dataCompletenessPercent: 0 });
    expect(details.data.summary.affectedDays).toBe(calendar.data.monthlySummary[0].lowDataDays);
    expect(details.meta.endDate).toBe(calendar.meta.endDate);
  });

  it('preserves history when a newer verified request supplies a later connected date', async () => {
    repository.earliestMeasurementDate.mockResolvedValue('2026-01-01');
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        { ...hourRow(0, 150), cdate: '2026-01-01', udate: '2026-01-01' },
        ...Array.from({ length: 10 }, (_, hour) => hourRow(hour)),
      ],
    });
    const result = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      { ...options, expectedStartDate: '2026-09-23' },
    );
    expect(result.data.summary).toMatchObject({ exceededDays: 1, lowDataDays: 0 });
  });

  it('keeps popup and table source-quality status identical and reports a truly absent popup parameter as noData', async () => {
    const row = { ...hourRow(9), co_data_completeness_percent: 50 };
    repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows: [row] });
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      options,
    );
    expect(evaluateHomeMeasurementRow(row, ['CO (ppm)'], options)['CO (ppm)']).toEqual(
      statistics.data.measurementPoints[0].rows[9].values['CO (ppm)'],
    );
    expect(evaluateHomeMeasurementRow(row, ['NOx (ppm)'], options)['NOx (ppm)']).toEqual({
      value: null,
      displayValue: '-',
      status: 'noData',
    });
  });

  it('loads every row of the exact completed hour for home popup without changing the normal latestHourly route', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        hourRow(8),
        { ...hourRow(9), ctime: '09:20:00' },
        { ...hourRow(9), ctime: '09:05:00' },
        hourRow(10),
      ],
    });
    const result = await parameterValuesService.latestHourly(
      'S1125',
      access,
      { date: '2026-09-23', hour: 9 },
      { homeHour: true },
    );
    expect(result.data.map((row) => row.ctime)).toEqual(['09:20:00', '09:05:00']);
  });

  it('keeps 191 of 240 parameter-hours below the 80 percent threshold before display rounding', async () => {
    const parameters = Array.from({ length: 10 }, (_, index) => `P${index} (ppm)`);
    repository.listRegisteredParameters.mockResolvedValue(parameters);
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        ...Array.from({ length: 19 }, (_, hour) => ({
          ...hourRow(hour),
          cdate: '2026-09-22',
          udate: '2026-09-22',
          ...Object.fromEntries(parameters.map((_, index) => [`p${index}_value`, 1])),
        })),
        { ...hourRow(19), cdate: '2026-09-22', udate: '2026-09-22', p0_value: 1 },
      ],
    });
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09', endDate: '2026-09-22' },
      access,
    );
    expect(calendar.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: 79.58,
      dataCompletenessStatus: 'lowData',
    });
    expect(calendar.data.summary.lowDataDays).toBe(1);
  });

  it('does not merge source noData with an older value from the same hour', async () => {
    const rows = [
      { ...hourRow(9), ctime: '09:00:00' },
      { ...hourRow(9), ctime: '09:30:00', co_value: null, co_status: 0 },
    ];
    repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows });
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      options,
    );
    const popup = evaluateHomeMeasurementRows(rows, ['CO (ppm)'], options);
    expect(popup['CO (ppm)']).toEqual(
      statistics.data.measurementPoints[0].rows[9].values['CO (ppm)'],
    );
    expect(popup['CO (ppm)']).toMatchObject({ status: 'noData', value: null });
  });

  it('preserves global source quality only on the home hourly read so popup and table agree', async () => {
    const source = {
      tableName: 'S1125_data_60m',
      rows: [{ ...hourRow(9), data_completeness_percent: 50 }],
    };
    repository.listRows.mockResolvedValue(source);
    repository.latestRowsAtOrBeforeHour.mockResolvedValue(source);
    const cutoff = { date: '2026-09-23', hour: 9 };
    const home = await parameterValuesService.latestHourly('S1125', access, cutoff, {
      homeHour: true,
    });
    const standard = await parameterValuesService.latestHourly('S1125', access, cutoff);
    const statistics = await parameterValuesService.measurementStatistics(
      { stationId: 'S1125', date: '2026-09-23' },
      access,
      options,
    );
    expect(home.data[0].data_completeness_percent).toBe(50);
    expect(standard.data[0]).not.toHaveProperty('data_completeness_percent');
    expect(evaluateHomeMeasurementRows(home.data, ['CO (ppm)'], options)['CO (ppm)']).toEqual(
      statistics.data.measurementPoints[0].rows[9].values['CO (ppm)'],
    );
    expect(statistics.data.measurementPoints[0].rows[9].values['CO (ppm)'].status).toBe(
      'insufficient',
    );
  });

  it('keeps same-name parameters with different units separate while counting the union of exceeded days', async () => {
    repository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'CO (%)']);
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: Array.from({ length: 10 }, (_, hour) => [
        { ...hourRow(hour, 150), co_units: 'ppm' },
        { ...hourRow(hour, 5), co_units: '%' },
      ]).flat(),
    });
    const twoUnits = {
      parameterEvaluations: [
        ...options.parameterEvaluations,
        { parameter: 'CO (%)', standardCriteria: criteria },
      ],
    };
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      twoUnits,
    );
    const detail = await parameterValuesService.calendarStatusDetails(
      { stationId: 'S1125', year: '2026', summaryType: 'exceeded', parameterCode: 'CO', unit: '%' },
      access,
      twoUnits,
    );
    expect(calendar.data.summary).toMatchObject({
      exceededDays: 1,
      todayDataCompletenessPercent: 100,
    });
    expect(
      calendar.data.monthlySummary.map((item) => [item.parameterLabel, item.exceededDays]),
    ).toEqual([
      ['CO (ppm)', 1],
      ['CO (%)', 0],
    ]);
    expect(detail.data.summary.affectedDays).toBe(0);
  });

  it('does not classify absent or invalid receipt timestamps as on-time', async () => {
    repository.listRows.mockResolvedValue({
      tableName: 'S1125_data_60m',
      rows: [
        { ...hourRow(0), udate: null },
        { ...hourRow(1), utime: '01:99:00' },
      ],
    });
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-09' },
      access,
      options,
    );
    expect(calendar.data.summary).toMatchObject({
      todayDataCompletenessPercent: 0,
      lateDataPercent: 0,
    });
  });

  it('does not reuse current-period totals or streaks when the requested calendar period is still in the future', async () => {
    repository.listRows.mockResolvedValue({ tableName: 'S1125_data_60m', rows: [hourRow(0, 150)] });
    const calendar = await parameterValuesService.calendarStatus(
      { stationId: 'S1125', month: '2026-10' },
      access,
      options,
    );
    const details = await parameterValuesService.calendarStatusDetails(
      { stationId: 'S1125', year: '2027', summaryType: 'lowData', parameterCode: 'CO' },
      access,
      options,
    );
    expect(calendar.data.calendar.days).toEqual([]);
    expect(calendar.data.summary).toEqual({
      exceededDays: 0,
      lowDataDays: 0,
      todayDataCompletenessPercent: null,
      lateDataPercent: null,
    });
    expect(details.data.rows).toEqual([]);
  });
});
