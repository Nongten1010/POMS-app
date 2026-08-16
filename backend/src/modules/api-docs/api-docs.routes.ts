import path from 'node:path';
import express, { Router } from 'express';
import { pomsOpenApiDocument, pomsOpenApiStats } from './poms.openapi';

const swaggerUiDistPath = path.dirname(require.resolve('swagger-ui-dist/package.json'));
const kanitFontPath = path.dirname(require.resolve('@fontsource/kanit/package.json'));
const totalOperations = pomsOpenApiStats.operationCount;
const totalApiEndpoints = pomsOpenApiStats.canonicalOperationCount;
const totalMenus = pomsOpenApiStats.tagCount;

const pomsDocsStyles = `
  :root {
    color-scheme: light;
    --poms-ink: #0b2239;
    --poms-teal: #007c78;
    --poms-water: #168aad;
    --poms-amber: #ffb000;
    --poms-mist: #edf5f5;
    --poms-paper: #ffffff;
    --poms-font-sans: "Kanit", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
    --poms-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  * {
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    overflow-x: hidden;
    background: var(--poms-mist);
    color: var(--poms-ink);
    font-family: var(--poms-font-sans);
    font-weight: 300;
  }

  .poms-skip-link {
    position: fixed;
    z-index: 20;
    top: 12px;
    left: 12px;
    padding: 10px 14px;
    border-radius: 6px;
    background: var(--poms-paper);
    color: var(--poms-ink);
    font-weight: 600;
    transform: translateY(-160%);
  }

  .poms-skip-link:focus {
    transform: translateY(0);
  }

  .poms-docs-hero {
    position: relative;
    overflow: hidden;
    padding: clamp(32px, 6vw, 72px) 24px clamp(28px, 5vw, 56px);
    background: linear-gradient(115deg, #071a2c 0%, var(--poms-ink) 58%, #0d4c57 100%);
    color: var(--poms-paper);
  }

  .poms-docs-hero::after {
    position: absolute;
    inset: auto -8% -72px 42%;
    height: 180px;
    content: "";
    opacity: 0.34;
    transform: rotate(-4deg);
    background:
      linear-gradient(
        115deg,
        transparent 0 8%,
        var(--poms-water) 8% 9%,
        transparent 9% 22%,
        var(--poms-amber) 22% 23%,
        transparent 23% 100%
      ),
      repeating-linear-gradient(90deg, transparent 0 47px, rgb(255 255 255 / 18%) 48px 49px);
  }

  .poms-docs-hero__inner {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  .poms-docs-eyebrow {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 0 0 16px;
    color: #9de2dc;
    font: 600 12px/1.4 var(--poms-font-sans);
    letter-spacing: 0.16em;
  }

  .poms-docs-eyebrow::before {
    width: 34px;
    height: 3px;
    content: "";
    background: var(--poms-amber);
  }

  .poms-docs-hero h1 {
    max-width: 760px;
    margin: 0;
    font-size: clamp(34px, 5vw, 64px);
    font-weight: 600;
    line-height: 1.08;
    letter-spacing: -0.035em;
  }

  .poms-docs-lead {
    max-width: 720px;
    margin: 18px 0 0;
    color: #d9e9ec;
    font-size: clamp(16px, 2vw, 19px);
    font-weight: 300;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .poms-docs-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
  }

  .poms-docs-stats li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 9px;
    align-items: baseline;
    min-width: 180px;
    padding: 10px 14px;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 8px;
    background: rgb(255 255 255 / 7%);
  }

  .poms-docs-stats strong {
    color: #ffffff;
    font: 600 22px/1 var(--poms-font-sans);
  }

  .poms-docs-stats span {
    color: #bdd8dc;
    font-size: 13px;
  }

  .poms-docs-notice {
    max-width: 880px;
    margin: 18px 0 0;
    padding: 12px 14px;
    border-left: 4px solid var(--poms-amber);
    border-radius: 0 8px 8px 0;
    background: rgb(255 176 0 / 12%);
    color: #f2f7f7;
    font-size: 14px;
    line-height: 1.65;
  }

  #swagger-ui {
    width: min(1240px, calc(100% - 32px));
    margin: 28px auto 64px;
    overflow-x: hidden;
    padding: clamp(12px, 2vw, 24px);
    border: 1px solid #d8e5e5;
    border-radius: 12px;
    background: var(--poms-paper);
    box-shadow: 0 18px 55px rgb(11 34 57 / 9%);
  }

  .swagger-ui .topbar {
    display: none;
  }

  .swagger-ui,
  .swagger-ui * {
    font-family: var(--poms-font-sans) !important;
  }

  .swagger-ui code,
  .swagger-ui pre,
  .swagger-ui .microlight,
  .swagger-ui .microlight *,
  .swagger-ui .highlight-code,
  .swagger-ui .highlight-code *,
  .swagger-ui .opblock-summary-path,
  .swagger-ui textarea.body-param__text,
  .swagger-ui .poms-enum-hint code {
    font-family: var(--poms-font-mono) !important;
  }

  .swagger-ui .info {
    margin: 12px 0 28px;
  }

  .swagger-ui .wrapper {
    max-width: 100%;
    padding-inline: 0;
  }

  .swagger-ui .info .title,
  .swagger-ui .opblock-tag {
    color: var(--poms-ink);
  }

  .swagger-ui .btn.authorize {
    border-color: var(--poms-teal);
    color: var(--poms-teal);
  }

  .swagger-ui select:focus-visible,
  .swagger-ui input:focus-visible,
  .swagger-ui textarea:focus-visible,
  .swagger-ui button:focus-visible,
  .swagger-ui a:focus-visible {
    outline: 3px solid var(--poms-amber);
    outline-offset: 2px;
  }

  .swagger-ui select.poms-enum-select {
    width: min(100%, 36rem);
    max-width: 100%;
    font-family: var(--poms-font-sans) !important;
  }

  .swagger-ui .poms-enum-hint {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    margin: 7px 0 0;
    color: #4f6473;
    font-size: 12px;
    line-height: 1.55;
  }

  .swagger-ui .poms-enum-hint code {
    padding: 2px 6px;
    border: 1px solid #c9dada;
    border-radius: 4px;
    background: #f2f8f8;
    color: var(--poms-ink);
    font: 700 11px/1.5 var(--poms-font-mono);
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    .poms-docs-hero {
      padding-inline: 18px;
    }

    .poms-docs-stats {
      display: grid;
    }

    .poms-docs-stats li {
      min-width: 0;
    }

    #swagger-ui {
      width: calc(100% - 16px);
      margin-top: 8px;
      padding: 8px;
      border-radius: 8px;
    }

    .swagger-ui .info .title {
      font-size: 28px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .swagger-ui .info p,
    .swagger-ui .info li,
    .swagger-ui .opblock-description-wrapper p {
      overflow-wrap: anywhere;
    }

    .swagger-ui .scheme-container {
      padding: 16px 0;
    }

    .swagger-ui .servers > label,
    .swagger-ui .opblock .opblock-summary {
      flex-wrap: wrap;
    }

    .swagger-ui select {
      max-width: 100%;
    }

    .swagger-ui .opblock .opblock-summary-path {
      max-width: calc(100% - 80px);
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .swagger-ui .opblock .opblock-summary-description {
      flex-basis: 100%;
      margin: 6px 10px 4px 74px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
  }
`;

