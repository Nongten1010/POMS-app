import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFactorySourceDb = jest.fn();

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockFactorySourceDb,
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

import {
  MANUAL_FACTORY_JURISTIC_ID,
  TARGET_FACTORY_FID,
  TARGET_OPERATOR_EXTERNAL_ID,
  buildFactoryAccessGrant,
  config,
  up,
} from '../../src/db/migrations/0073_grant_operator_demo_factory_access';

describe('0073_grant_operator_demo_factory_access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs schema and grant writes in one migration transaction', () => {
    expect(config).toEqual({ transaction: true });
  });

  it('builds the production grant from the DIW factory source row', () => {
    expect(
      buildFactoryAccessGrant(77, {
        FID: '10120000325542',
        FACREG: 'รง.เดิม-003',
        DISPFACREG: '3-101-3/55นบ',
        FNAME: 'บริษัท โรงงานเป้าหมาย จำกัด',
        PROV: 12,
        CLASS: '101',
        OBJECT: 'ผลิตผลิตภัณฑ์ทดสอบ',
        FFLAG: '1',
      }),
    ).toEqual({
      userId: 77,
      factoryFid: TARGET_FACTORY_FID,
      syntheticJuristicId: MANUAL_FACTORY_JURISTIC_ID,
      factoryName: 'บริษัท โรงงานเป้าหมาย จำกัด',
      provinceId: '1012',
      oldRegistrationNo: '3-101-3/55นบ',
      factoryTypeSequence: '101',
      businessActivity: 'ผลิตผลิตภัณฑ์ทดสอบ',
      operationStatus: 'แจ้งประกอบแล้ว',
    });
  });

  it('defers factory hydration and access until operator_demo is seeded or logs in', async () => {
    const first = jest.fn().mockResolvedValue(undefined as never);
    const usersQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first,
    };
    const raw = jest.fn();
    const schema = migrationSchemaMock(false);
    const knex = Object.assign(
      jest.fn(() => usersQuery),
      { raw, schema },
    );
    await up(knex as never);

    expect(usersQuery.where).toHaveBeenCalledWith({
      external_id: TARGET_OPERATOR_EXTERNAL_ID,
      user_type: 'operator',
    });
    expect(schema.createTable).toHaveBeenCalledWith('user_factory_access', expect.any(Function));
    expect(mockFactorySourceDb).not.toHaveBeenCalled();
    expect(raw).not.toHaveBeenCalled();
  });

  it('hydrates the target factory and executes an idempotent database grant', async () => {
    const usersQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 77 } as never),
    };
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = Object.assign(
      jest.fn(() => usersQuery),
      {
        raw,
        schema: migrationSchemaMock(true),
      },
    );
    const sourceQuery = {
      where: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        FID: TARGET_FACTORY_FID,
        FACREG: null,
        DISPFACREG: '3-101-3/55นบ',
        FNAME: 'บริษัท โรงงานเป้าหมาย จำกัด',
        PROV: 12,
        CLASS: '101',
        OBJECT: 'ผลิตผลิตภัณฑ์ทดสอบ',
        FFLAG: 3,
      } as never),
    };
    mockFactorySourceDb.mockReturnValue(sourceQuery);

    await up(knex as never);

    expect(sourceQuery.where).toHaveBeenCalledWith('FID', TARGET_FACTORY_FID);
    expect(raw).toHaveBeenCalledTimes(1);
    const [sql, bindings] = raw.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('INSERT INTO factories');
    expect(sql).toContain('INSERT INTO user_factory_access');
    expect(sql).not.toContain('INSERT INTO user_juristics');
    expect(sql).not.toContain('UPDATE user_factory_access');
    expect(sql).toContain('INSERT INTO eligible_factories');
    expect(sql).not.toContain('BEGIN TRANSACTION');
    expect(bindings).toEqual([
      77,
      TARGET_FACTORY_FID,
      MANUAL_FACTORY_JURISTIC_ID,
      'บริษัท โรงงานเป้าหมาย จำกัด',
      '1012',
      '3-101-3/55นบ',
      '101',
      'ผลิตผลิตภัณฑ์ทดสอบ',
      'หยุดชั่วคราว',
    ]);
  });

  it('fails deployment when the requested FID is absent from the DIW factory source', async () => {
    const usersQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 77 } as never),
    };
    const raw = jest.fn();
    const knex = Object.assign(
      jest.fn(() => usersQuery),
      {
        raw,
        schema: migrationSchemaMock(true),
      },
    );
    mockFactorySourceDb.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined as never),
    });

    await expect(up(knex as never)).rejects.toThrow(
      `Factory ${TARGET_FACTORY_FID} was not found in the DIW factory source`,
    );
    expect(raw).not.toHaveBeenCalled();
  });

  it.each([
    [
      'unexpected FID',
      { FID: 'wrong', FNAME: 'โรงงาน', PROV: 12 },
      'Unexpected factory source FID: wrong',
    ],
    [
      'missing factory name',
      { FID: TARGET_FACTORY_FID, FNAME: ' ', PROV: 12 },
      `Factory ${TARGET_FACTORY_FID} is missing FNAME in the DIW factory source`,
    ],
    [
      'invalid province',
      { FID: TARGET_FACTORY_FID, FNAME: 'โรงงาน', PROV: 999 },
      `Factory ${TARGET_FACTORY_FID} has an invalid province code`,
    ],
  ])('rejects %s before writing production data', (_label, source, expectedMessage) => {
    expect(() =>
      buildFactoryAccessGrant(77, {
        FACREG: null,
        DISPFACREG: null,
        CLASS: null,
        OBJECT: null,
        FFLAG: null,
        ...source,
      }),
    ).toThrow(expectedMessage);
  });

  it('falls back to FACREG and preserves an unknown operation status label', () => {
    const grant = buildFactoryAccessGrant(77, {
      FID: TARGET_FACTORY_FID,
      FACREG: 'ทะเบียนเดิม',
      DISPFACREG: TARGET_FACTORY_FID,
      FNAME: 'โรงงาน',
      PROV: '12',
      CLASS: null,
      OBJECT: null,
      FFLAG: '7',
    });

    expect(grant.oldRegistrationNo).toBe('ทะเบียนเดิม');
    expect(grant.operationStatus).toBe('สถานะ 7');
  });
});

function migrationSchemaMock(hasTable: boolean) {
  const table = {
    bigInteger: jest.fn().mockReturnThis(),
    specificType: jest.fn().mockReturnThis(),
    notNullable: jest.fn().mockReturnThis(),
    primary: jest.fn().mockReturnThis(),
    foreign: jest.fn().mockReturnThis(),
    references: jest.fn().mockReturnThis(),
    inTable: jest.fn().mockReturnThis(),
    onDelete: jest.fn().mockReturnThis(),
  };
  return {
    hasTable: jest.fn().mockResolvedValue(hasTable as never),
    createTable: jest.fn(async (_name: string, callback: (builder: typeof table) => void) => {
      callback(table);
    }),
  };
}
