import { describe, expect, it } from '@jest/globals';
import {
  buildExceedanceSnapshot,
  type ExceedancePointRow,
} from '../../src/modules/alert-exceedances/exceedance-metadata';
const row: ExceedancePointRow = {
  id: 1,
  point_code: 'S1',
  point_name: 'Stack',
  system_type: 'CEMS',
  point_type: 'STACK',
  connected_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  factory_id: 'factory',
  factory_name: 'โรงงาน',
  factory_registration_no: null,
  instruments_json: JSON.stringify({
    parameters: [
      {
        parameter: 'CO (ppm)',
        standardCriteria: { standardValue: 120 },
        eiaCriteria: { standardValue: '100' },
      },
      { parameter: 'CO (%)', standardCriteria: { standardValue: 1 } },
    ],
  }),
};
const channels = [
  { station_id: 'S1', data_type: 'CO (ppm)', config_updated_at: '2026-11-01T00:00:00Z' },
];
const activations = [
  {
    connected_point_id: 1,
    parameter_code: 'co',
    unit: 'ppm',
    activated_at: '2026-11-01T00:00:00Z',
  },
];
describe('detector current-configuration snapshot', () => {
  it('preserves criterion enablement from the live configuration', () => {
    const configured = {
      ...row,
      instruments_json: JSON.stringify({
        parameters: [
          {
            parameter: 'CO (ppm)',
            standardCriteria: { enabled: true, standardValue: 120 },
            eiaCriteria: { enabled: false, standardValue: 100 },
          },
        ],
      }),
    };
    expect(buildExceedanceSnapshot(configured, channels, activations).parameters[0]).toMatchObject({
      standardEnabled: true,
      eiaEnabled: false,
    });
  });
  it('intersects approved channels and verified activation without conflating units', () => {
    expect(buildExceedanceSnapshot(row, channels, activations).parameters).toEqual([
      { label: 'CO (ppm)', activatedAt: '2026-11-01T00:00:00.000Z', standard: 120, eia: '100' },
    ]);
    expect(buildExceedanceSnapshot(row, channels, []).parameters).toEqual([]);
  });
  it('rejects ambiguous channel or activation registrations rather than choosing the first', () => {
    expect(() => buildExceedanceSnapshot(row, [...channels, ...channels], activations)).toThrow(
      'Ambiguous',
    );
    expect(() => buildExceedanceSnapshot(row, channels, [...activations, ...activations])).toThrow(
      'Ambiguous',
    );
  });
  it('changes fingerprint when a criterion or a configuration revision changes', () => {
    const original = buildExceedanceSnapshot(row, channels, activations).fingerprint;
    expect(
      buildExceedanceSnapshot(
        { ...row, instruments_json: (row.instruments_json ?? '').replace('120', '130') },
        channels,
        activations,
      ).fingerprint,
    ).not.toBe(original);
    expect(
      buildExceedanceSnapshot(
        row,
        [{ ...channels[0], config_updated_at: '2026-11-02T00:00:00Z' }],
        activations,
      ).fingerprint,
    ).not.toBe(original);
    expect(
      buildExceedanceSnapshot(
        { ...row, factory_name: 'ชื่อใหม่', updated_at: '2026-11-03T00:00:00Z' },
        channels,
        activations,
      ).fingerprint,
    ).toBe(original);
  });
});
