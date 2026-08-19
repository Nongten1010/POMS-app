import { describe, expect, it } from '@jest/globals';
import {
  includeMandatoryEmailCc,
  MANDATORY_EMAIL_CC,
} from '../../src/shared/services/email.service';

describe('email service mandatory CC', () => {
  it('adds the DIW IEMC mailbox when no CC is supplied', () => {
    expect(includeMandatoryEmailCc()).toEqual([MANDATORY_EMAIL_CC]);
  });

  it('preserves existing CC recipients and adds the DIW IEMC mailbox', () => {
    expect(includeMandatoryEmailCc(['regional@example.com'])).toEqual([
      'regional@example.com',
      MANDATORY_EMAIL_CC,
    ]);
  });

  it('does not add the DIW IEMC mailbox twice', () => {
    expect(includeMandatoryEmailCc('DIW.IEMC@gmail.com')).toEqual(['DIW.IEMC@gmail.com']);
  });
});
