import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an OpenAPI object');
  }
  return value as JsonObject;
}

const schemas = object(object(pomsOpenApiDocument.components).schemas);
const paths = object(pomsOpenApiDocument.paths);

function operation(path: string, method: string): JsonObject {
  return object(object(paths[path])[method]);
}

function responseMedia(path: string, method: string, status: string): JsonObject {
  return object(
    object(object(object(operation(path, method).responses)[status]).content)['application/json'],
  );
}

// Interpret the response-envelope constraints independently of how the documentation
// merges error variants. This catches a new example violating an older code enum or
// an old required details.retryable field without adding a JSON-schema dependency.
function acceptsEnvelope(schemaValue: unknown, value: unknown): boolean {
  const schema = object(schemaValue);
  if (typeof schema.$ref === 'string') {
    return acceptsEnvelope(schemas[schema.$ref.replace('#/components/schemas/', '')], value);
  }
  if (Array.isArray(schema.allOf) && !schema.allOf.every((item) => acceptsEnvelope(item, value)))
    return false;
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((item) => acceptsEnvelope(item, value)))
    return false;
  if (
    Array.isArray(schema.oneOf) &&
    schema.oneOf.filter((item) => acceptsEnvelope(item, value)).length !== 1
  )
    return false;
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  if (schema.type === 'string' && typeof value !== 'string') return false;
  if (schema.type === 'boolean' && typeof value !== 'boolean') return false;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = object(value);
    if (
      Array.isArray(schema.required) &&
      schema.required.some((key) => !(String(key) in candidate))
    )
      return false;
    const properties = object(schema.properties ?? {});
    if (
      schema.additionalProperties === false &&
      Object.keys(candidate).some((key) => !(key in properties))
    )
      return false;
    for (const [key, property] of Object.entries(properties)) {
      if (key in candidate && !acceptsEnvelope(property, candidate[key])) return false;
    }
  }
  return true;
}

const lookupFailure = {
  success: false,
  error: {
    code: 'FACTORY_AREA_LOOKUP_UNAVAILABLE',
    message: 'Administrative area lookup is temporarily unavailable',
  },
};
const cleanupFailure = {
  success: false,
  error: {
    code: 'MEASUREMENT_CLEANUP_FAILED',
    message: 'Unable to clear test measurements; connection was not completed',
    details: { retryable: true },
  },
};

const writes = [
  ['/cems-wpms-requests', 'post'],
  ['/cems-wpms-requests/measurement-points', 'post'],
  ['/cems-wpms-requests/direct-connections', 'post'],
  ['/cems-wpms-requests/parameters', 'post'],
  ['/cems-wpms-requests/{id}/form', 'put'],
  ['/eligible-factories', 'post'],
  ['/eligible-factories/add-requests', 'post'],
  ['/monitoring-point-forms', 'post'],
  ['/monitoring-point-forms/{id}', 'put'],
  ['/monitoring-point-forms/{id}/select-eligible', 'post'],
];

