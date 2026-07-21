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
  up,
} from '../../src/db/migrations/0073_grant_operator_demo_factory_access';

describe('0073_grant_operator_demo_factory_access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('does nothing on a fresh database before operator_demo is seeded', async () => {
    const first = jest.fn().mockResolvedValue(undefined as never);
    const usersQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first,
    };
    const raw = jest.fn();
    const knex = Object.assign(jest.fn(() => usersQuery), { raw });

    await up(knex as never);

    expect(usersQuery.where).toHaveBeenCalledWith({
      external_id: TARGET_OPERATOR_EXTERNAL_ID,
      user_type: 'operator',
    });
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
    const knex = Object.assign(jest.fn(() => usersQuery), { raw });
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
    expect(sql).toContain('INSERT INTO user_juristics');
    expect(sql).toContain('INSERT INTO eligible_factories');
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
});
