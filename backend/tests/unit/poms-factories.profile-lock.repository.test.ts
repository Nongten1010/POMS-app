import { afterAll, describe, expect, it } from '@jest/globals';
import knex from 'knex';
import {
  buildFactoryFormContactsQueryForTests,
  buildLockedCurrentFactoryProfileQueryForTests,
} from '../../src/modules/poms-factories/poms-factories.repository';

const mssql = knex({ client: 'mssql' });

afterAll(async () => {
  await mssql.destroy();
});

describe('POMS current profile locking on MSSQL', () => {
  it('locks the connected-point table before JOINs to avoid SQL Server error 319', () => {
    const compiled = buildLockedCurrentFactoryProfileQueryForTests(mssql, 7).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain(
      'from [cems_wpms_connected_measurement_points] as [cp] with (updlock) inner join',
    );
    expect(sql.match(/with \(updlock\)/g)).toHaveLength(1);
    expect(sql).not.toContain('[ef].[industrial_estate_name] with (updlock)');
    expect(compiled.bindings).toEqual([7]);
  });

  it('keeps the factory filter parameterized and excludes inactive connected/eligible rows', () => {
    const compiled = buildLockedCurrentFactoryProfileQueryForTests(mssql, 123456789).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[cp].[eligible_factory_id] = ?');
    expect(sql).not.toContain('123456789');
    expect(compiled.bindings).toEqual([123456789]);
    expect(sql).toContain('[cp].[deleted_at] is null');
    expect(sql).toContain('[ef].[deleted_at] is null');
    expect(sql).toContain('[ef].[id] = [cp].[eligible_factory_id]');
    expect(sql).toContain('left join [provinces] as [p]');
    expect(sql).toContain('left join [industrial_estates] as [ie]');
    expect(sql).toContain('[cp].[updated_at]');
  });
});

describe('contact snapshot locking SQL used by create, resubmit and approve', () => {
  it.each(['WPMS', 'CEMS', undefined] as const)(
    'places locks at table references for %s',
    (systemType) => {
      const compiled = buildFactoryFormContactsQueryForTests(7, systemType, true).first().toSQL();
      const sql = compiled.sql.toLowerCase();
      expect(sql).toContain(
        'from [cems_wpms_connected_measurement_points] as [cp] with (updlock) inner join',
      );
      expect(sql).toContain('join [cems_wpms_connection_requests] as [req] with (updlock) on');
      expect(sql).not.toContain('[cp].[source_request_id] with (updlock)');
      expect(compiled.bindings).toEqual(systemType ? [1, 7, systemType] : [1, 7]);
      expect(sql).toContain('[cp].[deleted_at] is null');
      expect(sql).toContain('[req].[deleted_at] is null');
    },
  );
  it('keeps ordinary form reads free of update locks', () => {
    expect(
      buildFactoryFormContactsQueryForTests(7, 'WPMS').first().toSQL().sql.toLowerCase(),
    ).not.toContain('updlock');
  });
});
