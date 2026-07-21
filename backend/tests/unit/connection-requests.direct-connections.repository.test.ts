import { describe, expect, it } from '@jest/globals';
import * as repositoryModule from '../../src/modules/connection-requests/connection-requests.repository';

const buildDirectRequestNoForTests = (
  repositoryModule as unknown as {
    buildDirectRequestNoForTests?: (
      systemType: 'CEMS' | 'WPMS',
      sequence: number,
      date: Date,
    ) => string;
  }
).buildDirectRequestNoForTests;

describe('direct connection request number', () => {
  it.each([
    ['CEMS', 'OLDC-69-00001'],
    ['WPMS', 'OLDW-69-00001'],
  ] as const)('formats %s with an isolated Buddhist-year sequence', (systemType, expected) => {
    expect(buildDirectRequestNoForTests).toBeDefined();
    expect(buildDirectRequestNoForTests?.(systemType, 1, new Date('2026-07-21T00:00:00Z'))).toBe(
      expected,
    );
  });

  it('uses five digits for every sequence value', () => {
    expect(
      buildDirectRequestNoForTests?.('WPMS', 42, new Date('2026-07-21T00:00:00Z')),
    ).toBe('OLDW-69-00042');
  });

  it('moves to the next Buddhist-year suffix at the Bangkok year boundary', () => {
    expect(
      buildDirectRequestNoForTests?.('CEMS', 1, new Date('2027-01-01T00:00:00Z')),
    ).toBe('OLDC-70-00001');
  });
});