const swaggerUiHtml = `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>POMS API Docs</title>
    <link rel="stylesheet" href="./fonts/300.css">
    <link rel="stylesheet" href="./fonts/600.css">
    <link rel="stylesheet" href="./assets/swagger-ui.css">
    <style>${pomsDocsStyles}</style>
  </head>
  <body>
    <a class="poms-skip-link" href="#swagger-ui">ข้ามไปยังรายการ API</a>
    <header class="poms-docs-hero" aria-labelledby="poms-docs-title">
      <div class="poms-docs-hero__inner">
        <p class="poms-docs-eyebrow">POMS API PLAYGROUND</p>
        <h1 id="poms-docs-title">ทดสอบทุก API ของระบบ POMS</h1>
        <p class="poms-docs-lead">
          ตรวจ payload, validation, auth และผลตอบกลับจาก OpenAPI ชุดเดียวกับ backend
          โดยจัดกลุ่มตามเมนูจริง เช่น หน้าหลัก ข้อมูลพื้นฐาน ขอเชื่อมต่อ แจ้งแบบ กวภ. 01-05 และงานผู้ดูแลระบบ
        </p>
        <ul class="poms-docs-stats" aria-label="ภาพรวม API">
          <li><strong>${totalApiEndpoints}</strong><span>API endpoints</span></li>
          <li><strong>${totalOperations}</strong><span>test operations</span></li>
          <li><strong>${totalMenus}</strong><span>กลุ่มเมนู</span></li>
        </ul>
        <p class="poms-docs-notice" role="note">
          <strong>ก่อนกด Execute:</strong> Try it out จะเรียก environment นี้จริงและอาจสร้างหรือแก้ข้อมูล
          ให้ใช้ token และข้อมูลทดสอบที่เหมาะสม ส่วน test-connection ที่ระบุ MOCK จะไม่ต่อ transport/database จริง
        </p>
      </div>
    </header>
    <div id="swagger-ui"></div>
    <script src="./assets/swagger-ui-bundle.js"></script>
    <script src="./assets/swagger-ui-standalone-preset.js"></script>
    <script src="./swagger-initializer.js"></script>
  </body>
</html>`;

