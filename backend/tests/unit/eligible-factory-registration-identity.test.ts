import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex from 'knex';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));
jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findFactorySummaryForAccess: jest.fn(),
    findFactoryGeneral: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factory-candidates.repository', () => ({
  eligibleFactoryCandidatesRepository: {},
}));
jest.mock('../../src/modules/eligible-factories/eligible-factory-source-hydration', () => ({
  resolveEligibleFactoryAddressForStorage: jest.fn(),
}));
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  createFactoryProfileFromEligibleInTransaction: jest.fn(async () => undefined),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { eligibleFactoriesService } from '../../src/modules/eligible-factories/eligible-factories.service';
import type { EligibleFactoryAccessContext } from '../../src/modules/eligible-factories/eligible-factories.access';

const newNumber = '91090001125583';
const oldNumber = 'ข3-42(1)-11/58รย';
const mockedDb = db as unknown as jest.Mock & { transaction: jest.Mock };

function chain(row: Record<string, unknown>) {
  const query = {
    where: jest.fn(),
    whereNull: jest.fn(),
    forUpdate: jest.fn(),
    first: jest.fn(async () => row),
  };
  query.where.mockReturnValue(query);
  query.whereNull.mockReturnValue(query);
  query.forUpdate.mockReturnValue(query);
  return query;
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    factory_master_id: 30,
    source_factory_id: newNumber,
    factory_registration_no: oldNumber,
    factory_registration_no_old: null,
    factory_name: 'บริษัท อูเบะไฟน์ เคมิคอลส์ (เอเชีย) จำกัด',
    province_name: 'ระยอง',
    status: 'APPROVED',
    submitted_by: 42,
    submitted_at: '2026-09-01T00:00:00.000Z',
    factory_snapshot_json: JSON.stringify({
      sourceSystem: 'eligible_factory_add_requests',
      sourceFactoryId: newNumber,
      factoryRegistrationNoNew: newNumber,
      factoryRegistrationNoOld: oldNumber,
    }),
    ...overrides,
  };
}

