import { describe, expect, it } from '@jest/globals';
import fixtures from '../fixtures/upload-archives.json';
import pdfArchiveFixtures from '../fixtures/pdf-upload-archives.json';
import { pdfFixture } from '../helpers/pdf-fixture';
import {
  jpegUploadFixture,
  pngUploadFixture,
  storedZipFixture,
} from '../helpers/raster-upload-fixture';
import {
  validateGeneralUpload,
  uploadContentDisposition,
} from '../../src/shared/utils/upload-file-policy';

const LIMIT = 5 * 1024 * 1024;
const archive = (key: keyof typeof fixtures): Buffer => Buffer.from(fixtures[key], 'base64');
function upload(name: string, buffer: Buffer, mimeType = 'application/octet-stream') {
  return { originalName: name, buffer, size: buffer.length, mimeType };
}

function convertedPdfArchive(key: 'safeZip' | 'activeZip' | 'embeddedZip'): Buffer {
  const buffer = Buffer.from(pdfArchiveFixtures[key], 'base64');
  const centralHeader = buffer.indexOf(Buffer.from('PK\x01\x02'));
  const originalName = Buffer.from('manual.pdf');
  const convertedName = Buffer.from('ab.doc.pdf');
  expect(buffer.subarray(30, 40)).toEqual(originalName);
  expect(buffer.subarray(centralHeader + 46, centralHeader + 56)).toEqual(originalName);
  // Filenames have equal byte lengths; entry data, sizes, offsets and CRC stay intact.
  convertedName.copy(buffer, 30);
  convertedName.copy(buffer, centralHeader + 46);
  return buffer;
}

