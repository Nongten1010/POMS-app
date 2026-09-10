import { describe, it, expect } from '@jest/globals';
import {
  applyStatusManagementPatch,
  statusManagementDTO,
} from '../../src/modules/poms-factories/poms-status-management.state';
import {
  defaultFactoryStatus,
  type StatusSnapshot,
  type StatusSource,
} from '../../src/modules/poms-factories/poms-status-management.types';
const source: StatusSource = {
  eligibleFactoryId: 7,
  factoryId: 'F1',
  factoryName: 'Test',
  measurementPoints: [
    {
      connectedPointId: 11,
      pointCode: 'S0011',
      pointName: 'Boiler',
      systemType: 'CEMS',
      parameters: [
        { parameter: 'CO', displayName: 'CO (ppm)' },
        { parameter: 'CO2', displayName: 'CO2 (%)' },
      ],
    },
    {
      connectedPointId: 12,
      pointCode: 'W0012',
      pointName: 'Water',
      systemType: 'WPMS',
      parameters: [{ parameter: 'BOD', displayName: 'BOD (mg/L)' }],
    },
  ],
};
const initial = (): StatusSnapshot => ({
  state: defaultFactoryStatus(),
  revision: 0,
  updatedBy: null,
  updatedAt: null,
});
describe('Persistent hierarchy of display and connection statuses', () => {
  it('defaults current connected factories to visible/connected with labels including units', () => {
    const dto = statusManagementDTO(source, initial());
    expect(dto.factory).toMatchObject({ visibility: 'VISIBLE', connectionStatus: 'CONNECTED' });
    expect(dto.measurementPoints[0]!.parameters[0]).toEqual({
      parameter: 'CO',
      displayName: 'CO (ppm)',
      visibility: 'VISIBLE',
      effectiveVisibility: 'VISIBLE',
    });
  });
  it('hides the factory without overwriting point/parameter preferences and restores inheritance', () => {
    const state = applyStatusManagementPatch(source, initial(), {
      expectedRevision: 0,
      factory: { visibility: 'HIDDEN' },
      measurementPoints: [
        { connectedPointId: 11, parameters: [{ parameter: 'CO', visibility: 'HIDDEN' }] },
        { connectedPointId: 12, visibility: 'HIDDEN' },
      ],
    });
    const current = { ...initial(), state, revision: 1 };
    expect(
      statusManagementDTO(source, current).measurementPoints.every(
        (p) => p.effectiveVisibility === 'HIDDEN',
      ),
    ).toBe(true);
    const restored = applyStatusManagementPatch(source, current, {
      expectedRevision: 1,
      factory: { visibility: 'VISIBLE' },
    });
    const dto = statusManagementDTO(source, { ...current, state: restored });
    expect(dto.measurementPoints[0]!.effectiveVisibility).toBe('VISIBLE');
    expect(dto.measurementPoints[0]!.parameters[0]!.effectiveVisibility).toBe('HIDDEN');
    expect(dto.measurementPoints[0]!.parameters[1]!.effectiveVisibility).toBe('VISIBLE');
    expect(dto.measurementPoints[1]!.effectiveVisibility).toBe('HIDDEN');
  });
  it('disconnects a whole factory without deleting points, parameters, or overriding point states', () => {
    const state = applyStatusManagementPatch(source, initial(), {
      expectedRevision: 0,
      factory: { connectionStatus: 'DISCONNECTED' },
      measurementPoints: [{ connectedPointId: 11, connectionStatus: 'DISCONNECTED' }],
    });
    const dto = statusManagementDTO(source, { ...initial(), state });
    expect(dto.measurementPoints).toHaveLength(2);
    expect(dto.measurementPoints.every((p) => p.effectiveConnectionStatus === 'DISCONNECTED')).toBe(
      true,
    );
    expect(dto.measurementPoints[1]!.connectionStatus).toBe('CONNECTED');
    expect(dto.measurementPoints[0]!.parameters).toHaveLength(2);
    expect(dto.factory.visibility).toBe('VISIBLE');
  });
  it('does not change the sibling when disconnecting one measurement point', () => {
    const state = applyStatusManagementPatch(source, initial(), {
      expectedRevision: 0,
      measurementPoints: [{ connectedPointId: 11, connectionStatus: 'DISCONNECTED' }],
    });
    const dto = statusManagementDTO(source, { ...initial(), state });
    expect(dto.measurementPoints[1]!.effectiveConnectionStatus).toBe('CONNECTED');
    expect(dto.factory.connectionStatus).toBe('CONNECTED');
  });
  it('rejects stale revisions before applying changes', () => {
    expect(() =>
      applyStatusManagementPatch(
        source,
        { ...initial(), revision: 4 },
        { expectedRevision: 3, factory: { visibility: 'HIDDEN' } },
      ),
    ).toThrow('Status has changed');
  });
  it.each([
    { connectedPointId: 999, visibility: 'HIDDEN' as const },
    { connectedPointId: 11, parameters: [{ parameter: 'BOD', visibility: 'HIDDEN' as const }] },
  ])(
    'rejects a foreign point/parameter without mutating any part of the original state',
    (point) => {
      const current = initial();
      expect(() =>
        applyStatusManagementPatch(source, current, {
          expectedRevision: 0,
          factory: { visibility: 'HIDDEN' },
          measurementPoints: [point],
        }),
      ).toThrow();
      expect(current).toEqual(initial());
    },
  );
  it('keeps new points under the saved factory settings', () => {
    const state = defaultFactoryStatus();
    state.factory.visibility = 'HIDDEN';
    expect(
      statusManagementDTO(source, { ...initial(), state }).measurementPoints[1]!
        .effectiveVisibility,
    ).toBe('HIDDEN');
  });
  it('treats parameter identifiers as data, including object prototype names', () => {
    const unusual = structuredClone(source);
    unusual.measurementPoints[0]!.parameters = [
      { parameter: '__proto__', displayName: 'Test (ppm)' },
    ];
    const state = applyStatusManagementPatch(unusual, initial(), {
      expectedRevision: 0,
      measurementPoints: [
        { connectedPointId: 11, parameters: [{ parameter: '__proto__', visibility: 'HIDDEN' }] },
      ],
    });
    expect(
      statusManagementDTO(unusual, { ...initial(), state }).measurementPoints[0]!.parameters[0]!
        .visibility,
    ).toBe('HIDDEN');
    expect(({} as Record<string, unknown>).visibility).toBeUndefined();
  });
});
