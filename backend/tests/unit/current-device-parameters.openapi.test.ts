import { describe, expect, it } from '@jest/globals';
import { connectionRequestsOpenApiDocument } from '../../src/modules/api-docs/connection-requests.openapi';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Obj = Record<string, unknown>;
const obj = (x: unknown) => x as Obj;
describe('approved parameter replacement API contract', () => {
  it.each([
    '/connected-measurement-points/{stationId}/parameter-form',
    '/connected-measurement-points/{stationId}/{buddhistYear}/parameter-form',
  ])('documents live parameter groups for %s', (path) => {
    const get = obj(obj(obj(connectionRequestsOpenApiDocument.paths)[path]).get);
    expect(get.description).toEqual(expect.stringContaining('parameters_json'));
    const response = obj(obj(obj(obj(get.responses)['200']).content)['application/json']);
    expect(response.schema).toEqual({ $ref: '#/components/schemas/AddParameterFormResponse' });
    const schemas = obj(obj(connectionRequestsOpenApiDocument.components).schemas);
    const schema = obj(schemas.AddParameterFormResponse);
    const data = obj(obj(schema.properties).data);
    const form = obj(obj(data.properties).formDefaults);
    const point = obj(obj(obj(form.properties).measurementPoints).items);
    const details = obj(obj(point.properties).details);
    expect(details.required).toEqual([
      'eligibleParameters',
      'connectedParameters',
      'pendingParameters',
      'requestedParameters',
    ]);
    const example = obj(obj(obj(schema.example).data).formDefaults);
    const examplePoint = obj((example.measurementPoints as unknown[])[0]);
    expect(examplePoint.details).toMatchObject({
      connectedParameters: ['COD (mg/l)', 'Flow rate (m3/hr)', 'Watt (kW/hr)'],
      pendingParameters: [],
      requestedParameters: ['COD (mg/l)', 'Flow rate (m3/hr)', 'Watt (kW/hr)'],
    });
  });

  it.each([
    '/connected-measurement-points/{stationId}/device-configs',
    '/connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
  ])('documents unconfigured parameter rows for %s', (path) => {
    const get = obj(obj(obj(connectionRequestsOpenApiDocument.paths)[path]).get);
    expect(get.description).toEqual(expect.stringContaining('active connected point'));
    const response = obj(obj(obj(obj(get.responses)['200']).content)['application/json']);
    const data = obj(obj(obj(response.schema).properties).data);
    const mapping = obj(obj(obj(obj(data.properties).parameterMappings).items).properties);
    expect(mapping.configId).toEqual(expect.objectContaining({ type: 'integer', nullable: true }));
    expect(obj(mapping.addressId).description).toEqual(expect.stringContaining('ค่าว่าง'));
  });
  it('documents validated requestedParameters in the POMS point patch', () => {
    const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
    const details = obj(
      obj(obj(schemas.PomsFactoryMeasurementPointPatchRequest).properties).details,
    );
    expect(obj(details.properties).requestedParameters).toEqual(
      expect.objectContaining({ type: 'array', maxItems: 100, uniqueItems: true }),
    );
  });
});
