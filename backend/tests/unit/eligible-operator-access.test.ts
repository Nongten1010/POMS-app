import { buildOperatorFactoriesQueryForTests } from '../../src/modules/auth/auth.repository';
import {
  buildDirectConnectionFactoryQueryForTests,
  buildFactoriesForAccessQueryForTests,
} from '../../src/modules/connection-requests/connection-requests.repository';
import { buildFormsQueryForTests } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';
import { buildKwpFormFactoryQueryForTests } from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';
import { buildKwpFormSubmissionFactoryAccessQueryForTests } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';
import { buildBodCodDeviationFactoryQueryForTests } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import { buildBodCodNumberingFactoryQueryForTests } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-report-numbering.repository';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { env } from '../../src/config/env';
import { db } from '../../src/config/database';
import { operatorAccessFixture } from '../helpers/eligible-operator-access-fixture';
import {
  eligibleFactoryStatusSync,
  isFresh,
  sourceFlag,
} from '../../src/modules/eligible-factories/eligible-factory-status-sync';
import {
  operatorAccessService,
  operatorAccessRoutes,
  grantInput,
  maskCitizenId,
} from '../../src/modules/eligible-factories/eligible-operator-access';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import {
  applyAssignedFactoryAccessFilter,
  factoryAccessReadTable,
} from '../../src/shared/utils/factory-access-query';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

let fixture: Awaited<ReturnType<typeof operatorAccessFixture>>;
const settings = { ...env };
const access = { actorUserId: 1, scope: 'ALL' };
const grant = () => operatorAccessService.grant(17, { userId: 42 }, 1, access);
function accessibleIds(userId = 42) {
  return db(factoryAccessReadTable('f'))
    .select('f.fid')
    .modify((q) => applyAssignedFactoryAccessFilter(q, userId));
}
beforeEach(async () => {
  env.ELIGIBLE_OPERATOR_ACCESS_ENABLED = true;
  env.FACTORY_STATUS_SYNC_ENABLED = true;
  env.FACTORY_STATUS_MAX_AGE_SECONDS = 3600;
  env.FACTORY_STATUS_SYNC_HOUR = 2;
  fixture = await operatorAccessFixture();
  jest
    .spyOn(eligibleFactoriesRepository, 'findAccessibleById')
    .mockResolvedValue({ id: 17 } as never);
});
afterEach(() => {
  fixture.close();
  jest.restoreAllMocks();
  Object.assign(env, settings);
});

