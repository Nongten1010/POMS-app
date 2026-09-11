import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockTransaction = jest.fn();
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  lockFactoryProfileInTransaction: jest.fn(),
}));
jest.mock('../../src/modules/factory-profiles/factory-profile-mode', () => ({
  isCanonicalFactoryProfilesEnabled: () => false,
}));
jest.mock('../../src/config/database', () => ({ db: { transaction: mockTransaction } }));
jest.mock('../../src/modules/monitoring-point-forms/monitoring-point-forms.repository', () => ({
  monitoringPointFormsRepository: {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    create: jest.fn(),
    findByMonitoringPointFormId: jest.fn(),
    findByRegistrationNoNew: jest.fn(),
    updateFromMonitoringPointForm: jest.fn(),
  },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factory-source-hydration', () => ({
  resolveEligibleFactoryAddressForStorage: jest.fn(
    async (input: { address?: string | null }) => input.address,
  ),
  resolveEligibleFactoryIndustrialEstateForStorage: jest.fn(),
}));

import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';
import type {
  MonitoringPointFormDTO,
  SaveMonitoringPointFormInput,
} from '../../src/modules/monitoring-point-forms/monitoring-point-forms.types';

const forms = jest.mocked(monitoringPointFormsRepository);
const eligible = jest.mocked(eligibleFactoriesRepository);
const input: SaveMonitoringPointFormInput = {
  factory: {
    factoryName: 'New factory name',
    factoryRegistrationNoNew: 'TEST-REG',
    provinceName: 'ระยอง',
  },
  points: [],
};
const saved = {
  id: 7,
  factory: input.factory,
  points: [],
  createdAt: '2026-09-11T00:00:00Z',
  updatedAt: '2026-09-11T00:00:00Z',
} as MonitoringPointFormDTO;

describe('monitoring point form and eligible writes share one transaction', () => {
  let committedForms: number[];
  let stagedForms: number[];
  const transaction = {} as Knex.Transaction;

  beforeEach(() => {
    jest.resetAllMocks();
    committedForms = [];
    stagedForms = [];
    mockTransaction.mockImplementation(async (callback: unknown) => {
      const result = await (callback as (trx: Knex.Transaction) => Promise<unknown>)(transaction);
      committedForms.push(...stagedForms);
      return result;
    });
    forms.list.mockResolvedValue([]);
    forms.create.mockImplementation(async (...args: unknown[]) => {
      (args[2] === transaction ? stagedForms : committedForms).push(7);
      return saved;
    });
    forms.update.mockImplementation(async (...args: unknown[]) => {
      (args[4] === transaction ? stagedForms : committedForms).push(7);
      return saved;
    });
    eligible.findByMonitoringPointFormId.mockResolvedValue(null);
    eligible.findByRegistrationNoNew.mockResolvedValue(null);
    eligible.create.mockRejectedValue(new Error('Eligible persistence failed'));
  });

  it.each(['create', 'update'] as const)(
    'rolls back the form if eligible persistence fails during %s',
    async (action) => {
      const operation =
        action === 'create'
          ? monitoringPointFormsService.create(input, 42)
          : monitoringPointFormsService.update(7, input, 42);
      await expect(operation).rejects.toThrow('Eligible persistence failed');
      expect(committedForms).toEqual([]);
    },
  );

  it('commits only after both writes succeed using the same transaction', async () => {
    eligible.create.mockResolvedValue({ id: 8 } as never);
    await monitoringPointFormsService.create(input, 42);
    expect(committedForms).toEqual([7]);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(eligible.create.mock.calls[0]?.[2]).toBe(transaction);
  });
});
