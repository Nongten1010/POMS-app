import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { eligibleFactoriesService } from '../../src/modules/eligible-factories/eligible-factories.service';
import type { SelectedEligibleFactoryDTO } from '../../src/modules/eligible-factories/eligible-factories.types';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

let states = new Map<number, string>();
let pointQueries: unknown[][];
let factories: SelectedEligibleFactoryDTO[];

beforeEach(() => {
  states = new Map();
  pointQueries = [];
  factories = [
    selectedEligibleFactory({
      id: 7,
      factoryId: '10700000525488',
      factoryRegistrationNo: '3-88(2)-5/48รบ',
    }),
  ];
  jest
    .spyOn(eligibleFactoriesService, 'list')
    .mockImplementation(async () => ({ data: factories, meta: { total: factories.length } }));
  jest
    .spyOn(connectionRequestsRepository, 'listOfficerNotificationEmailsForFactories')
    .mockResolvedValue(new Map());
  // Run the real query builders and mappers; replace only the database I/O.
  jest.spyOn(db.client, 'runner').mockImplementation((value: unknown) => ({
    run: async () => {
      const query = (value as Knex.QueryBuilder).toSQL();
      if (query.sql.includes('from [cems_wpms_connected_measurement_points] where')) {
        if (query.bindings.length > 2100) throw new Error('MSSQL parameter limit exceeded');
        pointQueries.push([...query.bindings]);
        return factories
          .filter((f) => query.bindings.includes(f.id) || query.bindings.includes(f.factoryId))
          .map((f) => ({
            ...connectedFactoryRow(),
            id: 15,
            eligible_factory_id: f.id,
            factory_id: f.factoryId,
            source_request_id: 1,
            management_state_json: states.get(f.id) ?? null,
          }));
      }
      if (query.sql.includes('as [cp]')) {
        expect(query.sql).toContain('[fsm].[eligible_factory_id] = [cp].[eligible_factory_id]');
        return factories.map((f) =>
          connectedFactoryRow({
            eligible_factory_id: f.id,
            factory_id: f.factoryId,
            factory_registration_no_new: f.factoryId,
            management_state_json: states.get(f.id) ?? null,
          }),
        );
      }
      throw new Error(`Unexpected query: ${query.sql}`);
    },
  }));
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('saved factory status across master data and officer connection menus', () => {
  it.each([
    [null, 'แสดง'],
    [{ factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' } }, 'แสดง'],
    [{ factory: { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' } }, 'ซ่อน'],
    [
      { factory: { visibility: 'VISIBLE', connectionStatus: 'DISCONNECTED' } },
      'ยกเลิกการเชื่อมต่อ',
    ],
    [{ factory: { visibility: 'HIDDEN', connectionStatus: 'DISCONNECTED' } }, 'ยกเลิกการเชื่อมต่อ'],
    [
      {
        factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
        measurementPoints: { '15': { visibility: 'HIDDEN' } },
      },
      'ซ่อน',
    ],
  ])('returns the same saved status %j => %s', async (state, expected) => {
    if (state) states.set(7, JSON.stringify(state));
    const master = await pomsFactoriesService.listFactories(42, { scope: 'ALL' });
    const officer = await connectionRequestsService.listOfficerEligibleFactories(42, {
      scope: 'ALL',
    });
    expect(master.data).toHaveLength(1);
    expect(officer.data).toHaveLength(1);
    expect(master.data[0].status).toBe(expected);
    expect(officer.data[0].status).toBe(master.data[0].status);
    expect(officer.data[0].monitoringPointCount).toBe(1);
  });

  it('matches saved states by eligible id with mixed statuses and registration aliases', async () => {
    factories.push(
      selectedEligibleFactory({
        id: 8,
        factoryId: 'different-factory',
        factoryRegistrationNo: '10700000525488',
      }),
    );
    states.set(
      7,
      JSON.stringify({ factory: { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' } }),
    );
    states.set(
      8,
      JSON.stringify({ factory: { visibility: 'VISIBLE', connectionStatus: 'DISCONNECTED' } }),
    );
    states.set(99, JSON.stringify({ factory: { visibility: 'HIDDEN' } }));
    const result = await connectionRequestsService.listOfficerEligibleFactories(42, {
      scope: 'ALL',
    });
    expect(result.data.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 7, status: 'ซ่อน' },
      { id: 8, status: 'ยกเลิกการเชื่อมต่อ' },
    ]);
    expect(pointQueries.flat()).toEqual(expect.arrayContaining([7, 8]));
    expect(pointQueries.flat()).not.toContain(99);
  });

  it('loads a large eligible list without exceeding the MSSQL parameter limit', async () => {
    factories = Array.from({ length: 2101 }, (_, index) =>
      selectedEligibleFactory({
        id: index + 1,
        factoryId: `new-${index}`,
        factoryRegistrationNo: `old-${index}`,
      }),
    );
    const result = await connectionRequestsService.listOfficerEligibleFactories(42, {
      scope: 'ALL',
    });
    expect(result.data).toHaveLength(2101);
    expect(pointQueries.map((bindings) => bindings.length)).toEqual([1000, 1000, 101]);
  });

  it('does not query connected points when the accessible list is empty', async () => {
    factories = [];
    expect(
      await connectionRequestsService.listOfficerEligibleFactories(42, { scope: 'ALL' }),
    ).toEqual({ data: [], meta: { total: 0 } });
    expect(pointQueries).toEqual([]);
  });

  it('publishes the eligible list response schema and all factory display statuses', () => {
    const doc = JSON.parse(JSON.stringify(pomsOpenApiDocument));
    expect(
      doc.paths['/cems-wpms-requests/eligible-factories'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/OperatorFactoryTableResponse' });
    expect(doc.components.schemas.OperatorFactoryTableRow.properties.status.enum).toEqual([
      'แสดง',
      'ซ่อน',
      'ยกเลิกการเชื่อมต่อ',
    ]);
  });
});
function selectedEligibleFactory(
  overrides: Partial<SelectedEligibleFactoryDTO> = {},
): SelectedEligibleFactoryDTO {
  return {
    id: 7,
    monitoringPointFormId: 3,
    factoryId: '3-88(2)-5/49อบ',
    factoryName: 'โรงงานเข้าข่ายจากระบบเดิม จำกัด',
    factoryRegistrationNo: '3-88(2)-5/49อบ',
    factoryClass: '8802',
    factorySubclass: '0001',
    address: '88 หมู่ 2',
    provinceName: 'ชลบุรี',
    industrialEstateName: null,
    longitude: 100.7002,
    latitude: 13.5001,
    businessActivity: 'ผลิตพลังงานไฟฟ้า',
    operationStatus: 'ประกอบกิจการ',
    capitalAmount: null,
    machineryHorsepower: null,
    productionCapacity: '10 เมกะวัตต์',
    wastewaterDischargeInfo: null,
    boilerCount: null,
    boilerSizeEach: null,
    fuelUsed: null,
    hasEia: false,
    cemsConnectionStatusSummary: 'ยังไม่แล้วเสร็จ',
    wpmsConnectionStatusSummary: 'ยังไม่แล้วเสร็จ',
    measurementPoints: [],
    ...overrides,
  };
}

function connectedFactoryRow(overrides: Record<string, unknown> = {}) {
  return {
    connected_point_id: 15,
    source_measurement_point_id: 2,
    eligible_factory_id: 7,
    factory_id: 'factory-001',
    factory_name: 'บริษัท ทดสอบ จำกัด',
    factory_registration_no: 'POMS-REG-001',
    factory_address: '99 หมู่ 1',
    factory_latitude: 12.7,
    factory_longitude: 101.1,
    factory_eia_assessment: 'มี EIA' as const,
    factory_eia_other: null,
    factory_project_name: 'โครงการเดิม',
    factory_front_photos_json: null,
    factory_logo_json: null,
    province_name: 'ระยอง',
    industrial_estate_name: null,
    factory_registration_no_new: '3-106-33/50สบ',
    factory_registration_no_old: '3-106-33/49สบ',
    business_activity: 'ผลิตเคมีภัณฑ์',
    factory_type_sequence: '42 / 4201',
    system_type: 'CEMS' as const,
    point_name: 'ปล่อง A',
    point_code: 'S0001',
    point_type: 'STACK' as const,
    parameters_json: '["CO"]',
    monitoring_point_status: 'เชื่อมต่อครบแล้ว' as const,
    details_json: null,
    documents_json: null,
    instruments_json: null,
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}
