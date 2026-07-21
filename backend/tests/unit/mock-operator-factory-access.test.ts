import { describe, expect, it } from '@jest/globals';
import { MockIdentityProvider } from '../../src/modules/auth/identity-provider/mock.identity-provider';

describe('operator_demo factory access', () => {
  it('includes factory 10120000325542 after authentication', async () => {
    const provider = new MockIdentityProvider();

    const profile = await provider.authenticateOperator('operator_demo', 'demo1234');

    expect(
      profile?.juristics.flatMap((juristic) => juristic.factories.map((factory) => factory.fid)),
    ).toContain('10120000325542');

    const targetJuristic = profile?.juristics.find((juristic) =>
      juristic.factories.some((factory) => factory.fid === '10120000325542'),
    );
    expect(targetJuristic?.juristic_id).toBe('9900000009999');
    expect(targetJuristic?.factories).toHaveLength(1);
  });
});
