import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { pomsStatusManagementService } from '../../src/modules/poms-factories/poms-status-management.service';
import { pomsStatusManagementRepository } from '../../src/modules/poms-factories/poms-status-management.repository';
import { defaultFactoryStatus } from '../../src/modules/poms-factories/poms-status-management.types';
jest.mock('../../src/modules/poms-factories/poms-status-management.repository', () => ({
  pomsStatusManagementRepository: { read: jest.fn(), update: jest.fn() },
}));
const repo = jest.mocked(pomsStatusManagementRepository);
const actor = {
  actorUserId: 42,
  roles: ['admin'],
  scope: { scope: 'IN_PROVINCE' as const, province: 'ระยอง' },
  regionalAccess: { regions: ['ภาคตะวันออก'] },
};
const snapshot = { state: defaultFactoryStatus(), revision: 0, updatedAt: null, updatedBy: null };
const result = {
  source: { factoryId: 'F1', eligibleFactoryId: 7, factoryName: 'Test', measurementPoints: [] },
  snapshot,
};
beforeEach(() => {
  jest.clearAllMocks();
  repo.read.mockResolvedValue(result);
  repo.update.mockResolvedValue(result);
});
describe('Status management service', () => {
  it('preserves assigned province and regional access on reads and writes', async () => {
    expect(await pomsStatusManagementService.get('F1', actor)).toMatchObject({
      factoryId: 'F1',
      revision: 0,
    });
    const input = {
      expectedRevision: 0,
      reason: 'test',
      factory: { visibility: 'HIDDEN' as const },
    };
    await pomsStatusManagementService.update('F1', actor, input);
    expect(repo.read).toHaveBeenCalledWith('F1', actor);
    expect(repo.update).toHaveBeenCalledWith('F1', actor, input);
  });
  it('rejects non-admin direct service calls before any database access', async () => {
    const outsider = { ...actor, roles: ['factory_operator'] };
    await expect(pomsStatusManagementService.get('F1', outsider)).rejects.toThrow('Only Admin');
    await expect(
      pomsStatusManagementService.update('F1', outsider, {
        expectedRevision: 0,
        reason: 'test',
        factory: { visibility: 'HIDDEN' },
      }),
    ).rejects.toThrow('Only Admin');
    expect(repo.read).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('validates direct service inputs before saving', async () => {
    await expect(
      pomsStatusManagementService.update('F1', actor, {
        expectedRevision: 0,
        reason: '',
        factory: {},
      }),
    ).rejects.toThrow();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
