import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0139_update_provincial_regional_jurisdictions';
import { seed } from '../../src/db/seeds/01_provinces';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const expectedCounts = {
  ภาคกลาง: 11,
  ภาคตะวันตก: 8,
  ภาคตะวันออก: 8,
  ภาคเหนือ: 16,
  ภาคตะวันออกเฉียงเหนือ: 20,
  ภาคใต้: 14,
};

// Expected moves come from the confirmed jurisdiction list, including Tak in the north.
const moves = [
  ['นครนายก', 'ภาคกลาง', 'ภาคตะวันออก'],
  ['ตาก', 'ภาคตะวันตก', 'ภาคเหนือ'],
  ['กำแพงเพชร', 'ภาคกลาง', 'ภาคเหนือ'],
  ['นครสวรรค์', 'ภาคกลาง', 'ภาคเหนือ'],
  ['สมุทรสาคร', 'ภาคกลาง', 'ภาคตะวันตก'],
  ['สมุทรสงคราม', 'ภาคกลาง', 'ภาคตะวันตก'],
  ['นครปฐม', 'ภาคกลาง', 'ภาคตะวันตก'],
  ['สุพรรณบุรี', 'ภาคกลาง', 'ภาคตะวันตก'],
];

const originalTimestamp = '2026-10-01T00:00:00.000Z';
const snapshots = [
  { id: 1, province_name: 'นครนายก', province_code: '1026', region: 'ภาคกลาง' },
  { id: 2, province_name: null, province_code: '1063', region: 'ภาคตะวันตก' },
  {
    id: 3,
    province_name: 'นครปฐม',
    province_code: '1073',
    region: 'ภาคกลาง',
    deleted_at: 'deleted',
  },
  { id: 4, province_name: 'สมุทรสาคร', province_code: '1074', region: 'ภาคกลาง' },
  { id: 5, province_name: 'อุทัยธานี', province_code: '1060', region: 'ภาคกลาง' },
  { id: 6, province_name: '', province_code: '1060', region: 'ภาคกลาง' },
  { id: 7, province_name: null, province_code: 'unknown', region: 'ภาคกลาง' },
  { id: 8, province_name: 'นครนายก', province_code: '1026', region: 'ภาคกลาง' },
  { id: 9, province_name: 'เชียงใหม่', province_code: '1050', region: 'ภาคเหนือ' },
  { id: 10, province_name: 'นครนายก', province_code: '1026', region: 'ภาคตะวันออก' },
  { id: 11, province_name: 'สมุทรสงคราม', province_code: '1075', region: 'ภาคกลาง' },
  { id: 12, province_name: 'นครปฐม', province_code: '1073', region: null },
].map(({ region, ...row }) => ({
  deleted_at: null,
  ...row,
  request_id: row.id,
  region_name: region,
  region_code: region,
  updated_at: originalTimestamp,
}));

let db: Knex;
let fixture: KnexSqliteFixture;

async function counts(): Promise<Record<string, number>> {
  const rows = await db('provinces')
    .select('region')
    .count<Array<{ region: string; total: number | string }>>({ total: '*' })
    .groupBy('region');
  return Object.fromEntries(rows.map((row) => [row.region, Number(row.total)]));
}

async function migrate(direction: typeof up = up): Promise<void> {
  await db.transaction(async (trx) => direction(trx));
}

beforeEach(async () => {
  db = knex({ client: 'mssql' });
  fixture = await createKnexSqliteFixture(
    db,
    {
      provinces: [],
      cems_wpms_request_factory_snapshots: snapshots,
      cems_wpms_connection_requests: snapshots
        .filter((row) => row.id !== 8)
        .map((row) => ({
          id: row.id,
          deleted_at: row.id === 4 ? 'deleted' : null,
          request_no: `existing-request-${row.id}`,
          status: row.id === 1 ? 'CONNECTED' : 'PENDING_DESIGN_REVIEW',
        })),
      kwp_form_submissions: [
        { id: 1, submission_region_name: 'ภาคกลาง', submission_no: 'F01-07-0001/2569' },
      ],
    },
    { provinces: ['id', 'name_th', 'name_en', 'region'] },
  );
  await seed(db);
  for (const [province, previous] of moves) {
    await db('provinces').where('name_th', province).update({ region: previous });
  }
});

afterEach(async () => {
  fixture?.close();
  await db?.destroy();
});

