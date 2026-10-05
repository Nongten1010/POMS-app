export const MANDATORY_EMAIL_CC = 'diw.iemc@gmail.com';

export function includeMandatoryEmailCc(cc?: string | string[]): string[] {
  const recipients = cc === undefined ? [] : Array.isArray(cc) ? cc : [cc];
  const hasMandatoryCc = recipients.some(
    (recipient) => recipient.trim().toLowerCase() === MANDATORY_EMAIL_CC,
  );
  return hasMandatoryCc ? recipients : [...recipients, MANDATORY_EMAIL_CC];
}
