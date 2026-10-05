import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('../../src/modules/alert-events/alert-events.service', () => ({
  alertEventsService: { getById: jest.fn() },
}));
jest.mock('../../src/modules/alert-emails/alert-email-template', () => ({
  renderAlertEmail: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-outbox.repository', () => ({
  alertEmailOutboxRepository: { findDelivery: jest.fn() },
}));
import { alertEmailPreviewRoutes } from '../../src/modules/alert-emails/alert-email-preview';
import { alertEmailHistoryRoutes } from '../../src/modules/alert-emails/alert-email-history';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import { renderAlertEmail } from '../../src/modules/alert-emails/alert-email-template';
import { alertEmailOutboxRepository } from '../../src/modules/alert-emails/alert-email-outbox.repository';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { NotFoundError } from '../../src/shared/errors/AppError';

const events = jest.mocked(alertEventsService.getById);
const render = jest.mocked(renderAlertEmail);
const find = jest.mocked(alertEmailOutboxRepository.findDelivery);
const payload = { eventIds: [1], scheduledAt: '2026-10-02T12:05:00+07:00' };
function app() {
  const result = express();
  result.use(express.json());
  result.use('/api/v1/alert-email-previews', alertEmailPreviewRoutes);
  result.use('/api/v1/alert-email-deliveries', alertEmailHistoryRoutes);
  result.use(errorHandler);
  return result;
}
function token(permission: string): string {
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['officer'],
    scopes: { [permission]: 'OWN_FACTORY' },
  });
}
describe('alert email API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    events.mockResolvedValue({ id: 1, endedAt: '2026-10-02T11:59:59+07:00' } as never);
    render.mockReturnValue({ subject: 'preview', text: 'plain text', html: '<p>preview</p>' });
    find.mockResolvedValue({
      id: 1,
      recipient: 'private@example.com',
      eventIds: [1, 2],
      leaseToken: 'lease',
      leasedUntil: null,
      deduplicationKey: 'internal',
    } as never);
  });
  it('requires authentication for both endpoints', async () => {
    expect((await request(app()).post('/api/v1/alert-email-previews').send(payload)).status).toBe(
      401,
    );
    expect((await request(app()).get('/api/v1/alert-email-deliveries/1')).status).toBe(401);
    expect(events).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
  it('does not permit viewing permission to preview or editing permission to view delivery recipients', async () => {
    expect(
      (
        await request(app())
          .post('/api/v1/alert-email-previews')
          .set('Authorization', `Bearer ${token('notifications:view')}`)
          .send(payload)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app())
          .get('/api/v1/alert-email-deliveries/1')
          .set('Authorization', `Bearer ${token('notifications:edit')}`)
      ).status,
    ).toBe(403);
    expect(events).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
  it('passes the editing data scope into preview and returns only rendered content', async () => {
    const result = await request(app())
      .post('/api/v1/alert-email-previews')
      .set('Authorization', `Bearer ${token('notifications:edit')}`)
      .send(payload);
    expect(result.status).toBe(200);
    expect(events).toHaveBeenCalledWith(1, 7, { scope: 'OWN_FACTORY' }, null, false);
    expect(result.body.data).toMatchObject({
      subject: 'preview',
      eventCount: 1,
      scheduledAt: payload.scheduledAt,
    });
    expect(find).not.toHaveBeenCalled();
  });
  it.each([
    { ...payload, eventIds: [1, 1] },
    { ...payload, to: 'other@example.com' },
    { ...payload, scheduledAt: '2026-02-30T09:00:00+07:00' },
  ])('rejects invalid preview input before reading events: %j', async (body) => {
    const result = await request(app())
      .post('/api/v1/alert-email-previews')
      .set('Authorization', `Bearer ${token('notifications:edit')}`)
      .send(body);
    expect(result.status).toBe(400);
    expect(events).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });
  it('checks all delivery event scopes and omits internal leases on success', async () => {
    const result = await request(app())
      .get('/api/v1/alert-email-deliveries/1')
      .set('Authorization', `Bearer ${token('notifications:view_status')}`);
    expect(result.status).toBe(200);
    expect(events).toHaveBeenCalledWith(2, 7, { scope: 'OWN_FACTORY' }, null, false);
    expect(result.body.data).toHaveProperty('recipient', 'private@example.com');
    expect(result.body.data).not.toHaveProperty('leaseToken');
  });
  it('returns 404 without leaking delivery recipients when one event is out of scope', async () => {
    events.mockResolvedValueOnce({ id: 1 } as never).mockRejectedValueOnce(new NotFoundError());
    const result = await request(app())
      .get('/api/v1/alert-email-deliveries/1')
      .set('Authorization', `Bearer ${token('notifications:view_status')}`);
    expect(result.status).toBe(404);
    expect(JSON.stringify(result.body)).not.toContain('private@example.com');
  });
});
