import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('canceled point-code reuse published contract', () => {
  it.each(['review', 'status', 'cancel'])(
    'documents same-factory canceled-code reuse for %s',
    (action) => {
      const paths = obj(pomsOpenApiDocument.paths);
      const operation = obj(obj(paths[`/cems-wpms-requests/{id}/${action}`]).post);
      for (const text of [
        'P0267',
        'CANCELED',
        'โรงงานเดิม',
        'ยังไม่เคยเชื่อมต่อ',
        'POINT_CODE_ALREADY_ASSIGNED',
      ]) {
        expect(operation.description).toEqual(expect.stringContaining(text));
      }
    },
  );

  it.each(['PointCodeAssignment', 'DirectConnectionMeasurementPoint'])(
    'documents the same reuse rule on %s.pointCode',
    (schema) => {
      const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
      const property = obj(obj(obj(schemas[schema]).properties).pointCode);
      expect(property.description).toEqual(expect.stringContaining('P0267'));
      expect(property.description).toEqual(expect.stringContaining('โรงงานเดิม'));
    },
  );
});
