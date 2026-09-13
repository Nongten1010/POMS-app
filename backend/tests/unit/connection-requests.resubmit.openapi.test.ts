import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import { resubmitConnectionRequestSchema } from '../../src/modules/connection-requests/connection-requests.validator';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('collaborative resubmission contract', () => {
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
    expect(conflict.example).toMatchObject({
      success: false,
      error: { code: 'CONFLICT', details: { reason: 'REQUEST_CHANGED' } },
    });
  });
});
