import { describe, expect, it } from '@jest/globals';
import { changeKwpWorkflowStatusSchema } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.validator';

describe('KWP rejection request contract', () => {
  it('accepts rejection without a reason', () => {
    expect(changeKwpWorkflowStatusSchema.parse({ action: 'REJECT' })).toMatchObject({
      action: 'REJECT',
      officerNote: null,
    });
  });

  it.each([null, '', '   '])('accepts an empty rejection reason %p', (reason) => {
    expect(
      changeKwpWorkflowStatusSchema.parse({
        action: 'REJECT',
        revisionReason: reason,
        officerNote: reason,
      }),
    ).toEqual({ action: 'REJECT', revisionReason: null, officerNote: null });
  });

  it('keeps request-revision reasons mandatory and rejects untrusted fields', () => {
    expect(changeKwpWorkflowStatusSchema.safeParse({ action: 'REQUEST_REVISION' }).success).toBe(
      false,
    );
    expect(
      changeKwpWorkflowStatusSchema.safeParse({ action: 'REJECT', reviewedBy: 999 }).success,
    ).toBe(false);
    expect(
      changeKwpWorkflowStatusSchema.safeParse({ action: 'REJECT', officerNote: 999 }).success,
    ).toBe(false);
  });
});
