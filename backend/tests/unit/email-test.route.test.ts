import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/shared/services/email.service', () => ({
  emailService: {
    isConfigured: jest.fn(),
    send: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { emailService } from '../../src/shared/services/email.service';

const mockedEmailService = jest.mocked(emailService);

describe('email test route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEmailService.isConfigured.mockReturnValue(true);
    mockedEmailService.send.mockResolvedValue({ messageId: 'test-message-id' });
  });

  it('sends a test email to the fixed test recipient', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/email-test/send')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        subject: 'POMS test mail',
        message: 'Testing SMTP from POMS.',
      });

    expect(response.status).toBe(200);
    expect(mockedEmailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'yuth.s@ku.th',
        subject: 'POMS test mail',
        text: expect.stringContaining('Testing SMTP from POMS.'),
        html: expect.stringContaining('<meta charset="utf-8">'),
      }),
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        to: 'yuth.s@ku.th',
        subject: 'POMS test mail',
      },
    });
  });

  it('rejects attempts to override the fixed recipient', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/email-test/send')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        to: 'other@example.com',
        subject: 'POMS test mail',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedEmailService.send).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/email-test/send').send({});

    expect(response.status).toBe(401);
    expect(mockedEmailService.send).not.toHaveBeenCalled();
  });

  it('returns service unavailable when SMTP is not configured', async () => {
    mockedEmailService.isConfigured.mockReturnValue(false);
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/email-test/send')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SMTP_NOT_CONFIGURED');
    expect(mockedEmailService.send).not.toHaveBeenCalled();
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '1',
    userType: 'officer',
    roles: ['admin'],
    scopes: {},
  });
}
