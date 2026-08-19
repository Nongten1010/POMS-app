import { describe, expect, it } from '@jest/globals';
import {
  BANGKOK_NOTIFICATION_EMAILS,
  correctedEmailsForRecipient,
  INDUSTRIAL_ESTATE_NOTIFICATION_EMAILS,
  STALE_NOTIFICATION_EMAIL,
} from '../../src/db/migrations/0097_correct_officer_notification_email_recipients';

describe('officer notification email recipient correction', () => {
  it('replaces the industrial-estate list with the current IEAT mailbox', () => {
    expect(
      correctedEmailsForRecipient({ recipient_type: 'INDUSTRIAL_ESTATE', province_name: null }, [
        'contact@ieat.mail.go.th',
        'investment.1@ieat.mail.go.th',
        STALE_NOTIFICATION_EMAIL,
      ]),
    ).toEqual(INDUSTRIAL_ESTATE_NOTIFICATION_EMAILS);
  });

  it('sets the Bangkok recipient to the DIW central mailbox', () => {
    expect(
      correctedEmailsForRecipient({ recipient_type: 'PROVINCE', province_name: 'กรุงเทพมหานคร' }, [
        STALE_NOTIFICATION_EMAIL,
      ]),
    ).toEqual(BANGKOK_NOTIFICATION_EMAILS);
  });

  it('removes the stale test mailbox without changing other province recipients', () => {
    expect(
      correctedEmailsForRecipient({ recipient_type: 'PROVINCE', province_name: 'ระยอง' }, [
        'saraban_rayong@industry.go.th',
        STALE_NOTIFICATION_EMAIL,
      ]),
    ).toEqual(['saraban_rayong@industry.go.th']);
  });
});