describe('factory administrative-name runtime OpenAPI contract', () => {
  it.each(writes)('documents normalized geography and valid errors for %s %s', (path, method) => {
    expect(operation(path, method).description).toEqual(
      expect.stringContaining('legacy/canonical'),
    );
    const badRequest = responseMedia(path, method, '400');
    const badExample = object(
      object(object(badRequest.examples).unresolvedAdministrativeArea).value,
    );
    expect(badExample).toMatchObject({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        details: { path: 'address', reason: 'UNRESOLVED_ADMINISTRATIVE_AREA' },
      },
    });
    expect(acceptsEnvelope(badRequest.schema, badExample)).toBe(true);
    const unavailable = responseMedia(path, method, '503');
    const unavailableExample = object(
      object(unavailable.examples).factoryAreaLookupUnavailable,
    ).value;
    expect(unavailableExample).toEqual(lookupFailure);
    expect(acceptsEnvelope(unavailable.schema, lookupFailure)).toBe(true);
    for (const status of ['400', '503']) {
      const media = responseMedia(path, method, status);
      expect(media).not.toHaveProperty('example');
      expect(media.examples).toBeDefined();
    }
  });

  it.each(['/cems-wpms-requests/measurement-points', '/cems-wpms-requests/direct-connections'])(
    'preserves strict retryable cleanup failures alongside the new lookup failure at %s',
    (path) => {
      const media = responseMedia(path, 'post', '503');
      expect(object(object(media.examples).measurementCleanupFailed).value).toEqual(cleanupFailure);
      expect(acceptsEnvelope(media.schema, cleanupFailure)).toBe(true);
      expect(acceptsEnvelope(media.schema, lookupFailure)).toBe(true);
      const withoutRetryable = {
        success: false,
        error: { code: cleanupFailure.error.code, message: cleanupFailure.error.message },
      };
      expect(acceptsEnvelope(media.schema, withoutRetryable)).toBe(false);
      expect(
        acceptsEnvelope(media.schema, {
          ...cleanupFailure,
          error: { ...cleanupFailure.error, details: { retryable: false } },
        }),
      ).toBe(false);
      expect(
        acceptsEnvelope(media.schema, {
          success: false,
          error: { code: 'UNRELATED_ERROR', message: 'Other error' },
        }),
      ).toBe(false);
    },
  );

  it.each([
    ['/cems-wpms-requests/{id}/form', 'ConnectionRequestForm'],
    ['/poms-factories/{factoryId}/form', 'PomsFactoryForm'],
    ['/poms-factories/edit-requests/{id}/form', 'PomsFactoryEditRequestForm'],
  ])(
    'publishes verified existing name fields in the form response example for %s',
    (path, schemaName) => {
      const media = responseMedia(path, 'get', '200');
      const example = object(object(object(media.examples).verifiedAreaNames).value);
      expect(example.success).toBe(true);
      const data = object(example.data);
      expect(data).toMatchObject({
        address: '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140',
        provinceCode: null,
        provinceName: 'ระยอง',
        districtCode: null,
        districtName: 'ปลวกแดง',
        subdistrictCode: null,
        subdistrictName: 'มาบยางพร',
      });
      const schema = object(schemas[schemaName]);
      const properties = object(schema.properties);
      for (const key of Object.keys(data)) expect(properties).toHaveProperty(key);
      for (const key of schema.required as string[]) expect(data).toHaveProperty(key);
      for (const field of ['provinceName', 'districtName', 'subdistrictName']) {
        expect(object(properties[field]).nullable).toBe(true);
      }
      expect(media).not.toHaveProperty('example');
    },
  );

  it('documents name-by-name historical locality checks and preserves unknown blank fallbacks', () => {
    const properties = object(object(schemas.ConnectionRequestForm).properties);
    for (const field of ['provinceName', 'districtName', 'subdistrictName']) {
      const description = String(object(properties[field]).description);
      expect(description).toContain('มี property เดิม');
      expect(description).toContain('null/undefined/สตริงว่าง');
      expect(description).toContain('ไม่ใช้ตำแหน่งปัจจุบันของ Fac60k');
      expect(description).toContain('อาจเติมจังหวัด/อำเภอได้แต่ตำบลยังว่าง');
      expect(description).toContain('มีเพียงจังหวัดที่ยืนยันได้');
      expect(description).toContain('เมื่อมีข้อมูลอำเภอ/ตำบล');
      expect(description).toContain('คงชื่อว่างทั้งหมด');
      expect(description).toContain('คงช่องว่าง');
      expect(description).toContain('ไม่เพิ่ม property ที่ไม่มีเดิม');
      expect(description).toContain('ไม่เปลี่ยนชื่อที่อ่านได้หรือช่องรหัส');
    }
  });

  it('keeps POMS edit geography as read-only context instead of a new mutable write contract', () => {
    for (const schemaName of ['PomsFactoryForm', 'PomsFactoryEditRequestForm']) {
      const properties = object(object(schemas[schemaName]).properties);
      for (const field of ['address', 'provinceName', 'districtName', 'subdistrictName']) {
        const description = String(object(properties[field]).description);
        expect(description).toContain('GET');
        expect(description).not.toContain('503 FACTORY_AREA_LOOKUP_UNAVAILABLE');
      }
    }
    for (const [path, method] of [
      ['/poms-factories/{factoryId}/edit-requests', 'post'],
      ['/poms-factories/edit-requests/{id}/resubmission', 'put'],
    ]) {
      expect(String(operation(path, method).description)).not.toContain(
        'UNRESOLVED_ADMINISTRATIVE_AREA',
      );
    }
  });
});
