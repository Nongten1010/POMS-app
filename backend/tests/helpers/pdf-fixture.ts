import { deflateSync } from 'node:zlib';

export function pdfStream(data: Buffer, entries = ''): Buffer {
  return Buffer.concat([
    Buffer.from(`<< /Length ${data.length} ${entries} >>\nstream\n`),
    data,
    Buffer.from('\nendstream'),
  ]);
}

/** Small, valid PDFs; extra indirect objects start at object 5. */
export function pdfFixture(
  options: {
    catalogEntries?: string;
    resources?: string;
    pageEntries?: string;
    content?: string;
    comment?: string;
    objects?: (string | Buffer)[];
  } = {},
): Buffer {
  const bodies = [
    `<< /Type /Catalog /Pages 2 0 R ${options.catalogEntries ?? ''} >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources ${options.resources ?? '<< >>'} /Contents 4 0 R ${options.pageEntries ?? ''} >>`,
    pdfStream(Buffer.from(options.content ?? '')),
    ...(options.objects ?? []),
  ];
  const chunks = [Buffer.from(`%PDF-1.7\n% ${options.comment ?? 'test fixture'}\n`)];
  const offsets: number[] = [];
  let length = chunks[0].length;
  for (const [index, body] of bodies.entries()) {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      Buffer.from(body),
      Buffer.from('\nendobj\n'),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  }
  const rows = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  chunks.push(
    Buffer.from(
      `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${rows}trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(chunks);
}

/** Reproduces the manual's marker inside encoded image bytes, without copying its content. */
export function pdfWithImageMarker(): Buffer {
  const pixels = deflateSync(Buffer.from('/Js\0\0\0', 'latin1'), { level: 0 });
  return pdfFixture({
    resources: '<< /XObject << /Im1 5 0 R >> >>',
    content: 'q 100 0 0 100 0 0 cm /Im1 Do Q',
    objects: [
      pdfStream(
        pixels,
        '/Type /XObject /Subtype /Image /Width 2 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode',
      ),
    ],
  });
}

export function sizedPdfFixture(size: number): Buffer {
  const pdf = pdfFixture();
  if (size < pdf.length) throw new Error('Requested fixture size is too small');
  return Buffer.concat([pdf, Buffer.alloc(size - pdf.length, 0x20)]);
}
