import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type ObjectSchema = {
  properties: Record<string, ObjectSchema>;
  enum?: string[];
  description?: string;
  'x-max-size-bytes'?: number;
};
const document = pomsOpenApiDocument as {
  components: { schemas: Record<string, ObjectSchema> };
  paths: Record<
    string,
    Record<string, { requestBody?: unknown; description?: string; responses?: unknown }>
  >;
};

describe('general upload runtime contract', () => {
  it('removes old MIME enums without changing the POMS factory upload limit', () => {
    const schemas = document.components.schemas;
    expect(schemas.PomsFactoryUploadedDocumentImage.properties.fileType.enum).toBeUndefined();
    expect(schemas.LawFile.properties.mimeType.enum).toBeUndefined();
    expect(
      schemas.KwpAttachmentUploadResponse.properties.data.properties.mimeType.enum,
    ).toBeUndefined();
    expect(schemas.PomsFactoryDocumentImageUploadRequest.properties.file['x-max-size-bytes']).toBe(
      5242880,
    );
  });

  it.each([
    ['/cems-wpms-requests/document-images', 'post'],
    ['/poms-factories/document-images', 'post'],
    ['/monitoring-point-forms/attachments', 'post'],
    ['/bod-cod-deviation-reports/attachments', 'post'],
    ['/kwp-form-submissions/attachments', 'post'],
    ['/laws', 'post'],
    ['/laws/{id}', 'put'],
    ['/faqs', 'post'],
    ['/faqs/{id}', 'put'],
  ])('documents risk filtering and the absence of antivirus for %s %s', (endpoint, method) => {
    const operation = document.paths[endpoint][method];
    const schemas = JSON.stringify(document.components.schemas);
    expect(operation.requestBody).toBeDefined();
    expect(operation.description).toContain('ยังไม่มี antivirus');
    expect(operation.description).toContain('PDF ตรวจโครงสร้างออบเจ็กต์');
    expect(operation.description).toContain('PDF active content or embedded files are not allowed');
    expect(operation.description).toContain('Invalid, encrypted or unsupported PDF file');
    expect(operation.description).toContain('details.files');
    expect(schemas).toContain('ZIP');
  });
});
