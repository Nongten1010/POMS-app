import { describe, expect, it } from '@jest/globals';
import {
  buildParameterValueMockRows,
  PARAMETER_VALUE_MOCK_STATIONS,
  PARAMETER_VALUE_MOCK_STATUSES,
} from '../../src/db/seeds/12_parameter_value_mock_data';

describe('parameter value mock seed', () => {
  it('defines demo stations for S00001 and P0001 with pasted columns plus separate CO2 units', () => {
    expect(PARAMETER_VALUE_MOCK_STATIONS.map((station) => station.stationId).sort()).toEqual([
      'P0001',
      'S00001',
    ]);

    for (const station of PARAMETER_VALUE_MOCK_STATIONS) {
      expect(station.parameters).toHaveLength(130);
      expect(station.parameters.every((parameter) => parameter.label.length > 0)).toBe(true);
      expect(station.parameters.every((parameter) => parameter.columnPrefix.length > 0)).toBe(true);
    }
  });

  it('keeps CO2 percent and CO2 ppm as separate mock columns', () => {
    const stackStation = PARAMETER_VALUE_MOCK_STATIONS.find(
      (station) => station.stationId === 'S00001',
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
});
