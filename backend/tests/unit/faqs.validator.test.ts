import { describe, expect, it } from '@jest/globals';
import {
  createFaqSchema,
  faqIdParamsSchema,
  faqListQuerySchema,
  updateFaqSchema,
} from '../../src/modules/faqs/faqs.validator';

describe('FAQ validation', () => {
  const validPayload = {
    question: '  หากระบบ CEMS ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?  ',
    answer: '  ให้ตรวจสอบอุปกรณ์และการเชื่อมต่อ  ',
    category: 'CEMS' as const,
    updatedDate: '2026-09-04',
  };

  it('accepts and trims the complete create payload', () => {
    expect(createFaqSchema.parse(validPayload)).toEqual({
      question: 'หากระบบ CEMS ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?',
      answer: 'ให้ตรวจสอบอุปกรณ์และการเชื่อมต่อ',
      category: 'CEMS',
      updatedDate: '2026-09-04',
    });
  });

  it('accepts the full update payload and a future date through year 9999', () => {
    expect(
      updateFaqSchema.safeParse({ ...validPayload, category: 'OTHER', updatedDate: '9999-12-31' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['unknown fields', { ...validPayload, id: 'c24ff643-87c1-4154-bb8a-293a76b9900f' }],
    ['the UI-only all category', { ...validPayload, category: 'all' }],
    ['a blank question', { ...validPayload, question: '   ' }],
    ['a blank answer', { ...validPayload, answer: '\n\t' }],
    ['a question over the database limit', { ...validPayload, question: 'q'.repeat(1001) }],
    ['an impossible calendar date', { ...validPayload, updatedDate: '2026-02-30' }],
    ['a date before the supported range', { ...validPayload, updatedDate: '1899-12-31' }],
  ])('rejects %s', (_description, payload) => {
    expect(createFaqSchema.safeParse(payload).success).toBe(false);
  });

  it('requires a canonical UUID path id', () => {
    expect(faqIdParamsSchema.parse({ id: 'c24ff643-87c1-4154-bb8a-293a76b9900f' })).toEqual({
      id: 'c24ff643-87c1-4154-bb8a-293a76b9900f',
    });
    expect(faqIdParamsSchema.safeParse({ id: 'faq_001' }).success).toBe(false);
  });

  it('accepts multiple links and retained attachment ids on update', () => {
    expect(
      updateFaqSchema.safeParse({
        ...validPayload,
        links: ['https://example.com/a', 'https://example.com/b'],
        attachmentIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      }).success,
    ).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', 'ftp://example.com/a'])(
    'rejects unsafe link %s',
    (url) => {
      expect(createFaqSchema.safeParse({ ...validPayload, links: [url] }).success).toBe(false);
    },
  );

  it('rejects excess links, duplicate attachment ids, and retaining files on create', () => {
    expect(
      createFaqSchema.safeParse({ ...validPayload, links: Array(21).fill('https://example.com') })
        .success,
    ).toBe(false);
    const id = '11111111-1111-4111-8111-111111111111';
    expect(updateFaqSchema.safeParse({ ...validPayload, attachmentIds: [id, id] }).success).toBe(
      false,
    );
    expect(createFaqSchema.safeParse({ ...validPayload, attachmentIds: [id] }).success).toBe(false);
  });

  it('rejects pagination, filtering, and sorting query parameters', () => {
    expect(faqListQuerySchema.parse({})).toEqual({});
    expect(faqListQuerySchema.safeParse({ page: '1' }).success).toBe(false);
  });
});
