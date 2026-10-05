import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument, pomsOpenApiStats } from '../../src/modules/api-docs/poms.openapi';

interface Schema {
  $ref?: string;
  properties: Record<string, Schema>;
  enum?: unknown[];
  additionalProperties?: boolean;
  description?: string;
  example?: string;
}

interface Operation {
  description?: string;
  responses: Record<string, { content: Record<string, { schema: Schema }> }>;
}

interface RuntimeDocument {
  paths: Record<string, { get: Operation; post: Operation }>;
  components: { schemas: Record<string, Schema> };
}

describe('alert email runtime contract', () => {
  it('keeps public operation totals aligned after adding the two email endpoints', () => {
    expect(pomsOpenApiDocument['x-poms-canonical-operation-count']).toBe(
      pomsOpenApiStats.canonicalOperationCount,
    );
    const description = (pomsOpenApiDocument.info as { description: string }).description;
    expect(description).toContain(String(pomsOpenApiStats.canonicalOperationCount));
    expect(description).toContain(String(pomsOpenApiStats.operationCount));
  });
  it('publishes preview validation, success content, and editing permission', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const operation = doc.paths['/alert-email-previews']?.post;
    expect(operation).toBeDefined();
    expect(JSON.stringify(operation)).toContain('notifications:edit');
    expect(operation.responses['200'].content['application/json'].schema).toBeDefined();
    expect(operation.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertEmailPreviewResponse',
    );
    expect(doc.components.schemas.AlertEmailPreviewResponse.properties.data.$ref).toBe(
      '#/components/schemas/AlertEmailPreview',
    );
    const request = doc.components.schemas.AlertEmailPreviewRequest;
    expect(request.properties.eventIds).toMatchObject({
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
    });
    expect(request.additionalProperties).toBe(false);
  });
  it('publishes the PDF letter example using the measurement time rather than the send time', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const preview = doc.components.schemas.AlertEmailPreview;
    expect(preview.properties.subject.example).toBe(
      'D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม ในวันที่ 5-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท',
    );
    expect(preview.properties.text.example).toContain(
      'เรียน เจ้าหน้าที่ที่เกี่ยวข้อง\nเรื่อง D-POMS',
    );
    expect(preview.properties.text.example).toContain(
      '1) บริษัท ตัวอย่าง จำกัด (01000000000001) จังหวัด ระยอง',
    );
    expect(preview.properties.text.example).toContain('1.1 Stack 1 (CEMS)');
    expect(preview.properties.text.example).toContain('- SO2 = 250 ppm');
    expect(preview.properties.text.example).toContain('ขอแสดงความนับถือ');
    expect(preview.properties.text.example).toContain('poms.support@diw.mail.go.th');
    expect(preview.properties.text.example).toContain('Line ID : @iemcdiw');
    expect(preview.properties.text.example).not.toContain('รอบแจ้งเตือน:');
    expect(preview.properties.text.example).not.toContain('ดูรายละเอียดใน D-POMS');
    expect(
      doc.components.schemas.AlertEmailPreviewRequest.properties.scheduledAt.description,
    ).toContain('ไม่ใช่วันที่หรือเวลาที่แสดงในเรื่องอีเมล');
  });
  it('documents abnormal duration through the last observed abnormal measurement', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const description = doc.components.schemas.AlertEmailPreview.properties.text.description;
    expect(description).toContain('firstAbnormalAt ถึง endedAt');
    expect(description).toContain('confirmedAbnormalAt ใช้ยืนยันเงื่อนไข');
    expect(description).toContain('ไม่มี endedAt แสดงระยะเวลาไม่ระบุ');
  });
  it('documents rejection of mixed report dates or hourly measurement starts', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const description = doc.paths['/alert-email-previews'].post.description;
    expect(description).toContain('eventDate เดียวกัน');
    expect(description).toContain('startedAt เดียวกัน');
    expect(description).toContain('400 BAD_REQUEST');
    expect(description).toContain('แม่แบบ PDF ทั้ง 6 แบบ');
    expect(doc.components.schemas.AlertEmailDelivery.properties.subject.description).toContain(
      'ไม่สร้างข้อความใหม่หรือส่งซ้ำอัตโนมัติ',
    );
  });
  it('publishes scoped SMTP status history separately from officer tracking status', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const operation = doc.paths['/alert-email-deliveries/{id}']?.get;
    expect(operation).toBeDefined();
    expect(operation.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertEmailDeliveryResponse',
    );
    expect(JSON.stringify(operation)).toContain('notifications:view_status');
    expect(doc.components.schemas.AlertEmailDelivery.properties.status.enum).toContain(
      'SMTP_ACCEPTED',
    );
    expect(doc.components.schemas.AlertEmailDelivery.properties.status.enum).toContain('UNKNOWN');
    expect(doc.components.schemas.AlertEmailDelivery.properties).not.toHaveProperty('leaseToken');
  });
});
