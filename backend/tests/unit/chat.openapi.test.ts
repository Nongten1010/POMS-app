import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { apiDocsRoutes } from '../../src/modules/api-docs/api-docs.routes';
import { createApp } from '../../src/app';

const app = express();
app.use('/api/v1', apiDocsRoutes);

describe('Chat runtime OpenAPI', () => {
  it('lets clients discover authenticated chat options and the six supported topics', async () => {
    const response = await request(app).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.paths['/chat/options']?.get).toMatchObject({
      security: [{ bearerAuth: [] }],
      responses: {
        '200': expect.any(Object),
        '401': expect.any(Object),
        '403': expect.any(Object),
      },
    });
    expect(response.body.components.schemas.ChatTopicCode.enum).toEqual([
      'factory_access',
      'connection_data',
      'measurements_alerts',
      'forms_reports',
      'form_legal_guidance',
      'other',
    ]);
    expect(response.body.components.schemas.ChatOptions.required).toEqual(
      expect.arrayContaining(['viewer', 'topics', 'limits', 'canCreate']),
    );
    const canCreateDescription =
      response.body.components.schemas.ChatOptions.properties.canCreate.description;
    expect(canCreateDescription).toContain('userType=operator');
    expect(canCreateDescription).toContain('chat:view');
    expect(canCreateDescription).toContain('officer/admin/citizen');
    expect(canCreateDescription).toContain('false');
  });

  it('limits opening tickets to operators with the Chat use checkbox', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    const create = document.paths['/chat/tickets']?.post;
    expect(create?.['x-poms-permissions']).toEqual(['chat:view', 'eligible_factories:view']);
    expect(create).not.toHaveProperty('x-allowed-user-types');
    expect(create?.['x-poms-user-types']).toEqual(['operator']);
    expect(document.components.schemas.ChatOptions.properties.canCreate.description).toContain(
      'chat:view',
    );
  });

  it('connects the editable Chat use checkbox to ticket actions without granting an admin role', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    for (const name of ['EditablePermissionGroups', 'EditablePermissionGroupsResponse']) {
      const chat = document.components.schemas[name].properties.chat;
      expect(chat.properties.view.description).toContain('chat:view');
      expect(chat.properties.view.description).toContain('เปิด Ticket');
      expect(chat.properties.view.description).toContain('userType=operator');
      expect(chat.properties.edit.description).toContain('chat:answer');
      expect(chat.properties.edit.description).toContain('ไม่เปลี่ยน role');
      expect(Object.keys(chat.properties)).toEqual(['view', 'edit']);
    }
  });

  it('describes atomic ticket creation, strict inputs, point identity, and safe retries', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    const operation = document.paths['/chat/tickets']?.post;
    expect(operation?.['x-poms-permissions']).toEqual(['chat:view', 'eligible_factories:view']);
    expect(operation?.['x-poms-user-types']).toEqual(['operator']);
    expect(operation?.responses['403']).toMatchObject({
      description: expect.stringContaining('userType ไม่ใช่ operator'),
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
    });
    expect(operation?.responses['403'].description).toContain('officer/admin/citizen');
    expect(operation?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
      }),
    );
    expect(operation?.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '201': expect.any(Object),
        '409': expect.any(Object),
      }),
    );
    const schemas = document.components.schemas;
    expect(schemas.ChatCreateTicket).toMatchObject({
      additionalProperties: false,
      required: ['eligibleFactoryId', 'topicCode', 'message'],
      properties: {
        message: { type: 'string', minLength: 1, maxLength: 2000 },
        measurementPoint: expect.objectContaining({ nullable: true, default: null }),
      },
    });
    expect(schemas.ChatPointReference).toMatchObject({
      required: ['kind', 'id'],
      additionalProperties: false,
      properties: { kind: { enum: ['eligible', 'connected'] }, id: { minimum: 1 } },
    });
    expect(schemas.ChatTicketSummary.properties.ticketNo).toMatchObject({
      pattern: '^TK-[0-9]{2}-[0-9]{5}$',
    });
    expect(schemas.ChatTicketSummary.properties.status).toEqual({
      type: 'string',
      enum: ['open', 'closed'],
    });
    expect(schemas.ChatCreateResult.required).toEqual(['ticket', 'firstMessage', 'replayed']);
  });

  it('publishes scoped factory and typed point choices without requiring a connected factory', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    expect(document.paths['/chat/factories']?.get.parameters).toContainEqual(
      expect.objectContaining({
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', enum: [25, 50, 100], default: 25 },
      }),
    );
    expect(document.paths['/chat/factories/{id}/measurement-points']?.get).toMatchObject({
      security: [{ bearerAuth: [] }],
      responses: { '404': expect.any(Object) },
    });
    expect(document.components.schemas.ChatFactoryPage.required).toEqual([
      'success',
      'data',
      'pagination',
    ]);
    expect(document.components.schemas.ChatMeasurementPoint.properties).toMatchObject({
      kind: { enum: ['eligible', 'connected'] },
      pointCode: { nullable: true },
    });
  });

  it('documents bounded ticket browsing and message continuation with current status', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    expect(document.paths['/chat/tickets']?.get.parameters).toContainEqual(
      expect.objectContaining({
        name: 'sort',
        schema: expect.objectContaining({ default: 'lastMessageAt' }),
      }),
    );
    expect(document.paths['/chat/tickets/{id}']?.get.responses['200']).toBeDefined();
    const messageRead = document.paths['/chat/tickets/{id}/messages']?.get;
    expect(messageRead?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        }),
        expect.objectContaining({ name: 'olderCursor' }),
        expect.objectContaining({ name: 'afterMessageId' }),
      ]),
    );
    expect(messageRead?.description).toContain('ใช้พร้อมกันไม่ได้');
    expect(document.components.schemas.ChatMessagePage.required).toEqual([
      'ticket',
      'messages',
      'pagination',
    ]);
    expect(document.components.schemas.ChatTicketSummary.properties).not.toHaveProperty('events');
    expect(document.components.schemas.ChatTicketDetail.required).toContain('events');
  });

  it('preserves chat:view write permission, retries after close, and idempotent closure', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    const send = document.paths['/chat/tickets/{id}/messages']?.post;
    const close = document.paths['/chat/tickets/{id}/close']?.post;
    for (const operation of [send, close]) {
      expect(operation?.['x-poms-permissions']).toEqual(['chat:view', 'eligible_factories:view']);
      expect(operation?.['x-poms-write-permissions']).toEqual({ anyOf: ['chat:view'] });
      expect(operation).not.toHaveProperty('x-poms-user-types');
      expect(operation?.description).toContain('ไม่ต้องมี chat:ask หรือ chat:answer เพิ่ม');
    }
    expect(send?.description).toContain('หลังปิด');
    expect(send?.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '201': expect.any(Object),
        '409': expect.any(Object),
      }),
    );
    expect(close?.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ChatCloseTicket',
    });
    expect(close?.responses['200']).toBeDefined();
    expect(document.components.schemas.ChatCloseTicket).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {},
    });
    expect(send?.responses['429'].content).toHaveProperty('application/json');
    expect(send?.responses['429'].content).toHaveProperty('text/html');
    const methods = Object.entries(document.paths as Record<string, Record<string, unknown>>)
      .filter(([path]) => path.startsWith('/chat/'))
      .flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
      );
    expect(methods).toHaveLength(9);
    expect(methods.every((method) => method.startsWith('GET ') || method.startsWith('POST '))).toBe(
      true,
    );
  });

  it('documents malformed JSON and the one-megabyte request-body limit', async () => {
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    for (const path of [
      '/chat/tickets',
      '/chat/tickets/{id}/messages',
      '/chat/tickets/{id}/close',
    ]) {
      const responses = document.paths[path].post.responses;
      expect(responses['400'].description).toContain('BAD_REQUEST');
      expect(responses['413']).toMatchObject({
        description: expect.stringContaining('PAYLOAD_TOO_LARGE'),
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      });
    }
  });

  it('publishes the actual global rate-limit media type served before chat authentication', async () => {
    const limitedApp = createApp();
    for (let index = 0; index < 300; index += 1) {
      await request(limitedApp).get('/api/v1/chat/options').expect(401);
    }
    const limited = await request(limitedApp).get('/api/v1/chat/options');
    expect(limited.status).toBe(429);
    expect(limited.type).toBe('text/html');
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.text).toBe('Too many requests, please try again later.');
    const { body: document } = await request(app).get('/api/v1/openapi.json');
    expect(document.paths['/chat/options'].get.responses['429'].content).toHaveProperty(
      limited.type,
    );
    expect(document.paths['/chat/tickets'].post.responses['429'].content).toHaveProperty(
      limited.type,
    );
  }, 15000);
});
