import { jest } from '@jest/globals';
import { authService } from '../../src/modules/auth/auth.service';
import type { AuthenticatedUser } from '../../src/shared/types/express';
import * as jwtUtils from '../../src/shared/utils/jwt';
import type { AccessTokenPayload } from '../../src/shared/utils/jwt';

const originalSignAccessToken = jwtUtils.signAccessToken;
const originalVerifyAccessToken = jwtUtils.verifyAccessToken;
const authorizationFixtures = new Map<string, AuthenticatedUser>();
let selectedAuthorization: AuthenticatedUser | undefined;

/**
 * Isolated feature-route tests provide their current account fixture here instead
 * of opening a DB connection. Live authorization regressions use the real resolver.
 */
export function signTestAccessToken(payload: AccessTokenPayload): string {
  const userId = Number(payload.sub);
  const token = originalSignAccessToken(payload);
  authorizationFixtures.set(token, {
    id: userId,
    userType: payload.userType,
    roles: [...payload.roles],
    scopes: { ...payload.scopes },
    scopeDetails: payload.scopeDetails ? structuredClone(payload.scopeDetails) : undefined,
    regionalAccess: payload.regionalAccess ? structuredClone(payload.regionalAccess) : null,
  });

  // Tests can model different current accounts with the same fixture id. Select the
  // intended fixture only after the real signature/expiration checks have passed.
  // Each sign reinstalls both implementations after resetAllMocks/restoreAllMocks.
  jest.spyOn(jwtUtils, 'verifyAccessToken').mockImplementation((accessToken) => {
    selectedAuthorization = undefined;
    const verified = originalVerifyAccessToken(accessToken);
    selectedAuthorization = authorizationFixtures.get(accessToken);
    return verified;
  });

  jest.spyOn(authService, 'getAuthorizationContext').mockImplementation(async (id) => {
    // Clone synchronously before the returned Promise yields so concurrent route
    // requests cannot replace the context selected for this authentication call.
    const account = selectedAuthorization;
    if (!account || account.id !== id) {
      throw new Error(`Current authorization fixture is missing for user ${id}`);
    }
    return structuredClone(account);
  });

  return token;
}