describe('general upload risk filter', () => {
  it.each([
    ['notes.txt', Buffer.from('hello'), 'text/plain'],
    ['measurements.csv', Buffer.from('name,value\nx,1'), 'text/csv'],
    ['data.json', Buffer.from('{"value":1}'), 'application/json'],
    ['custom.dat', Buffer.from([1, 2, 3]), 'application/octet-stream'],
    [
      'document.docx',
      archive('document'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'workbook.xlsx',
      archive('spreadsheet'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['archive.zip', archive('ordinary'), 'application/zip'],
    ['nested.zip', archive('nestedOrdinary'), 'application/zip'],
  ])('accepts %s without trusting client MIME', async (name, buffer, mime) => {
    await expect(validateGeneralUpload(upload(name, buffer, 'image/png'), LIMIT)).resolves.toBe(
      mime,
    );
  });

  it.each([
    ['photo.png', pngUploadFixture('<script>example</script>'), 'image/png'],
    ['photo.jpg', jpegUploadFixture('<svg>example</svg>'), 'image/jpeg'],
    ['photo.png', pngUploadFixture('%PDF-1.7 in a comment'), 'image/png'],
    ['photo.jpg', jpegUploadFixture('%PDF-1.7 in a comment'), 'image/jpeg'],
    ['photo.png', jpegUploadFixture(), 'image/jpeg'],
    ['photo.jpg', pngUploadFixture(), 'image/png'],
    ['photo.jfif', jpegUploadFixture(), 'image/jpeg'],
  ])(
    'identifies raster content in %s without treating metadata as code',
    async (name, buffer, mime) => {
      await expect(validateGeneralUpload(upload(name, buffer), LIMIT)).resolves.toBe(mime);
    },
  );

  it.each(['photo.png', 'photo.jpg', 'photo.jfif', 'photo.gif', 'photo.webp'])(
    'rejects an actual PDF behind image filename %s',
    async (name) => {
      await expect(validateGeneralUpload(upload(name, pdfFixture()), LIMIT)).rejects.toThrow(
        'Uploaded file content does not match its declared type',
      );
    },
  );

  it.each([Buffer.from('<script>void(0)</script>'), Buffer.from('unrecognised image bytes')])(
    'requires a recognised image signature for JFIF uploads',
    async (buffer) => {
      await expect(validateGeneralUpload(upload('photo.jfif', buffer), LIMIT)).rejects.toThrow(
        'Uploaded file content does not match its declared type',
      );
    },
  );

  it.each([false, true])(
    'does not classify a PNG/PDF polyglot as PDF, active=%s',
    async (active) => {
      const pdf = pdfFixture(
        active ? { catalogEntries: '/OpenAction << /S /JavaScript /JS (void\\(0\\)) >>' } : {},
      );
      const buffer = Buffer.concat([pngUploadFixture(), pdf]);
      await expect(validateGeneralUpload(upload('report.pdf', buffer), LIMIT)).rejects.toThrow(
        'Uploaded file content does not match its declared type',
      );
      await expect(validateGeneralUpload(upload('photo.jpg', buffer), LIMIT)).resolves.toBe(
        'image/png',
      );
    },
  );

  it('inspects raster entries as image data inside ZIP archives', async () => {
    const image = jpegUploadFixture('<script>example</script> %PDF-1.7 macroenabled');
    const buffer = storedZipFixture('photo.png', image);
    await expect(validateGeneralUpload(upload('pictures.zip', buffer), LIMIT)).resolves.toBe(
      'application/zip',
    );
  });

  it('inspects nested raster archives without interpreting their binary bytes as macro XML', async () => {
    const image = jpegUploadFixture('<script>example</script> %PDF-1.7 macroenabled');
    const inner = storedZipFixture('photo.png', image);
    const outer = storedZipFixture('photos.zip', inner);
    await expect(validateGeneralUpload(upload('nested.zip', outer), LIMIT)).resolves.toBe(
      'application/zip',
    );
  });

  it('rejects a PDF disguised as an image inside a ZIP', async () => {
    const buffer = storedZipFixture('photo.png', pdfFixture());
    await expect(validateGeneralUpload(upload('pictures.zip', buffer), LIMIT)).rejects.toThrow(
      'Uploaded file content does not match its declared type',
    );
  });

  it.each(['doc.pdf', 'r.pdf'])('treats the basename of %s as a display name', async (name) => {
    await expect(validateGeneralUpload(upload(name, pdfFixture()), LIMIT)).resolves.toBe(
      'application/pdf',
    );
  });

  it('does not mistake a plain-text basename for a script extension', async () => {
    await expect(
      validateGeneralUpload(upload('sql.txt', Buffer.from('ordinary notes')), LIMIT),
    ).resolves.toBe('text/plain');
  });

  it.each(['script', 'svg'])('accepts an inline %s tag example in TXT prose', async (tag) => {
    const buffer = Buffer.from(`This guide explains the <${tag}> tag as ordinary text.`);
    await expect(validateGeneralUpload(upload('guide.txt', buffer), LIMIT)).resolves.toBe(
      'text/plain',
    );
  });

  it.each(['guide.xml', 'guide.dat'])(
    'keeps active-content marker checks for non-TXT file %s',
    async (name) => {
      await expect(
        validateGeneralUpload(upload(name, Buffer.from('Notes: <script>void(0)</script>')), LIMIT),
      ).rejects.toThrow('Script or active web content is not allowed');
    },
  );

  it('accepts a genuine converted PDF filename inside a ZIP', async () => {
    await expect(
      validateGeneralUpload(upload('documents.zip', convertedPdfArchive('safeZip')), LIMIT),
    ).resolves.toBe('application/zip');
  });

  it.each(['activeZip', 'embeddedZip'] as const)(
    'still inspects converted PDF entries inside %s',
    async (key) => {
      await expect(
        validateGeneralUpload(upload('documents.zip', convertedPdfArchive(key)), LIMIT),
      ).rejects.toThrow('PDF active content or embedded files are not allowed');
    },
  );

  it.each([
    'payload.EXE',
    'payload.exe.txt',
    'payload.ps1',
    'payload.py',
    'payload.php',
    'payload.sh',
    'payload.js',
    'payload.xsl',
    'payload.scpt',
    'macros.accdb',
    'payload.svg',
    'payload.html',
    'payload.docm',
    'payload.xlsm',
    'payload.xlsb',
    'legacy.doc',
    'legacy.xls',
    'legacy.ppt',
    'legacy.rtf',
    'archive.rar',
    'archive.7z',
    'archive.gz',
    'missing-extension',
    'trailing.txt.',
    'trailing.txt ',
    'colon:payload.txt',
    'null\0.txt',
  ])('rejects blocked or ambiguous filename %s', async (name) => {
    await expect(
      validateGeneralUpload(upload(name, Buffer.from('hello')), LIMIT),
    ).rejects.toThrow();
  });

  it.each([
    ['renamed.dat', Buffer.from('MZ executable')],
    ['renamed.dat', Buffer.from([0x7f, 0x45, 0x4c, 0x46])],
    ['renamed.dat', Buffer.from('cafebabe', 'hex')],
    ['renamed.dat', Buffer.from('d0cf11e0a1b11ae1', 'hex')],
    ['renamed.dat', Buffer.from('#!/bin/sh\necho hello')],
    ['renamed.dat', Buffer.from('<script>alert(1)</script>')],
    ['renamed.xml', Buffer.from('<?xml version="1.0"?><msxsl:script>code</msxsl:script>')],
    ['renamed.txt', Buffer.from('alert(1)')],
    ['renamed.txt', Buffer.from('console.log("script")')],
    ['renamed.dat', Buffer.from('<?php echo 1;')],
    ['renamed.dat', Buffer.from('\ufeff#!/bin/sh', 'utf16le')],
    ['active.pdf', Buffer.from('%PDF-1.4\n/JavaScript (alert(1))')],
    ['fake.png', Buffer.from('not an image')],
    ['fake.docx', Buffer.from('not an Office ZIP')],
    ['fake.zip', Buffer.from('PK\x03\x04malformed')],
  ])('rejects dangerous or mismatched content for %s', async (name, buffer) => {
    await expect(validateGeneralUpload(upload(name, buffer), LIMIT)).rejects.toThrow();
  });

  it.each([
    'script',
    'renamedExecutable',
    'macro',
    'macroContentType',
    'excelMacroSheet',
    'embeddedObject',
    'legacyOffice',
    'traversal',
    'largeEntry',
    'totalSize',
    'manyEntries',
    'nestedMacro',
    'deep',
  ] as const)('rejects unsafe ZIP fixture %s even when renamed', async (key) => {
    await expect(
      validateGeneralUpload(upload('renamed.dat', archive(key)), LIMIT),
    ).rejects.toThrow();
  });

  it('rejects encrypted entries and mismatched local/central filenames', async () => {
    const encrypted = archive('ordinary');
    const central = encrypted.indexOf(Buffer.from('PK\x01\x02'));
    encrypted.writeUInt16LE(encrypted.readUInt16LE(6) | 1, 6);
    encrypted.writeUInt16LE(encrypted.readUInt16LE(central + 8) | 1, central + 8);
    await expect(
      validateGeneralUpload(upload('encrypted.zip', encrypted), LIMIT),
    ).rejects.toThrow();

    const inconsistent = archive('ordinary');
    inconsistent[30] = 120;
    await expect(
      validateGeneralUpload(upload('inconsistent.zip', inconsistent), LIMIT),
    ).rejects.toThrow();
  });

  it('preserves the caller limit and rejects invalid declared sizes', async () => {
    const file = upload('data.dat', Buffer.alloc(1024, 65));
    await expect(validateGeneralUpload(file, 1024)).resolves.toBe('application/octet-stream');
    await expect(validateGeneralUpload(file, 1023)).rejects.toThrow();
    await expect(validateGeneralUpload({ ...file, size: 999 }, LIMIT)).rejects.toThrow();
    await expect(
      validateGeneralUpload(upload('empty.txt', Buffer.alloc(0)), LIMIT),
    ).rejects.toThrow();
  });

  it('keeps image/PDF previews and forces downloads for new file types', () => {
    expect(uploadContentDisposition('image.png', 'image/png')).toMatch(/^inline;/);
    expect(uploadContentDisposition('report.pdf', 'application/pdf')).toMatch(/^inline;/);
    expect(
      uploadContentDisposition(
        'data.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toMatch(/^attachment;/);
    expect(uploadContentDisposition('file.html', 'application/octet-stream')).toMatch(
      /^attachment;/,
    );
  });
});
