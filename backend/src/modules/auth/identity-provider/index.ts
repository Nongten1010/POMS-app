import { env } from '../../../config/env';
import { IdentityProvider } from './identity-provider.interface';
import { DiwUserLoginIdentityProvider } from './diw-user-login.identity-provider';
import { MockIdentityProvider } from './mock.identity-provider';

let instance: IdentityProvider | null = null;

export function getIdentityProvider(): IdentityProvider {
  if (instance) return instance;
  switch (env.IDENTITY_PROVIDER) {
    case 'mock':
      instance = withOptionalDiwLogin(new MockIdentityProvider());
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

function withOptionalDiwLogin(primary: IdentityProvider): IdentityProvider {
  if (!env.DIW_USER_LOGIN_ENABLED && !env.DIW_OFFICER_LOGIN_ENABLED) return primary;

  const diwProvider = new DiwUserLoginIdentityProvider({
    operatorUrl: env.DIW_USER_LOGIN_URL,
    officerUrl: env.DIW_OFFICER_LOGIN_URL,
    clientId: env.DIW_USER_LOGIN_CLIENT_ID!,
    timeoutMs: env.DIW_USER_LOGIN_TIMEOUT_MS,
    defaultProvinceId: env.DIW_USER_LOGIN_DEFAULT_PROVINCE_ID,
  });

  return {
    async authenticateOfficer(username, password, departmentID) {
      const primaryProfile = await primary.authenticateOfficer(username, password, departmentID);
      if (primaryProfile || !env.DIW_OFFICER_LOGIN_ENABLED) return primaryProfile;
      return diwProvider.authenticateOfficer(username, password, departmentID);
    },
    async authenticateOperator(username, password) {
      const primaryProfile = await primary.authenticateOperator(username, password);
      if (primaryProfile || !env.DIW_USER_LOGIN_ENABLED) return primaryProfile;
      return diwProvider.authenticateOperator(username, password);
    },
    authenticateCitizen: primary.authenticateCitizen.bind(primary),
  };
}
