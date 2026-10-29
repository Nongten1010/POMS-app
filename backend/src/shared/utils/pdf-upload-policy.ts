import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject, PDFStream } from 'pdf-lib';
import { BadRequestError } from '../errors/AppError';

const ACTIVE_CONTENT_ERROR = 'PDF active content or embedded files are not allowed';
const INVALID_PDF_ERROR = 'Invalid, encrypted or unsupported PDF file';
const MAX_INSPECTED_OBJECTS = 100_000;
const blockedNames = new Set([
  'JavaScript',
  'JS',
  'Launch',
  'EmbeddedFile',
  'EmbeddedFiles',
  'EF',
  'RichMedia',
  'RichMediaContent',
  'OnInstantiate',
]);

function decodedName(name: PDFName): string {
  // pdf-lib 1.x can leave lowercase hex escapes in parsed names undecoded.
  return name
    .decodeText()
    .replace(/#([0-9a-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

export async function validatePdfUpload(buffer: Buffer): Promise<void> {
  try {
    const document = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    if (!(document.catalog instanceof PDFDict)) throw new Error('Missing PDF catalog');

    // The parser expands compressed object streams. Inspect every parsed object,
    // including indirect action names/scripts, without decoding image/font streams.
    const pending: PDFObject[] = document.context
      .enumerateIndirectObjects()
      .map(([, object]) => object);
    const visited = new Set<PDFObject>();
    while (pending.length) {
      const object = pending.pop();
      if (!object || visited.has(object)) continue;
      visited.add(object);
      if (visited.size > MAX_INSPECTED_OBJECTS) throw new Error('PDF inspection limit');

      if (object instanceof PDFName) {
        const name = decodedName(object);
        // XFA can carry JavaScript in XML packets, outside PDF action dictionaries.
        // This inspector does not parse XFA; accepting opaque packets would bypass it.
        if (name === 'XFA') throw new Error('Unsupported XFA form');
        if (blockedNames.has(name)) {
          throw new BadRequestError(ACTIVE_CONTENT_ERROR);
        }
      } else if (object instanceof PDFStream) {
        const type = object.dict.lookup(PDFName.of('Type'));
        // A remaining ObjStm was not expanded (e.g. an escaped/indirect Type).
        // Never accept its opaque bytes without inspecting the contained objects.
        if (type instanceof PDFName && decodedName(type) === 'ObjStm') {
          throw new Error('Unparsed PDF object stream');
        }
        pending.push(object.dict);
      } else if (object instanceof PDFDict) {
        for (const [key, value] of object.entries()) pending.push(key, value);
      } else if (object instanceof PDFArray) {
        for (let index = 0; index < object.size(); index++) pending.push(object.get(index));
      }
    }
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError(INVALID_PDF_ERROR);
  }
}
