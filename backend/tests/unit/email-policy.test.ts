import { describe, expect, it } from '@jest/globals';
import {
  includeMandatoryEmailCc,
  MANDATORY_EMAIL_CC,
} from '../../src/shared/services/email-policy';

describe('pure email recipient policy', () => {
  it('always includes the central mailbox without requiring SMTP or DB configuration', () => {
    expect(includeMandatoryEmailCc()).toEqual(['diw.iemc@gmail.com']);
    expect(MANDATORY_EMAIL_CC).toBe('diw.iemc@gmail.com');
  });
  it('retains existing recipients and does not add a duplicate central mailbox', () => {
    expect(includeMandatoryEmailCc('tester@example.test')).toEqual([
      'tester@example.test',
      MANDATORY_EMAIL_CC,
    ]);
    expect(includeMandatoryEmailCc(['DIW.IEMC@gmail.com', 'tester@example.test'])).toEqual([
      'DIW.IEMC@gmail.com',
      'tester@example.test',
    ]);
  });
});