const swaggerInitializer = `window.onload = function () {
  const enumGroups = [];
  const swaggerRoot = document.getElementById('swagger-ui');
  let enumObserver;
  let enumRefreshQueued = false;
  let enumHintId = 0;

  const normalizeEnumValue = (rawValue) =>
    typeof rawValue === 'string' ? rawValue.trim().replace(/^"(.*)"$/, '$1') : '';

  const collectEnumMetadata = (node) => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(collectEnumMetadata);
      return;
    }

    const values = Array.isArray(node.enum) ? node.enum.map(String) : [];
    const labels = node['x-enum-labels'];
    const descriptions = node['x-enum-descriptions'];
    if (values.length && labels && typeof labels === 'object' && !Array.isArray(labels)) {
      const groupLabels = new Map();
      const groupDescriptions = new Map();

      values.forEach((value) => {
        const label = labels[value];
        if (typeof label !== 'string' || !label.trim()) return;
        groupLabels.set(value, label.trim());

        const description = descriptions?.[value];
        if (typeof description === 'string' && description.trim()) {
          groupDescriptions.set(value, description.trim());
        }
      });

      if (groupLabels.size) {
        enumGroups.push({
          values: Array.from(groupLabels.keys()),
          labels: groupLabels,
          descriptions: groupDescriptions
        });
      }
    }

    Object.values(node).forEach(collectEnumMetadata);
  };

  const findEnumGroup = (select) => {
    const optionValues = Array.from(select.options)
      .map((option) => normalizeEnumValue(option.value))
      .filter((value) => value && value !== '--');
    if (!optionValues.length) return null;

    const candidates = enumGroups.filter(
      (group) =>
        group.values.length === optionValues.length &&
        optionValues.every((value) => group.labels.has(value))
    );
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length) return null;

    const labelSignatures = new Set(
      candidates.map((group) => optionValues.map((value) => group.labels.get(value)).join('|'))
    );
    return labelSignatures.size === 1 ? candidates[0] : null;
  };

  const emptyLabelForGroup = (group) => {
    if (group.labels.has('PENDING_DESIGN_REVIEW')) return 'ทุกสถานะ';
    if (group.labels.has('NEW_CONNECTION')) return 'ทุกประเภทคำขอ';
    return 'ไม่ระบุ / ใช้ค่าเริ่มต้น';
  };

  const updateEnumHint = (select, group) => {
    let hint = select.nextElementSibling;
    if (!hint || !hint.classList.contains('poms-enum-hint')) {
      hint = document.createElement('small');
      hint.className = 'poms-enum-hint';
      hint.id = 'poms-enum-hint-' + String(++enumHintId);
      hint.setAttribute('aria-live', 'polite');
      select.insertAdjacentElement('afterend', hint);

      const describedBy = (select.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && !id.startsWith('poms-enum-hint-'));
      select.setAttribute('aria-describedby', [...describedBy, hint.id].join(' '));
    }

    const selectedValue = normalizeEnumValue(select.value);
    if (hint.dataset.enumValue === selectedValue) return;
    hint.dataset.enumValue = selectedValue;

    if (!selectedValue || !group.labels.has(selectedValue)) {
      hint.textContent = 'ยังไม่ส่งค่านี้ — ระบบจะไม่กรองหรือใช้ค่าเริ่มต้น';
      return;
    }

    const code = document.createElement('code');
    code.textContent = selectedValue;
    hint.replaceChildren(document.createTextNode('ค่าที่ API ส่งจริง:'), code);
  };

  const decorateEnumSelect = (select) => {
    const group = findEnumGroup(select);
    if (!group) return;

    select.classList.add('poms-enum-select');
    Array.from(select.options).forEach((option) => {
      const value = normalizeEnumValue(option.value);
      if (!value) {
        const emptyLabel = emptyLabelForGroup(group);
        if (option.textContent !== emptyLabel) option.textContent = emptyLabel;
        return;
      }

      const label = group.labels.get(value);
      if (!label) return;
      const displayText = label === value ? value : label + ' — ' + value;
      if (option.textContent !== displayText) option.textContent = displayText;
      option.title = group.descriptions.get(value) || label + ' — รหัสที่ API ส่งจริง: ' + value;
    });

    if (!select.dataset.pomsEnumBound) {
      select.dataset.pomsEnumBound = 'true';
      select.addEventListener('change', () => updateEnumHint(select, group));
    }
    updateEnumHint(select, group);
  };

  const applyEnumLabels = () => {
    if (!swaggerRoot) return;
    swaggerRoot.querySelectorAll('select').forEach(decorateEnumSelect);
  };

  const queueEnumRefresh = () => {
    if (enumRefreshQueued) return;
    enumRefreshQueued = true;
    window.requestAnimationFrame(() => {
      enumRefreshQueued = false;
      applyEnumLabels();
    });
  };

  const renderSwagger = (source) => {
    window.ui = SwaggerUIBundle({
      ...source,
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
      validatorUrl: null,
      tryItOutEnabled: true,
      persistAuthorization: false,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: -1,
      onComplete: function () {
        applyEnumLabels();
        if (swaggerRoot && !enumObserver) {
          enumObserver = new MutationObserver(queueEnumRefresh);
          enumObserver.observe(swaggerRoot, { childList: true, subtree: true });
        }
      }
    });
  };

  fetch('../openapi.json', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
    .then((response) => {
      if (!response.ok) throw new Error('OpenAPI document could not be loaded');
      return response.json();
    })
    .then((spec) => {
      collectEnumMetadata(spec);
      renderSwagger({ spec });
    })
    .catch(() => renderSwagger({ url: '../openapi.json' }));
};
`;

export const apiDocsRoutes = Router({ strict: true });

apiDocsRoutes.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(pomsOpenApiDocument);
});

apiDocsRoutes.get('/docs', (req, res) => {
  res.redirect(308, `${req.baseUrl}/docs/`);
});

apiDocsRoutes.get('/docs/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(swaggerUiHtml);
});

apiDocsRoutes.get('/docs/swagger-initializer.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript').send(swaggerInitializer);
});

apiDocsRoutes.use(
  '/docs/fonts',
  express.static(kanitFontPath, {
    fallthrough: false,
    index: false,
    maxAge: '1d',
  }),
);

apiDocsRoutes.use(
  '/docs/assets',
  express.static(swaggerUiDistPath, {
    fallthrough: false,
    index: false,
    maxAge: '1d',
  }),
);
