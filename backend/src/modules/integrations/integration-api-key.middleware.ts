import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/AppError';

const API_KEY_HEADER = 'x-api-key';

type IntegrationApiKeyEnvName =
  | 'INTEGRATION_API_KEYS'
  | 'DEVICE_CONFIG_API_KEYS'
  | 'ALERT_EVENT_API_KEYS';

export const authenticateIntegrationApiKey = authenticateIntegrationApiKeyFor(
  'INTEGRATION_API_KEYS',
);
export const authenticateDeviceConfigApiKey = authenticateIntegrationApiKeyFor(
  'DEVICE_CONFIG_API_KEYS',
  'INTEGRATION_API_KEYS',
);
export const authenticateAlertEventApiKey = authenticateIntegrationApiKeyFor(
  'ALERT_EVENT_API_KEYS',
  'INTEGRATION_API_KEYS',
);

function authenticateIntegrationApiKeyFor(
  primaryEnvName: IntegrationApiKeyEnvName,
  fallbackEnvName?: IntegrationApiKeyEnvName,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const apiKey = req.get(API_KEY_HEADER)?.trim();
    if (!apiKey) {
      return next(new UnauthorizedError('Missing X-API-Key header'));
    }

    if (!isAllowedApiKey(apiKey, primaryEnvName, fallbackEnvName)) {
      return next(new UnauthorizedError('Invalid integration API key'));
    }

    return next();
  };
}

function isAllowedApiKey(
  apiKey: string,
  primaryEnvName: IntegrationApiKeyEnvName,
  fallbackEnvName?: IntegrationApiKeyEnvName,
): boolean {
  const primaryKeys = parseApiKeys(process.env[primaryEnvName]);
  const allowedKeys =
    primaryKeys.length > 0 || !fallbackEnvName
      ? primaryKeys
      : parseApiKeys(process.env[fallbackEnvName]);

  return allowedKeys.some((allowedKey) => safeEquals(apiKey, allowedKey));
}

function parseApiKeys(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function safeEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
