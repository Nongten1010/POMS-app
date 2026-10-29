import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '../../src/config/logger';
import { DiwUserLoginIdentityProvider } from '../../src/modules/auth/identity-provider/diw-user-login.identity-provider';

const syntheticUsername = '1111111111111';
const syntheticPassword = 'synthetic-test*';
const syntheticClientId = 'synthetic-client';
const logs: Record<string, unknown>[] = [];
const captureLog = (entry: Record<string, unknown>) => logs.push(entry);

function createProvider(fetchImpl: typeof fetch, timeoutMs = 25) {
  return new DiwUserLoginIdentityProvider({
    operatorUrl: 'https://diw.example.invalid/operator',
    officerUrl: 'https://diw.example.invalid/officer',
    clientId: syntheticClientId,
    defaultProvinceId: '1000',
    timeoutMs,
    fetchImpl,
  });
}

function expectNoSecrets() {
  const serialized = JSON.stringify(logs);
  for (const secret of [syntheticUsername, syntheticPassword, syntheticClientId]) {
    expect(serialized).not.toContain(secret);
  }
}

describe('DIW authentication diagnostics at the HTTP boundary', () => {
  beforeEach(() => {
    logs.length = 0;
    logger.on('data', captureLog);
  });

  afterEach(() => {
    logger.removeListener('data', captureLog);
    jest.useRealTimers();
  });

  it('records a DIW denial even when HTTP succeeds, without logging credentials', async () => {
    const provider = createProvider(
      async () =>
        new Response(JSON.stringify([{ citizen_id: syntheticUsername, status: 'false' }]), {
          status: 200,
        }),
    );

    await expect(
      provider.authenticateOperator(syntheticUsername, syntheticPassword),
    ).resolves.toBeNull();

    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_rejected',
        userType: 'operator',
      }),
    );
    expectNoSecrets();
  });

  it('records HTTP failures without trusting upstream status text', async () => {
    const provider = createProvider(
      async () =>
        new Response(null, {
          status: 503,
          statusText: syntheticPassword,
        }),
    );

    await expect(
      provider.authenticateOperator(syntheticUsername, syntheticPassword),
    ).resolves.toBeNull();

    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_http_error',
        status: 503,
        level: expect.stringContaining('warn'),
      }),
    );
    expectNoSecrets();
  });

  it('distinguishes a malformed HTTP 200 response from a credential denial', async () => {
    const provider = createProvider(async () => new Response(syntheticPassword, { status: 200 }));

    await expect(
      provider.authenticateOperator(syntheticUsername, syntheticPassword),
    ).resolves.toBeNull();

    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_invalid_response',
      }),
    );
    expectNoSecrets();
  });

  it('records a real abort timeout without logging the thrown error', async () => {
    jest.useFakeTimers();
    const provider = createProvider(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException(syntheticPassword, 'AbortError'));
          });
        }),
    );

    const result = provider.authenticateOperator(syntheticUsername, syntheticPassword);
    await jest.advanceTimersByTimeAsync(25);
    await expect(result).resolves.toBeNull();

    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_timeout',
        elapsedMs: 25,
      }),
    );
    expectNoSecrets();
  });

  it('records an officer denial without logging the upstream message', async () => {
    const provider = createProvider(
      async () =>
        new Response(
          JSON.stringify({
            status: 'false',
            msg: syntheticPassword,
          }),
          { status: 200 },
        ),
    );

    await expect(
      provider.authenticateOfficer('U_TEST', syntheticPassword, '2'),
    ).resolves.toBeNull();

    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_rejected',
        userType: 'officer',
      }),
    );
    expectNoSecrets();
  });

  it('preserves a password containing a star in the DIW payload and logs only the outcome', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            status: 'true',
            citizen_id: syntheticUsername,
            juristic: [],
          },
        ]),
        { status: 200 },
      ),
    );
    const provider = createProvider(fetchImpl);

    await expect(
      provider.authenticateOperator(syntheticUsername, syntheticPassword),
    ).resolves.toMatchObject({
      identity_provider: 'i_industry',
      external_id: syntheticUsername,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://diw.example.invalid/operator',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          clientId: syntheticClientId,
          username: syntheticUsername,
          password: syntheticPassword,
        }),
      }),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_authenticated',
      }),
    );
    expectNoSecrets();
  });

  it('records a network failure without logging the thrown message', async () => {
    const provider = createProvider(async () => {
      throw new Error(syntheticPassword);
    });

    await expect(
      provider.authenticateOperator(syntheticUsername, syntheticPassword),
    ).resolves.toBeNull();

    expect(logs).toContainEqual(
      expect.objectContaining({
        provider: 'diw',
        reason: 'diw_request_failed',
      }),
    );
    expectNoSecrets();
  });
});
