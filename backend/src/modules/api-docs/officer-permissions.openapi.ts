import { env } from '../../config/env';

type OpenApiObject = Record<string, unknown>;

export const officerPermissionPolicyDescription =
  'นโยบายชั่วคราวสำหรับ officer/admin: OFFICER_PERMISSION_CHECKS_ENABLED มีค่าเริ่มต้น false. ' +
  'เมื่อ false บัญชี officer/admin ที่ยืนยันตัวตนและยังเปิดใช้งานได้รับทุก permission ของ backend ภายในคำขอ API ' +
  'โดยขอบเขตข้อมูลเป็น ALL และ action แบบ binary เป็น null แม้ชุดสิทธิ์ที่บันทึกไว้จะไม่มีสิทธิ์นั้นหรือมี deny. ' +
  'frontend เป็นผู้ตรวจเมนู/action โดยใช้สิทธิ์ที่บันทึกจริงจาก login/me ซึ่งไม่ถูกขยายและไม่มีการแก้ฐานข้อมูลสิทธิ์. ' +
  'ผู้ที่ล็อกอินเป็นเจ้าหน้าที่สามารถเรียก API โดยตรงได้โดยไม่ผ่านเงื่อนไขสิทธิ์ของ frontend. ' +
  'JWT, สถานะบัญชี, validation และกติกาธุรกิจยังถูกตรวจ; citizen/operator และ Integration API คงนโยบายเดิม. ' +
  'ตั้ง OFFICER_PERMISSION_CHECKS_ENABLED=true และ restart backend เพื่อคืนการตรวจ permission และ data scope ตามเดิม. ' +
  `ค่าของ runtime นี้: ${env.OFFICER_PERMISSION_CHECKS_ENABLED}. ` +
  'เงื่อนไข permission/scope ที่ระบุในแต่ละ operation สำหรับ officer/admin มีผลเมื่อเปิดสวิตช์นี้เท่านั้น';

export function decorateOfficerPermissionDocs(paths: Record<string, OpenApiObject>): void {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  for (const path of Object.values(paths)) {
    for (const [method, value] of Object.entries(path)) {
      if (!methods.has(method) || !value || typeof value !== 'object') continue;
      const operation = value as OpenApiObject;
      const security = operation.security as OpenApiObject[] | undefined;
      if (!security?.some((scheme) => Object.hasOwn(scheme, 'bearerAuth'))) continue;
      operation.description = `${operation.description ?? ''}\n\n${officerPermissionPolicyDescription}`;
      operation['x-poms-officer-permission-checks-enabled'] = env.OFFICER_PERMISSION_CHECKS_ENABLED;
    }
  }
}
