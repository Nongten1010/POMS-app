import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('published operator cancellation contract', () => {
  const operation = obj(
    obj(obj(pomsOpenApiDocument.paths)['/cems-wpms-requests/{id}/cancel']).post,
  );
  const responses = obj(operation.responses);

  it('documents owner, submission source and every allowed and terminal status', () => {
    for (const text of [
      'cems_wpms_requests:edit',
      'createdBy',
      'OPERATOR_FORM',
      'PENDING_DESIGN_REVIEW',
      'WAITING_FACTORY_REVISION',
      'REVISED_PENDING_DESIGN_REVIEW',
      'WAITING_CONNECTION',
      'CONNECTION_CONFIRMED',
      'CONNECTED',
      'CANCELED',
      '409 CONFLICT',
    ]) {
      expect(operation.description).toEqual(expect.stringContaining(text));
    }
  });

  it('publishes a concrete canceled response and conflict details', () => {
    const success = obj(obj(obj(responses['200']).content)['application/json']);
    expect(success.schema).toEqual({
      $ref: '#/components/schemas/CancelConnectionRequestResponse',
    });
    const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
    const parts = obj(schemas.CancelConnectionRequestResponse).allOf as Obj[];
    expect(parts[0]).toEqual({ $ref: '#/components/schemas/ConnectionRequestResponse' });
    const properties = obj(obj(obj(parts[1].properties).data).properties);
    expect(properties.status).toEqual({ type: 'string', enum: ['CANCELED'] });

    const conflict = obj(obj(obj(responses['409']).content)['application/json']);
    expect(conflict.example).toMatchObject({
      success: false,
      error: { code: 'CONFLICT', details: { currentStatus: 'CANCELED' } },
    });
    for (const code of ['400', '401', '403', '404', '409']) {
      expect(responses[code]).toBeDefined();
    }
  });
});
