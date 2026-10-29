import path from 'node:path';
import { fromBuffer, type Entry, type ZipFile } from 'yauzl';
import { BadRequestError } from '../errors/AppError';
import { validatePdfUpload } from './pdf-upload-policy';

// This is a risk filter, not an antivirus verdict. Never execute uploaded content.
const blockedExtensions = new Set(
  `exe dll com scr cpl ocx sys drv efi so dylib msi msp msix app appx apk ipa dmg iso img deb rpm binrun jar class wasm
  bat cmd ps1 ps2 psm1 psd1 ps1xml psc1 sh bash zsh fish ksh csh js jse mjs cjs jsx ts tsx vbs vbe wsf wsh
  php php3 php4 php5 php7 php8 phtml phar asp aspx ascx ashx jsp jspx cgi pl pm py pyw pyc pyo pyz rb lua r sql
  vb vba bas vbp ahk au3 scpt scptd applescript sct wsc xsl xslt run action workflow
  html htm xhtml shtml svg svgz hta swf lnk url desktop reg inf scf chm
  doc xls ppt dot xlt pot docm dotm xlsm xltm xla xlm xlam xlsb pptm potm ppam ppsm sldm rtf
  mdb mde mda accdb accde accdr accda adp ade otm
  rar 7z gz gzip bz2 xz zst tar tgz tbz tbz2 txz cab ace arj lz lzh lzma sit sitx
  env`.split(/\s+/),
);
const blockedMime =
  /(?:javascript|ecmascript|x-(?:msdownload|dosexec|executable|sharedlib|shellscript|php|python|perl|ruby)|macroenabled|text\/html|image\/svg\+xml)/i;
const officeMimeTypes: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
};
const ordinaryMimeTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.avif': 'image/avif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
};
const ZIP_MAX_ENTRIES = 256;
const ZIP_MAX_EXPANDED_BYTES = 25 * 1024 * 1024;
const ZIP_MAX_ENTRY_BYTES = 10 * 1024 * 1024;
const ZIP_MAX_DEPTH = 2;

export interface GeneralUploadedFile {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export function validateUploadFileMetadata(originalName: string, mimeType: string): string {
  const name = path.posix.basename(originalName.replace(/\\/g, '/'));
  if (!name || name.length > 1024 || /[\u0000-\u001f\u007f:]/.test(name) || /[. ]$/.test(name)) {
    throw new BadRequestError('Invalid uploaded file name');
  }
  const extension = path.posix.extname(name).toLowerCase();
  if (!/^\.[a-z0-9]{1,16}$/.test(extension)) {
    throw new BadRequestError('Uploaded file must have a valid extension');
  }
  if (
    name
      .toLowerCase()
      .split('.')
      .some((part) => blockedExtensions.has(part)) ||
    blockedMime.test(mimeType)
  ) {
    throw new BadRequestError(
      'Programs, scripts, macros and uninspectable archives are not allowed',
    );
  }
  return extension;
}

export async function validateGeneralUpload(
  file: GeneralUploadedFile,
  maxBytes: number,
): Promise<string> {
  if (
    !Buffer.isBuffer(file.buffer) ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > maxBytes ||
    file.size !== file.buffer.length
  ) {
    throw new BadRequestError(
      `Uploaded file must contain 1 byte to ${maxBytes / 1024 / 1024} MB and match its declared size`,
    );
  }
  const extension = validateUploadFileMetadata(file.originalName, file.mimeType);
  await inspectContent(file.buffer, extension);
  if (isZip(file.buffer)) {
    await inspectZip(file.buffer, { entries: 0, bytes: 0 }, 0);
  } else if (officeMimeTypes[extension] || extension === '.zip') {
    throw new BadRequestError('Uploaded file content does not match its declared type');
  }
  // Ignore client MIME when determining what will be sent back on download.
  return officeMimeTypes[extension] ?? ordinaryMimeTypes[extension] ?? 'application/octet-stream';
}

async function inspectContent(buffer: Buffer, extension: string): Promise<void> {
  const hex = buffer.subarray(0, 8).toString('hex');
  if (
    buffer.subarray(0, 2).toString('ascii') === 'MZ' ||
    /^(7f454c46|cafebabe|bebafeca|feedface|cefaedfe|feedfacf|cffaedfe|cafebabf|bfbafeca|0061736d|d0cf11e0a1b11ae1|52617221|377abcaf271c|1f8b|425a68|fd377a585a00|28b52ffd|4d534346)/.test(
      hex,
    ) ||
    buffer.subarray(257, 262).toString('ascii') === 'ustar'
  ) {
    throw new BadRequestError(
      'Executable, legacy Office or uninspectable archive content is not allowed',
    );
  }
  const isPdf = buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  // Also recognise UTF-16 scripts, including files renamed to ordinary text extensions.
  const head = buffer.subarray(0, 65536);
  const text = (
    head[0] === 0xff && head[1] === 0xfe ? head.toString('utf16le') : head.toString('utf8')
  )
    .replace(/\0/g, '')
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (
    !isPdf &&
    (/^(#!|<\?php\b|<\?=|<!doctype\s+html\b|<html\b|<svg\b|@echo\s+off\b)/i.test(text) ||
      /<(?:[\w.-]+:)?(?:script|svg)\b/i.test(text) ||
      /^(?:["']use strict["']\s*;|(?:const|let|var)\s+\w+\s*=|(?:def|function)\s+\w+\s*\(|(?:import|from)\s+[\w.]+\s+(?:import|as)|(?:console|document|window|process)\s*\.|(?:alert|eval|require)\s*\()/i.test(
        text,
      ))
  ) {
    throw new BadRequestError('Script or active web content is not allowed');
  }
  const signatures: Record<string, boolean> = {
    '.pdf': isPdf,
    '.png': hex === '89504e470d0a1a0a',
    '.jpg': hex.startsWith('ffd8ff'),
    '.jpeg': hex.startsWith('ffd8ff'),
    '.gif': /^GIF8[79]a/.test(buffer.subarray(0, 6).toString('ascii')),
    '.webp':
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  if (signatures[extension] === false) {
    throw new BadRequestError('Uploaded file content does not match its declared type');
  }
  if (extension === '.txt') {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new BadRequestError('TXT files must contain UTF-8 text');
    }
    if (buffer.includes(0)) throw new BadRequestError('TXT files must contain text');
  }
  if (isPdf) await validatePdfUpload(buffer);
}

function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 && [0x04034b50, 0x06054b50, 0x08074b50].includes(buffer.readUInt32LE(0))
  );
}

interface ZipBudget {
  entries: number;
  bytes: number;
}

async function inspectZip(buffer: Buffer, budget: ZipBudget, depth: number): Promise<void> {
  if (depth > ZIP_MAX_DEPTH) throw new BadRequestError('Archive nesting limit exceeded');
  await new Promise<void>((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error || !zip) {
          reject(new BadRequestError('Invalid or unsupported ZIP file'));
          return;
        }
        if (zip.entryCount > ZIP_MAX_ENTRIES) {
          zip.close();
          reject(new BadRequestError('Archive inspection limit exceeded'));
          return;
        }
        const seen = new Set<string>();
        let stopped = false;
        const fail = (reason: unknown) => {
          if (stopped) return;
          stopped = true;
          zip.close();
          reject(
            reason instanceof BadRequestError
              ? reason
              : new BadRequestError('Invalid or unsupported ZIP file'),
          );
        };
        zip.on('error', fail);
        zip.on('end', () => {
          if (!stopped) resolve();
        });
        zip.on('entry', (entry: Entry) => {
          void inspectZipEntry(zip, entry, budget, depth, seen).then(() => {
            if (!stopped) zip.readEntry();
          }, fail);
        });
        zip.readEntry();
      },
    );
  });
}

