import { describe, expect, it } from '@jest/globals';
import { connectionRequestsOpenApiDocument } from '../../src/modules/api-docs/connection-requests.openapi';
import { createDeviceConnectionConfigRequestSchema } from '../../src/modules/device-connections/device-connections.validator';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('duplicate device config OpenAPI contract', () => {
  it('shows the validation issues returned for a duplicate parameter payload', () => {
    const result = createDeviceConnectionConfigRequestSchema.safeParse({
      stationId: 'S2014',
      deviceCode: 'S2014/01',
      protocol: 'MSSQL',
      channels: [
        { dataType: 'CO (ppm)', addressId: 3 },
        { dataType: ' co (PPM) ', addressId: null },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Duplicate parameter unexpectedly accepted');

    const path = obj(connectionRequestsOpenApiDocument.paths)['/cems-wpms-requests/{id}/device-configs'];
    const response = obj(obj(obj(path).post).responses)['400'];
    const media = obj(obj(obj(response).content)['application/json']);
    const example = obj(obj(obj(media.examples).duplicateParameter).value);

    expect(example.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: result.error.flatten().fieldErrors,
      issues: result.error.issues.map((issue) => ({
        code: issue.code,
        path: [...issue.path],
        pathString: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    });
  });

  it.each([
    '/cems-wpms-requests/{id}/device-configs',
    '/connected-measurement-points/{stationId}/device-configs',
    '/connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
  ])('publishes duplicate validation errors for %s', (path) => {
    const post = obj(obj(obj(connectionRequestsOpenApiDocument.paths)[path]).post);
    const badRequest = obj(obj(post.responses)['400']);
    const media = obj(obj(badRequest.content)['application/json']);
    const examples = obj(media.examples);

    expect(obj(obj(examples.duplicateParameter).value)).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(obj(obj(examples.duplicateDevice).value)).toMatchObject({
      success: false,
      error: { code: 'BAD_REQUEST' },
    });
    expect(media.schema).toEqual({ $ref: '#/components/schemas/ErrorEnvelope' });
  });
});
