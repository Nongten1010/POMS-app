import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import type { PermissionScopeDetails } from '../../src/modules/auth/permissions';
import { alertEventsRepository } from '../../src/modules/alert-events/alert-events.repository';
import { bodCodDeviationReportsRepository } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { createKnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
const today = '2026-10-15';
const access = { actorUserId: 42, scope: { scope: 'ALL' } as PermissionScopeDetails };
let fixture: Awaited<ReturnType<typeof createKnexSqliteFixture>>;

beforeEach(async () => {
  env.FACTORY_PROFILE_MODE = 'legacy';
  fixture = await createKnexSqliteFixture(
    db,
    {
      factories: [
        {
          id: 1,
          fid: 'factory-east',
          code: 'REG-EAST',
          province_id: 1,
          industrial_estate_id: 1,
          juristic_id: 1,
          deleted_at: null,
        },
        {
          id: 2,
          fid: 'factory-central',
          code: 'REG-CENTRAL',
          province_id: 2,
          industrial_estate_id: 2,
          juristic_id: 2,
          deleted_at: null,
        },
      ],
      provinces: [
        { id: 1, name_th: 'ระยอง', region: 'ภาคตะวันออก' },
        { id: 2, name_th: 'กรุงเทพมหานคร', region: 'ภาคกลาง' },
      ],
      industrial_estates: [
        { id: 1, code: 'EAST', name_th: 'นิคมตะวันออก', deleted_at: null },
        { id: 2, code: 'CENTRAL', name_th: 'นิคมกลาง', deleted_at: null },
      ],
      eligible_factories: [
        {
          id: 1,
          source_factory_id: 'factory-east',
          factory_registration_no_new: 'REG-EAST',
          factory_registration_no_old: null,
          province_name: 'ระยอง',
          industrial_estate_name: 'นิคมตะวันออก',
          factory_type_sequence: '00088',
          deleted_at: null,
        },
        {
          id: 2,
          source_factory_id: 'factory-central',
          factory_registration_no_new: 'REG-CENTRAL',
          factory_registration_no_old: null,
          province_name: 'กรุงเทพมหานคร',
          industrial_estate_name: 'นิคมกลาง',
          factory_type_sequence: '00101',
          deleted_at: null,
        },
      ],
      user_juristics: [],
      user_factory_access: [{ factory_id: 1, user_id: 42, revoked_at: null }],
      bod_cod_deviation_reports: [
        {
          id: 1,
          factory_id: 1,
          factory_registration_no: 'REG-EAST',
          province_name: 'ระยอง',
          status: 'SUBMITTED',
          created_by: 999,
          deleted_at: null,
        },
      ],
      eligible_factory_add_requests: [
        {
          id: 1,
          factory_master_id: 1,
          source_factory_id: 'factory-east',
          factory_registration_no: 'REG-EAST',
          province_name: 'ระยอง',
          industrial_estate_name: 'นิคมตะวันออก',
          factory_type_sequence: '00088',
          status: 'PENDING_REVIEW',
          submitted_by: 999,
          is_open: false,
          deleted_at: null,
        },
      ],
      alert_events: [],
    },
    {
      user_juristics: ['juristic_id', 'user_id', 'revoked_at'],
      alert_events: [
        'id',
        'factory_id',
        'system_type',
        'display_system_type',
        'event_date',
        'alert_type',
        'threshold_type',
        'deleted_at',
        'notification_status',
        'created_at',
        'detected_at',
      ],
    },
  );
});

afterEach(() => {
  fixture?.close();
  env.FACTORY_PROFILE_MODE = originalMode;
});

function expectFirstIdQuery(alias: string) {
  const [builder] = jest.mocked(db.client.runner).mock.calls.at(-1) ?? [];
  const compiled = (builder as Knex.QueryBuilder).toSQL();
  expect(compiled.method).toBe('first');
  expect(compiled.sql).toContain(`select top (?) [${alias}].[id]`);
  expect(compiled.sql.toLowerCase()).not.toMatch(/\bcount\s*\(/);
  expect(compiled.sql.toLowerCase()).not.toContain('order by');
  expect(compiled.sql.toLowerCase()).not.toContain('offset');
  expect(compiled.bindings[0]).toBe(1);
  return compiled;
}

function seedEvent(overrides: Record<string, string | null> = {}) {
  const event = {
    factory_id: 'REG-EAST',
    system_type: 'CEMS',
    display_system_type: 'CEMS',
    event_date: today,
    alert_type: 'STANDARD_EXCEEDED',
    threshold_type: 'STANDARD',
    deleted_at: null,
    notification_status: 'ACKNOWLEDGED',
    created_at: '2026-10-14',
    detected_at: '2026-10-14',
    ...overrides,
  };
  fixture.execute('DELETE FROM alert_events');
  fixture.execute(
    `INSERT INTO alert_events (id, ${Object.keys(event).join(', ')}) VALUES (1, ${Object.keys(event)
      .map(() => '?')
      .join(', ')})`,
    Object.values(event),
  );
}

describe('menu Badge BOD/COD existence queries', () => {
  it('finds visible statuses without measurements or a creator/current-step filter', async () => {
    expect(
      await bodCodDeviationReportsRepository.hasReportsInStatuses(
        ['SUBMITTED', 'WAITING_RESULT_NOTICE'],
        access,
      ),
    ).toBe(true);
    const compiled = expectFirstIdQuery('r');
    expect(compiled.sql).toContain('[r].[status] in (?, ?)');
    expect(compiled.sql).not.toContain('bod_cod_deviation_measurements');
    expect(compiled.sql).not.toContain('bod_cod_approval_steps');
    expect(compiled.sql).not.toContain('created_by');
  });

  it('returns false for unmatched status, empty statuses, and deleted reports', async () => {
    expect(
      await bodCodDeviationReportsRepository.hasReportsInStatuses(['REVISION_REQUESTED'], access),
    ).toBe(false);
    expect(await bodCodDeviationReportsRepository.hasReportsInStatuses([], access)).toBe(false);
    fixture.execute('UPDATE bod_cod_deviation_reports SET deleted_at = ?', [today]);
    expect(await bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], access)).toBe(
      false,
    );
  });

  it('uses current assignments without requiring report ownership', async () => {
    const ownAccess = { ...access, scope: { scope: 'OWN_FACTORY' } as PermissionScopeDetails };
    expect(
      await bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], ownAccess),
    ).toBe(true);
    expect(
      await bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], {
        ...ownAccess,
        actorUserId: 43,
      }),
    ).toBe(false);
    fixture.execute('UPDATE user_factory_access SET revoked_at = ?', [today]);
    expect(
      await bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], ownAccess),
    ).toBe(false);
  });
});

