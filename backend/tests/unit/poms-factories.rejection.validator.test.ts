import { describe, expect, it } from '@jest/globals';
import { reviewPomsFactoryEditRequestSchema } from '../../src/modules/poms-factories/poms-factories.validator';

describe('POMS factory edit request rejection validation', () => {
  it.each([{}, { officerNote: null }, { officerNote: '' }, { officerNote: '   ' }])(
    'accepts rejection without a reason for %j',
    (note) => {
      expect(
        reviewPomsFactoryEditRequestSchema.safeParse({ decision: 'REJECT', ...note }).success,
      ).toBe(true);
    },
  );

  it.each([{ officerNote: 123 }, { officerNote: 'a'.repeat(1001) }])(
    'retains officer-note type and length validation for %j',
    (note) => {
      expect(
        reviewPomsFactoryEditRequestSchema.safeParse({ decision: 'REJECT', ...note }).success,
      ).toBe(false);
    },
  );
});
