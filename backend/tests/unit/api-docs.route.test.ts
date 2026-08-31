import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import {
  countOpenApiOperations,
  pomsOpenApiDocument,
  pomsOpenApiStats,
} from '../../src/modules/api-docs/poms.openapi';

const operationMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function createDocsTestApp() {
  return createApp();
}

describe('API documentation routes', () => {
  it('redirects the docs path to its trailing-slash URL', async () => {
    const response = await request(createDocsTestApp()).get('/api/v1/docs');

    expect(response.status).toBe(308);
    expect(response.headers.location).toBe('/api/v1/docs/');
  });

  it('serves a CSP-compatible Swagger UI page using only local assets', async () => {
    const response = await request(createDocsTestApp()).get('/api/v1/docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.text).toContain('./fonts/300.css');
    expect(response.text).toContain('./fonts/600.css');
    expect(response.text).toContain('./assets/swagger-ui.css');
    expect(response.text).toContain('./assets/swagger-ui-bundle.js');
    expect(response.text).toContain('./assets/swagger-ui-standalone-preset.js');
    expect(response.text).toContain('./swagger-initializer.js');
    expect(response.text).toContain('POMS API PLAYGROUND');
    expect(response.text).toContain('ทดสอบทุก API ของระบบ POMS');
    expect(response.text).toContain('แจ้งแบบ กวภ. 01-05');
    expect(response.text).toContain('Try it out จะเรียก environment นี้จริง');
    expect(response.text).toContain(`${pomsOpenApiStats.canonicalOperationCount}`);
    expect(response.text).toContain(`${pomsOpenApiStats.operationCount}`);
    expect(response.text).toContain(`${pomsOpenApiStats.tagCount}`);
    expect(response.text).toContain('class="poms-skip-link"');
    expect(response.text).toContain('--poms-font-sans: "Kanit"');
    expect(response.text).toContain('font-family: var(--poms-font-sans) !important');
    expect(response.text).toContain('.swagger-ui select.poms-enum-select');
    expect(response.text).toContain('.swagger-ui .poms-enum-hint');
    expect(response.text).toContain('@media (prefers-reduced-motion: reduce)');
    expect(response.text).not.toMatch(/https?:\/\//);

    const scriptTags = response.text.match(/<script\b[^>]*>/g) ?? [];
    expect(scriptTags).toHaveLength(3);
    for (const scriptTag of scriptTags) {
      expect(scriptTag).toMatch(/\bsrc="[^"]+"/);
    }
  });

  it('serves Swagger UI assets from the installed package', async () => {
    const app = createDocsTestApp();

    const [css, bundle, preset] = await Promise.all([
      request(app).get('/api/v1/docs/assets/swagger-ui.css'),
      request(app).get('/api/v1/docs/assets/swagger-ui-bundle.js'),
      request(app).get('/api/v1/docs/assets/swagger-ui-standalone-preset.js'),
    ]);

    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/^text\/css/);
    expect(bundle.status).toBe(200);
    expect(bundle.headers['content-type']).toMatch(/javascript/);
    expect(preset.status).toBe(200);
    expect(preset.headers['content-type']).toMatch(/javascript/);
  });

  it('serves the same local Kanit font weights used by the POMS frontend', async () => {
    const app = createDocsTestApp();

    const [lightCss, semiboldCss, thaiFont] = await Promise.all([
      request(app).get('/api/v1/docs/fonts/300.css'),
      request(app).get('/api/v1/docs/fonts/600.css'),
      request(app).get('/api/v1/docs/fonts/files/kanit-thai-300-normal.woff2'),
    ]);

    expect(lightCss.status).toBe(200);
    expect(lightCss.headers['content-type']).toMatch(/^text\/css/);
    expect(lightCss.text).toContain("font-family: 'Kanit'");
    expect(lightCss.text).toContain('font-weight: 300');
    expect(lightCss.text).toContain('./files/kanit-thai-300-normal.woff2');
    expect(semiboldCss.status).toBe(200);
    expect(semiboldCss.headers['content-type']).toMatch(/^text\/css/);
    expect(semiboldCss.text).toContain('font-weight: 600');
    expect(thaiFont.status).toBe(200);
    expect(thaiFont.headers['content-type']).toMatch(/font\/woff2/);
  });

  it('serves an external initializer with interactive testing enabled', async () => {
    const response = await request(createDocsTestApp()).get('/api/v1/docs/swagger-initializer.js');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/javascript/);
    expect(response.text).toContain("fetch('../openapi.json'");
    expect(response.text).toContain('const enumGroups = []');
    expect(response.text).toContain("node['x-enum-labels']");
    expect(response.text).toContain("node['x-enum-descriptions']");
    expect(response.text).toContain("label + ' — ' + value");
    expect(response.text).toContain("return 'ทุกสถานะ'");
    expect(response.text).toContain("return 'ทุกประเภทคำขอ'");
    expect(response.text).toContain("document.createElement('small')");
    expect(response.text).toContain("select.setAttribute('aria-describedby'");
    expect(response.text).toContain("document.createTextNode('ค่าที่ API ส่งจริง:')");
    expect(response.text).toContain('code.textContent = selectedValue');
    expect(response.text).toContain('new MutationObserver(queueEnumRefresh)');
    expect(response.text).toContain("renderSwagger({ url: '../openapi.json' })");
    expect(response.text).toContain('validatorUrl: null');
    expect(response.text).toContain('tryItOutEnabled: true');
    expect(response.text).toContain('persistAuthorization: false');
    expect(response.text).toContain('displayRequestDuration: true');
    expect(response.text).toContain('filter: true');
    expect(response.text).toContain("docExpansion: 'none'");
    expect(response.text).toContain('defaultModelsExpandDepth: -1');
    expect(response.text).not.toContain('innerHTML');
    expect(response.text).not.toContain('<script');
    expect(response.text).not.toMatch(/https?:\/\//);
  });

  it('serves the unified OpenAPI contract with local bearer and API-key schemes', async () => {
    const response = await request(createDocsTestApp()).get('/api/v1/openapi.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.servers).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: '/api/v1' })]),
    );
    expect(response.body.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(response.body.components.securitySchemes.deviceConfigApiKey).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    });

    const operationCount = Object.values(
      response.body.paths as Record<string, Record<string, unknown>>,
    ).reduce(
      (count, pathItem) =>
        count + Object.keys(pathItem).filter((key) => operationMethods.has(key)).length,
      0,
    );
    expect(operationCount).toBe(
      countOpenApiOperations(pomsOpenApiDocument as Record<string, unknown>),
    );
    expect(operationCount).toBe(135);
  });

  it('documents the key write flows with a required request body', async () => {
    const response = await request(createDocsTestApp()).get('/api/v1/openapi.json');
    const paths = response.body.paths as Record<
      string,
      Record<string, { requestBody?: { required?: boolean } }>
    >;

    expect(paths['/cems-wpms-requests/measurement-points'].post.requestBody?.required).toBe(true);
    expect(paths['/cems-wpms-requests/parameters'].post.requestBody?.required).toBe(true);
    expect(paths['/cems-wpms-requests/{id}/form'].put.requestBody?.required).toBe(true);
    expect(paths['/cems-wpms-requests/direct-connections'].post.requestBody?.required).toBe(true);
    expect(paths['/device-connections/test-connection'].post.requestBody?.required).toBe(true);
    expect(paths['/eligible-factories'].post.requestBody?.required).toBe(true);
    expect(paths['/kwp-form-submissions/kwp01'].post.requestBody?.required).toBe(true);
  });

  it('does not mount the documentation surface when it is disabled', async () => {
    const previousValue = env.API_DOCS_ENABLED;
    env.API_DOCS_ENABLED = false;

    try {
      const app = createDocsTestApp();
      const [docsResponse, specResponse] = await Promise.all([
        request(app).get('/api/v1/docs'),
        request(app).get('/api/v1/openapi.json'),
      ]);

      expect(docsResponse.status).toBe(404);
      expect(specResponse.status).toBe(404);
    } finally {
      env.API_DOCS_ENABLED = previousValue;
    }
  });
});
