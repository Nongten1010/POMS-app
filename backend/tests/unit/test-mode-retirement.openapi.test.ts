import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('retired Test mode OpenAPI contract', () => {
  it('keeps compatible boolean requests while promising false to integration consumers', () => {
    const document = pomsOpenApiDocument as any;
    const schemas = document.components.schemas;
    for (const schemaName of ['DeviceChannel', 'DeviceConnectionChannel']) {
      expect(schemas[schemaName].properties.testMode).toMatchObject({
        type: 'boolean',
        nullable: true,
        default: false,
      });
      expect(schemas[schemaName].properties.testMode.enum).toBeUndefined();
    }
    expect(schemas.IntegrationParameterConfig.properties.testMode).toMatchObject({
      type: 'boolean',
      enum: [false],
      default: false,
    });
  });

  it('publishes false in config reads, form mappings and save responses without narrowing payloads', () => {
    const document = pomsOpenApiDocument as any;
    const schemas = document.components.schemas;
    const resolve = (schema: any): any =>
      schema?.$ref ? resolve(schemas[schema.$ref.split('/').at(-1)]) : schema;
    const successData = (path: string, method: string, status = '200') =>
      resolve(
        resolve(document.paths[path][method].responses[status].content['application/json'].schema)
          .properties.data,
      );
    const falseTestMode = { type: 'boolean', enum: [false] };

    for (const [path, method, status] of [
      ['/device-connections/{id}', 'get', '200'],
      ['/device-connections', 'post', '201'],
    ]) {
      const channel = resolve(successData(path, method, status).properties.channels.items);
      expect(channel.properties.testMode).toMatchObject(falseTestMode);
    }
    const listChannel = resolve(
      resolve(successData('/device-connections', 'get').items).properties.channels.items,
    );
    expect(listChannel.properties.testMode).toMatchObject(falseTestMode);

    for (const path of [
      '/cems-wpms-requests/{id}/device-configs',
      '/cems-wpms-requests/{id}/device-configs/{configId}',
      '/connected-measurement-points/{stationId}/device-configs',
      '/connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
    ]) {
      const data = successData(path, 'get');
      expect(data.properties.parameterMappings.items.properties.testMode).toMatchObject(
        falseTestMode,
      );
      const raw = resolve(data.properties.rawConfigs);
      expect(resolve(raw.properties.channels.items).properties.testMode).toMatchObject(
        falseTestMode,
      );
    }
    for (const path of [
      '/cems-wpms-requests/{id}/device-configs',
      '/connected-measurement-points/{stationId}/device-configs',
      '/connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
    ]) {
      const payload = resolve(successData(path, 'post', '201').oneOf[0]);
      expect(resolve(payload.properties.channels.items).properties.testMode).toMatchObject(
        falseTestMode,
      );
    }
    expect(schemas.DeviceChannel.properties.testMode.enum).toBeUndefined();
  });

  it('documents false in configs embedded in request details and station request lists', () => {
    const document = pomsOpenApiDocument as any;
    const schemas = document.components.schemas;
    const resolve = (schema: any): any =>
      schema?.$ref ? resolve(schemas[schema.$ref.split('/').at(-1)]) : schema;
    const cases: Array<[string, boolean]> = [
      ['/cems-wpms-requests/{id}/detail', false],
      ['/connected-measurement-points/{stationId}/requests', true],
      ['/connected-measurement-points/{stationId}/{buddhistYear}/requests', true],
    ];
    for (const [path, collection] of cases) {
      const response = resolve(
        document.paths[path].get.responses['200'].content['application/json'].schema,
      );
      const data = resolve(response.properties.data);
      const record = collection ? resolve(data.items) : data;
      const payload = resolve(record.properties.deviceConfigs.items);
      const channel = resolve(payload.properties.channels.items);
      expect(channel.properties.testMode).toMatchObject({ type: 'boolean', enum: [false] });
    }
  });
});
