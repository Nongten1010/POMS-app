import { describe, expect, it } from '@jest/globals';
import { resolveMeasurementParameterFamily } from '../../src/modules/parameter-values/measurement-parameter-columns';

describe('measurement source family selection', () => {
  it.each(['DegC', 'degc', ' DegC ', 'C°', '°C', null])(
    'reads a single registered Celsius channel with source unit %s',
    (unit) => {
      const row = { temp_value: '150.77', temp_status: '1', temp_units: unit };
      expect(resolveMeasurementParameterFamily(row, 'Temp. (C°)', ['Temp. (C°)'])).toMatchObject({
        valueColumn: 'temp_value',
        statusColumn: 'temp_status',
      });
    },
  );

  it('does not guess a missing temperature unit when Celsius and Fahrenheit are registered', () => {
    expect(
      resolveMeasurementParameterFamily(
        { temp_value: '150.77', temp_status: '1', temp_units: null },
        'Temp. (C°)',
        ['Temp. (C°)', 'Temp. (°F)'],
      ),
    ).toBeNull();
  });

  it('prefers the dedicated unit family without borrowing its missing status', () => {
    const row = {
      hcl_value: 10,
      hcl_units: 'ppm',
      hcl_status: 'Defective',
      hcl_ppm_value: '0.13593',
      hcl_ppm_units: null,
      hcl_ppm_status: null,
    };
    const family = resolveMeasurementParameterFamily(row, 'HCl (ppm)', ['HCl (ppm)']);
    expect(family?.prefix).toBe('hcl_ppm');
    expect(family?.statusColumn).toBe('hcl_ppm_status');
    expect(row.hcl_ppm_status).toBeNull();
  });

  it('keeps same-name channels in separate units', () => {
    const row = { hcl_ppm_value: 5, hcl_ppm_status: '1', hcl_mgm3_value: 20, hcl_mgm3_status: '3' };
    const labels = ['HCl (ppm)', 'HCl (mg/m3)'];
    expect(resolveMeasurementParameterFamily(row, labels[0], labels)?.prefix).toBe('hcl_ppm');
    expect(resolveMeasurementParameterFamily(row, labels[1], labels)?.prefix).toBe('hcl_mgm3');
  });

  it.each([
    { hcl_ppm_value: 5, hcl_ppm_units: 'mg/m3' },
    { hcl_value: 5, hcl_percent_value: 1 },
    { hcl_value: 5, hcl_units: '%' },
  ])('rejects a conflicting or unidentified unit: %j', (row) => {
    expect(resolveMeasurementParameterFamily(row, 'HCl (ppm)', ['HCl (ppm)'])).toBeNull();
  });

  it('rejects an unlabelled generic channel registered with two units', () => {
    expect(
      resolveMeasurementParameterFamily({ hcl_value: 5 }, 'HCl (ppm)', [
        'HCl (ppm)',
        'HCl (mg/m3)',
      ]),
    ).toBeNull();
  });

  it('retains a generic legacy channel with one registered unit', () => {
    expect(
      resolveMeasurementParameterFamily({ hcl_value: 5, hcl_status: '1' }, 'HCl (ppm)', [
        'HCl (ppm)',
      ])?.prefix,
    ).toBe('hcl');
  });
});
