import { describe, expect, it } from '@jest/globals';
import {
  parseRegisteredAlertParameter,
  planAlertParameterActivations,
  type StoredAlertParameterActivation,
} from '../../src/modules/alert-emails/alert-parameter-activations';

const now = '2026-10-05T02:00:00.000Z';
const previous = '2026-09-01T00:00:00.000Z';
function registered(value: string) {
  const parameter = parseRegisteredAlertParameter(value);
  if (!parameter) throw new Error('Invalid registered test parameter');
  return parameter;
}
const co = () => registered('CO (ppm)');
const activation = (overrides: Partial<StoredAlertParameterActivation> = {}) => ({
  id: 1,
  parameterCode: 'co',
  unit: 'ppm',
  activatedAt: previous,
  ...overrides,
});

describe('stable alert parameter activations', () => {
  it('requires a real registered unit and a machine-readable parameter name', () => {
    expect(parseRegisteredAlertParameter('CO')).toBeNull();
    expect(parseRegisteredAlertParameter('CO ()')).toBeNull();
    expect(parseRegisteredAlertParameter(' (ppm)')).toBeNull();
  });

  it('normalizes registered labels without conflating different units', () => {
    expect(parseRegisteredAlertParameter(' CO ( ppm ) ')).toMatchObject({
      parameterCode: 'co',
      name: 'CO',
      unit: 'ppm',
      label: 'CO (ppm)',
    });
    expect(co().key).not.toBe(registered('CO (%)').key);
  });

  it('retains the old activation across config or device replacement', () => {
    expect(planAlertParameterActivations([activation()], [co()], now)).toEqual({
      activate: [],
      deactivateIds: [],
    });
  });

  it('starts newly registered parameters at the current time, never point connection', () => {
    expect(planAlertParameterActivations([], [co()], now).activate).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: now },
    ]);
  });

  it('ends removed or test-only keys and starts a changed unit separately', () => {
    expect(planAlertParameterActivations([activation()], [registered('CO (%)')], now)).toEqual({
      activate: [{ parameterCode: 'co', unit: '%', activatedAt: now }],
      deactivateIds: [1],
    });
    expect(planAlertParameterActivations([activation()], [], now).deactivateIds).toEqual([1]);
  });

  it('deduplicates multiple normal devices for one parameter and unit', () => {
    expect(planAlertParameterActivations([], [co(), co()], now).activate).toHaveLength(1);
  });

  it('carries only currently registered old keys during an approved continuous point replacement', () => {
    const carry = [activation(), activation({ id: 2, parameterCode: 'so2' })];
    expect(planAlertParameterActivations([], [co(), registered('NOx (ppm)')], now, carry)).toEqual({
      activate: [
        { parameterCode: 'co', unit: 'ppm', activatedAt: previous },
        { parameterCode: 'nox', unit: 'ppm', activatedAt: now },
      ],
      deactivateIds: [],
    });
  });

  it('does not carry an old unit to a newly registered unit', () => {
    expect(
      planAlertParameterActivations([], [registered('CO (%)')], now, [activation()]).activate[0]
        .activatedAt,
    ).toBe(now);
  });

  it('rejects malformed baselines instead of silently counting a false history', () => {
    expect(() =>
      planAlertParameterActivations([activation({ activatedAt: 'invalid' })], [co()], now),
    ).toThrow();
  });

  it('retains a conservative future bound instead of guessing the old database time zone', () => {
    const future = '2027-01-01T00:00:00Z';
    expect(
      planAlertParameterActivations([], [co()], now, [activation({ activatedAt: future })])
        .activate[0].activatedAt,
    ).toBe(future);
  });
});
