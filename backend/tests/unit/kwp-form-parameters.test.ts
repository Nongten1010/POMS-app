import { describe, expect, it } from '@jest/globals';
import type { Knex } from 'knex';
import {
  getKwpEligibleParameters,
  validateKwpParameterSelection,
} from '../../src/modules/kwp-form-submissions/kwp-form-parameters';

describe('KWP eligible parameters', () => {
  it('keeps all eligible parameters including exemptions and pending connections', async () => {
    const connection = fakeConnection([
      [
        {
          eligible_factory_id: 1,
          system_type: 'WPMS',
          point_code: 'P01',
          point_name: 'Water',
          parameters_json: '["BOD (mg/l)"]',
          details_json: '{"eligibleParameters":["wrong"]}',
        },
      ],
      [{ monitoring_point_form_id: 2 }],
      [
        {
          point_code: 'P01',
          eligible_parameters_json: '["BOD (mg/l)","COD (mg/l)"]',
          exempted_parameters_json: '["COD (mg/l)"]',
        },
      ],
    ]);
    expect(
      await getKwpEligibleParameters(connection, { factoryId: 'F001', connectedPointId: 8 }),
    ).toEqual(['BOD (mg/l)', 'COD (mg/l)']);
  });
  it('does not replace an explicitly empty eligible list with connected parameters', async () => {
    const connection = fakeConnection([
      [
        {
          eligible_factory_id: 1,
          system_type: 'WPMS',
          point_code: 'P01',
          parameters_json: '["BOD (mg/l)"]',
          details_json: '{"eligibleParameters":["COD (mg/l)"]}',
        },
      ],
      [{ monitoring_point_form_id: 2 }],
      [{ point_code: 'P01', eligible_parameters_json: '[]' }],
    ]);
    expect(
      await getKwpEligibleParameters(connection, { factoryId: 'F001', connectedPointId: 8 }),
    ).toEqual([]);
  });
  it('does not select arbitrarily among duplicate point matches', async () => {
    const connection = fakeConnection([
      [{ eligible_factory_id: 1, system_type: 'WPMS', point_code: 'P01' }],
      [{ monitoring_point_form_id: 2 }],
      [
        { point_code: 'P01', eligible_parameters_json: '["BOD (mg/l)"]' },
        { point_code: 'P01', eligible_parameters_json: '["COD (mg/l)"]' },
      ],
    ]);
    expect(
      await getKwpEligibleParameters(connection, { factoryId: 'F001', connectedPointId: 8 }),
    ).toEqual([]);
  });
  it('validates units and accepts a legacy code only when unambiguous', () => {
    expect(() => validateKwpParameterSelection(['CO (ppm)'], ['CO (%)'])).toThrow('not eligible');
    expect(() => validateKwpParameterSelection(['CO'], ['CO (%)', 'CO (ppm)'])).toThrow(
      'not eligible',
    );
    expect(() => validateKwpParameterSelection(['BOD'], ['BOD (mg/l)'])).not.toThrow();
    expect(() =>
      validateKwpParameterSelection(['COD (mg/l)'], ['BOD (mg/l)', 'COD (mg/l)']),
    ).not.toThrow();
  });
});

function fakeConnection(results: unknown[][]): Knex {
  return (() => {
    const result = results.shift();
    const chain = { where: () => chain, whereNull: () => chain, select: async () => result };
    return chain;
  }) as unknown as Knex;
}