describe('eligible operator access with persisted rows', () => {
  it('grants a previously authenticated citizen, masks its ID and grants only one real FID without a master', async () => {
    const result = await grant();
    expect(result.id).toBe(1);
    expect(fixture.rows('SELECT * FROM factories')).toEqual([]);
    expect(await accessibleIds()).toEqual([{ fid: '10000000000017' }]);
    const snapshot = await operatorAccessService.snapshot(17);
    expect(snapshot.capabilities.canGrant).toBe(true);
    expect(snapshot.items[0]).toMatchObject({
      userId: 42,
      status: 'active',
      canRevoke: true,
      citizenIdMasked: '*********1234',
    });
    expect(JSON.stringify(snapshot)).not.toContain('1111111111234');
    expect(snapshot.history[0]).toMatchObject({ action: 'granted', reason: null });
    expect(snapshot.history[0].occurredAt).toMatch(/Z$/);
  });
  it('does not create a new grant when forced source verification fails even with a recent cached status', async () => {
    await eligibleFactoryStatusSync.refresh(17, true);
    fixture.source.unavailable = true;
    await expect(grant()).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: 'SOURCE_STATUS_UNVERIFIED' },
    });
    expect(fixture.rows('SELECT * FROM user_eligible_factory_access')).toEqual([]);
    expect((await operatorAccessService.snapshot(17)).capabilities.canGrant).toBe(false);
  });

  it('does not transfer cached authorization when an eligible row changes factory identity', async () => {
    await grant();
    fixture.sqlite.run(
      "UPDATE eligible_factories SET factory_registration_no_new='10000000000099' WHERE id=17",
    );
    expect(await accessibleIds()).toEqual([]);
    fixture.source.rows.push({ FID: '10000000000099', FFLAG: '0' });
    await eligibleFactoryStatusSync.refreshForUser(42);
    expect(await accessibleIds()).toEqual([]);
    expect(fixture.rows('SELECT status FROM user_eligible_factory_access')[0].status).toBe(
      'expired',
    );
    expect(
      fixture.rows("SELECT reason FROM eligible_operator_access_events WHERE action='expired'")[0]
        .reason,
    ).toBe('FACTORY_IDENTITY_CHANGED');
  });

  it('rejects duplicate assignments without duplicate history', async () => {
    await grant();
    await expect(grant()).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: 'DUPLICATE_GRANT' },
    });
    expect(fixture.rows('SELECT * FROM eligible_operator_access_events')).toHaveLength(1);
  });
  it.each(['1', '2', '3'])(
    'expires on source flag %s, preserves existing transactions and never revives ended grants',
    async (flag) => {
      await grant();
      fixture.source.rows[0].FFLAG = flag;
      await eligibleFactoryStatusSync.refresh(17, true);
      expect(await accessibleIds()).toEqual([]);
      expect(
        fixture.rows('SELECT status, ended_at FROM user_eligible_factory_access')[0],
      ).toMatchObject({ status: 'expired', ended_at: expect.any(String) });
      expect((await operatorAccessService.snapshot(17)).capabilities.canGrant).toBe(false);
      await expect(grant()).rejects.toMatchObject({ statusCode: 409 });
      fixture.source.rows[0].FFLAG = '0';
      await eligibleFactoryStatusSync.refresh(17, true);
      expect(await accessibleIds()).toEqual([]);
      expect(
        fixture.rows("SELECT * FROM eligible_operator_access_events WHERE action='expired'"),
      ).toHaveLength(1);
    },
  );
  it('revocation denies subsequent requests with an existing identity and does not remove an independent juristic grant', async () => {
    const { id } = await grant();
    await operatorAccessService.revoke(17, id, 1, undefined, access);
    expect(await accessibleIds()).toEqual([]);
    fixture.sqlite.run(
      "INSERT INTO factories VALUES (9,'10000000000017','10000000000017',77,NULL); INSERT INTO user_juristics VALUES (42,77,NULL)",
    );
    expect(await accessibleIds()).toEqual([{ fid: '10000000000017' }]);
    await expect(operatorAccessService.revoke(18, id, 1, undefined, access)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
  it('suspends stale source access on failure, keeps confirmed status, and resumes after successful verification', async () => {
    await grant();
    fixture.sqlite.run(
      "UPDATE eligible_factory_source_status SET last_success_at='2000-01-01T00:00:00.000Z'",
    );
    fixture.source.unavailable = true;
    await eligibleFactoryStatusSync.refreshForUser(42);
    expect(await accessibleIds()).toEqual([]);
    expect(
      fixture.rows('SELECT operation_status FROM eligible_factories WHERE id=17')[0]
        .operation_status,
    ).toBe('ยังไม่แจ้งประกอบ');
    expect((await operatorAccessService.snapshot(17)).items[0].status).toBe('suspended');
    await expect(grant()).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: 'SOURCE_STATUS_UNVERIFIED' },
    });
    fixture.source.unavailable = false;
    await eligibleFactoryStatusSync.refreshForUser(42);
    expect(await accessibleIds()).toEqual([{ fid: '10000000000017' }]);
  });
  it.each(['SOURCE_NOT_FOUND', 'SOURCE_AMBIGUOUS', 'SOURCE_STATUS_UNKNOWN'])(
    'does not treat %s as deregistration',
    async (error) => {
      await grant();
      fixture.source.rows =
        error === 'SOURCE_NOT_FOUND'
          ? []
          : error === 'SOURCE_AMBIGUOUS'
            ? [fixture.source.rows[0], fixture.source.rows[0]]
            : [{ FID: '10000000000017', FFLAG: '9' }];
      await eligibleFactoryStatusSync.refresh(17, true);
      expect(
        fixture.rows('SELECT flag,error_code FROM eligible_factory_source_status')[0],
      ).toMatchObject({ flag: '0', error_code: error });
      expect(fixture.rows('SELECT status FROM user_eligible_factory_access')[0].status).toBe(
        'active',
      );
    },
  );
  it('only selects active previously logged in i-industry citizens/operators and excludes open grants', async () => {
    fixture.sqlite.run(
      "INSERT INTO users VALUES (43,'local','test','operator',1,'2026-11-09',NULL,'ผู้ประกอบการ','อื่น'); INSERT INTO users VALUES (44,'i_industry','2222222222222','operator',1,NULL,NULL,'ผู้ประกอบการ','ใหม่')",
    );
    expect(
      (await operatorAccessService.candidates(17, 'ผู้ประกอบการ')).items.map((x) => x.userId),
    ).toEqual([42]);
    await expect(operatorAccessService.grant(17, { userId: 43 }, 1, access)).rejects.toMatchObject({
      statusCode: 404,
    });
    await grant();
    expect((await operatorAccessService.candidates(17, 'ผู้ประกอบการ')).items).toEqual([]);
  });
  it('runs once per Bangkok day, reads every source flag and retries only failed targets', async () => {
    env.FACTORY_STATUS_SYNC_HOUR = 0;
    await grant();
    fixture.source.rows[0].FFLAG = '2';
    fixture.source.rows = fixture.source.rows.filter((row) => row.FID !== '10000000000018');
    expect(await eligibleFactoryStatusSync.runDaily()).toBe(true);
    expect(
      fixture.rows('SELECT status, failed_count FROM eligible_factory_status_runs')[0],
    ).toMatchObject({ status: 'failed', failed_count: 1 });
    expect(
      fixture.rows('SELECT operation_status FROM eligible_factories WHERE id=17')[0]
        .operation_status,
    ).toBe('จำหน่ายทะเบียน');
    fixture.source.rows.push({ FID: '10000000000018', FFLAG: '0' });
    expect(await eligibleFactoryStatusSync.runDaily()).toBe(true);
    expect(
      fixture.rows('SELECT status,checked_count,failed_count FROM eligible_factory_status_runs')[0],
    ).toMatchObject({ status: 'complete', checked_count: 1, failed_count: 0 });
    expect(await eligibleFactoryStatusSync.runDaily()).toBe(false);
    expect(
      fixture.rows("SELECT * FROM eligible_operator_access_events WHERE action='expired'"),
    ).toHaveLength(1);
  });
});