describe('menu Badge eligible add-request existence queries', () => {
  it('uses PENDING_REVIEW without an extra is_open or submitter filter', async () => {
    expect(await eligibleFactoriesRepository.hasPendingAddRequests(access)).toBe(true);
    const compiled = expectFirstIdQuery('ef');
    expect(compiled.sql).toContain('[ef].[status] = ?');
    expect(compiled.bindings).toContain('PENDING_REVIEW');
    expect(compiled.sql).not.toContain('is_open');
    expect(compiled.sql).not.toContain('submitted_by');
    fixture.execute('UPDATE eligible_factory_add_requests SET status = ?', ['APPROVED']);
    expect(await eligibleFactoriesRepository.hasPendingAddRequests(access)).toBe(false);
  });

  it('excludes deleted requests and respects current assignments', async () => {
    const ownAccess = { ...access, scope: { scope: 'OWN_FACTORY' } as PermissionScopeDetails };
    expect(await eligibleFactoriesRepository.hasPendingAddRequests(ownAccess)).toBe(true);
    expect(
      await eligibleFactoriesRepository.hasPendingAddRequests({ ...ownAccess, actorUserId: 43 }),
    ).toBe(false);
    fixture.execute('UPDATE eligible_factory_add_requests SET deleted_at = ?', [today]);
    expect(await eligibleFactoriesRepository.hasPendingAddRequests(access)).toBe(false);
  });
});

