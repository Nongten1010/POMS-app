import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('connection-test OpenAPI contract', () => {
  it('documents measured values separately from operational statuses in both protocol examples', () => {
    const document = pomsOpenApiDocument as any;
    const response =
      document.paths['/parameter-values/connection-test'].get.responses['200'].content[
        'application/json'
      ];
    for (const exampleName of ['latestMinuteRows', 'latestRealtimeRows']) {
      expect(response.examples[exampleName].value.data[0]).toMatchObject({
        values: { 'NOx (ppm)': '88.2' },
        statuses: { 'NOx (ppm)': 'Shut Down' },
      });
    }
    const values =
      document.components.schemas.ParameterConnectionTestResponse.properties.data.items.properties
        .values;
    expect(values.description).toContain('ค่าตรวจวัดตามต้นทางเสมอ');
    expect(values.description).toContain('null');
  });

  it('shows unit-specific values and statuses from the same family with safe generic fallback', () => {
    const document = pomsOpenApiDocument as any;
    const response =
      document.paths['/parameter-values/connection-test'].get.responses['200'].content[
        'application/json'
      ];
    expect(response.examples.mixedParameterFamilies.value).toMatchObject({
      data: [
        {
          values: {
            'CO2 (ppm)': null,
            'CO2 (%)': '0.04',
            'PM2.5 (µg/m3)': 0,
            pH: '7.2',
          },
          statuses: {
            'CO2 (ppm)': 'Maintenance',
            'CO2 (%)': 'Normal',
            'PM2.5 (µg/m3)': 'Calibration',
            pH: 'Normal',
          },
        },
        {
          values: { 'CO2 (ppm)': '420.0', 'CO2 (%)': null },
          statuses: { 'CO2 (ppm)': 'Normal', 'CO2 (%)': null },
        },
      ],
      meta: { interval: 'real', count: 2 },
    });
    expect(
      document.components.schemas.ParameterConnectionTestResponse.properties.data.items.properties
        .values.description,
    ).toContain('family เดียวกัน');
  });

  it('documents parameter-only cleanup on final verification of add-parameter requests', () => {
    const document = pomsOpenApiDocument as any;
    const operation = document.paths['/cems-wpms-requests/{id}/verify-connection'].post;
    expect(operation.description).toContain('ADD_PARAMETER');
    expect(operation.description).toContain('*_value');
    expect(operation.description).toContain('*_status');
    expect(operation.description).toContain('ห้ามลบแถว');
    expect(operation.description).toContain('1day');
    expect(operation.responses['503'].content['application/json'].example.error).toMatchObject({
      code: 'MEASUREMENT_CLEANUP_FAILED',
      message: 'Unable to clear added parameter measurements; connection was not completed',
      details: { retryable: true },
    });
    expect(operation.responses['409'].description).toContain(
      'ADD_PARAMETER_POINT_OWNERSHIP_INVALID',
    );
  });

  it('documents all matching source families and the explicit dimensionless pH exception', () => {
    const document = pomsOpenApiDocument as any;
    const operation = document.paths['/cems-wpms-requests/{id}/verify-connection'].post;
    expect(operation.description).toContain('ทุก family');
    expect(operation.description).toContain('co2_ppm');
    expect(operation.description).toContain('pH');
    expect(operation.description).toContain('receipt');
  });

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