function app(
  userType: 'admin' | 'officer' | 'operator',
  roles: string[],
  scopes = { 'eligible_factories:view': 'ALL' },
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 1, userType, roles, scopes };
    next();
  });
  app.use('/eligible-factories/:id/operator-access', operatorAccessRoutes);
  app.use(errorHandler);
  return app;
}
it('allows an admin with view alone, denies officers/directors with edit, and accepts the frontend envelopes', async () => {
  await request(
    app('officer', ['director'], {
      'eligible_factories:view': 'ALL',
      'eligible_factories:edit': 'ALL',
    } as never),
  )
    .post('/eligible-factories/17/operator-access')
    .send({ userId: 42 })
    .expect(403);
  const api = app('admin', ['admin']);
  const result = await request(api)
    .post('/eligible-factories/17/operator-access')
    .send({ userId: 42 })
    .expect(201);
  expect(result.body).toEqual({ success: true, data: { id: 1 } });
  const snapshot = await request(api).get('/eligible-factories/17/operator-access').expect(200);
  expect(snapshot.headers['cache-control']).toBe('no-store');
  expect(snapshot.body.data.items[0].citizenIdMasked).toBe('*********1234');
  await request(api).post('/eligible-factories/17/operator-access/1/revoke').send({}).expect(200);
});
it('denies an out-of-scope factory and validates payloads before writes', async () => {
  await request(app('admin', ['admin']))
    .post('/eligible-factories/17/operator-access')
    .send({ userId: '42' })
    .expect(400);
  jest.mocked(eligibleFactoriesRepository.findAccessibleById).mockResolvedValue(null);
  await request(app('admin', ['admin']))
    .get('/eligible-factories/17/operator-access')
    .expect(404);
});
it('keeps feature disabled until migrations/config are ready', async () => {
  env.ELIGIBLE_OPERATOR_ACCESS_ENABLED = false;
  await request(app('admin', ['admin']))
    .get('/eligible-factories/17/operator-access')
    .expect(503);
});
it('validates reasons, masks invalid identities, and enforces a freshness deadline', () => {
  expect(grantInput.parse({ userId: 42, reason: '  ' }).reason).toBeUndefined();
  expect(grantInput.safeParse({ userId: 42, reason: 'x'.repeat(1001) }).success).toBe(false);
  expect(() => sourceFlag([{ FID: 'A', FFLAG: '__proto__' }], 'A')).toThrow(
    'SOURCE_STATUS_UNKNOWN',
  );
  expect(maskCitizenId('unexpected')).toBe('*************');
  expect(isFresh({ flag: '0', last_success_at: '2000-01-01Z' })).toBe(false);
  expect(() =>
    sourceFlag(
      [
        { FID: 'A', FFLAG: '0' },
        { FID: 'A', FFLAG: '1' },
      ],
      'A',
    ),
  ).toThrow('SOURCE_AMBIGUOUS');
});
it('publishes all frontend paths with view+admin authorization and required schemas', () => {
  const doc = pomsOpenApiDocument as {
    paths: Record<string, Record<string, Record<string, unknown>>>;
  };
  const base = '/eligible-factories/{id}/operator-access';
  for (const [path, method] of [
    [base, 'get'],
    [base, 'post'],
    [base + '/candidates', 'get'],
    [base + '/{grantId}/revoke', 'post'],
  ]) {
    const operation = doc.paths[path][method];
    expect(operation['x-poms-permissions']).toEqual(['eligible_factories:view']);
    expect(operation['x-poms-required-roles']).toEqual(['admin']);
  }
});

