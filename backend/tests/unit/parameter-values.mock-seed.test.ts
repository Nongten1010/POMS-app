import { describe, expect, it } from '@jest/globals';
import {
  buildParameterValueMockRows,
  PARAMETER_VALUE_MOCK_DATES,
  PARAMETER_VALUE_MOCK_STATIONS,
  PARAMETER_VALUE_MOCK_STATUSES,
} from '../../src/db/seeds/12_parameter_value_mock_data';

describe('parameter value mock seed', () => {
  it('defines a June 1-10, 2026 mock date range', () => {
    expect(PARAMETER_VALUE_MOCK_DATES).toHaveLength(10);
    expect(PARAMETER_VALUE_MOCK_DATES[0]).toBe('2026-06-01');
    expect(PARAMETER_VALUE_MOCK_DATES[PARAMETER_VALUE_MOCK_DATES.length - 1]).toBe('2026-06-10');
  });

  it('defines demo stations for S0001 and P0001 with pasted columns plus separate CO2 units', () => {
    expect(PARAMETER_VALUE_MOCK_STATIONS.map((station) => station.stationId).sort()).toEqual([
      'P0001',
      'S0001',
    ]);

    for (const station of PARAMETER_VALUE_MOCK_STATIONS) {
      expect(station.parameters).toHaveLength(130);
      expect(station.parameters.every((parameter) => parameter.label.length > 0)).toBe(true);
      expect(station.parameters.every((parameter) => parameter.columnPrefix.length > 0)).toBe(true);
    }
  });

  it('keeps CO2 percent and CO2 ppm as separate mock columns', () => {
    const stackStation = PARAMETER_VALUE_MOCK_STATIONS.find(
      (station) => station.stationId === 'S0001',
    );

    expect(stackStation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'CO2 (%)', columnPrefix: 'co2_percent', unit: '%' }),
        expect.objectContaining({ label: 'CO2 (ppm)', columnPrefix: 'co2_ppm', unit: 'ppm' }),
      ]),
    );
    expect(
      stackStation?.parameters.filter((parameter) => parameter.columnPrefix.startsWith('co2')),
    ).toHaveLength(2);
    expect(stackStation?.parameters.some((parameter) => parameter.columnPrefix === 'co2')).toBe(
      false,
    );
  });

  it('generates all parameter statuses with Normal between 70 and 90 percent', () => {
    const allowedStatuses = new Set<string>(PARAMETER_VALUE_MOCK_STATUSES);

    for (const station of PARAMETER_VALUE_MOCK_STATIONS) {
      const rows = buildParameterValueMockRows(station, '2026-06-09');

      expect(rows).toHaveLength(24);

      for (const parameter of station.parameters) {
        const statuses = rows.map((row) => row[`${parameter.columnPrefix}_status`]);

        expect(statuses.every((status) => allowedStatuses.has(String(status)))).toBe(true);
        expect(statuses).toContain('Maintenance');
        expect(statuses).toContain('Shut Down');

        const normalPercent =
          (statuses.filter((status) => status === 'Normal').length / statuses.length) * 100;

        expect(normalPercent).toBeGreaterThanOrEqual(70);
        expect(normalPercent).toBeLessThanOrEqual(90);
      }
    }
  });

  it('fills value, unit, and status for every mock parameter on every row', () => {
    for (const station of PARAMETER_VALUE_MOCK_STATIONS) {
      const rows = buildParameterValueMockRows(station, '2026-06-09');

      for (const row of rows) {
        for (const parameter of station.parameters) {
          expect(row[`${parameter.columnPrefix}_value`]).not.toBeNull();
          expect(row[`${parameter.columnPrefix}_units`]).not.toBeNull();
          expect(row[`${parameter.columnPrefix}_units`]).not.toBe('');
          expect(row[`${parameter.columnPrefix}_status`]).not.toBeNull();
        }

        expect(row.co2_value).not.toBeNull();
        expect(row.co2_units).not.toBeNull();
        expect(row.co2_status).not.toBeNull();
      }
    }
  });

  it('varies mock values and statuses across dates', () => {
    const station = PARAMETER_VALUE_MOCK_STATIONS.find(
      (mockStation) => mockStation.stationId === 'S0001',
    );
    expect(station).toBeDefined();

    const firstDayRows = buildParameterValueMockRows(station!, '2026-06-01');
    const secondDayRows = buildParameterValueMockRows(station!, '2026-06-02');

    expect(firstDayRows[0].co2_percent_value).not.toBe(secondDayRows[0].co2_percent_value);
    expect(firstDayRows[18].co2_percent_status).not.toBe(secondDayRows[18].co2_percent_status);
  });

  it('uses wider realistic ranges for key stack parameters', () => {
    const station = PARAMETER_VALUE_MOCK_STATIONS.find(
      (mockStation) => mockStation.stationId === 'S0001',
    );
    expect(station).toBeDefined();

    const rows = PARAMETER_VALUE_MOCK_DATES.flatMap((date) =>
      buildParameterValueMockRows(station!, date),
    );
    const coValues = rows.map((row) => Number(row.co_value));
    const noxValues = rows.map((row) => Number(row.nox_value));

    expect(Math.min(...coValues)).toBeGreaterThanOrEqual(300);
    expect(Math.max(...coValues)).toBeLessThanOrEqual(700);
    expect(Math.max(...coValues) - Math.min(...coValues)).toBeGreaterThan(250);

    expect(Math.min(...noxValues)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...noxValues)).toBeLessThanOrEqual(360);
    expect(Math.max(...noxValues) - Math.min(...noxValues)).toBeGreaterThan(160);
  });
});