describe('menu Badge alert-event existence queries', () => {
  const alertTypes = [
    ['STANDARD_EXCEEDED', 'STANDARD'],
    ['EIA_EXCEEDED', 'EIA'],
    ['DAILY_COMPLETENESS_LOW', null],
    ['CONSECUTIVE_NO_REPORT', null],
    ['ABNORMAL_VALUE', null],
  ];

  describe.each([
    ['CEMS', 'CEMS'],
    ['WPMS', 'BOD_COD_ONLINE'],
  ])('%s / %s', (systemType, displaySystemType) => {
    it.each(alertTypes)(
      'counts the existing %s event classification',
      async (alertType, thresholdType) => {
        seedEvent({
          system_type: systemType,
          display_system_type: displaySystemType,
          alert_type: alertType,
          threshold_type: thresholdType,
        });
        expect(await alertEventsRepository.hasMenuBadgeEvents(today, access)).toBe(true);
        const compiled = expectFirstIdQuery('alert_events');
        expect(compiled.sql).toContain('[alert_events].[event_date] = ?');
        expect(compiled.sql).not.toMatch(/notification_status|created_at|detected_at/);
      },
    );
  });

  it.each([
    { system_type: 'WPMS', display_system_type: 'CEMS' },
    { system_type: 'OTHER', display_system_type: 'BOD_COD_ONLINE' },
    { alert_type: 'STANDARD_EXCEEDED', threshold_type: 'EIA' },
    { alert_type: 'STANDARD_EXCEEDED', threshold_type: null },
    { alert_type: 'EIA_EXCEEDED', threshold_type: 'STANDARD' },
    { alert_type: 'OTHER', threshold_type: 'STANDARD' },
    { event_date: '2026-10-14', created_at: today, detected_at: today },
    { deleted_at: today },
  ] as Array<Record<string, string | null>>)(
    'rejects events outside menu/date/type constraints: %j',
    async (overrides) => {
      seedEvent(overrides);
      expect(await alertEventsRepository.hasMenuBadgeEvents(today, access)).toBe(false);
    },
  );

  it('counts CEMS using systemType alone and refreshes the last matching event', async () => {
    seedEvent({ display_system_type: 'BOD_COD_ONLINE' });
    expect(await alertEventsRepository.hasMenuBadgeEvents(today, access)).toBe(true);
    fixture.execute('UPDATE alert_events SET event_date = ?', ['2026-10-14']);
    expect(await alertEventsRepository.hasMenuBadgeEvents(today, access)).toBe(false);
  });

  it('finds a matching event beyond earlier unrelated rows without pagination', async () => {
    seedEvent();
    fixture.execute('UPDATE alert_events SET id = 500');
    for (let index = 1; index <= 25; index++) {
      fixture.execute(
        'INSERT INTO alert_events (id, factory_id, system_type, display_system_type, event_date, alert_type, threshold_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index, 'REG-EAST', 'CEMS', 'CEMS', '2026-10-14', 'STANDARD_EXCEEDED', 'STANDARD'],
      );
    }
    expect(await alertEventsRepository.hasMenuBadgeEvents(today, access)).toBe(true);
    expectFirstIdQuery('alert_events');
  });

  it('uses own-factory grants on every query', async () => {
    seedEvent();
    const ownAccess = { ...access, scope: { scope: 'OWN_FACTORY' } as PermissionScopeDetails };
    expect(await alertEventsRepository.hasMenuBadgeEvents(today, ownAccess)).toBe(true);
    expect(
      await alertEventsRepository.hasMenuBadgeEvents(today, { ...ownAccess, actorUserId: 43 }),
    ).toBe(false);
    fixture.execute('UPDATE user_factory_access SET revoked_at = ?', [today]);
    expect(await alertEventsRepository.hasMenuBadgeEvents(today, ownAccess)).toBe(false);
  });
});

