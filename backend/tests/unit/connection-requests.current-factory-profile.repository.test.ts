import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

type Row = Record<string, unknown>;
const mockedDb = db as unknown as { transaction: jest.Mock };
const previousMode = env.FACTORY_PROFILE_MODE;
const CONNECTED = 'cems_wpms_connected_measurement_points';
const POINTS = 'cems_wpms_measurement_points';
const REGISTRY = 'cems_wpms_point_code_registry';

// Exercise the real repository with persisted rows; this adapter models query
// operations only and does not decide which factory profile is authoritative.
function fixtureDatabase(connectedRows: Row[], canonical = false) {
  const tables: Record<string, Row[]> = {
    eligible_factories: [
      {
        id: 17,
        source_factory_id: 'FID-17',
        factory_registration_no_new: 'REG-17',
        factory_registration_no_old: null,
        latitude: 14,
        longitude: 101,
        eia_assessment: 'ไม่มี',
        eia_other: null,
        has_eia: false,
        project_name: 'โครงการอนุมัติล่าสุด',
      },
    ],
    [CONNECTED]: structuredClone(connectedRows),
    [REGISTRY]: [],
    device_connection_configs: [],
  };
  if (canonical) {
    env.FACTORY_PROFILE_MODE = 'canonical';
    const current = currentPoint();
    tables.factory_profiles = [
      {
        id: 501,
        eligible_factory_id: 17,
        revision: 3,
        factory_name: current.factory_name,
        address: current.factory_address,
        province_name: 'นนทบุรี',
        industrial_estate_name: null,
        latitude: 14,
        longitude: 101,
        eia_assessment: 'ไม่มี',
        eia_other: null,
        has_eia: false,
        project_name: current.factory_project_name,
        business_activity: null,
        factory_type_sequence: null,
        front_photos_json: null,
        logo_json: null,
        updated_at: 'current-time',
      },
    ];
    tables.factory_profile_events = [];
    tables.cems_wpms_connection_requests = [
      {
        id: 3,
        source_factory_profile_revision: 3,
        connection_due_at: null,
        confirmed_at: null,
        verified_at: null,
        created_at: '2026-09-11T00:00:00.000Z',
      },
    ];
    tables.cems_wpms_measurement_points = [];
    tables.cems_wpms_request_factory_snapshots = [];
    tables.cems_wpms_request_status_history = [];
  }
  const locks: string[] = [];
  const beforeRegistryDelete = jest.fn<() => void>();
  const trx = Object.assign(
    (queryTable: string) => {
      const table =
        queryTable === 'current_eligible_factories as ef' ? 'eligible_factories' : queryTable;
      if (!tables[table]) throw new Error(`Unexpected table ${table}`);
      const predicates: Array<(row: Row) => boolean> = [];
      let columns: string[] = [];
      let counted = false;
      let ordering: [string, string] | undefined;
      const rows = (): Row[] => {
        const sourceRows =
          queryTable === 'current_eligible_factories as ef'
            ? tables[table].map((row) => ({
                ...row,
                ...tables.factory_profiles.find(
                  (profile) => profile.eligible_factory_id === row.id,
                ),
                id: row.id,
              }))
            : tables[table];
        const matches = sourceRows.filter((row) => predicates.every((predicate) => predicate(row)));
        if (ordering) {
          const [column, direction] = ordering;
          matches.sort(
            (a, b) => (Number(a[column]) - Number(b[column])) * (direction === 'desc' ? -1 : 1),
          );
        }
        return matches;
      };
      const project = (row: Row | undefined) =>
        row &&
        (columns.length > 0
          ? Object.fromEntries(
              columns.map((column) => {
                const [source, alias] = column.split(' as ');
                const key = source.split('.').at(-1) ?? source;
                return [alias ?? key, row[key]];
              }),
            )
          : { ...row });
      const builder = {
        where(column: string | ((query: unknown) => void), value?: unknown) {
          if (typeof column === 'string') {
            predicates.push((row) => row[column.split('.').at(-1) ?? column] === value);
          } else {
            const alternatives: Array<Array<(row: Row) => boolean>> = [[]];
            const add = (predicate: (row: Row) => boolean, or = false) => {
              if (or) alternatives.push([]);
              alternatives.at(-1)?.push(predicate);
              return group;
            };
            const compare = (field: string, operatorOrValue: unknown, operand?: unknown) => {
              const key = field.split('.').at(-1) ?? field;
              if (operand === undefined) return (row: Row) => row[key] === operatorOrValue;
              if (operatorOrValue !== 'like') throw new Error('Unsupported fixture operator');
              const parts = String(operand).split('%');
              return (row: Row) =>
                typeof row[key] === 'string' &&
                row[key].startsWith(parts[0]) &&
                row[key].endsWith(parts.at(-1) ?? '');
            };
            const group = {
              where(field: string, operatorOrValue: unknown, operand?: unknown) {
                return add(compare(field, operatorOrValue, operand));
              },
              orWhere(field: string, operatorOrValue: unknown, operand?: unknown) {
                return add(compare(field, operatorOrValue, operand), true);
              },
              whereNull(field: string) {
                return add((row) => row[field.split('.').at(-1) ?? field] == null);
              },
              whereIn(field: string, values: unknown[]) {
                return add((row) => values.includes(row[field.split('.').at(-1) ?? field]));
              },
              orWhereIn(field: string, values: unknown[]) {
                return add((row) => values.includes(row[field.split('.').at(-1) ?? field]), true);
              },
            };
            column(group);
            predicates.push((row) =>
              alternatives.some((alternative) => alternative.every((predicate) => predicate(row))),
            );
          }
          return builder;
        },
        whereNull(column: string) {
          predicates.push((row) => row[column.split('.').at(-1) ?? column] == null);
          return builder;
        },
        orderBy(column: string, direction = 'asc') {
          ordering = [column, direction];
          return builder;
        },
        leftJoin() {
          return builder;
        },
        whereRaw(sql: string, bindings: unknown[] = []) {
          if (sql === '1 = 0') predicates.push(() => false);
          const normalizedMatch = sql.match(/^UPPER\(LTRIM\(RTRIM\((\w+)\)\)\) = \?$/i);
          if (normalizedMatch) {
            predicates.push(
              (row) =>
                String(row[normalizedMatch[1]] ?? '')
                  .trim()
                  .toUpperCase() === bindings[0],
            );
          }
          return builder;
        },
        whereIn(column: string, values: unknown[]) {
          predicates.push((row) => values.includes(row[column.split('.').at(-1) ?? column]));
          return builder;
        },
        whereNotIn(column: string, values: unknown[]) {
          predicates.push((row) => !values.includes(row[column.split('.').at(-1) ?? column]));
          return builder;
        },
        async del() {
          const matched = rows();
          if (table === REGISTRY) {
            beforeRegistryDelete();
            for (const entry of matched) {
              if (
                tables[POINTS].some(
                  (point) =>
                    point.id === entry.source_measurement_point_id && point.deleted_at == null,
                )
              ) {
                throw new Error(
                  'Registry reservation cannot be removed while its source point is active',
                );
              }
            }
          }
          tables[table] = tables[table].filter((row) => !matched.includes(row));
          return matched.length;
        },
        count() {
          counted = true;
          return builder;
        },
        select(...selected: string[]) {
          columns = selected;
          return builder;
        },
        forUpdate() {
          locks.push(table);
          return builder;
        },
        async first(...selected: string[]) {
          if (selected.length) columns = selected;
          return counted ? { total: rows().length } : project(rows()[0]);
        },
        async update(patch: Row) {
          const matched = rows();
          for (const row of matched) Object.assign(row, patch);
          return matched.length;
        },
        insert(input: Row | Row[]) {
          const inputs = Array.isArray(input) ? input : [input];
          if (table === REGISTRY) {
            const codes = new Set(tables[table].map((row) => row.normalized_point_code));
            for (const row of inputs) {
              if (codes.has(row.normalized_point_code)) {
                throw Object.assign(new Error('uq_cems_wpms_point_code_registry_normalized'), {
                  number: 2627,
                });
              }
              codes.add(row.normalized_point_code);
            }
          }
          const inserted = (Array.isArray(input) ? input : [input]).map((row, index) => ({
            id: 900 + tables[table].length + index,
            connection_due_at: null,
            confirmed_at: null,
            verified_at: null,
            created_at: '2026-09-11T00:00:00.000Z',
            updated_at: '2026-09-11T00:00:00.000Z',
            changed_at: '2026-09-11T00:00:00.000Z',
            ...row,
          }));
          tables[table].push(...inserted);
          return {
            returning: async () => inserted.map((row) => ({ id: row.id })),
            then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
              return Promise.resolve(inserted.length).then(resolve, reject);
            },
          };
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(rows().map(project)).then(resolve, reject);
        },
      };
      return builder;
    },
    {
      fn: { now: () => '2026-09-11T00:00:00.000Z' },
      async raw(sql: string, [requestId, actorUserId]: unknown[]) {
        if (!sql.includes('ranked_points')) throw new Error('Unsupported fixture raw query');
        const points = tables[POINTS].filter(
          (row) => row.request_id === requestId && row.deleted_at == null,
        ).sort(
          (a, b) => Number(!a.point_code) - Number(!b.point_code) || Number(a.id) - Number(b.id),
        );
        const names = new Set<string>();
        for (const point of points) {
          const name = String(point.point_name).trim().toLowerCase();
          if (names.has(name)) {
            Object.assign(point, {
              deleted_at: '2026-09-11T00:00:00.000Z',
              updated_by: actorUserId,
            });
          }
          names.add(name);
        }
      },
    },
  );
  mockedDb.transaction.mockImplementation(async (callback: unknown) => {
    const before = structuredClone(tables);
    try {
      return await (callback as (trx: unknown) => Promise<unknown>)(trx);
    } catch (error) {
      for (const table of Object.keys(tables)) delete tables[table];
      Object.assign(tables, before);
      throw error;
    }
  });
  return { tables, locks, beforeRegistryDelete };
}

