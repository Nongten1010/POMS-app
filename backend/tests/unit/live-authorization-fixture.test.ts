import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/config/env', () => ({
  env: {
    JWT_EXPIRES_IN: '15m',
    JWT_SECRET: 'fixture-test-secret-at-least-16-chars',
    LOG_LEVEL: 'error',
    NODE_ENV: 'test',
  },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { signTestAccessToken } from '../helpers/live-authorization-fixture';
import { authenticate } from '../../src/shared/middlewares/authenticate';
import { authorize } from '../../src/shared/middlewares/authorize';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';

function createFixtureApp() {
  const app = express();
  app.get('/view', authenticate, authorize('factories:view'), (req, res) => {
    res.json({ scopes: req.user?.scopes });
  });
  app.post('/edit', authenticate, authorize('factories:edit'), (_req, res) => {
    res.sendStatus(204);
  });
  app.use(errorHandler);
  return app;
}

describe('isolated route authorization fixtures', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects separate viewer/editor fixtures whose real signed tokens share one user id', async () => {
    const viewerToken = signTestAccessToken({
      sub: '45',
      userType: 'officer',
      roles: ['diw_central'],
      scopes: { 'factories:view': 'ALL' },
    });
    const editorToken = signTestAccessToken({
      sub: '45',
      userType: 'officer',
      roles: ['diw_central'],
      scopes: { 'factories:view': 'IN_PROVINCE', 'factories:edit': null },
    });
    const app = createFixtureApp();

    const [viewer, editor, deniedEdit, allowedEdit] = await Promise.all([
      request(app).get('/view').set('Authorization', `Bearer ${viewerToken}`),
      request(app).get('/view').set('Authorization', `Bearer ${editorToken}`),
      request(app).post('/edit').set('Authorization', `Bearer ${viewerToken}`),
      request(app).post('/edit').set('Authorization', `Bearer ${editorToken}`),
    ]);

    expect(viewer.body.scopes).toEqual({ 'factories:view': 'ALL' });
    expect(editor.body.scopes).toEqual({
      'factories:view': 'IN_PROVINCE',
      'factories:edit': null,
    });
    expect(deniedEdit.status).toBe(403);
    expect(allowedEdit.status).toBe(204);
  });

  it.each(['reset', 'restore'])('reinstalls fixture spies after mocks %s', async (mode) => {
    const payload = {
      sub: '46',
      userType: 'officer' as const,
      roles: ['diw_central'],
      scopes: { 'factories:view': 'ALL' },
    };
    signTestAccessToken(payload);
    if (mode === 'reset') jest.resetAllMocks();
    else jest.restoreAllMocks();
    const token = signTestAccessToken(payload);

    const response = await request(createFixtureApp())
      .get('/view')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.scopes).toEqual(payload.scopes);
  });

  it('still verifies the signature before selecting an authorization fixture', async () => {
    const token = signTestAccessToken({
      sub: '45',
      userType: 'officer',
      roles: ['diw_central'],
      scopes: { 'factories:view': 'ALL' },
    });
    const parts = token.split('.');
    const signature = parts[2] ?? '';
    parts[2] = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;

    const response = await request(createFixtureApp())
      .get('/view')
      .set('Authorization', `Bearer ${parts.join('.')}`);

    expect(response.status).toBe(401);
  });
});
