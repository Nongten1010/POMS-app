import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import request from 'supertest';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';
import { jpegUploadFixture, pngUploadFixture } from '../helpers/raster-upload-fixture';

describe('connection request upload compatibility with ordinary document content', () => {
  let pdfBuffer: Buffer;
  let activePdfBuffer: Buffer;

  beforeAll(async () => {
    const document = await PDFDocument.create();
    document.addPage();
    pdfBuffer = Buffer.from(await document.save());

    const activeDocument = await PDFDocument.create();
    activeDocument.addPage();
    activeDocument.catalog.set(
      PDFName.of('OpenAction'),
      activeDocument.context.obj({
        S: PDFName.of('JavaScript'),
        JS: PDFString.of('void(0);'),
      }),
    );
    activePdfBuffer = Buffer.from(await activeDocument.save());
  });

  async function withUploadDirectory(
    callback: (uploadDir: string) => Promise<void>,
  ): Promise<void> {
    const previousUploadDir = env.UPLOAD_DIR;
    const previousPublicBaseUrl = env.PUBLIC_BASE_URL;
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-upload-compatibility-'));
    env.UPLOAD_DIR = uploadDir;
    env.PUBLIC_BASE_URL = undefined;

    try {
      await callback(uploadDir);
    } finally {
      env.UPLOAD_DIR = previousUploadDir;
      env.PUBLIC_BASE_URL = previousPublicBaseUrl;
      await rm(uploadDir, { recursive: true, force: true });
    }
  }

  function accessToken(): string {
    return signTestAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['operator'],
      scopes: { 'cems_wpms_requests:edit': 'OWN_FACTORY' },
    });
  }

  it.each([
    ['photo.png', jpegUploadFixture(), 'image/jpeg', '.jpg'],
    ['photo.jpg', pngUploadFixture(), 'image/png', '.png'],
    ['photo.jfif', jpegUploadFixture(), 'image/jpeg', '.jpg'],
    ['photo.png', pngUploadFixture('<script>example</script> %PDF-1.7'), 'image/png', '.png'],
    ['photo.jpg', jpegUploadFixture('<svg>example</svg> %PDF-1.7'), 'image/jpeg', '.jpg'],
    ['photo.jpg', () => Buffer.concat([pngUploadFixture(), activePdfBuffer]), 'image/png', '.png'],
  ])(
    'stores %s using its detected raster format',
    async (filename, fixture, mimeType, extension) => {
      await withUploadDirectory(async (uploadDir) => {
        const buffer = typeof fixture === 'function' ? fixture() : fixture;
        const response = await request(createApp())
          .post('/api/v1/cems-wpms-requests/document-images')
          .set('Authorization', `Bearer ${accessToken()}`)
          .attach('file', buffer, { filename, contentType: 'application/octet-stream' });

        expect({ status: response.status, body: response.body }).toMatchObject({
          status: 201,
          body: { success: true, data: { fileName: filename, fileType: mimeType } },
        });
        const publicPath = new URL(response.body.data.fileUrl).pathname;
        expect(path.extname(publicPath)).toBe(extension);
        const storedPath = path.join(
          uploadDir,
          publicPath.slice(env.UPLOAD_PUBLIC_PATH.length + 1),
        );
        await expect(readFile(storedPath)).resolves.toEqual(buffer);
        const download = await request(createApp()).get(publicPath);
        expect(download.status).toBe(200);
        expect(download.headers['content-type']).toBe(mimeType);
        expect(download.headers['x-content-type-options']).toBe('nosniff');
      });
    },
  );

  it.each([
    ['photo.png', Buffer.from('<html><script>void(0)</script></html>')],
    ['photo.jpg', Buffer.from('MZ executable payload')],
    ['photo.png', Buffer.from('d0cf11e0a1b11ae1', 'hex')],
    ['photo.png', () => pdfBuffer],
    ['photo.jpg', () => activePdfBuffer],
    ['photo.jfif', () => activePdfBuffer],
    ['photo.jfif', Buffer.from('unrecognised bytes')],
    ['photo.jfif', Buffer.from('<script>void(0)</script>')],
    ['report.pdf', () => Buffer.concat([pngUploadFixture(), activePdfBuffer])],
  ])('rejects non-raster content renamed to %s', async (filename, fixture) => {
    await withUploadDirectory(async () => {
      const buffer = typeof fixture === 'function' ? fixture() : fixture;
      const response = await request(createApp())
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', buffer, { filename, contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  it.each(['report.pdf', 'report.doc.pdf', 'report.xls.pdf', 'report.ppt.pdf'])(
    'stores the same genuine PDF bytes when the display filename is %s',
    async (filename) => {
      await withUploadDirectory(async (uploadDir) => {
        const app = createApp();
        const response = await request(app)
          .post('/api/v1/cems-wpms-requests/document-images')
          .set('Authorization', `Bearer ${accessToken()}`)
          .attach('file', pdfBuffer, { filename, contentType: 'application/pdf' });

        expect(response.body.error).toBeUndefined();
        expect({ status: response.status, body: response.body }).toMatchObject({
          status: 201,
          body: {
            success: true,
            data: { fileName: filename, fileType: 'application/pdf', fileSize: pdfBuffer.length },
          },
        });
        const publicPath = new URL(response.body.data.fileUrl).pathname;
        const storedPath = path.join(
          uploadDir,
          publicPath.slice(env.UPLOAD_PUBLIC_PATH.length + 1),
        );
        await expect(readFile(storedPath)).resolves.toEqual(pdfBuffer);
        expect(path.basename(storedPath)).toMatch(/^[a-f0-9-]+\.pdf$/);

        const download = await request(app).get(publicPath);
        expect(download.status).toBe(200);
        expect(download.headers['content-type']).toBe('application/pdf');
        expect(download.headers['x-content-type-options']).toBe('nosniff');
      });
    },
  );

  it('serves a plain-text explanation of a script tag only as an inert download', async () => {
    await withUploadDirectory(async (uploadDir) => {
      const app = createApp();
      const contents = Buffer.from('User guide: the <script> tag is an example in this document.');
      const response = await request(app)
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', contents, { filename: 'guide.txt', contentType: 'text/plain' });

      expect(response.body.error).toBeUndefined();
      expect({ status: response.status, body: response.body }).toMatchObject({
        status: 201,
        body: {
          success: true,
          data: { fileName: 'guide.txt', fileType: 'text/plain', fileSize: contents.length },
        },
      });
      const publicPath = new URL(response.body.data.fileUrl).pathname;
      const storedPath = path.join(uploadDir, publicPath.slice(env.UPLOAD_PUBLIC_PATH.length + 1));
      await expect(readFile(storedPath)).resolves.toEqual(contents);

      const download = await request(app).get(publicPath);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toBe('application/octet-stream');
      expect(download.headers['content-disposition']).toMatch(/^attachment;/);
      expect(download.headers['x-content-type-options']).toBe('nosniff');
      expect(download.body).toEqual(contents);
    });
  });

  it.each([
    ['payload.exe.pdf', Buffer.from('MZ executable payload'), 'application/pdf'],
    ['notes.txt', Buffer.from('console.log("payload")'), 'text/plain'],
  ])('keeps rejecting active content renamed to %s', async (filename, contents, contentType) => {
    await withUploadDirectory(async () => {
      const response = await request(createApp())
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', contents, { filename, contentType });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, error: { code: 'BAD_REQUEST' } });
    });
  });

  it.each([
    {
      label: 'malformed PDF',
      contents: () => Buffer.from('%PDF-1.4\nnot a PDF'),
      contentType: 'application/pdf',
    },
    {
      label: 'Windows executable bytes',
      contents: () => Buffer.from('MZ executable payload'),
      contentType: 'application/pdf',
    },
    {
      label: 'legacy Office bytes',
      contents: () => Buffer.from('d0cf11e0a1b11ae1', 'hex'),
      contentType: 'application/pdf',
    },
    {
      label: 'PDF JavaScript action',
      contents: () => activePdfBuffer,
      contentType: 'application/pdf',
    },
    {
      label: 'JavaScript MIME on genuine PDF bytes',
      contents: () => pdfBuffer,
      contentType: 'application/javascript',
    },
  ])('rejects $label behind a converted-document filename', async ({ contents, contentType }) => {
    await withUploadDirectory(async () => {
      const response = await request(createApp())
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', contents(), { filename: 'report.doc.pdf', contentType });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, error: { code: 'BAD_REQUEST' } });
    });
  });

  it.each(['report.exe.pdf', 'report.docm.pdf', 'report.pdf.exe'])(
    'rejects the dangerous filename %s even when its bytes are a genuine PDF',
    async (filename) => {
      await withUploadDirectory(async () => {
        const response = await request(createApp())
          .post('/api/v1/cems-wpms-requests/document-images')
          .set('Authorization', `Bearer ${accessToken()}`)
          .attach('file', pdfBuffer, { filename, contentType: 'application/pdf' });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ success: false, error: { code: 'BAD_REQUEST' } });
      });
    },
  );

  describe.each([
    ['without a prefix', ''],
    ['after a BOM and whitespace', '\uFEFF \n\t'],
  ])('active web content disguised as TXT %s', (_description, prefix) => {
    it.each([
      ['HTML script', '<script>void(0);</script>'],
      ['SVG', '<svg xmlns="http://www.w3.org/2000/svg"><script>void(0);</script></svg>'],
      ['XML with script', '<?xml version="1.0"?><root><script>void(0);</script></root>'],
    ])('rejects %s', async (_name, markup) => {
      await withUploadDirectory(async () => {
        const response = await request(createApp())
          .post('/api/v1/cems-wpms-requests/document-images')
          .set('Authorization', `Bearer ${accessToken()}`)
          .attach('file', Buffer.from(prefix + markup), {
            filename: 'notes.txt',
            contentType: 'text/plain',
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ success: false, error: { code: 'BAD_REQUEST' } });
      });
    });
  });
});
