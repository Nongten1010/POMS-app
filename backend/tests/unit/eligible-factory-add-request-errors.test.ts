import { describe, expect, it } from '@jest/globals';
import { isMssqlUniqueConstraintError } from '../../src/modules/eligible-factories/eligible-factory-add-request-errors';

describe('eligible factory add request MSSQL errors', () => {
  it.each([
    { number: 2601 },
    { number: 2627 },
    { originalError: { number: 2601 } },
    { originalError: { info: { number: 2627 } } },
  ])('recognizes unique constraint error shapes', (error) => {
    expect(isMssqlUniqueConstraintError(error)).toBe(true);
  });

  it('does not classify unrelated or malformed errors as unique violations', () => {
    expect(isMssqlUniqueConstraintError({ originalError: { info: { number: 50000 } } })).toBe(
      false,
    );
    expect(isMssqlUniqueConstraintError(new Error('database unavailable'))).toBe(false);
  });
});
