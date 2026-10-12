import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type OpenApiOperation = {
  description: string;
  'x-poms-permissions': string[];
};
const document = pomsOpenApiDocument as unknown as {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: { PermissionMode: { enum: string[] } } };
};
const operation = (path: string, method = 'post') => document.paths[path][method];

describe('backend per-menu approval scope OpenAPI contract', () => {
  it.each([
    ['/eligible-factories/add-requests/{id}/review', 'eligible_factories:approve'],
    ['/poms-factories/edit-requests/{id}/review', 'factories:approve'],
    ['/bod-cod-deviation-reports/{id}/workflow-actions', 'bod_cod_errors:approve'],
    ['/kwp-form-submissions/{id}/workflow-actions', 'kwp_forms:approve'],
    ['/monitoring-point-forms/{id}/select-eligible', 'eligible_factories:approve'],
  ])('documents independent effective approval for %s', (path, permission) => {
    const action = operation(path);
    expect(action['x-poms-permissions']).toContain(permission);
    expect(action.description).toContain('approve แยกรายเมนู');
    expect(action.description).toContain('Backend API');
    expect(action.description).toContain('ไม่จำกัด role หรือ userType');
    expect(action.description).toContain('สถานะและขั้นตอนปัจจุบัน');
    expect(action.description).toContain('ไม่เติม view หรือ edit ให้อัตโนมัติ');
  });

  it.each(['review', 'status', 'verify-connection'])(
    'limits connection %s to current approval scope and real factory assignments',
    (action) => {
      const contract = operation(`/cems-wpms-requests/{id}/${action}`);
      expect(contract['x-poms-permissions']).toEqual(['cems_wpms_requests:approve']);
      expect(contract.description).toContain('Backend API');
      expect(contract.description).toContain('OWN_FACTORY ตรวจ assignment ปัจจุบัน');
      expect(contract.description).toContain('user_factory_access หรือ user_juristics');
      expect(contract.description).toContain('createdBy อย่างเดียวไม่ให้สิทธิ์อนุมัติ');
      expect(contract.description).toContain('direct factory assignment ไม่ขยาย');
      expect(contract.description).toContain('saved OWN_FACTORY ไม่ถูกจำกัดซ้ำ');
      expect(contract.description).toContain('ไม่มี approve ตอบ 403');
      expect(contract.description).toContain('scope/assignment ตอบ 404');
      expect(contract.description).toContain('ไม่เติม view อัตโนมัติ');
    },
  );

  it('keeps BOD and POMS view guards and adds no new permission mode', () => {
    expect(
      operation('/bod-cod-deviation-reports/{id}/workflow-actions')['x-poms-permissions'],
    ).toEqual(['bod_cod_errors:view', 'bod_cod_errors:approve']);
    expect(operation('/poms-factories/edit-requests/{id}/review')['x-poms-permissions']).toEqual([
      'factories:view',
      'factories:approve',
    ]);
    expect(document.components.schemas.PermissionMode.enum).toEqual(['role_default', 'custom']);
  });

  it('maps candidate provinces by canonical name and fails closed without a source scope', () => {
    const candidate = operation('/eligible-factories/candidates', 'get');
    expect(candidate['x-poms-permissions']).toEqual(['eligible_factories:view']);
    expect(candidate.description).toContain('canonical mapping ตามชื่อ');
    expect(candidate.description).toContain('ไม่ใช้ POMS province ID หรือคำนวณรหัส');
    expect(candidate.description).toContain('1080 นครศรีธรรมราชใช้ PROV 80');
    expect(candidate.description).toContain('data [] และ meta.total 0');
    expect(candidate.description).toContain('โดยไม่เรียกต้นทางหรือขยายเป็น ALL');
  });
});