it('uses current eligible grants and the same freshness check across transaction query paths', () => {
  const own = { actorUserId: 42, scope: 'OWN_FACTORY' };
  const queries = [
    buildOperatorFactoriesQueryForTests(42),
    buildFactoriesForAccessQueryForTests(own),
    buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10000000000017', factoryRegistrationNo: '10000000000017' },
      own,
    ),
    buildFormsQueryForTests({}, own),
    buildKwpFormFactoryQueryForTests(own),
    buildKwpFormSubmissionFactoryAccessQueryForTests('10000000000017', own),
    buildBodCodDeviationFactoryQueryForTests(own),
  ];
  for (const query of queries) {
    const sql = query.toSQL().sql;
    expect(sql).toContain('[factory_access_identities]');
    expect(sql).toContain('[user_eligible_factory_access]');
    expect(sql).toContain('[eag].[status] = ?');
    expect(sql).toContain('eas.last_success_at > DATEADD');
  }
  const numbering = buildBodCodNumberingFactoryQueryForTests(
    {
      factoryId: '10000000000017',
      factoryRegistrationNo: '10000000000017',
      eligibleFactoryId: 17,
      factoryInternalId: null,
    },
    own,
  ).toSQL().sql;
  expect(numbering).toContain('f.fid = ef.factory_registration_no_new');
});
