import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { apiDocsRoutes } from '../../src/modules/api-docs/api-docs.routes';

interface Operation {
  responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
}

describe('published API response contracts', () => {
  it('declares endpoint-specific success schemas for every JSON response', async () => {
    const app = express();
    app.use('/api/v1', apiDocsRoutes);
    const response = await request(app).get('/api/v1/openapi.json').expect(200);
    const paths = response.body.paths as Record<string, Record<string, Operation>>;
    const missing: string[] = [];
    for (const [path, item] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(item)) {
        for (const [status, result] of Object.entries(operation.responses ?? {})) {
          if (!status.startsWith('2')) continue;
          const media = result.content?.['application/json'];
          if (
            media &&
            (!media.schema || media.schema.$ref === '#/components/schemas/SuccessEnvelope')
          ) {
            missing.push(`${method.toUpperCase()} ${path}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