async function inspectZipEntry(
  zip: ZipFile,
  entry: Entry,
  budget: ZipBudget,
  depth: number,
  seen: Set<string>,
): Promise<void> {
  const name = entry.fileName.toLowerCase();
  budget.entries += 1;
  budget.bytes += entry.uncompressedSize;
  if (
    budget.entries > ZIP_MAX_ENTRIES ||
    budget.bytes > ZIP_MAX_EXPANDED_BYTES ||
    entry.uncompressedSize > ZIP_MAX_ENTRY_BYTES
  ) {
    throw new BadRequestError('Archive inspection limit exceeded');
  }
  if (
    seen.has(name) ||
    /[\u0000-\u001f\u007f:]/.test(name) ||
    (entry.generalPurposeBitFlag & 0x41) !== 0 ||
    ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
  ) {
    throw new BadRequestError('Encrypted, duplicate or unsafe archive entry is not allowed');
  }
  seen.add(name);
  if (
    /(?:^|\/)(?:vbaproject|vbadata|macros?|macrosheets|intlmacrosheets|scripts?|basic)(?:[/.]|$)|(?:^|\/)embeddings\//i.test(
      name,
    )
  ) {
    throw new BadRequestError('Office macros, scripts or embedded objects are not allowed');
  }
  const header = await zip.readLocalFileHeaderPromise(entry);
  if (
    !header.fileName.equals(entry.fileNameRaw) ||
    header.generalPurposeBitFlag !== entry.generalPurposeBitFlag ||
    header.compressionMethod !== entry.compressionMethod
  ) {
    throw new BadRequestError('Inconsistent ZIP entry headers are not allowed');
  }
  if (name.endsWith('/')) {
    if (entry.uncompressedSize !== 0)
      throw new BadRequestError('Archive directories must not contain data');
    return;
  }
  // Office package internals may have extensionless files; still reject dangerous suffixes.
  const extension = path.posix.extname(name);
  if (extension) validateUploadFileMetadata(path.posix.basename(name), '');
  const contents = await new Promise<Buffer>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error('Missing ZIP entry stream'));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      stream.on('error', reject);
      stream.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > ZIP_MAX_ENTRY_BYTES || bytes > entry.uncompressedSize) {
          stream.destroy(new BadRequestError('Archive inspection limit exceeded'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
  await inspectContent(contents, extension);
  if (
    /macroenabled|vnd\.ms-office\.vbaproject|vnd\.ms-excel\.(?:macrosheet|intlmacrosheet)/i.test(
      contents.toString('latin1').replace(/\0/g, ''),
    )
  ) {
    throw new BadRequestError('Office macros are not allowed');
  }
  if (isZip(contents)) await inspectZip(contents, budget, depth + 1);
  else if (officeMimeTypes[extension] || extension === '.zip')
    throw new BadRequestError('Invalid nested ZIP or Office file');
}

export function uploadContentDisposition(fileName: string, mimeType: string): string {
  // Keep the existing image/PDF previews; other files must download.
  const mode = ['image/jpeg', 'image/png', 'application/pdf'].includes(mimeType)
    ? 'inline'
    : 'attachment';
  const asciiFileName = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${mode}; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
