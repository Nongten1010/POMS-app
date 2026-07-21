import { describe, expect, it, jest } from '@jest/globals';
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
const reserveDirectRequestNoForTests = (
  repositoryModule as unknown as {
    reserveDirectRequestNoForTests: (
      trx: unknown,
      systemType: 'CEMS' | 'WPMS',
      date: Date,
    ) => Promise<string>;
  }
).reserveDirectRequestNoForTests;

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
    expect(buildDirectRequestNoForTests?.('WPMS', 42, new Date('2026-07-21T00:00:00Z'))).toBe(
      'OLDW-69-00042',
    );
  });

  it.each([0, 100_000, 1.5])('rejects an out-of-range sequence value %s', (sequence) => {
    expect(() =>
      buildDirectRequestNoForTests?.('CEMS', sequence, new Date('2026-07-21T00:00:00Z')),
    ).toThrow(RangeError);
  });

  it('moves to the next Buddhist-year suffix at the Bangkok year boundary', () => {
    expect(buildDirectRequestNoForTests?.('CEMS', 1, new Date('2027-01-01T00:00:00Z'))).toBe(
      'OLDC-70-00001',
    );
  });

  it('locks and increments the system/year sequence row before formatting', async () => {
    const selectBuilder = {
      where: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<{ last_sequence: string }>>().mockResolvedValue({
        last_sequence: '7',
      }),
    };
    const updateBuilder = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn<(_row: unknown) => Promise<number>>().mockResolvedValue(1),
    };
    const trx = Object.assign(
      jest
        .fn<(...args: unknown[]) => unknown>()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(updateBuilder),
      { fn: { now: jest.fn(() => 'db-now') } },
    );

    await expect(
      reserveDirectRequestNoForTests(trx as never, 'CEMS', new Date('2026-07-21T00:00:00Z')),
    ).resolves.toBe('OLDC-69-00008');
    expect(selectBuilder.where).toHaveBeenCalledWith({
      system_type: 'CEMS',
      buddhist_year: '69',
    });
    expect(selectBuilder.forUpdate).toHaveBeenCalledTimes(1);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      last_sequence: 8,
      updated_at: 'db-now',
    });
  });

  it('fails closed when the system/year sequence row was not provisioned', async () => {
    const selectBuilder = {
      where: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<undefined>>().mockResolvedValue(undefined),
    };
    const trx = Object.assign(
      jest.fn<(...args: unknown[]) => unknown>(() => selectBuilder),
      {
        fn: { now: jest.fn(() => 'db-now') },
      },
    );

    await expect(
      reserveDirectRequestNoForTests(trx as never, 'WPMS', new Date('2026-07-21T00:00:00Z')),
    ).rejects.toThrow('Direct request sequence is not provisioned for WPMS-69');
    expect(selectBuilder.forUpdate).toHaveBeenCalledTimes(1);
    expect(trx).toHaveBeenCalledTimes(1);
  });
});
