import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;
const paths = obj(pomsOpenApiDocument.paths);
const reason = 'ADD_PARAMETER_POINT_OWNERSHIP_INVALID';

describe('add-parameter point ownership OpenAPI contract', () => {
  it.each([
    ['post', '/cems-wpms-requests/parameters'],
    ['put', '/cems-wpms-requests/{id}/form'],
    ['post', '/cems-wpms-requests/{id}/review'],
    ['post', '/cems-wpms-requests/{id}/status'],
    ['post', '/cems-wpms-requests/{id}/confirm-connection'],
    ['post', '/cems-wpms-requests/{id}/verify-connection'],
  ])('publishes a non-disclosing ownership conflict on %s %s', (method, path) => {
    const operation = obj(obj(paths[path])[method]);
    const response = obj(obj(operation.responses)['409']);
    const media = obj(obj(response.content)['application/json']);
    expect(media.schema).toEqual({ $ref: '#/components/schemas/ErrorEnvelope' });
    expect(obj(obj(media.examples).addParameterPointOwnershipInvalid).value).toEqual({
      success: false,
      error: {
        code: 'CONFLICT',
        message:
          'Add parameter point must reference an active point owned by this factory and system',
        details: { path: 'measurementPoints.0.pointCode', reason },
      },
    });
    expect(response.description).toEqual(expect.stringContaining(reason));
    expect(operation.description).toEqual(expect.stringContaining(reason));
    expect(operation.description).toEqual(expect.stringContaining('eligible_factory_id'));
    expect(operation.description).toEqual(expect.stringContaining('systemType'));
  });

  it('describes existing active-point ownership on create and resubmit input schemas', () => {
    const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
    for (const name of ['AddParameterRequest', 'ResubmitConnectionRequest']) {
      expect(obj(schemas[name]).description).toEqual(expect.stringContaining(reason));
    }
    const pointCode = obj(obj(obj(schemas.AddParameterMeasurementPoint).properties).pointCode);
    expect(pointCode).toMatchObject({ type: 'string', minLength: 1, maxLength: 64 });
    expect(pointCode.description).toEqual(expect.stringContaining('eligible_factory_id'));
    expect(pointCode.description).toEqual(expect.stringContaining('systemType'));
  });

  it.each(['confirm-connection', 'verify-connection'])(
    'keeps existing factory-profile conflicts on %s',
    (action) => {
      const operation = obj(obj(paths[`/cems-wpms-requests/{id}/${action}`]).post);
      const response = obj(obj(operation.responses)['409']);
      expect(response.description).toEqual(expect.stringContaining('FACTORY_PROFILE_CONFLICT'));
      expect(response.description).toEqual(expect.stringContaining('FACTORY_PROFILE_CHANGED'));
    },
  );
});
