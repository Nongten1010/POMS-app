import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../src/shared/errors/AppError';
import { lawIdParamsSchema, parseLawInput } from '../../src/modules/laws/laws.validator';

describe('laws validator', () => {
  it.each([
    'MINISTERIAL_REGULATION',
    'MINISTRY_ANNOUNCEMENT',
    'DEPARTMENT_ANNOUNCEMENT',
    'REGULATION_REQUIREMENT',
    'OTHER',
  ])('accepts the current document type %s', (type) => {
    expect(
      parseLawInput({ title: 'ทดสอบ', category: 'CEMS', type, publishedDate: '2026-09-14' }).type,
    ).toBe(type);
  });

  it.each(['RULE_AND_ANNOUNCEMENT', 'ACT', '', 'ministry_announcement'])(
    'rejects a legacy or invalid write type %s',
    (type) => {
      expect(() =>
        parseLawInput({ title: 'ทดสอบ', category: 'CEMS', type, publishedDate: '2026-09-14' }),
      ).toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          details: { type: expect.any(String) },
        }),
      );
    },
  );

  it('normalizes a complete law payload', () => {
    expect(
      parseLawInput({
        title: '  ประกาศกรมโรงงานอุตสาหกรรม  ',
        category: 'CEMS',
        type: 'DEPARTMENT_ANNOUNCEMENT',
        publishedDate: '2026-09-04',
      }),
    ).toEqual({
      title: 'ประกาศกรมโรงงานอุตสาหกรรม',
      category: 'CEMS',
      type: 'DEPARTMENT_ANNOUNCEMENT',
      publishedDate: '2026-09-04',
    });
  });

  it.each(['1899-12-31', '2025-02-29', '04/09/2026', '10000-01-01'])(
    'rejects an invalid or unsupported published date: %s',
    (publishedDate) => {
      expect(() =>
        parseLawInput({
          title: 'กฎหมายทดสอบ',
          category: 'WPMS',
          type: 'OTHER',
          publishedDate,
        }),
      ).toThrow(AppError);

      try {
        parseLawInput({
          title: 'กฎหมายทดสอบ',
          category: 'WPMS',
          type: 'OTHER',
          publishedDate,
        });
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'ข้อมูลรายการกฎหมายไม่ถูกต้อง',
          details: { publishedDate: expect.any(String) },
        });
      }
    },
  );

  it('reports field-addressable details for invalid enums and an empty title', () => {
    try {
      parseLawInput({
        title: '   ',
        category: 'ALL',
        type: 'ACT',
        publishedDate: '2026-09-04',
      });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: {
          title: expect.any(String),
          category: expect.any(String),
          type: expect.any(String),
        },
      });
    }
  });

  it('accepts only UUID route identifiers', () => {
    const id = '28b69ad9-2acf-4b50-961f-84d7a5bea945';
    expect(lawIdParamsSchema.parse({ id })).toEqual({ id });
    expect(() => lawIdParamsSchema.parse({ id: '../../etc/passwd' })).toThrow();
  });
});
