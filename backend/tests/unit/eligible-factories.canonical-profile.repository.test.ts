import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockDb = jest.fn();
const mockUpdateProfile = jest.fn(async (..._args: unknown[]) => undefined);
const mockProjectForm = jest.fn(async (..._args: unknown[]) => undefined);
const mockCreateProfile = jest.fn(async (..._args: unknown[]) => undefined);
const mockLockProfile = jest.fn(async () => ({ id: 81 }));
jest.mock('../../src/config/env', () => ({
  env: { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'canonical', API_PREFIX: '/api/v1' },
}));
jest.mock('../../src/config/factory-source-database', () => ({ factorySourceDb: jest.fn() }));
jest.mock('../../src/config/database', () => ({ db: mockDb }));
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  updateFactoryProfileInTransaction: mockUpdateProfile,
  projectFactoryProfileToMonitoringFormInTransaction: mockProjectForm,
  createFactoryProfileFromEligibleInTransaction: mockCreateProfile,
  lockFactoryProfileInTransaction: mockLockProfile,
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';

function query(row: unknown = null) {
  return {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    forUpdate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(row).then(resolve, reject),
    update: jest.fn(async () => 1),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn(async () => [{ id: 81 }]),
  };
}
const stored = {
  id: 81,
  selected_at: '2026-09-11',
  created_at: '2026-09-11',
  updated_at: '2026-09-11',
};
const input = {
  factoryName: 'New factory name',
  factoryRegistrationNoNew: 'REG-TEST',
  provinceName: 'ระยอง',
  operationStatus: 'operating',
  monitoringPointFormId: 7,
  address: null,
  coordinates: { latitude: 12, longitude: 101 },
};

describe('eligible factory canonical profile transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates shared fields in the same transaction and excludes point-derived fields', async () => {
    const base = query(stored);
    const trx = Object.assign(
      jest.fn(() => base),
      { fn: { now: () => 'NOW' } },
    );
    await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      81,
      {
        ...input,
        productionCapacity: '200 tons',
        fuelUsed: 'gas',
        eia: 'อื่นๆ',
        eiaOther: 'Other assessment',
        hasEia: false,
        projectName: 'New project',
      },
      42,
      trx as unknown as Knex.Transaction,
    );

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      trx,
      81,
      expect.objectContaining({
        factory_name: 'New factory name',
        address: null,
        province_name: 'ระยอง',
        latitude: 12,
        longitude: 101,
        eia_assessment: 'อื่นๆ',
        eia_other: 'Other assessment',
        has_eia: false,
        project_name: 'New project',
      }),
      42,
      'monitoring-point-form',
    );
    const patch = (mockUpdateProfile.mock.calls[0] as unknown[] | undefined)?.[2];
    expect(patch).not.toHaveProperty('production_capacity');
    expect(patch).not.toHaveProperty('fuel_used');
    expect(patch).not.toHaveProperty('operation_status');
    expect(mockProjectForm).toHaveBeenCalledWith(trx, 81, 42);
    expect(mockProjectForm.mock.invocationCallOrder[0]).toBeGreaterThan(
      Number(mockUpdateProfile.mock.invocationCallOrder[0]),
    );
  });

  it('reads the shared form profile publicly and the pending raw values only inside form persistence', async () => {
    mockDb.mockImplementation((table: unknown) => {
      if (table === 'current_factory_monitoring_point_forms')
        return query({ ...stored, factory_name: 'Canonical name' });
      if (table === 'factory_monitoring_point_forms')
        return query({ ...stored, factory_name: 'Pending form name' });
      if (table === 'factory_monitoring_points') return query([]);
      throw new Error(`Unexpected form read ${String(table)}`);
    });
    expect((await monitoringPointFormsRepository.findById(81))?.factory.factoryName).toBe(
      'Canonical name',
    );
    expect(
      (await monitoringPointFormsRepository.findById(81, undefined, undefined, true))?.factory
        .factoryName,
    ).toBe('Pending form name');
  });

  it('clears all three canonical EIA fields when the form explicitly sends null', async () => {
    const base = query(stored);
    const trx = Object.assign(
      jest.fn(() => base),
      { fn: { now: () => 'NOW' } },
    );
    await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      81,
      { ...input, eia: null, eiaOther: null, hasEia: null },
      42,
      trx as unknown as Knex.Transaction,
    );
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      trx,
      81,
      expect.objectContaining({ eia_assessment: null, eia_other: null, has_eia: null }),
      42,
      'monitoring-point-form',
    );
  });

  it('reads selected factory detail from the canonical view', async () => {
    mockDb.mockReturnValue(query(stored));
    await eligibleFactoriesRepository.findById(81);
    expect(mockDb).toHaveBeenCalledWith('current_eligible_factories');
  });

  it.each([false, true])(
    'creates a profile in the selection transaction (restored: %s)',
    async (restored) => {
      const queues = {
        factories: [query(null)],
        eligible_factories: [query(null), query(restored ? { id: 81 } : null), query(stored)],
      } as Record<string, ReturnType<typeof query>[]>;
      const trx = Object.assign(
        jest.fn((table: string) => {
          if (table === 'current_eligible_factories') return query(stored);
          return queues[table]?.shift() ?? query(stored);
        }),
        { fn: { now: () => 'NOW' } },
      );
      await eligibleFactoriesRepository.create(input, 42, trx as unknown as Knex.Transaction);
      expect(mockCreateProfile).toHaveBeenCalledWith(trx, 81, 42, 'eligible-selection');
    },
  );
});
