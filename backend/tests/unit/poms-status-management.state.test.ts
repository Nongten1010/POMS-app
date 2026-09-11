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
  it('rolls visibility up across multiple parameters and points, including one remaining visible child', () => {
    let snapshot = initial();
    const save = (
      measurementPoints: Parameters<typeof applyStatusManagementPatch>[2]['measurementPoints'],
    ) => {
      snapshot = {
        ...snapshot,
        state: applyStatusManagementPatch(source, snapshot, {
          expectedRevision: snapshot.revision,
          measurementPoints,
        }),
        revision: snapshot.revision + 1,
      };
      return statusManagementDTO(source, snapshot);
    };
    let dto = save([
      { connectedPointId: 11, parameters: [{ parameter: 'CO', visibility: 'HIDDEN' }] },
    ]);
    expect(dto.measurementPoints[0]?.status).toBe('แสดง');
    dto = save([
      { connectedPointId: 11, parameters: [{ parameter: 'CO2', visibility: 'HIDDEN' }] },
    ]);
    expect(dto.measurementPoints[0]?.status).toBe('ซ่อน');
    expect(dto.factory.status).toBe('แสดง');
    dto = save([{ connectedPointId: 12, visibility: 'HIDDEN' }]);
    expect(dto.factory.status).toBe('ซ่อน');
    dto = save([
      { connectedPointId: 11, parameters: [{ parameter: 'CO2', visibility: 'VISIBLE' }] },
    ]);
    expect(dto.factory.status).toBe('แสดง');
    expect(dto.measurementPoints.map((point) => point.status)).toEqual(['แสดง', 'ซ่อน']);
    expect(dto.measurementPoints[0]?.parameters.map((parameter) => parameter.visibility)).toEqual([
      'HIDDEN',
      'VISIBLE',
    ]);
  });
  it('applies explicit child changes after a parent command in the same PATCH', () => {
    const state = applyStatusManagementPatch(source, initial(), {
      expectedRevision: 0,
      factory: { visibility: 'HIDDEN' },
      measurementPoints: [
        { connectedPointId: 11, parameters: [{ parameter: 'CO', visibility: 'VISIBLE' }] },
      ],
    });
    const dto = statusManagementDTO(source, { ...initial(), state });
    expect(dto.factory.status).toBe('แสดง');
    expect(dto.measurementPoints.map((point) => point.status)).toEqual(['แสดง', 'ซ่อน']);
  });
  it('keeps disconnect independent when parameters reopen and excludes disconnected children from factory visibility', () => {
    let state = applyStatusManagementPatch(source, initial(), {
      expectedRevision: 0,
      factory: { visibility: 'HIDDEN' },
      measurementPoints: [{ connectedPointId: 11, connectionStatus: 'DISCONNECTED' }],
    });
    state = applyStatusManagementPatch(
      source,
      { ...initial(), state },
      {
        expectedRevision: 0,
        measurementPoints: [
          { connectedPointId: 11, parameters: [{ parameter: 'CO', visibility: 'VISIBLE' }] },
        ],
      },
    );
    let dto = statusManagementDTO(source, { ...initial(), state });
    expect(dto.measurementPoints[0]?.status).toBe('ยกเลิกการเชื่อมต่อ');
    expect(dto.factory.status).toBe('ซ่อน');
    state = applyStatusManagementPatch(
      source,
      { ...initial(), state },
      {
        expectedRevision: 0,
        measurementPoints: [{ connectedPointId: 11, connectionStatus: 'CONNECTED' }],
      },
    );
    dto = statusManagementDTO(source, { ...initial(), state });
    expect(dto.factory.status).toBe('แสดง');
    expect(dto.measurementPoints[0]?.status).toBe('แสดง');
  });
  it('retains explicit visibility for an empty point and for a factory without connected children', () => {
    const empty = {
      ...source,
      measurementPoints: [{ ...source.measurementPoints[0]!, parameters: [] }],
    };
    const state = applyStatusManagementPatch(empty, initial(), {
      expectedRevision: 0,
      measurementPoints: [
        { connectedPointId: 11, visibility: 'HIDDEN', connectionStatus: 'DISCONNECTED' },
      ],
    });
    const dto = statusManagementDTO(empty, { ...initial(), state });
    expect(dto.factory).toMatchObject({ status: 'แสดง', connectionStatus: 'CONNECTED' });
    expect(dto.measurementPoints[0]).toMatchObject({
      status: 'ยกเลิกการเชื่อมต่อ',
      visibility: 'HIDDEN',
      parameters: [],
    });
    expect(
      statusManagementDTO({ ...source, measurementPoints: [] }, initial()).factory.status,
    ).toBe('แสดง');
  });
  it('cascades factory visibility to all current descendants on hide and show', () => {
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
    expect(dto.measurementPoints[0]!.parameters[0]!.effectiveVisibility).toBe('VISIBLE');
    expect(dto.measurementPoints[0]!.parameters[1]!.effectiveVisibility).toBe('VISIBLE');
    expect(dto.measurementPoints[1]!.effectiveVisibility).toBe('VISIBLE');
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
