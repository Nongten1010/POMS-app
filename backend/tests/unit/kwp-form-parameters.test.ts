import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import {
  getKwpEligibleParameters,
  validateKwpParameterSelection,
} from '../../src/modules/kwp-form-submissions/kwp-form-parameters';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const reference = { factoryId: 'F001', connectedPointId: 8 };
const pomsEligible = ['COD (mg/l)', 'Flow rate (m3/hr)', 'Watt (kW/hr)'];
const originalMode = env.FACTORY_PROFILE_MODE;
const connectedPoint = {
  id: 8,
  factory_id: 'F001',
  eligible_factory_id: 1,
  system_type: 'WPMS',
  point_code: 'P0208',
  point_name: 'Wastewater outlet',
  parameters_json: '["COD (mg/l)","BOD (mg/l)"]',
  details_json: JSON.stringify({ eligibleParameters: pomsEligible }),
  deleted_at: null,
};

describe.each(['legacy', 'canonical'] as const)('KWP eligible parameters in %s mode', (mode) => {
  let fixture: KnexSqliteFixture;

  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = mode;
    fixture = await createKnexSqliteFixture(db, {
      cems_wpms_connected_measurement_points: [connectedPoint],
      eligible_factories: [{ id: 1, monitoring_point_form_id: 2, deleted_at: null }],
      factory_monitoring_points: [
        {
          id: 3,
          form_id: 2,
          system_type: 'WPMS',
          point_code: 'P0208',
          point_name: 'Wastewater outlet',
          eligible_parameters_json: '[]',
          deleted_at: null,
        },
      ],
    });
    fixture.execute(
      'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
    );
    fixture.execute('CREATE VIEW current_eligible_factories AS SELECT * FROM eligible_factories');
  });

  afterEach(() => {
    fixture?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
  });

  it('returns the eligible list for P0208 when the matching factory form is empty', async () => {
    expect(await getKwpEligibleParameters(db, reference)).toEqual(pomsEligible);
  });

  it.each([null, '{}', '{"eligibleParameters":[]}', 'invalid JSON'])(
    'returns no parameters when POMS eligibility is unavailable (%s)',
    async (details) => {
      await db('cems_wpms_connected_measurement_points')
        .where('id', 8)
        .update({ details_json: details });
      await db('factory_monitoring_points')
        .where('id', 3)
        .update({ eligible_parameters_json: '["BOD (mg/l)"]' });

      expect(await getKwpEligibleParameters(db, reference)).toEqual([]);
    },
  );

  it('uses only an unambiguous POMS unit for legacy eligible labels', async () => {
    await db('cems_wpms_connected_measurement_points').where('id', 8).update({
      parameters_json: '["COD (mg/l)","CO (%)","CO (ppm)"]',
      details_json: '{"eligibleParameters":["COD","CO"]}',
    });

    expect(await getKwpEligibleParameters(db, { factoryId: 'F001', pointCode: 'P0208' })).toEqual([
      'COD (mg/l)',
      'CO (ไม่ระบุหน่วย)',
    ]);
  });

  it('requires a unique active POMS point in the requested factory', async () => {
    await db('cems_wpms_connected_measurement_points').insert([
      { ...connectedPoint, id: 9 },
      { ...connectedPoint, id: 10, deleted_at: '2026-11-01' },
    ]);
    expect(await getKwpEligibleParameters(db, { factoryId: 'F001', pointCode: 'P0208' })).toEqual(
      [],
    );
    expect(await getKwpEligibleParameters(db, { ...reference, factoryId: 'OTHER' })).toEqual([]);
    expect(await getKwpEligibleParameters(db, { ...reference, connectedPointId: 10 })).toEqual([]);
    expect(await getKwpEligibleParameters(db, reference)).toEqual(pomsEligible);
  });
});

describe('KWP parameter selection', () => {
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
