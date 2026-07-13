import { describe, expect, it, jest } from '@jest/globals';

jest.mock(
  '../../src/modules/officer-notification-email-recipients/officer-notification-email-recipients.repository',
  () => ({
    officerNotificationEmailRecipientsRepository: {
      addEmail: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
    },
  }),
);

import { officerNotificationEmailRecipientsRepository } from '../../src/modules/officer-notification-email-recipients/officer-notification-email-recipients.repository';
import { officerNotificationEmailRecipientsService } from '../../src/modules/officer-notification-email-recipients/officer-notification-email-recipients.service';

const mockedRepository = jest.mocked(officerNotificationEmailRecipientsRepository);

describe('officerNotificationEmailRecipientsService', () => {
  it('reports a conflict when an admin creates a recipient that already exists', async () => {
    mockedRepository.create.mockRejectedValue({ number: 2627 });

    await expect(
      officerNotificationEmailRecipientsService.create(
        {
          recipientType: 'PROVINCE',
          provinceName: 'เชียงใหม่',
          emails: ['first@example.com'],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
