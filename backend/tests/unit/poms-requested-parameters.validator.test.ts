import { approvedParameterLabel } from '../../src/modules/poms-factories/poms-measurement-point-parameters';
import { describe, expect, it } from '@jest/globals';
import { createPomsFactoryEditRequestSchema } from '../../src/modules/poms-factories/poms-factories.validator';

const input = (requestedParameters: unknown) => ({
  formType: 'MEASUREMENT_POINTS',
  measurementPoints: [{ connectedPointId: 15, details: { requestedParameters } }],
});

describe('requested parameters in POMS edit requests', () => {
  it('accepts the replacement BOD Watt Flow list', () => {
    expect(
      createPomsFactoryEditRequestSchema.safeParse(
        input(['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)']),
      ).success,
    ).toBe(true);
  });
  it('accepts an explicit empty list', () => {
    expect(createPomsFactoryEditRequestSchema.safeParse(input([])).success).toBe(true);
  });
  it.each([null, 123, 'BOD', [''], [123], ['BOD', ' bod '], ['ไม่มี']])(
    'rejects malformed parameter selection %j',
    (value) => {
      expect(createPomsFactoryEditRequestSchema.safeParse(input(value)).success).toBe(false);
    },
  );
});

describe('legacy channel parameter matching', () => {
  it('matches an unambiguous unitless name without replacing device settings', () => {
    expect(approvedParameterLabel('bod', ['BOD (mg/l)', 'Watt (kW/hr)'])).toBe('BOD (mg/l)');
    expect(approvedParameterLabel('BOD (mg/l)', ['BOD'])).toBe('BOD');
  });
  it('does not conflate units or ambiguous unitless names', () => {
    expect(approvedParameterLabel('BOD (mg/l)', ['BOD (g/l)'])).toBeUndefined();
    expect(approvedParameterLabel('BOD', ['BOD (mg/l)', 'BOD (g/l)'])).toBeUndefined();
  });
});
