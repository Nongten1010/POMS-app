import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('../../src/modules/alert-emails/alert-email-outbox.repository', () => ({
  alertEmailOutboxRepository: { findDelivery: jest.fn() },
}));
jest.mock('../../src/modules/alert-events/alert-events.service', () => ({
  alertEventsService: { getById: jest.fn() },
}));
import {
  alertEmailOutboxRepository,
  type AlertEmailDelivery,
} from '../../src/modules/alert-emails/alert-email-outbox.repository';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import { alertEmailHistoryService } from '../../src/modules/alert-emails/alert-email-history';
import { NotFoundError } from '../../src/shared/errors/AppError';
const find = jest.mocked(alertEmailOutboxRepository.findDelivery);
const event = jest.mocked(alertEventsService.getById);
const actor = { userId: 7, scope: { scope: 'OWN_FACTORY' as const }, regionalAccess: null };
describe('scoped email delivery history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    find.mockResolvedValue({
      id: 1,
      eventIds: [3, 4],
      recipient: 'private@example.com',
      leaseToken: 'secret-lease',
      leasedUntil: 'time',
      deduplicationKey: 'internal',
      status: 'UNKNOWN',
    } as AlertEmailDelivery);
    event.mockResolvedValue({ id: 3 } as never);
  });
  it('requires scope for every event before returning any recipients or content', async () => {
    event.mockResolvedValueOnce({ id: 3 } as never).mockRejectedValueOnce(new NotFoundError());
    await expect(alertEmailHistoryService.getById(1, actor)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(event).toHaveBeenCalledWith(4, 7, { scope: 'OWN_FACTORY' }, null, false);
  });
  it('omits internal leases and deduplication keys from the public DTO', async () => {
    const result = await alertEmailHistoryService.getById(1, actor);
    expect(result).toMatchObject({ recipient: 'private@example.com', status: 'UNKNOWN' });
    expect(result).not.toHaveProperty('leaseToken');
    expect(result).not.toHaveProperty('leasedUntil');
    expect(result).not.toHaveProperty('deduplicationKey');
  });
  it('returns the same not-found response for missing or empty deliveries', async () => {
    find.mockResolvedValueOnce(null);
    await expect(alertEmailHistoryService.getById(9, actor)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    find.mockResolvedValueOnce({ eventIds: [] } as unknown as AlertEmailDelivery);
    await expect(alertEmailHistoryService.getById(9, actor)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
