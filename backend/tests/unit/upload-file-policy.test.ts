import { describe, expect, it } from '@jest/globals';
import fixtures from '../fixtures/upload-archives.json';
import {
  validateGeneralUpload,
  uploadContentDisposition,
} from '../../src/shared/utils/upload-file-policy';

const LIMIT = 5 * 1024 * 1024;
const archive = (key: keyof typeof fixtures): Buffer => Buffer.from(fixtures[key], 'base64');
function upload(name: string, buffer: Buffer, mimeType = 'application/octet-stream') {
  return { originalName: name, buffer, size: buffer.length, mimeType };
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
