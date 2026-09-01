import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;

describe('integrated POMS measurement-point edit OpenAPI contract', () => {
  it('publishes the point selector plus the exact editable-field allowlist', () => {
    const patch = schema('PomsFactoryMeasurementPointPatchRequest');
    const properties = asObject(patch.properties, 'point patch properties');

    expect(Object.keys(properties).sort()).toEqual(
      [
        'connectedPointId',
        'pointName',
        'monitoringPointStatus',
        'details',
        'documentsAndImages',
        'measurementInstruments',
      ].sort(),
    );
    expect(patch.additionalProperties).toBe(false);
    expect(patch.required).toEqual(['connectedPointId']);
    expect(properties).not.toHaveProperty('pointCode');
    expect(properties).not.toHaveProperty('parameters');
    expect(properties).not.toHaveProperty('pointType');
    expect(properties).not.toHaveProperty('systemType');
    expect(properties).not.toHaveProperty('deviceConfig');
  });

  it('uses the integrated MEASUREMENT_POINTS variant for create and resubmission', () => {
    const submission = schema('PomsFactoryEditSubmissionRequest');
    expect(submission.oneOf).toEqual([
      { $ref: '#/components/schemas/PomsFactoryEditableProfileRequest' },
      { $ref: '#/components/schemas/PomsFactoryEditableMeasurementPointsRequest' },
    ]);

    const measurementRequest = schema('PomsFactoryEditableMeasurementPointsRequest');
    expect(measurementRequest.required).toEqual(['formType', 'measurementPoints']);
    const requestProperties = asObject(measurementRequest.properties, 'measurement request');
    expect(asObject(requestProperties.formType, 'formType').enum).toEqual(['MEASUREMENT_POINTS']);
    expect(
      asObject(asObject(requestProperties.measurementPoints, 'measurementPoints').items, 'items'),
    ).toEqual({ $ref: '#/components/schemas/PomsFactoryMeasurementPointPatchRequest' });

    expect(requestSchema('/poms-factories/{factoryId}/edit-requests', 'post')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditSubmissionRequest',
    });
    expect(requestSchema('/poms-factories/edit-requests/{id}/resubmission', 'put')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditSubmissionRequest',
    });
  });

  it('keeps immutable fields out of the published measurement-point request example', () => {
    const example = asObject(
      schema('PomsFactoryEditableMeasurementPointsRequest').example,
      'measurement-point example',
    );
    const points = example.measurementPoints as unknown[];
    expect(points.length).toBeGreaterThan(0);
    for (const [index, pointValue] of points.entries()) {
      const point = asObject(pointValue, `measurementPoints[${index}]`);
      expect(point).not.toHaveProperty('pointCode');
      expect(point).not.toHaveProperty('parameters');
      expect(point).not.toHaveProperty('pointType');
      expect(point).not.toHaveProperty('systemType');
      expect(point).not.toHaveProperty('deviceConfig');
    }
  });
});

function schema(name: string): JsonObject {
  const components = asObject(pomsOpenApiDocument.components, 'components');
  return asObject(asObject(components.schemas, 'schemas')[name], name);
}

function requestSchema(path: string, method: string): JsonObject {
  const paths = asObject(pomsOpenApiDocument.paths, 'paths');
  const operation = asObject(asObject(paths[path], path)[method], `${method} ${path}`);
  const requestBody = asObject(operation.requestBody, 'requestBody');
  const content = asObject(requestBody.content, 'content');
  return asObject(asObject(content['application/json'], 'application/json').schema, 'schema');
}

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}