describe.each([
  [
    'BOD/COD',
    (scope: PermissionScopeDetails) =>
      bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], { ...access, scope }),
  ],
  [
    'eligible requests',
    (scope: PermissionScopeDetails) =>
      eligibleFactoriesRepository.hasPendingAddRequests({ ...access, scope }),
  ],
  [
    'alerts',
    (scope: PermissionScopeDetails) =>
      alertEventsRepository.hasMenuBadgeEvents(today, { ...access, scope }),
  ],
] as const)('%s location scope matches the list', (_name, hasMatch) => {
  it.each([
    [{ scope: 'IN_PROVINCE', province: 'ระยอง' }, true],
    [{ scope: 'IN_PROVINCE', province: 'กรุงเทพมหานคร' }, false],
    [{ scope: 'IN_PROVINCE' }, false],
    [{ scope: 'IN_REGION', region: 'ภาคตะวันออก' }, true],
    [{ scope: 'IN_REGION', region: 'ภาคกลาง' }, false],
    [{ scope: 'IN_REGION' }, false],
    [{ scope: 'IN_ESTATE', estateCode: 'EAST' }, true],
  ] as Array<[PermissionScopeDetails, boolean]>)('honors %j', async (scope, expected) => {
    seedEvent();
    expect(await hasMatch(scope)).toBe(expected);
  });
});

describe('menu Badge SQL Server category and estate query constraints', () => {
  it('keeps the existing type-88 SQL normalization in all three queries', async () => {
    const runner = jest.mocked(db.client.runner);
    runner.mockImplementation(() => ({ run: async () => ({ id: 1 }) }) as never);
    const scope = { scope: 'FACTORY_TYPE_88' } as PermissionScopeDetails;
    for (const hasMatch of [
      () =>
        bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], { ...access, scope }),
      () => eligibleFactoriesRepository.hasPendingAddRequests({ ...access, scope }),
      () => alertEventsRepository.hasMenuBadgeEvents(today, { ...access, scope }),
    ]) {
      expect(await hasMatch()).toBe(true);
      const [builder] = runner.mock.calls.at(-1) ?? [];
      const compiled = (builder as Knex.QueryBuilder).toSQL();
      expect(compiled.sql).toContain('[ef].[factory_type_sequence]');
      expect(compiled.bindings).toContain('00088');
      expect(compiled.sql).not.toMatch(/count\s*\(/i);
    }
  });

  it('denies a different estate for BOD/COD and alerts using their list access query', async () => {
    seedEvent();
    const scope = { scope: 'IN_ESTATE', estateCode: 'CENTRAL' } as PermissionScopeDetails;
    expect(
      await bodCodDeviationReportsRepository.hasReportsInStatuses(['SUBMITTED'], {
        ...access,
        scope,
      }),
    ).toBe(false);
    expect(await alertEventsRepository.hasMenuBadgeEvents(today, { ...access, scope })).toBe(false);
  });
});

describe('eligible request Badge exact estate scope', () => {
  it.each([
    [{ estateCode: 'EAST' }, true],
    [{ estateCode: 'CENTRAL' }, false],
    [{ estateCode: 'MISSING' }, false],
    [{}, false],
    [{ estateCode: ' ' }, false],
    [{ estateId: 1 }, true],
    [{ estateId: 2 }, false],
    [{ estateId: 999 }, false],
    [{ estateName: 'นิคมตะวันออก' }, true],
    [{ estateName: 'นิคมกลาง' }, false],
    [{ estate: 'EAST' }, true],
    [{ estate: 'นิคมตะวันออก' }, true],
    [{ estate: 'CENTRAL' }, false],
  ])('never widens the trusted estate assignment %j', async (assignment, expected) => {
    const scope = { scope: 'IN_ESTATE', ...assignment } as PermissionScopeDetails;
    expect(await eligibleFactoriesRepository.hasPendingAddRequests({ ...access, scope })).toBe(
      expected,
    );
  });
});
