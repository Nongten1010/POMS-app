import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { kwpFormReportsRepository } from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';
import type { KwpFormReportAccess } from '../../src/modules/kwp-form-reports/kwp-form-reports.types';
import { createKnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

type CompiledQuery = ReturnType<Knex.QueryBuilder['toSQL']>;
const previousProfileMode = env.FACTORY_PROFILE_MODE;
const targets = [
  {
    name: 'factory edit requests',
    repository: pomsFactoriesRepository,
    method: 'hasEditRequestsInStatuses',
    table: '[poms_factory_edit_requests] as [req]',
    idColumn: '[req].[id]',
    statusColumn: '[req].[status]',
    statuses: ['PENDING_REVIEW', 'REVISED_PENDING_REVIEW'],
  },
  {
    name: 'connection table requests',
    repository: connectionRequestsRepository,
    method: 'hasTableRequestsInStatuses',
    table: '[cems_wpms_connection_requests]',
    idColumn: '[id]',
    statusColumn: '[status]',
    statuses: ['PENDING_DESIGN_REVIEW', 'CONNECTION_CONFIRMED'],
  },
  {
    name: 'KWP requests',
    repository: kwpFormReportsRepository,
    method: 'hasRequestsInStatuses',
    table: '[kwp_form_submissions] as [s]',
    idColumn: '[s].[id]',
    statusColumn: '[s].[status]',
    statuses: ['SUBMITTED', 'UNDER_REVIEW'],
  },
] as const;

function read(
  target: (typeof targets)[number],
  statuses: readonly string[],
  access: KwpFormReportAccess,
): Promise<boolean> {
  const method = Reflect.get(target.repository, target.method);
  expect(typeof method).toBe('function');
  return method.call(target.repository, statuses, access) as Promise<boolean>;
}

function captureQuery(exists = true): CompiledQuery[] {
  const queries: CompiledQuery[] = [];
  jest.spyOn(db.client, 'runner').mockImplementation((builder: unknown) => ({
    run: async () => {
      queries.push((builder as Knex.QueryBuilder).toSQL());
      return exists ? { id: 7 } : undefined;
    },
  }));
  return queries;
}

beforeEach(() => {
  env.FACTORY_PROFILE_MODE = 'legacy';
});
afterEach(() => {
  env.FACTORY_PROFILE_MODE = previousProfileMode;
  jest.restoreAllMocks();
});

describe.each(targets)('$name badge existence', (target) => {
  it.each([true, false])('returns %s according to the first matching row', async (exists) => {
    captureQuery(exists);
    expect(await read(target, target.statuses, { actorUserId: 42, scope: 'ALL' })).toBe(exists);
  });

  it('selects only the first ID for all relevant statuses without list hydration or counting', async () => {
    const queries = captureQuery();
    expect(await read(target, target.statuses, { actorUserId: 42, scope: 'ALL' })).toBe(true);
    expect(queries).toHaveLength(1);
    const compiled = queries[0];
    const sql = compiled.sql.toLowerCase();
    expect(compiled.method).toBe('first');
    expect(sql).toContain(`select top (?) ${target.idColumn} from ${target.table}`);
    expect(sql).toContain(`${target.statusColumn} in (?, ?)`);
    expect(compiled.bindings).toEqual(expect.arrayContaining([1, ...target.statuses]));
    expect(sql).not.toMatch(
      /count\(|offset|fetch next|order by \[|submission_no|request_no|officer_note/,
    );
  });

  it('uses assigned factories without adding a request creator condition', async () => {
    const queries = captureQuery();
    const access = {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      includeRequestOwnerAccess: true,
    };
    await read(target, target.statuses, access);
    const sql = queries[0].sql.toLowerCase();
    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(sql).toContain('[uj].[revoked_at] is null');
    expect(sql).toContain('[ufa].[revoked_at] is null');
    expect(sql).not.toMatch(/\[(?:created_by|submitted_by)\] =/);
    expect(queries[0].bindings).toContain(42);
  });

  it('uses the menu region instead of unrelated profile regions', async () => {
    const queries = captureQuery();
    await read(target, target.statuses, {
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
      regionalAccess: { regions: ['ภาคใต้'] },
    });
    expect(queries[0].bindings).toContain('ภาคเหนือ');
    expect(queries[0].bindings).not.toContain('ภาคใต้');
    expect(queries[0].sql.toLowerCase()).toContain('region');
  });

  it.each([
    [{ scope: 'IN_PROVINCE', province: 'ระยอง' }, 'ระยอง'],
    [{ scope: 'IN_ESTATE', estateCode: 'IE-01' }, 'IE-01'],
    [{ scope: 'FACTORY_TYPE_88' }, '00088'],
  ] as const)('preserves list scope %j', async (scope, expectedBinding) => {
    const queries = captureQuery();
    await read(target, target.statuses, { actorUserId: 42, scope });
    expect(queries[0].bindings).toContain(expectedBinding);
  });

  it('fails closed for an estate scope without its qualifier', async () => {
    const queries = captureQuery();
    await read(target, target.statuses, { actorUserId: 42, scope: { scope: 'IN_ESTATE' } });
    expect(queries[0].sql).toMatch(/1 = (?:0|\?)/);
  });
});

describe.each(targets.slice(0, 2))('$name SQL fixture results', (target) => {
  it('finds a later assigned task and excludes revoked, deleted and wrong-status rows', async () => {
    const fixture = await createKnexSqliteFixture(
      db,
      {
        factories: [
          { id: 1, fid: 'A', code: 'OLD-A', juristic_id: 1, deleted_at: null },
          { id: 2, fid: 'B', code: 'OLD-B', juristic_id: 2, deleted_at: null },
        ],
        eligible_factories: [
          {
            id: 1,
            source_factory_id: 'A',
            factory_registration_no_new: 'A',
            province_name: 'ระยอง',
            industrial_estate_name: null,
            deleted_at: null,
          },
          {
            id: 2,
            source_factory_id: 'B',
            factory_registration_no_new: 'B',
            province_name: 'ระยอง',
            industrial_estate_name: null,
            deleted_at: null,
          },
        ],
        user_juristics: [{ user_id: 42, juristic_id: 2, revoked_at: '2026-10-14' }],
        user_factory_access: [{ user_id: 42, factory_id: 1, revoked_at: null }],
        provinces: [{ id: 1, name_th: 'ระยอง', region: 'ภาคตะวันออก' }],
        industrial_estates: [{ id: 1, name_th: 'นิคม', code: 'IE-01' }],
        poms_factory_edit_requests: [
          {
            id: 1,
            eligible_factory_id: 2,
            factory_id: 'B',
            status: target.statuses[0],
            deleted_at: null,
          },
          { id: 2, eligible_factory_id: 1, factory_id: 'A', status: 'APPROVED', deleted_at: null },
          {
            id: 3,
            eligible_factory_id: 1,
            factory_id: 'A',
            status: target.statuses[0],
            deleted_at: '2026-10-14',
          },
        ],
        cems_wpms_connection_requests: [
          {
            id: 1,
            eligible_factory_id: 2,
            factory_id: 'B',
            status: target.statuses[0],
            deleted_at: null,
          },
          { id: 2, eligible_factory_id: 1, factory_id: 'A', status: 'CONNECTED', deleted_at: null },
          {
            id: 3,
            eligible_factory_id: 1,
            factory_id: 'A',
            status: target.statuses[0],
            deleted_at: '2026-10-14',
          },
        ],
      },
      {
        eligible_factories: ['factory_registration_no_old'],
      },
    );
    try {
      const access = { actorUserId: 42, scope: 'OWN_FACTORY' };
      expect(await read(target, target.statuses, access)).toBe(false);
      const table =
        target.method === 'hasEditRequestsInStatuses'
          ? 'poms_factory_edit_requests'
          : 'cems_wpms_connection_requests';
      fixture.execute(
        `INSERT INTO ${table} (id, eligible_factory_id, factory_id, status, deleted_at) VALUES (?, ?, ?, ?, ?)`,
        [999, 1, 'A', target.statuses[1], null],
      );
      expect(await read(target, target.statuses, access)).toBe(true);
      fixture.execute('UPDATE user_factory_access SET revoked_at = ? WHERE user_id = ?', [
        '2026-10-15',
        42,
      ]);
      expect(await read(target, target.statuses, access)).toBe(false);
    } finally {
      fixture.close();
    }
  });
});