describe('provincial regional jurisdictions', () => {
  it('seeds exactly 77 distinct provinces with the confirmed six-region distribution', async () => {
    await seed(db);
    await seed(db);

    const provinces = await db('provinces').select('*');
    expect(provinces).toHaveLength(77);
    expect(new Set(provinces.map((row) => row.name_th)).size).toBe(77);
    expect(await counts()).toEqual(expectedCounts);
    for (const [province, , current] of moves) {
      expect(provinces.find((row) => row.name_th === province)?.region).toBe(current);
    }
    expect(provinces.find((row) => row.name_th === 'อุทัยธานี')?.region).toBe('ภาคกลาง');
  });

  it('migrates the existing master without changing province identities or unrelated rows', async () => {
    const before = await db('provinces').orderBy('id');
    const requestsBefore = await db('cems_wpms_connection_requests').orderBy('id');
    const submissionsBefore = await db('kwp_form_submissions').select('*');

    expect(config.transaction).toBe(true);
    await migrate();

    const after = await db('provinces').orderBy('id');
    expect(await counts()).toEqual(expectedCounts);
    expect(after).toEqual(
      before.map((row) => ({
        ...row,
        region: moves.find(([province]) => province === row.name_th)?.[2] ?? row.region,
      })),
    );
    expect(await db('cems_wpms_connection_requests').orderBy('id')).toEqual(requestsBefore);
    expect(await db('kwp_form_submissions').select('*')).toEqual(submissionsBefore);
  });

  it('routes existing active snapshots by province name or a missing-name code fallback', async () => {
    await migrate();

    const after = await db('cems_wpms_request_factory_snapshots').orderBy('id');
    for (const [id, region] of [
      [1, 'ภาคตะวันออก'],
      [2, 'ภาคเหนือ'],
      [6, 'ภาคเหนือ'],
      [11, 'ภาคตะวันตก'],
      [12, 'ภาคตะวันตก'],
    ] as const) {
      const original = snapshots.find((row) => row.id === id);
      const actual = after.find((row) => row.id === id);
      expect(actual).toEqual({
        ...original,
        region_name: region,
        region_code: region,
        updated_at: expect.any(String),
      });
      expect(actual.updated_at).not.toBe(originalTimestamp);
    }
    // Deleted snapshots/parents, orphans, unknown codes, and conflicting nonempty names stay intact.
    for (const id of [3, 4, 5, 7, 8, 9, 10]) {
      expect(after.find((row) => row.id === id)).toEqual(snapshots.find((row) => row.id === id));
    }
    const oldRegion = await db('cems_wpms_request_factory_snapshots').where({
      id: 1,
      region_name: 'ภาคกลาง',
    });
    const newRegion = await db('cems_wpms_request_factory_snapshots').where({
      id: 1,
      region_name: 'ภาคตะวันออก',
    });
    expect(oldRegion).toHaveLength(0);
    expect(newRegion).toHaveLength(1);
  });

  it('is idempotent and remains aligned when the province seed is run later', async () => {
    await migrate();
    const before = await db('cems_wpms_request_factory_snapshots').orderBy('id');
    await migrate();
    await seed(db);
    expect(await db('cems_wpms_request_factory_snapshots').orderBy('id')).toEqual(before);
    expect(await counts()).toEqual(expectedCounts);
  });

  it('rolls back all earlier updates if a snapshot update fails inside the migration transaction', async () => {
    const provincesBefore = await db('provinces').orderBy('id');
    const snapshotsBefore = await db('cems_wpms_request_factory_snapshots').orderBy('id');
    fixture.execute(`
      CREATE TRIGGER reject_snapshot_update
      BEFORE UPDATE ON cems_wpms_request_factory_snapshots
      WHEN OLD.id = 2
      BEGIN
        SELECT RAISE(ABORT, 'fixture snapshot update failure');
      END;
    `);

    await expect(migrate()).rejects.toThrow('fixture snapshot update failure');
    expect(await db('provinces').orderBy('id')).toEqual(provincesBefore);
    expect(await db('cems_wpms_request_factory_snapshots').orderBy('id')).toEqual(snapshotsBefore);
  });

  it('rolls back the previous mapping without overwriting a subsequent region correction', async () => {
    const provincesBefore = await db('provinces').orderBy('id');
    await migrate();
    await db('cems_wpms_request_factory_snapshots')
      .where('id', 1)
      .update({ region_name: 'ภาคใต้', region_code: 'ภาคใต้' });
    await migrate(down);

    expect(await db('provinces').orderBy('id')).toEqual(provincesBefore);
    expect(await db('cems_wpms_request_factory_snapshots').where('id', 1).first()).toMatchObject({
      region_name: 'ภาคใต้',
      region_code: 'ภาคใต้',
    });
    expect(await db('cems_wpms_request_factory_snapshots').where('id', 2).first()).toMatchObject({
      region_name: 'ภาคตะวันตก',
      region_code: 'ภาคตะวันตก',
    });
  });
});