describe('eligible add-request registration identity', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedDb.mockReset();
    mockedDb.transaction.mockReset();
    jest.mocked(connectionRequestsRepository.findFactorySummaryForAccess).mockReset();
    jest.mocked(connectionRequestsRepository.findFactoryGeneral).mockReset();
  });

  it('reloads the snapshot new/old numbers without treating the generic display number as new', async () => {
    mockedDb.mockReturnValue(chain(requestRow()));

    const result = await eligibleFactoriesRepository.findAddRequestById(1);

    expect(result?.requestedFactory).toMatchObject({
      sourceFactoryId: newNumber,
      factoryRegistrationNoNew: newNumber,
      factoryRegistrationNoOld: oldNumber,
    });
    expect(result?.factoryRegistrationNo).toBe(oldNumber);
  });

  it('reads the legacy snapshot using its source identity and preserves the old Thai display', async () => {
    mockedDb.mockReturnValue(
      chain(
        requestRow({
          factory_snapshot_json: JSON.stringify({
            sourceSystem: 'eligible_factory_add_requests',
            sourceFactoryId: newNumber,
            factoryRegistrationNoNew: oldNumber,
            factoryRegistrationNoOld: null,
          }),
        }),
      ),
    );

    const result = await eligibleFactoriesRepository.findAddRequestById(1);

    expect(result?.requestedFactory).toMatchObject({
      factoryRegistrationNoNew: newNumber,
      factoryRegistrationNoOld: oldNumber,
    });
  });

  it('creates, persists and reloads distinct identity and display numbers through the service', async () => {
    jest.mocked(connectionRequestsRepository.findFactorySummaryForAccess).mockResolvedValue({
      id: 30,
      factoryId: newNumber,
      factoryName: 'บริษัท อูเบะไฟน์ เคมิคอลส์ (เอเชีย) จำกัด',
      newRegistrationNo: newNumber,
      oldRegistrationNo: oldNumber,
      provinceName: 'ระยอง',
      isEligible: false,
      latitude: null,
      longitude: null,
    } as never);
    jest.mocked(connectionRequestsRepository.findFactoryGeneral).mockResolvedValue(null);
    const findSelected = jest
      .spyOn(eligibleFactoriesRepository, 'findByRegistrationNoNew')
      .mockResolvedValue(null);
    jest
      .spyOn(eligibleFactoriesRepository, 'findOpenAddRequestByFactoryMasterId')
      .mockResolvedValue(null);
    let inserted: Record<string, unknown> = {};
    const trx = jest.fn((table: string) => {
      if (table === 'factories') return chain({ id: 30 });
      if (table === 'eligible_factory_add_requests') {
        return {
          insert: (values: Record<string, unknown>) => {
            inserted = values;
            return { returning: async () => [{ id: 1 }] };
          },
        };
      }
      if (table === 'eligible_factory_add_requests as ef') return chain(requestRow(inserted));
      throw new Error(`Unexpected table: ${table}`);
    });
    mockedDb.transaction.mockImplementation(async (...args: unknown[]) =>
      (args[0] as (transaction: typeof trx) => Promise<unknown>)(trx),
    );
    const access = { actorUserId: 42 } as EligibleFactoryAccessContext;

    const result = await eligibleFactoriesService.createAddRequest(
      { factoryId: newNumber, reason: 'เข้าข่าย' },
      42,
      { view: access, edit: access },
    );

    expect(inserted).toMatchObject({
      source_factory_id: newNumber,
      factory_registration_no: oldNumber,
      factory_registration_no_old: oldNumber,
    });
    expect(JSON.parse(inserted.factory_snapshot_json as string)).toMatchObject({
      factoryRegistrationNoNew: newNumber,
      factoryRegistrationNoOld: oldNumber,
    });
    expect(findSelected.mock.calls.map(([number]) => number)).toEqual([newNumber, newNumber]);
    expect(result).toMatchObject({ factoryId: newNumber, factoryRegistrationNo: oldNumber });
    const reloaded = await eligibleFactoriesRepository.findAddRequestById(1, trx as never);
    expect(reloaded?.requestedFactory).toMatchObject({
      factoryRegistrationNoNew: newNumber,
      factoryRegistrationNoOld: oldNumber,
    });
  });

  it('restores the most recent deleted record of the selected source without reusing another form history', async () => {
    const sqlDb = knex({ client: 'mssql' });
    const deletedQuery = sqlDb('eligible_factories');
    jest.spyOn(sqlDb.client, 'runner').mockReturnValue({
      run: async () => ({ id: 17 }),
    } as never);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn(async () => 1),
    };
    let eligibleCalls = 0;
    const trx = Object.assign(
      jest.fn((table: string) => {
        if (table === 'factories')
          return {
            where: jest.fn().mockReturnThis(),
            whereNull: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: async () => null,
          };
        if (table === 'eligible_factories')
          return eligibleCalls++ === 0 ? deletedQuery : updateQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
      { fn: { now: () => '2026-10-06T00:00:00.000Z' } },
    );
    jest.spyOn(eligibleFactoriesRepository, 'findByRegistrationNoNew').mockResolvedValue(null);
    jest.spyOn(eligibleFactoriesRepository, 'findById').mockResolvedValue({ id: 17 } as never);
    try {
      await eligibleFactoriesRepository.create(
        {
          sourceSystem: 'diw.fac_import',
          sourceFactoryId: '10550000125197',
          monitoringPointFormId: null,
          factoryRegistrationNoNew: '10550000125197',
          factoryRegistrationNoOld: '3-1-1/19นน',
          factoryName: 'สถานีบ่มใบยาสบหนอง',
          provinceName: 'น่าน',
          operationStatus: 'แจ้งประกอบแล้ว',
        },
        42,
        trx as never,
      );
      const query = deletedQuery.toSQL();
      expect(query.sql).toContain('[source_factory_id] = ?');
      expect(query.sql).toContain('[source_system] = ?');
      expect(query.sql).toContain('[monitoring_point_form_id] is null');
      expect(query.sql).toContain('order by [deleted_at] desc, [id] desc');
      expect(updateQuery.where).toHaveBeenCalledWith('id', 17);
    } finally {
      await sqlDb.destroy();
    }
  });
});
