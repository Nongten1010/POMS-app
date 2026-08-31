import { describe, expect, it } from '@jest/globals';
import { assertEligibleFactoryAddRequestReviewable } from '../../src/modules/eligible-factories/eligible-factory-add-request-state';

describe('eligible factory add request review state', () => {
  it('allows a different actor to review one open pending request', () => {
    expect(() =>
      assertEligibleFactoryAddRequestReviewable(
        { submittedBy: 42, status: 'PENDING_REVIEW' },
        true,
        7,
      ),
    ).not.toThrow();
  });

  it('forbids a submitter from reviewing their own request', () => {
    expect(() =>
      assertEligibleFactoryAddRequestReviewable(
        { submittedBy: 42, status: 'PENDING_REVIEW' },
        true,
        42,
      ),
    ).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it.each([
    { status: 'APPROVED' as const, isOpen: false },
    { status: 'REJECTED' as const, isOpen: false },
    { status: 'PENDING_REVIEW' as const, isOpen: false },
  ])('rejects a terminal or closed request ($status, open=$isOpen)', ({ status, isOpen }) => {
    expect(() =>
      assertEligibleFactoryAddRequestReviewable({ submittedBy: 42, status }, isOpen, 7),
    ).toThrow(expect.objectContaining({ code: 'CONFLICT' }));
  });
});
