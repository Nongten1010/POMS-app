import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { apiDocsRoutes } from '../../src/modules/api-docs/api-docs.routes';
import {
  addMeasurementPointRequestSchema,
  addParameterRequestSchema,
  createConnectionRequestSchema,
  directConnectionRequestSchema,
  resubmitConnectionRequestSchema,
  resubmitConnectionRequestWithTypeSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';

describe('connection request parameter contract', () => {
  it('serves matching parameter limits for request, form response and instrument schemas', async () => {
    const app = express();
    app.use('/api/v1', apiDocsRoutes);
    const response = await request(app).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    const schemas = response.body.components.schemas;
    for (const name of [
      'MeasurementPoint',
      'AddPointMeasurementPoint',
      'AddParameterMeasurementPoint',
      'DirectConnectionMeasurementPoint',
    ]) {
      expect(schemas[name].properties.parameters).toMatchObject({
        type: 'array',
        minItems: 0,
        maxItems: 100,
        items: { type: 'string', minLength: 1, maxLength: 128 },
      });
    }
    expect(schemas.MeasurementInstruments.properties.parameters.maxItems).toBe(100);
    expect(schemas.MeasurementInstrumentParameter.properties.parameter.maxLength).toBe(128);
    expect(schemas.ResubmitConnectionRequest.description).toContain('ฟอร์มหลายจุด');
    const examples =
      response.body.paths['/cems-wpms-requests/{id}/form'].put.requestBody.content[
        'application/json'
      ].examples;
    const first = resubmitConnectionRequestSchema.parse(examples.emptyParameters.value);
    const second = resubmitConnectionRequestWithTypeSchema.parse({
      ...first,
      requestType: 'ADD_MEASUREMENT_POINT',
    });
    expect(second.measurementPoints[0]).toMatchObject({
      monitoringPointStatus: 'ได้รับการยกเว้นทั้งหมด',
      parameters: [],
      details: { stackLatitude: 13.643351, stackLongitude: 100.584545 },
    });
  });

  const form = {
    factoryId: 'test-factory',
    factoryName: 'โรงงานทดสอบ',
    systemType: 'WPMS',
    contactPersons: [{ name: 'ผู้ติดต่อ', phone: '0812345678' }],
  };
  const point = {
    pointName: 'จุดทดสอบ',
    pointCode: 'P2001',
    pointType: 'WASTEWATER',
    monitoringPointStatus: 'ได้รับการยกเว้นทั้งหมด',
    details: { monitoringPointKind: 'WPMS' },
    measurementInstruments: { parameters: [] },
  };

  it.each([
    { name: 'empty', parameters: [] },
    {
      name: '128-character names and 100 parameters',
      parameters: Array.from({ length: 100 }, (_, i) => `${String(i).padStart(120, 'P')} (mg/m3)`),
    },
  ])('accepts $name through all form validators and repeated resubmission', ({ parameters }) => {
    const body = {
      ...form,
      measurementPoints: [
        {
          ...point,
          parameters,
          details: { ...point.details, requestedParameters: parameters },
        },
      ],
    };
    for (const schema of [
      createConnectionRequestSchema,
      addMeasurementPointRequestSchema,
      addParameterRequestSchema,
      directConnectionRequestSchema,
    ]) {
      const { monitoringPointStatus: _status, ...directPoint } = body.measurementPoints[0];
      const input =
        schema === directConnectionRequestSchema
          ? { ...body, measurementPoints: [directPoint] }
          : body;
      const result = schema.safeParse(input);
      expect(result.success ? [] : result.error.issues).toEqual([]);
    }
    for (const requestType of ['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT', 'ADD_PARAMETER']) {
      const first = resubmitConnectionRequestSchema.parse({ ...body, requestType });
      const second = resubmitConnectionRequestWithTypeSchema.parse(first);
      expect(second).toEqual(first);
      expect(second.measurementPoints[0].parameters).toEqual(parameters);
    }
  });

  it.each([
    { name: 'more than 128 characters', parameters: [`${'P'.repeat(121)} (mg/m3)`] },
    {
      name: 'more than 100 parameters',
      parameters: Array.from({ length: 101 }, (_, i) => `P${i} (ppm)`),
    },
    { name: 'blank parameter', parameters: [' '] },
  ])('rejects $name in every point-level input contract', ({ parameters }) => {
    const body = { ...form, measurementPoints: [{ ...point, parameters }] };
    for (const schema of [
      createConnectionRequestSchema,
      addMeasurementPointRequestSchema,
      addParameterRequestSchema,
      directConnectionRequestSchema,
      resubmitConnectionRequestSchema,
    ]) {
      const { monitoringPointStatus: _status, ...directPoint } = body.measurementPoints[0];
      const input =
        schema === directConnectionRequestSchema
          ? { ...body, measurementPoints: [directPoint] }
          : body;
      expect(schema.safeParse(input).success).toBe(false);
    }
  });
});
