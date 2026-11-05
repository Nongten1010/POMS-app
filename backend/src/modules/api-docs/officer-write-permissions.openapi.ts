import { env } from '../../config/env';
import { isOfficerWritePermission } from '../auth/officer-write-permission-policy';

type OpenApiObject = Record<string, unknown>;

export const officerWritePermissionDescription =
  'นโยบายเจ้าหน้าที่: OFFICER_WRITE_PERMISSION_CHECKS_ENABLED มีค่าเริ่มต้น false. ' +
  'เมื่อ false ยกเว้นเฉพาะ permission ที่ลงท้าย :edit หรือ :approve บน POST/PUT/PATCH/DELETE ของ officer/admin ' +
  'โดย action scope เป็น ALL หรือ null สำหรับ binary permission แม้ไม่มี grant หรือมี deny. ' +
  'GET/HEAD และทุก permission :view ยังคงตรวจ grant, deny และพื้นที่เดิม รวมถึง view guard ที่อยู่บน write endpoint. ' +
  'ไม่เปลี่ยน req.user.scopes, scopeDetails, regionalAccess, login/me หรือข้อมูลเมนูที่ frontend อ่าน. ' +
  'manage, direct_connect, answer, ask, export และ action อื่นยังตรวจตามเดิม รวมถึง citizen/operator และ Integration API. ' +
  'ยังตรวจ JWT, สถานะบัญชี, payload และ workflow. ตั้งสวิตช์เป็น true แล้ว restart เพื่อคืนการตรวจ edit/approve. ' +
  `ค่าของ runtime นี้: ${env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED}`;

/** Read operations retain their exact descriptions, requirements, and schemas. */
export function decorateOfficerWritePermissionDocs(paths: Record<string, OpenApiObject>): void {
  for (const path of Object.values(paths)) {
    for (const [method, value] of Object.entries(path)) {
      if (!value || typeof value !== 'object') continue;
      const operation = value as OpenApiObject;
      const permissions = operation['x-poms-permissions'] as string[] | undefined;
      const bypassed = permissions?.filter((permission) =>
        isOfficerWritePermission(permission, method),
      );
      if (!bypassed?.length) continue;
      operation.description = `${operation.description ?? ''}\n\n${officerWritePermissionDescription}`;
      operation['x-poms-officer-write-permission-checks-enabled'] =
        env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED;
      operation['x-poms-officer-bypassed-permissions'] = env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED
        ? []
        : bypassed;
    }
  }
}
