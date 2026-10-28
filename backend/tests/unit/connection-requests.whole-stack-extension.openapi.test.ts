import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { apiDocsRoutes } from '../../src/modules/api-docs/api-docs.routes';
import { addMeasurementPointRequestSchema } from '../../src/modules/connection-requests/connection-requests.validator';

describe('whole-stack extension runtime OpenAPI contract', () => {
  it('publishes the frontend option mapping, valid payload and approval result', async () => {
    const app = express();
    app.use('/api/v1', apiDocsRoutes);
    const response = await request(app).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    const schemas = response.body.components.schemas;
    expect(schemas.AddPointMeasurementPoint.properties.monitoringPointStatus.description).toContain(
      'อยู่ระหว่างขยายระยะเวลาทั้งปล่อง',
    );
    const create = response.body.paths['/cems-wpms-requests/measurement-points'].post;
    const payload =
      create.requestBody.content['application/json'].examples.wholeStackExtension.value;
    expect(payload.measurementPoints[0]).toMatchObject({
      monitoringPointStatus: 'อยู่ระหว่างขยายเวลา',
      details: { requestedParameters: [] },
      measurementInstruments: { parameters: [] },
    });
    expect(addMeasurementPointRequestSchema.safeParse(payload).success).toBe(true);
    for (const path of ['/cems-wpms-requests/{id}/review', '/cems-wpms-requests/{id}/status']) {
      const operation = response.body.paths[path].post;
      expect(operation.description).toContain('อยู่ระหว่างขยายเวลา');
      expect(
        operation.responses['200'].content['application/json'].examples.wholeStackExtension.value
          .data,
      ).toMatchObject({
        status: 'CONNECTED',
        connectionDueAt: null,
        confirmedAt: null,
        measurementPoints: [{ monitoringPointStatus: 'อยู่ระหว่างขยายเวลา', parameters: [] }],
      });
    }
  });
});
