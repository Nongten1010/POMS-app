import { env } from '../../../config/env';
import { IdentityProvider } from './identity-provider.interface';
import { MockIdentityProvider } from './mock.identity-provider';

let instance: IdentityProvider | null = null;

export function getIdentityProvider(): IdentityProvider {
  if (instance) return instance;
  switch (env.IDENTITY_PROVIDER) {
    case 'mock':
      instance = new MockIdentityProvider();
      return instance;
    case 'external':
      throw new Error(
        '[identity-provider] external provider not yet implemented — set IDENTITY_PROVIDER=mock',
      );
    default:
      throw new Error(`[identity-provider] unknown provider: ${env.IDENTITY_PROVIDER}`);
  }
}

export type { IdentityProvider } from './identity-provider.interface';
