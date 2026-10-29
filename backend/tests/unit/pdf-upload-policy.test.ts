import { describe, expect, it } from '@jest/globals';
import { PDFDocument } from 'pdf-lib';
import { deflateSync } from 'node:zlib';
import archiveFixtures from '../fixtures/pdf-upload-archives.json';
import { validateGeneralUpload } from '../../src/shared/utils/upload-file-policy';
import { validateFaqFile } from '../../src/modules/faqs/faqs-file-storage';
import { pdfFixture, pdfStream, pdfWithImageMarker } from '../helpers/pdf-fixture';

const ACTIVE_CONTENT_ERROR = 'PDF active content or embedded files are not allowed';
const LIMIT = 10 * 1024 * 1024;
function upload(buffer: Buffer, originalName = 'manual.pdf') {
  return { buffer, size: buffer.length, originalName, mimeType: 'application/pdf' };
}
function faqUpload(buffer: Buffer): Express.Multer.File {
  return {
    buffer,
    size: buffer.length,
    originalname: 'manual.pdf',
    mimetype: 'application/pdf',
  } as Express.Multer.File;
}

describe('PDF upload structure inspection', () => {
  it('accepts the FAQ regression: /Js bytes inside a compressed image', async () => {
    const buffer = pdfWithImageMarker();
    expect(buffer.includes(Buffer.from('/Js'))).toBe(true);
    await expect(validateFaqFile(faqUpload(buffer))).resolves.toBe('application/pdf');
  });

  it.each([
    ['a comment', { comment: '/JS /JavaScript /EmbeddedFile /Launch /RichMedia' }],
    ['a literal string', { catalogEntries: '/Example (/JS /JavaScript /EmbeddedFile)' }],
    ['page content', { content: '(/JS /JavaScript /EmbeddedFile) Tj' }],
    ['HTML examples in page content', { content: '(<script>example</script>) Tj' }],
    ['a hex string', { catalogEntries: '/Example <2f4a53202f456d62656464656446696c65>' }],
  ])('accepts marker-like text in %s', async (_name, options) => {
    await expect(validateGeneralUpload(upload(pdfFixture(options)), LIMIT)).resolves.toBe(
      'application/pdf',
    );
  });

  it('accepts ordinary HTTPS link annotations', async () => {
    const buffer = pdfFixture({
      pageEntries: '/Annots [5 0 R]',
      objects: [
        '<< /Type /Annot /Subtype /Link /Rect [0 0 50 50] /A << /S /URI /URI (https://example.invalid/manual) >> >>',
      ],
    });
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).resolves.toBe('application/pdf');
  });

  it.each([false, true])(
    'blocks actual JavaScript, object streams=%s',
    async (useObjectStreams) => {
      const document = await PDFDocument.create();
      document.addPage();
      document.addJavaScript('example', 'void(0);');
      const buffer = Buffer.from(await document.save({ useObjectStreams }));
      if (useObjectStreams) expect(buffer.includes(Buffer.from('/JavaScript'))).toBe(false);
      await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
        ACTIVE_CONTENT_ERROR,
      );
    },
  );

  it.each([false, true])(
    'blocks actual attached files, object streams=%s',
    async (useObjectStreams) => {
      const document = await PDFDocument.create();
      document.addPage();
      await document.attach(Buffer.from('plain attachment'), 'notes.txt');
      const buffer = Buffer.from(await document.save({ useObjectStreams }));
      await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
        ACTIVE_CONTENT_ERROR,
      );
    },
  );

  it.each([
    [
      'escaped JavaScript names',
      '/OpenAction 5 0 R',
      ['<< /S /Java#53cript /J#53 (void\\(0\\)) >>'],
    ],
    ['lowercase hex escapes', '/OpenAction 5 0 R', ['<< /S /#4aavaScript /#4aS (void\\(0\\)) >>']],
    [
      'indirect action type and script',
      '/OpenAction 5 0 R',
      ['<< /S 6 0 R /JS 7 0 R >>', '/JavaScript', '(void\\(0\\))'],
    ],
    [
      'file specification without EmbeddedFile type',
      '/Names << /EmbeddedFiles 5 0 R >>',
      [
        '<< /Names [(notes.txt) << /Type /Filespec /EF << /F 6 0 R >> >>] >>',
        '<< /Length 0 >>\nstream\n\nendstream',
      ],
    ],
    ['launch action', '/OpenAction 5 0 R', ['<< /S /Launch /F (program.exe) >>']],
    ['rich-media annotation', '', ['<< /Type /Annot /Subtype /RichMedia >>']],
  ] as const)('blocks %s', async (_name, catalogEntries, objects) => {
    const buffer = pdfFixture({ catalogEntries, objects: [...objects] });
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
      ACTIVE_CONTENT_ERROR,
    );
  });

  it('inspects PDF bytes even when renamed to a different extension', async () => {
    const buffer = pdfFixture({
      catalogEntries: '/OpenAction << /S /JavaScript /JS (void\\(0\\)) >>',
    });
    await expect(validateGeneralUpload(upload(buffer, 'manual.dat'), LIMIT)).rejects.toThrow(
      ACTIVE_CONTENT_ERROR,
    );
  });

  it('preserves the FAQ status, code, and field error for actual active content', async () => {
    const buffer = pdfFixture({
      catalogEntries: '/OpenAction << /S /JavaScript /JS (void\\(0\\)) >>',
    });
    await expect(validateFaqFile(faqUpload(buffer))).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: ACTIVE_CONTENT_ERROR,
      details: { files: ACTIVE_CONTENT_ERROR },
    });
  });

  it('inspects ordinary PDFs inside ZIP archives without image-marker false positives', async () => {
    const buffer = Buffer.from(archiveFixtures.safeZip, 'base64');
    await expect(validateGeneralUpload(upload(buffer, 'manual.zip'), LIMIT)).resolves.toBe(
      'application/zip',
    );
  });

  it.each(['activeZip', 'embeddedZip', 'nestedActiveZip'] as const)(
    'blocks unsafe PDFs inside %s',
    async (key) => {
      const buffer = Buffer.from(archiveFixtures[key], 'base64');
      await expect(validateGeneralUpload(upload(buffer, 'manual.zip'), LIMIT)).rejects.toThrow(
        ACTIVE_CONTENT_ERROR,
      );
    },
  );

  it('rejects encrypted PDFs whose contents cannot be inspected', async () => {
    const buffer = Buffer.from(archiveFixtures.encryptedPdf, 'base64');
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
      'Invalid, encrypted or unsupported PDF file',
    );
  });

  it('rejects object streams the parser could not expand, including escaped Type names', async () => {
    const data = deflateSync(Buffer.from('6 0 << /S /JavaScript /JS (void\\(0\\)) >>'));
    const buffer = pdfFixture({
      catalogEntries: '/OpenAction 6 0 R',
      objects: [pdfStream(data, '/Type /ObjSt#6d /N 1 /First 4 /Filter /FlateDecode')],
    });
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
      'Invalid, encrypted or unsupported PDF file',
    );
  });

  it('accepts ordinary AcroForm fields without scripts', async () => {
    const buffer = pdfFixture({
      catalogEntries: '/AcroForm 5 0 R',
      objects: ['<< /Fields [] >>'],
    });
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).resolves.toBe('application/pdf');
  });

  it('rejects uninspectable XFA forms that can carry scripts inside XML streams', async () => {
    const xml = Buffer.from(
      '<template xmlns="http://www.xfa.org/schema/xfa-template/3.3/"><subform><event activity="initialize"><script contentType="application/x-javascript">void(0);</script></event></subform></template>',
    );
    const buffer = pdfFixture({
      catalogEntries: '/AcroForm 5 0 R',
      objects: ['<< /Fields [] /XFA 6 0 R >>', pdfStream(deflateSync(xml), '/Filter /FlateDecode')],
    });
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
      'Invalid, encrypted or unsupported PDF file',
    );
  });

  it('blocks 3D JavaScript referenced by OnInstantiate', async () => {
    const buffer = pdfFixture({
      pageEntries: '/Annots [5 0 R]',
      objects: [
        '<< /Type /Annot /Subtype /3D /Rect [0 0 100 100] /3DD 6 0 R >>',
        pdfStream(Buffer.from('fixture 3D data'), '/Type /3D /Subtype /U3D /OnInstantiate 7 0 R'),
        pdfStream(Buffer.from('void(0);')),
      ],
    });
    await expect(validateGeneralUpload(upload(buffer), LIMIT)).rejects.toThrow(
      ACTIVE_CONTENT_ERROR,
    );
  });

  it('rejects a PDF that cannot be parsed instead of silently accepting it', async () => {
    await expect(
      validateFaqFile(faqUpload(Buffer.from('%PDF-1.7\nnot a PDF'))),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid, encrypted or unsupported PDF file',
      details: { files: 'Invalid, encrypted or unsupported PDF file' },
    });
  });
});
