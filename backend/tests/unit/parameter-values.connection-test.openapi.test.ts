import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('connection-test OpenAPI contract', () => {
  it('publishes protocol-specific sources, the ten-row limit and persona-specific access requirements', () => {
    const document = pomsOpenApiDocument as any;
    const operation = document.paths['/parameter-values/connection-test'].get;
    const response = operation.responses['200'].content['application/json'];
    const schema = document.components.schemas.ParameterConnectionTestResponse;

    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation['x-poms-permissions']).toEqual([
      'cems_wpms_requests:view',
      'cems_wpms_requests:approve',
    ]);
    expect(operation['x-poms-permission-mode']).toBe('any');
    expect(operation.description).toContain('cems_wpms_requests:view');
    expect(operation.description).toContain('cems_wpms_requests:approve');
    expect(operation.description).toContain('officer/admin');
    expect(operation.description).toContain('ไม่ fallback');
    expect(operation.description).toContain('ไม่ต้องมี view เพิ่ม');
    expect(operation.description).toContain('citizen');
    expect(operation.description).toContain('WAITING_CONNECTION');
    expect(operation.description).toContain('CONNECTION_CONFIRMED');
    expect(operation.description).toContain('request factory snapshot');
    expect(operation.description).toContain('403 FORBIDDEN');
    expect(operation.description).toContain('registered parameters');
    expect(operation.description).toContain('device_connection_configs ด้วย scope เดียวกัน');
    expect(operation.description).toContain('MODBUS_RTU');
    expect(operation.description).toContain('MODBUS_TCP');
    expect(operation.description).toContain('DCON_ASCII');
    expect(operation.description).toContain('<stationId>_data_real');
    expect(operation.description).toContain('<stationId>_data_1m');
    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: 'stationId', in: 'query', required: true }),
    ]);
    expect(response.schema).toEqual({
      $ref: '#/components/schemas/ParameterConnectionTestResponse',
    });
    expect(schema.properties.data).toMatchObject({ type: 'array', maxItems: 10 });
    expect(schema.properties.meta.properties).toMatchObject({
      interval: { enum: ['real', '1m'] },
      tableName: { example: 'S2003_data_1m' },
      count: { minimum: 0, maximum: 10 },
    });
    expect(response.examples.latestMinuteRows.value).toMatchObject({
      success: true,
      data: [expect.objectContaining({ timestamp: '2026-10-19 10:15:00' })],
      meta: { stationId: 'S2003', interval: '1m', tableName: 'S2003_data_1m', count: 1 },
    });
    expect(response.examples.latestRealtimeRows.value).toMatchObject({
      success: true,
      data: [expect.objectContaining({ timestamp: expect.any(String) })],
      meta: { interval: 'real', tableName: 'S2003_data_real' },
    });
  });

  it.each(['/parameter-values', '/parameter-values/latest', '/parameter-values/tables'])(
    'keeps the view permission on %s',
    (path) => {
      const document = pomsOpenApiDocument as any;
      const operation = document.paths[path].get;

      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation['x-poms-permissions']).toEqual(['cems_wpms_requests:view']);
      expect(operation.description).toContain('cems_wpms_requests:view');
      expect(operation.description).not.toContain('cems_wpms_requests:approve');
    },
  );
});
