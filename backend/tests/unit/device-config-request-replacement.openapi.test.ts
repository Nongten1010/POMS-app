import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';

describe('published request device replacement contract', () => {
  it('publishes full station replacement for single, batch and form payloads', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    const operation = response.body.paths['/cems-wpms-requests/{id}/device-configs'].post;
    expect(operation.description).toContain('แทนที่อุปกรณ์ทั้งหมดของแต่ละ stationId ที่ส่งมา');
    expect(operation.description).toContain('soft delete');
    expect(operation.description).toContain('request snapshot');
    expect(operation.description).toContain('station ที่ไม่ส่งมา');
    expect(operation['x-poms-permissions']).toContain('cems_wpms_requests:edit');
    expect(operation.responses).toHaveProperty('201');
    expect(operation.responses).toHaveProperty('400');
    expect(operation.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/DeviceConnectionConfigRequest',
    );
    expect(response.body.components.schemas.DeviceConnectionConfigRequest.oneOf).toHaveLength(3);
  });
});
