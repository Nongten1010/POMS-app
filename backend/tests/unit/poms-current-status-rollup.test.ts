import { describe, expect, it, jest } from '@jest/globals';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

let mockRows: Record<string, unknown>[] = [];
jest.mock('../../src/config/database', () => ({
  db: () => {
    const query = {
      select: () => query,
      whereNull: () => query,
      whereRaw: () => query,
      where: () => query,
      orderBy: () => query,
      as: () => query,
      then: (resolve: (rows: Record<string, unknown>[]) => unknown) =>
        Promise.resolve(mockRows).then(resolve),
    };
    return query;
  },
}));

describe('current POMS point reads share the factory visibility rollup', () => {
  it.each([
    'listConnectedMeasurementPointsForFactories',
    'listPublicConnectedMeasurementPointsForFactories',
  ] as const)(
    '%s derives from complete current children and keeps factories separate',
    async (method) => {
      const state = JSON.stringify({
        factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
        measurementPoints: {
          '11': {
            visibility: 'VISIBLE',
            connectionStatus: 'CONNECTED',
            parameters: { CO: 'HIDDEN' },
          },
        },
      });
      const point = (id: number, eligible: number, factory: string, stateJson: string | null) => ({
        id,
        eligible_factory_id: eligible,
        factory_id: factory,
        parameters_json: '["CO"]',
        management_state_json: stateJson,
        point_name: `P${id}`,
        point_code: `P${id}`,
        system_type: 'CEMS',
        source_measurement_point_id: id,
        source_request_id: 1,
        monitoring_point_status: 'เชื่อมต่อครบแล้ว',
      });
      mockRows = [point(11, 7, 'F1', state), point(21, 8, 'F2', null)];
      let result = await connectionRequestsRepository[method](['F1', 'F2']);
      expect(result.map((row) => [row.status, row.factoryStatus])).toEqual([
        ['ซ่อน', 'ซ่อน'],
        ['แสดง', 'แสดง'],
      ]);
      // A current sibling without a saved override must still participate in the rollup.
      mockRows.push(point(12, 7, 'F1', state));
      result = await connectionRequestsRepository[method](['F1', 'F2']);
      expect(result.map((row) => [row.status, row.factoryStatus])).toEqual([
        ['ซ่อน', 'แสดง'],
        ['แสดง', 'แสดง'],
        ['แสดง', 'แสดง'],
      ]);
      expect(result[0]?.monitoringPointStatus).toBe('เชื่อมต่อครบแล้ว');
    },
  );
});