function currentPoint(): Row {
  return {
    id: 20,
    eligible_factory_id: 17,
    factory_id: 'FID-17',
    factory_registration_no: 'REG-17',
    factory_name: 'ชื่อที่อนุมัติล่าสุด',
    factory_address: 'ที่อยู่ที่อนุมัติล่าสุด',
    factory_latitude: 14,
    factory_longitude: 101,
    factory_eia_assessment: 'ไม่มี',
    factory_eia_other: null,
    factory_has_eia: false,
    factory_project_name: 'โครงการอนุมัติล่าสุด',
    factory_front_photos_json: null,
    factory_logo_json: null,
    source_request_id: 55,
    source_measurement_point_id: 51,
    point_code: 'P0017',
    parameters_json: '["BOD"]',
    deleted_at: null,
  };
}

function oldRequest(requestType: string, pointCode = 'P0018') {
  return {
    id: 3,
    eligibleFactoryId: 17,
    factoryId: 'FID-17',
    factoryRegistrationNo: 'REG-17',
    factoryName: 'ชื่อเก่าจากคำขอ',
    address: 'ที่อยู่เก่าจากคำขอ',
    provinceName: 'จังหวัดเก่า',
    latitude: 10,
    longitude: 99,
    eia: 'มี EIA',
    projectName: 'โครงการเก่าจากคำขอ',
    requestType,
    systemType: 'WPMS',
    verifiedAt: '2026-09-11T00:00:00.000Z',
    measurementPoints: [
      {
        id: 18,
        pointName: 'จุดใหม่',
        pointCode,
        pointType: 'EXIT',
        parameters: ['BOD', 'COD'],
        documentsAndImages: [
          { title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท', fileUrl: '/old-logo.png' },
        ],
      },
    ],
  };
}

function expectCurrentGeneral(actual: Row) {
  const current = currentPoint();
  for (const field of [
    'factory_name',
    'factory_address',
    'factory_latitude',
    'factory_longitude',
    'factory_eia_assessment',
    'factory_eia_other',
    'factory_has_eia',
    'factory_project_name',
    'factory_front_photos_json',
    'factory_logo_json',
  ]) {
    expect({ [field]: actual[field] }).toEqual({ [field]: current[field] });
  }
}

function resubmissionFixture() {
  const fixture = fixtureDatabase([], true);
  Object.assign(fixture.tables.cems_wpms_connection_requests[0], {
    id: 10037,
    status: 'WAITING_FACTORY_REVISION',
    updated_at: '2026-09-13T00:00:00.000Z',
    system_type: 'CEMS',
    factory_id: 'FID-17',
    factory_registration_no: 'REG-17',
    created_by: 99,
  });
  fixture.tables[POINTS].push({
    id: 10041,
    request_id: 10037,
    point_name: 'ปล่องเดิม',
    point_code: 'S0527',
    point_code_assignment_mode: 'OFFICER_DIRECT',
    parameters_json: '[]',
    deleted_at: null,
  });
  fixture.tables[REGISTRY].push({
    id: 17,
    point_code: 'S0527',
    normalized_point_code: 'S0527',
    assignment_mode: 'OFFICER_DIRECT',
    source_request_id: 10037,
    source_measurement_point_id: 10041,
  });
  const input = {
    ...oldRequest('NEW_CONNECTION'),
    systemType: 'CEMS',
    contactName: 'ผู้ประสานงาน',
    contactPhone: '0812345678',
    measurementPoints: [{ pointName: 'ปล่องเดิม', pointType: 'STACK', parameters: [] }],
  };
  const resubmit = () =>
    connectionRequestsRepository.replaceForm(
      10037,
      input as never,
      7,
      'REVISED_PENDING_DESIGN_REVIEW',
      { actorUserId: 7, scope: 'ALL', expectedUpdatedAt: '2026-09-13T00:00:00.000Z' },
    );
  return { ...fixture, input, resubmit };
}

describe('connection profile persistence with a stale submitted factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.FACTORY_PROFILE_MODE = 'legacy';
  });
  afterEach(() => {
    env.FACTORY_PROFILE_MODE = previousMode;
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'ADD_PARAMETER retains existing parameters and instruments (canonical: %s, full list: %s)',
    async (canonical, fullList) => {
      const oldParameter = 'Flow Rate (m3/hr)';
      const oldInstrument = {
        parameter: oldParameter,
        brand: 'Existing brand',
        range: '0-100',
        standardCriteria: { max: 100 },
      };
      const added = ['NOx (ppm)', 'SO2 (ppm)', 'O2 (%)'];
      const fixture = fixtureDatabase(
        [
          {
            ...currentPoint(),
            point_code: 'S0017',
            system_type: 'CEMS',
            parameters_json: JSON.stringify([oldParameter]),
            instruments_json: JSON.stringify({
              converterBrand: 'Existing converter',
              parameters: [oldInstrument],
            }),
          },
        ],
        canonical,
      );
      const request = oldRequest('ADD_PARAMETER', 'P0017');
      request.systemType = 'CEMS';
      request.measurementPoints[0].pointCode = 'S0017';
      request.measurementPoints[0].pointType = 'STACK';
      request.measurementPoints[0].parameters = fullList ? [oldParameter, ...added] : added;
      Object.assign(request.measurementPoints[0], {
        measurementInstruments: {
          parameters: added.map((parameter) => ({ parameter, brand: 'New brand' })),
        },
      });
      const snapshot = structuredClone(request);
      // Replaying the same sync must not duplicate parameters or instruments.
      for (let attempt = 0; attempt < 2; attempt++) {
        await connectionRequestsRepository.syncConnectedMeasurementPoints(request as never, 7);
        const active = fixture.tables[CONNECTED].filter((row) => row.deleted_at == null);
        expect(active).toHaveLength(1);
        expect(JSON.parse(String(active[0].parameters_json))).toEqual([oldParameter, ...added]);
        expect(JSON.parse(String(active[0].instruments_json))).toEqual({
          converterBrand: 'Existing converter',
          parameters: [
            oldInstrument,
            ...added.map((parameter) => ({ parameter, brand: 'New brand' })),
          ],
        });
      }
      expect(request).toEqual(snapshot);
    },
  );

  it.each([undefined, null, { parameters: [] }])(
    'ADD_PARAMETER keeps old instruments when incoming instruments are %j',
    async (measurementInstruments) => {
      const instruments = { parameters: [{ parameter: 'BOD (mg/l)', brand: 'Existing brand' }] };
      const fixture = fixtureDatabase([
        {
          ...currentPoint(),
          parameters_json: '["BOD (mg/l)"]',
          instruments_json: JSON.stringify(instruments),
        },
      ]);
      const request = oldRequest('ADD_PARAMETER', 'P0017');
      request.measurementPoints[0].parameters = ['COD (mg/l)'];
      Object.assign(request.measurementPoints[0], { measurementInstruments });
      await connectionRequestsRepository.syncConnectedMeasurementPoints(request as never, 7);
      const active = fixture.tables[CONNECTED].find((row) => row.deleted_at == null)!;
      expect(JSON.parse(String(active.parameters_json))).toEqual(['BOD (mg/l)', 'COD (mg/l)']);
      expect(JSON.parse(String(active.instruments_json))).toEqual(instruments);
    },
  );

  it('ADD_PARAMETER merges repeated labels and instrument fields without reviving removed instruments', async () => {
    const fixture = fixtureDatabase([
      {
        ...currentPoint(),
        parameters_json: '["BOD (mg/l)"]',
        instruments_json: JSON.stringify({
          parameters: [
            { parameter: 'BOD (mg/l)', brand: 'Existing brand', range: '0-100' },
            { parameter: 'Watt (kW/hr)', brand: 'Retired' },
          ],
        }),
      },
    ]);
    const request = oldRequest('ADD_PARAMETER', 'P0017');
    request.measurementPoints[0].parameters = [' bod (mg/l) ', 'COD (mg/l)'];
    Object.assign(request.measurementPoints[0], {
      measurementInstruments: {
        parameters: [
          { parameter: ' bod (mg/l) ', range: null },
          { parameter: 'COD (mg/l)' },
          { parameter: 'BOD (ppm)' },
        ],
      },
    });
    await connectionRequestsRepository.syncConnectedMeasurementPoints(request as never, 7);
    const active = fixture.tables[CONNECTED].find((row) => row.deleted_at == null)!;
    expect(JSON.parse(String(active.parameters_json))).toEqual([
      'BOD (mg/l)',
      'COD (mg/l)',
      'BOD (ppm)',
    ]);
    expect(JSON.parse(String(active.instruments_json)).parameters).toEqual([
      { parameter: 'BOD (mg/l)', brand: 'Existing brand', range: null },
      { parameter: 'COD (mg/l)' },
      { parameter: 'BOD (ppm)' },
    ]);
  });

  it('retains replacement behavior for a non-ADD_PARAMETER request', async () => {
    const fixture = fixtureDatabase([currentPoint()]);
    const request = oldRequest('NEW_CONNECTION', 'P0017');
    request.measurementPoints[0].parameters = ['COD (mg/l)'];
    await connectionRequestsRepository.syncConnectedMeasurementPoints(request as never, 7);
    const active = fixture.tables[CONNECTED].find((row) => row.deleted_at == null)!;
    expect(JSON.parse(String(active.parameters_json))).toEqual(['COD (mg/l)']);
  });

  it.each(['ADD_MEASUREMENT_POINT', 'ADD_PARAMETER'])(
    '%s preserves approved general data in the existing point and eligible factory',
    async (requestType) => {
      const fixture = fixtureDatabase([currentPoint()]);
      const eligibleBefore = structuredClone(fixture.tables.eligible_factories[0]);
      await connectionRequestsRepository.syncConnectedMeasurementPoints(
        oldRequest(requestType, requestType === 'ADD_PARAMETER' ? 'P0017' : 'P0018') as never,
        7,
      );
      expectCurrentGeneral(fixture.tables[CONNECTED][0]);
      expect(fixture.tables.eligible_factories[0]).toEqual(eligibleBefore);
    },
  );

  it('creates the new point with current general data and explicit nulls without changing request history', async () => {
    const fixture = fixtureDatabase([currentPoint()]);
    const request = oldRequest('ADD_MEASUREMENT_POINT');
    const history = structuredClone(request);
    await connectionRequestsRepository.syncConnectedMeasurementPoints(request as never, 7);
    expectCurrentGeneral(fixture.tables[CONNECTED][1]);
    expect(fixture.tables[CONNECTED][1]).toMatchObject({
      source_request_id: 3,
      source_measurement_point_id: 18,
      factory_id: 'FID-17',
      point_code: 'P0018',
      parameters_json: '["BOD","COD"]',
    });
    expect(request).toEqual(history);
  });

  it('uses the locked canonical profile despite stale compatibility copies without advancing its revision', async () => {
    const fixture = fixtureDatabase(
      [{ ...currentPoint(), factory_name: 'ชื่อสำเนาเก่า', factory_latitude: 12 }],
      true,
    );
    const canonicalBefore = structuredClone(fixture.tables.factory_profiles[0]);
    await connectionRequestsRepository.syncConnectedMeasurementPoints(
      oldRequest('ADD_PARAMETER', 'P0017') as never,
      7,
    );
    expectCurrentGeneral(fixture.tables[CONNECTED][1]);
    expect(fixture.tables.factory_profiles[0]).toEqual(canonicalBefore);
    expect(fixture.tables.factory_profile_events).toEqual([]);
    expect(fixture.locks.indexOf('factory_profiles')).toBeLessThan(
      fixture.locks.indexOf(CONNECTED),
    );
  });

  it('fails before mutation when canonical profile backfill has not been completed', async () => {
    const fixture = fixtureDatabase([currentPoint()], true);
    fixture.tables.factory_profiles = [];
    const before = structuredClone(fixture.tables);
    await expect(
      connectionRequestsRepository.syncConnectedMeasurementPoints(
        oldRequest('ADD_PARAMETER', 'P0017') as never,
        7,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(fixture.tables).toEqual(before);
  });

  it.each(['create', 'resubmit'] as const)(
    'captures the canonical revision when operators %s a request',
    async (operation) => {
      const fixture = fixtureDatabase([], true);
      if (operation === 'resubmit') {
        Object.assign(fixture.tables.cems_wpms_connection_requests[0], {
          status: 'WAITING_FACTORY_REVISION',
          updated_at: '2026-09-13T00:00:00.000Z',
          system_type: 'WPMS',
          factory_id: 'FID-17',
          factory_registration_no: 'REG-17',
          created_by: 99,
        });
      }
      const input = {
        ...oldRequest('NEW_CONNECTION'),
        contactName: 'ผู้ประสานงาน',
        contactPhone: '0812345678',
      };
      const result =
        operation === 'create'
          ? await connectionRequestsRepository.create(input as never, 7, 'PENDING_DESIGN_REVIEW')
          : await connectionRequestsRepository.replaceForm(
              3,
              input as never,
              7,
              'PENDING_DESIGN_REVIEW',
              { actorUserId: 7, scope: 'ALL', expectedUpdatedAt: '2026-09-13T00:00:00.000Z' },
            );
      const persisted = fixture.tables.cems_wpms_connection_requests.find(
        (row) => row.id === result.id,
      );
      expect(persisted).toMatchObject({ source_factory_profile_revision: 3 });
      if (operation === 'resubmit') {
        expect(persisted).toMatchObject({ created_by: 99, updated_by: 7 });
        expect(fixture.tables.cems_wpms_request_status_history[0]).toMatchObject({
          changed_by: 7,
          note: expect.stringContaining('measurementPoints'),
        });
        expect(
          String(fixture.tables.cems_wpms_request_status_history[0].note).length,
        ).toBeLessThanOrEqual(1000);
      }
      expect(result).not.toHaveProperty('sourceFactoryProfileRevision');
      expect(result.measurementPoints).toHaveLength(1);
    },
  );

  it.each([null, '2026-09-21T14:15:33.600Z'])(
    'resubmits the same point then approves S0527 without a stale reservation conflict (deleted: %s)',
    async (deletedAt) => {
      const fixture = resubmissionFixture();
      fixture.tables[POINTS][0].deleted_at = deletedAt;
      const resubmitted = await fixture.resubmit();
      const newPointId = resubmitted.measurementPoints[0].id;
      const approved = await connectionRequestsRepository.updateStatus(
        10037,
        'WAITING_CONNECTION',
        7,
        { officerNote: 'แบบถูกต้อง' },
        {
          pointCodeAssignments: [
            {
              measurementPointId: newPointId,
              assignmentMode: 'MANUAL_LEGACY',
              pointCode: 'S0527',
              reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
            },
          ],
        },
      );
      expect(approved.measurementPoints[0]).toMatchObject({ id: newPointId, pointCode: 'S0527' });
      expect(fixture.tables[POINTS].map((point) => point.id)).toEqual([newPointId]);
      expect(fixture.tables[REGISTRY]).toEqual([
        expect.objectContaining({
          normalized_point_code: 'S0527',
          source_request_id: 10037,
          source_measurement_point_id: newPointId,
        }),
      ]);
    },
  );

  it('removes old ADD_PARAMETER snapshots while preserving the connected point owner and reservation', async () => {
    const fixture = resubmissionFixture();
    fixture.input.requestType = 'ADD_PARAMETER';
    Object.assign(fixture.input.measurementPoints[0], { pointCode: 'S0527' });
    Object.assign(fixture.tables[REGISTRY][0], {
      source_request_id: 55,
      source_measurement_point_id: 51,
    });
    fixture.tables[CONNECTED].push({ ...currentPoint(), point_code: 'S0527' });
    const registryBefore = structuredClone(fixture.tables[REGISTRY]);
    const connectedBefore = structuredClone(fixture.tables[CONNECTED]);

    const resubmitted = await fixture.resubmit();
    const approved = await connectionRequestsRepository.updateStatus(
      10037,
      'WAITING_CONNECTION',
      7,
      {},
    );

    expect(approved.measurementPoints[0].pointCode).toBe('S0527');
    expect(fixture.tables[POINTS].map((point) => point.id)).toEqual([
      resubmitted.measurementPoints[0].id,
    ]);
    expect(fixture.tables[REGISTRY]).toEqual(registryBefore);
    expect(fixture.tables[CONNECTED]).toEqual(connectedBefore);
  });

  it.each([null, '2026-09-21T14:15:33.600Z'])(
    'rejects resubmission and preserves all data when a connected row references a snapshot (deleted: %s)',
    async (deletedAt) => {
      const fixture = resubmissionFixture();
      fixture.tables[CONNECTED].push({
        ...currentPoint(),
        source_measurement_point_id: 10041,
        deleted_at: deletedAt,
      });
      const before = structuredClone(fixture.tables);

      await expect(fixture.resubmit()).rejects.toMatchObject({
        statusCode: 409,
        details: { reason: 'REQUEST_POINTS_ALREADY_CONNECTED' },
      });

      expect(fixture.tables).toEqual(before);
    },
  );

  it.each([
    'connected code',
    'retired connected code',
    'connected name alias',
    'other active snapshot',
    'live device configuration',
    'mismatched registry owner',
  ])('keeps the entire request unchanged if release conflicts with %s', async (conflict) => {
    const fixture = resubmissionFixture();
    switch (conflict) {
      case 'connected code':
      case 'retired connected code':
        fixture.tables[CONNECTED].push({
          ...currentPoint(),
          point_code: ' s0527 ',
          deleted_at: conflict === 'retired connected code' ? '2026-09-21T14:15:33.600Z' : null,
        });
        break;
      case 'connected name alias':
        fixture.tables[CONNECTED].push({ ...currentPoint(), point_name: ' s0527 ' });
        break;
      case 'other active snapshot':
        fixture.tables[POINTS].push({
          id: 22,
          request_id: 44,
          point_code: ' s0527 ',
          deleted_at: null,
        });
        break;
      case 'live device configuration':
        fixture.tables.device_connection_configs.push({
          id: 1,
          request_id: null,
          station_id: ' s0527 ',
          deleted_at: null,
        });
        break;
      case 'mismatched registry owner':
        fixture.tables[REGISTRY][0].source_request_id = 44;
        break;
    }
    const before = structuredClone(fixture.tables);

    await expect(fixture.resubmit()).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: 'POINT_CODE_RELEASE_BLOCKED' },
    });

    expect(fixture.tables).toEqual(before);
  });

  it('rolls back temporary retirement when the database rejects releasing a reservation', async () => {
    const fixture = resubmissionFixture();
    const before = structuredClone(fixture.tables);
    fixture.beforeRegistryDelete.mockImplementationOnce(() => {
      expect(fixture.tables[POINTS][0].deleted_at).not.toBeNull();
      throw Object.assign(new Error('Point code is now referenced'), {
        originalError: { info: { number: 51096 } },
      });
    });

    await expect(fixture.resubmit()).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: 'POINT_CODE_RELEASE_BLOCKED' },
    });

    expect(fixture.beforeRegistryDelete).toHaveBeenCalledTimes(1);
    expect(fixture.tables).toEqual(before);
  });

  it.each([
    { status: 'REVISED_PENDING_DESIGN_REVIEW', updatedAt: '2026-09-13T00:00:00.000Z' },
    { status: 'WAITING_FACTORY_REVISION', updatedAt: '2026-09-13T00:00:01.000Z' },
  ])(
    'rejects a concurrent resubmit before mutating persisted data: %j',
    async ({ status, updatedAt }) => {
      const fixture = fixtureDatabase([], true);
      Object.assign(fixture.tables.cems_wpms_connection_requests[0], {
        status,
        updated_at: updatedAt,
      });
      const before = structuredClone(fixture.tables);
      await expect(
        connectionRequestsRepository.replaceForm(
          3,
          oldRequest('NEW_CONNECTION') as never,
          7,
          'REVISED_PENDING_DESIGN_REVIEW',
          { actorUserId: 7, scope: 'ALL', expectedUpdatedAt: '2026-09-13T00:00:00.000Z' },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT', details: { reason: 'REQUEST_CHANGED' } });
      expect(fixture.tables).toEqual(before);
      expect(fixture.locks).toContain('cems_wpms_connection_requests');
    },
  );

  it('rechecks edit access inside the transaction before exposing state or writing', async () => {
    const fixture = fixtureDatabase([], true);
    fixture.tables.cems_wpms_connection_requests[0].created_by = 7;
    const before = structuredClone(fixture.tables);
    await expect(
      connectionRequestsRepository.replaceForm(
        3,
        oldRequest('NEW_CONNECTION') as never,
        7,
        'REVISED_PENDING_DESIGN_REVIEW',
        { actorUserId: 7, scope: 'IN_PROVINCE', expectedUpdatedAt: '2026-09-13T00:00:00.000Z' },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(fixture.tables).toEqual(before);
    expect(fixture.locks).toContain('cems_wpms_connection_requests');
  });

  it.each([2, null])(
    'rejects a stale or pre-cutover first-connection revision %s without reverting the profile',
    async (sourceRevision) => {
      const fixture = fixtureDatabase([], true);
      fixture.tables.cems_wpms_connection_requests[0].source_factory_profile_revision =
        sourceRevision;
      const before = structuredClone(fixture.tables);
      await expect(
        connectionRequestsRepository.syncConnectedMeasurementPoints(
          oldRequest('NEW_CONNECTION') as never,
          7,
        ),
      ).rejects.toMatchObject({ statusCode: 409, details: { reason: 'FACTORY_PROFILE_CHANGED' } });
      expect(fixture.tables).toEqual(before);
    },
  );

  it('does not restore an old profile when reconnecting after every previous point was retired', async () => {
    const fixture = fixtureDatabase(
      [{ ...currentPoint(), deleted_at: '2026-09-10T00:00:00.000Z' }],
      true,
    );
    fixture.tables.cems_wpms_connection_requests[0].source_factory_profile_revision = 2;
    const before = structuredClone(fixture.tables);
    await expect(
      connectionRequestsRepository.syncConnectedMeasurementPoints(
        oldRequest('NEW_CONNECTION') as never,
        7,
      ),
    ).rejects.toMatchObject({ statusCode: 409, details: { reason: 'FACTORY_PROFILE_CHANGED' } });
    expect(fixture.tables).toEqual(before);
  });

  it('inherits current canonical data when a first connection has no optional general patch', async () => {
    const fixture = fixtureDatabase([], true);
    fixture.tables.cems_wpms_connection_requests[0].source_factory_profile_revision = null;
    const source = oldRequest('NEW_CONNECTION');
    await connectionRequestsRepository.syncConnectedMeasurementPoints(
      {
        ...source,
        latitude: null,
        longitude: null,
        eia: null,
        projectName: null,
        measurementPoints: [{ ...source.measurementPoints[0], documentsAndImages: [] }],
      } as never,
      7,
    );
    expectCurrentGeneral(fixture.tables[CONNECTED][0]);
    expect(fixture.tables.factory_profiles[0].revision).toBe(3);
    expect(fixture.tables.factory_profile_events).toEqual([]);
  });

  it.each([
    ['WAITING_CONNECTION', 2],
    ['CONNECTION_CONFIRMED', 2],
    ['CONNECTION_CONFIRMED', null],
  ] as const)(
    'atomically returns a stale %s first connection with baseline %s to owner revision',
    async (status, revision) => {
      const fixture = fixtureDatabase([], true);
      const created = await connectionRequestsRepository.create(
        oldRequest('NEW_CONNECTION') as never,
        7,
        'PENDING_DESIGN_REVIEW',
      );
      const requestRow = fixture.tables.cems_wpms_connection_requests.find(
        (row) => row.id === created.id,
      );
      if (!requestRow) throw new Error('Missing created fixture');
      Object.assign(requestRow, { status, source_factory_profile_revision: revision });
      fixture.locks.length = 0;
      const result = await connectionRequestsRepository.returnToFactoryRevisionAfterProfileChange(
        created.id,
        42,
        { scope: 'ALL' },
        { revisionReason: 'กรุณาตรวจสอบข้อมูลล่าสุด' },
      );
      expect(result.status).toBe('WAITING_FACTORY_REVISION');
      expect(requestRow.source_factory_profile_revision).toBe(revision);
      expect(fixture.tables.cems_wpms_request_status_history.at(-1)).toMatchObject({
        request_id: created.id,
        status: 'WAITING_FACTORY_REVISION',
        changed_by: 42,
      });
      expect(fixture.locks.slice(0, 4)).toEqual([
        'cems_wpms_connection_requests',
        'eligible_factories',
        'factory_profiles',
        CONNECTED,
      ]);
    },
  );

  it.each(['profile-matches', 'already-live', 'old-province', 'no-patch', 'wrong-status'] as const)(
    'does not reopen a request when recovery guard fails: %s',
    async (failure) => {
      const fixture = fixtureDatabase([], true);
      const input = oldRequest('NEW_CONNECTION');
      const created = await connectionRequestsRepository.create(
        (failure === 'no-patch'
          ? {
              ...input,
              latitude: null,
              longitude: null,
              eia: null,
              projectName: null,
              measurementPoints: [{ ...input.measurementPoints[0], documentsAndImages: [] }],
            }
          : input) as never,
        7,
        'PENDING_DESIGN_REVIEW',
      );
      const requestRow = fixture.tables.cems_wpms_connection_requests.find(
        (row) => row.id === created.id,
      );
      if (!requestRow) throw new Error('Missing created fixture');
      Object.assign(requestRow, {
        status: failure === 'wrong-status' ? 'CONNECTED' : 'CONNECTION_CONFIRMED',
        source_factory_profile_revision: failure === 'profile-matches' ? 3 : 2,
      });
      if (failure === 'already-live') fixture.tables[CONNECTED].push(currentPoint());
      fixture.tables.eligible_factories[0].province_name = 'จังหวัดเดิม';
      const before = structuredClone(fixture.tables);
      await expect(
        connectionRequestsRepository.returnToFactoryRevisionAfterProfileChange(
          created.id,
          42,
          {
            scope:
              failure === 'old-province'
                ? { scope: 'IN_PROVINCE', province: 'จังหวัดเดิม' }
                : 'ALL',
          },
          { revisionReason: 'กรุณาตรวจสอบข้อมูลล่าสุด' },
        ),
      ).rejects.toMatchObject({ statusCode: failure === 'old-province' ? 403 : 409 });
      expect(fixture.tables).toEqual(before);
    },
  );

  it('allows the current province officer to recover a request whose historical province is different', async () => {
    const fixture = fixtureDatabase([], true);
    const created = await connectionRequestsRepository.create(
      oldRequest('NEW_CONNECTION') as never,
      7,
      'PENDING_DESIGN_REVIEW',
    );
    const requestRow = fixture.tables.cems_wpms_connection_requests.find(
      (row) => row.id === created.id,
    );
    if (!requestRow) throw new Error('Missing created fixture');
    Object.assign(requestRow, {
      status: 'CONNECTION_CONFIRMED',
      source_factory_profile_revision: null,
    });
    const result = await connectionRequestsRepository.returnToFactoryRevisionAfterProfileChange(
      created.id,
      42,
      { scope: { scope: 'IN_PROVINCE', province: 'นนทบุรี' } },
      { revisionReason: 'ตรวจข้อมูลล่าสุด' },
    );
    expect(result.status).toBe('WAITING_FACTORY_REVISION');
    expect(result.provinceName).toBe('จังหวัดเก่า');
    expect(result.createdBy).toBe(7);
  });

  it('recovers by the stable eligible ID after source ID and registration are corrected', async () => {
    const fixture = fixtureDatabase([], true);
    const created = await connectionRequestsRepository.create(
      oldRequest('NEW_CONNECTION') as never,
      7,
      'PENDING_DESIGN_REVIEW',
    );
    const requestRow = fixture.tables.cems_wpms_connection_requests.find(
      (row) => row.id === created.id,
    );
    if (!requestRow) throw new Error('Missing created fixture');
    Object.assign(requestRow, {
      status: 'CONNECTION_CONFIRMED',
      source_factory_profile_revision: 2,
    });
    Object.assign(fixture.tables.eligible_factories[0], {
      source_factory_id: 'FID-CORRECTED',
      factory_registration_no_new: 'REG-CORRECTED',
      factory_registration_no_old: null,
    });
    const historicalSnapshots = structuredClone(fixture.tables.cems_wpms_request_factory_snapshots);
    const result = await connectionRequestsRepository.returnToFactoryRevisionAfterProfileChange(
      created.id,
      42,
      { scope: 'ALL' },
      { revisionReason: 'ตรวจสอบทะเบียนโรงงานที่แก้ไขแล้ว' },
    );
    expect(result.status).toBe('WAITING_FACTORY_REVISION');
    expect(result.eligibleFactoryId).toBe(17);
    expect(result.factoryId).toBe('FID-17');
    expect(result.factoryRegistrationNo).toBe('REG-17');
    expect(fixture.tables.cems_wpms_request_factory_snapshots).toEqual(historicalSnapshots);
  });

  it('initializes first-connection optional fields through the canonical profile and audit event', async () => {
    const fixture = fixtureDatabase([], true);
    await connectionRequestsRepository.syncConnectedMeasurementPoints(
      oldRequest('ADD_MEASUREMENT_POINT') as never,
      7,
    );
    expect(fixture.tables.factory_profiles[0]).toMatchObject({
      latitude: 10,
      longitude: 99,
      eia_assessment: 'มี EIA',
      project_name: 'โครงการเก่าจากคำขอ',
      revision: 4,
    });
    expect(fixture.tables[CONNECTED][0]).toMatchObject({
      factory_latitude: 10,
      factory_longitude: 99,
      factory_eia_assessment: 'มี EIA',
    });
    expect(fixture.tables.factory_profile_events).toHaveLength(1);
  });

  it('refuses to guess when active legacy points disagree about the general profile', async () => {
    const fixture = fixtureDatabase([
      currentPoint(),
      { ...currentPoint(), id: 21, factory_name: 'ชื่อขัดแย้ง' },
    ]);
    const before = structuredClone(fixture.tables);
    await expect(
      connectionRequestsRepository.syncConnectedMeasurementPoints(
        oldRequest('ADD_MEASUREMENT_POINT') as never,
        7,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(fixture.tables).toEqual(before);
  });

  it('locks eligibility before the current profile points', async () => {
    const fixture = fixtureDatabase([currentPoint()]);
    await connectionRequestsRepository.syncConnectedMeasurementPoints(
      oldRequest('ADD_MEASUREMENT_POINT') as never,
      7,
    );
    expect(fixture.locks).toEqual(['eligible_factories', CONNECTED]);
  });

  it('keeps submitted profile fields on first connection when no live POMS factory exists', async () => {
    const fixture = fixtureDatabase([]);
    await connectionRequestsRepository.syncConnectedMeasurementPoints(
      oldRequest('ADD_MEASUREMENT_POINT') as never,
      7,
    );
    expect(fixture.tables[CONNECTED][0]).toMatchObject({
      factory_name: 'ชื่อเก่าจากคำขอ',
      factory_latitude: 10,
      factory_longitude: 99,
      factory_eia_assessment: 'มี EIA',
      factory_project_name: 'โครงการเก่าจากคำขอ',
    });
    expect(fixture.tables.eligible_factories[0]).toMatchObject({
      latitude: 10,
      longitude: 99,
      eia_assessment: 'มี EIA',
      project_name: 'โครงการเก่าจากคำขอ',
    });
  });
});
