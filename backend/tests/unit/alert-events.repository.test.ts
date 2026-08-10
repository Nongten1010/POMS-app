import { describe, expect, it } from '@jest/globals';
import {
  buildAlertEventsAccessQueryForTests,
  buildAlertEventsListQueryForTests,
} from '../../src/modules/alert-events/alert-events.repository';

describe('alertEventsRepository query helpers', () => {
  it('uses regional access for base IN_REGION notification reads when scope details omit region', () => {
    const compiled = buildAlertEventsListQueryForTests(
      { page: 1, pageSize: 20 },
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: null, province: null },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      } as never,
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[region]');
    expect(sql).toContain('select distinct');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
  });

  it('does not let regional access narrow ALL-scoped notification reads', () => {
    const compiled = buildAlertEventsListQueryForTests(
      { page: 1, pageSize: 20 },
      {
        actorUserId: 42,
        scope: { scope: 'ALL' },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      } as never,
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('select distinct');
    expect(sql).not.toContain('[p].[region] in (?)');
    expect(compiled.bindings).not.toContain('ภาคตะวันออก');
  });

  it('groups the factory join OR clauses before applying the soft-delete predicate', () => {
    const sql = buildAlertEventsAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'ALL' },
    } as never)
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('left join [factories] as [f] on ([f].[fid] = [alert_events].[factory_id] or [f].[code] = [alert_events].[factory_id]) and [f].[deleted_at] is null');
  });
});
