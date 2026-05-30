import { describe, expect, it } from '@jest/globals';
import { buildRequestNoPrefix } from '../../src/modules/connection-requests/connection-requests.repository';

describe('connectionRequestsRepository request numbers', () => {
  it('builds request number prefixes from system type and Thai Buddhist year', () => {
    const date = new Date('2026-05-30T12:00:00.000+07:00');

    expect(buildRequestNoPrefix('CEMS', date)).toBe('CEMS-69');
    expect(buildRequestNoPrefix('WPMS', date)).toBe('WPMS-69');
  });
});
