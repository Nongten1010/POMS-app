import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
import { planApprovedParameterRepair } from '../../src/modules/poms-factories/poms-approved-parameter-repair';
import type { PomsMeasurementPointDTO } from '../../src/modules/poms-factories/poms-factories.types';

function fixture() {
  const before: PomsMeasurementPointDTO = {
    connectedPointId: 15,
    sourceMeasurementPointId: 2,
    eligibleFactoryId: 7,
    factoryId: '10100000125241',
    factoryName: 'Test factory',
    systemType: 'WPMS',
    pointName: 'P0260',
    pointCode: 'P0260',
    pointType: 'WASTEWATER',
    parameters: ['BOD (mg/l)', 'COD (mg/l)', 'Watt (kW/hr)'],
    monitoringPointStatus: null,
    details: null,
    documentsAndImages: [],
    measurementInstruments: null,
    updatedAt: '2026-09-06T00:00:00.000Z',
  };
  const after = ['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)'];
  const proposed = { ...before, details: { requestedParameters: after } };
  const live = {
    id: 15,
    eligible_factory_id: 7,
    parameters_json: JSON.stringify(before.parameters),
    point_name: 'P0260',
    monitoring_point_status: null,
    details_json: JSON.stringify(proposed.details),
    documents_json: null,
    instruments_json: null,
    updated_at: new Date('2026-09-07T00:00:00.001Z'),
  };
  return { before, proposed, live, after, approvedAt: '2026-09-07T00:00:00.002Z' };
}

describe('guarded approved parameter repair', () => {
  it('plans only the omitted parameter write when live data matches the approved proposal', () => {
    const f = fixture();
    expect(planApprovedParameterRepair(f.before, f.proposed, f.live, f.approvedAt)).toEqual({
      stationId: 'P0260',
      before: f.before.parameters,
      after: f.after,
      patch: { parameters_json: JSON.stringify(f.after), instruments_json: null },
    });
  });
  it('is a no-op when already repaired', () => {
    const f = fixture();
    expect(
      planApprovedParameterRepair(
        f.before,
        f.proposed,
        { ...f.live, parameters_json: JSON.stringify(f.after) },
        f.approvedAt,
      ),
    ).toBeNull();
  });
  it.each([
    { id: 99 },
    { parameters_json: '["different"]' },
    { details_json: '{"requestedParameters":["different"]}' },
    { updated_at: new Date('2026-09-07T00:00:00.003Z') },
  ])('refuses unexpected live state %j', (change) => {
    const f = fixture();
    expect(() =>
      planApprovedParameterRepair(f.before, f.proposed, { ...f.live, ...change }, f.approvedAt),
    ).toThrow();
  });
});
