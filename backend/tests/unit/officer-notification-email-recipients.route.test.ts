import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock(
  '../../src/modules/officer-notification-email-recipients/officer-notification-email-recipients.service',
  () => ({
    officerNotificationEmailRecipientsService: {
      addEmail: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
    },
  }),
  { virtual: true },
);

import { createApp } from '../../src/app';
import { officerNotificationEmailRecipientsService } from '../../src/modules/officer-notification-email-recipients/officer-notification-email-recipients.service';

const mockedService = jest.mocked(officerNotificationEmailRecipientsService);

describe('officer notification email recipient routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an admin to create one province recipient with multiple email addresses', async () => {
    mockedService.create.mockResolvedValue({
      id: 1,
      recipientType: 'PROVINCE',
      provinceName: 'เชียงใหม่',
      emails: ['first@example.com', 'second@example.com'],
      isActive: true,
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/officer-notification-email-recipients')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        recipientType: 'PROVINCE',
        provinceName: 'เชียงใหม่',
        emails: ['first@example.com', 'second@example.com'],
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        recipientType: 'PROVINCE',
        provinceName: 'เชียงใหม่',
        emails: ['first@example.com', 'second@example.com'],
      },
    });
  });

  it('allows an admin to list existing recipient configurations', async () => {
    mockedService.list.mockResolvedValue([
      {
        id: 1,
        recipientType: 'PROVINCE',
        provinceName: 'เชียงใหม่',
        emails: ['first@example.com', 'second@example.com'],
        isActive: true,
        createdAt: '2026-07-13T00:00:00.000Z',
        updatedAt: '2026-07-13T00:00:00.000Z',
      },
    ]);
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/officer-notification-email-recipients')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          id: 1,
          emails: ['first@example.com', 'second@example.com'],
        },
      ],
    });
  });

  it('allows an admin to add another email without replacing existing emails', async () => {
    mockedService.addEmail.mockResolvedValue({
      id: 1,
      recipientType: 'PROVINCE',
      provinceName: 'เชียงใหม่',
      emails: ['first@example.com', 'second@example.com'],
      isActive: true,
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/officer-notification-email-recipients/1/emails')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ email: 'second@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 1,
        emails: ['first@example.com', 'second@example.com'],
      },
    });
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '1',
    userType: 'officer',
    roles: ['admin'],
    scopes: { 'notifications:edit': null },
  });
}
