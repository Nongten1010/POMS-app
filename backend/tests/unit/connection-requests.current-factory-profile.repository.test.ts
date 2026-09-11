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
  const trx = Object.assign(
    (queryTable: string) => {
      const table =
        queryTable === 'current_eligible_factories as ef' ? 'eligible_factories' : queryTable;
      if (!tables[table]) throw new Error(`Unexpected table ${table}`);
      const predicates: Array<(row: Row) => boolean> = [];
      let columns: string[] = [];
      let counted = false;
      let ordering: [string, string] | undefined;
      const rows = () => {
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
        whereRaw(sql: string) {
          if (sql === '1 = 0') predicates.push(() => false);
          return builder;
        },
        whereIn(column: string, values: unknown[]) {
          predicates.push((row) => values.includes(row[column.split('.').at(-1) ?? column]));
          return builder;
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
    { fn: { now: () => '2026-09-11T00:00:00.000Z' } },
  );
  mockedDb.transaction.mockImplementation(async (callback: unknown) =>
    (callback as (trx: unknown) => Promise<unknown>)(trx),
  );
  return { tables, locks };
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

describe('connection profile persistence with a stale submitted factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.FACTORY_PROFILE_MODE = 'legacy';
  });
  afterEach(() => {
    env.FACTORY_PROFILE_MODE = previousMode;
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
            );
      const persisted = fixture.tables.cems_wpms_connection_requests.find(
        (row) => row.id === result.id,
      );
      expect(persisted).toMatchObject({ source_factory_profile_revision: 3 });
      expect(result).not.toHaveProperty('sourceFactoryProfileRevision');
      expect(result.measurementPoints).toHaveLength(1);
    },
  );

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
