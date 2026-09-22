import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import { resubmitConnectionRequestSchema } from '../../src/modules/connection-requests/connection-requests.validator';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('collaborative resubmission contract', () => {
  it.each([
    '/cems-wpms-requests/{id}/device-configs',
    '/cems-wpms-requests/{id}/confirm-connection',
    '/cems-wpms-requests/{id}/cancel',
    '/connected-measurement-points/{stationId}/device-configs',
    '/connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
  ])('publishes collaborative edit scope for request action %s', (path) => {
    const action = obj(obj(obj(pomsOpenApiDocument.paths)[path]).post);
    for (const text of [
      'cems_wpms_requests:edit',
      'OWN_FACTORY',
      'user_factory_access',
      'regionalAccess',
    ]) {
      expect(action.description).toEqual(expect.stringContaining(text));
    }
  });

  const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
  const operation = obj(obj(obj(pomsOpenApiDocument.paths)['/cems-wpms-requests/{id}/form']).put);

  it('publishes the same optional concurrency token on GET form and PUT input', () => {
    const formToken = obj(obj(schemas.ConnectionRequestForm).properties).expectedUpdatedAt;
    const inputToken = obj(obj(schemas.ResubmitConnectionRequest).properties).expectedUpdatedAt;
    expect(formToken).toEqual(inputToken);
    expect(inputToken).toMatchObject({ type: 'string', format: 'date-time' });
    expect(obj(schemas.ResubmitConnectionRequest).required).not.toContain('expectedUpdatedAt');
    const example = obj(schemas.ResubmitConnectionRequest).example as Obj;
    for (const token of ['2026-09-13T00:00:00.000Z', '2026-09-13T07:00:00+07:00']) {
      expect(
        resubmitConnectionRequestSchema.parse({ ...example, expectedUpdatedAt: token }),
      ).toMatchObject({ expectedUpdatedAt: token });
    }
    expect(
      resubmitConnectionRequestSchema.safeParse({ ...example, expectedUpdatedAt: 'invalid' })
        .success,
    ).toBe(false);
  });

  it('documents assignment, scoped edit rights, status restrictions and a resolvable 409 response', () => {
    for (const value of [
      'cems_wpms_requests:edit',
      'OWN_FACTORY',
      'user_juristics',
      'user_factory_access',
      'regionalAccess',
      'WAITING_FACTORY_REVISION',
      'REQUEST_CHANGED',
    ]) {
      expect(operation.description).toEqual(expect.stringContaining(value));
    }
    const conflict = obj(obj(obj(obj(operation.responses)['409']).content)['application/json']);
    expect(conflict.schema).toEqual({ $ref: '#/components/schemas/ErrorEnvelope' });
    expect(schemas.ErrorEnvelope).toBeDefined();
    expect(obj(obj(conflict.examples).requestChanged).value).toMatchObject({
      success: false,
      error: { code: 'CONFLICT', details: { reason: 'REQUEST_CHANGED' } },
    });
  });

  it.each([
    {
      name: 'pointsAlreadyConnected',
      reason: 'REQUEST_POINTS_ALREADY_CONNECTED',
      message: 'Connected measurement points cannot be removed by resubmission',
      details: { path: 'measurementPoints', requestId: 101 },
    },
    {
      name: 'pointCodeReleaseBlocked',
      reason: 'POINT_CODE_RELEASE_BLOCKED',
      message: 'Measurement point code is still referenced and cannot be released',
      details: { path: 'measurementPoints', requestId: 101, pointCode: 'S1054' },
    },
  ])('publishes an actionable 409 example for $reason', ({ name, reason, message, details }) => {
    const response = obj(obj(operation.responses)['409']);
    const media = obj(obj(response.content)['application/json']);
    expect(media.example).toBeUndefined();
    expect(obj(obj(media.examples)[name]).value).toEqual({
      success: false,
      error: { code: 'CONFLICT', message, details: { ...details, reason } },
    });
    expect(response.description).toEqual(expect.stringContaining(reason));
    expect(operation.description).toEqual(expect.stringContaining(reason));
    expect(obj(schemas.ResubmitConnectionRequest).description).toEqual(
      expect.stringContaining(reason),
    );
  });
});
