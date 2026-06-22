/**
 * IdentityProvider — adapter ระหว่าง POMS กับระบบ identity ภายนอก
 *
 * Implementations:
 *  - MockIdentityProvider (ใช้ตอน demo, อ่านจาก fixtures)
 *  - ExternalIdentityProvider (เรียก API จริงของ กรอ. / ระบบผู้ประกอบการ — ทำในอนาคต)
 *
 * Switch via env: IDENTITY_PROVIDER=mock|external
 */

export interface ExternalOfficerProfile {
  external_id: string; // per_cardno
  prename_th: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  pos_no: string;
  pertype_id: string;
  pertype: string;
  position_type_id: string;
  position_type_th: string;
  line_id: string;
  line_name_th: string;
  level_id: string;
  level_name_th: string;
  mposition_id?: string;
  mposition?: string;
  organize_id: string;
  division_id: string;
  department_id: string;
  ministry_id: string;
  province_id: string;
  per_status: string;
  per_status_name: string;
  relocation_type?: string;
  relocation_name?: string;
}

export interface ExternalOperatorProfile {
  citizen_id: string;
  user_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  regis_date: string | null;
  juristics: Array<{
    juristic_id: string;
    name_th: string;
    name_en: string;
    factories: Array<{
      fid: string;
      code: string;
      name: string;
      province_id: string;
      system_id: number | null;
      verify_status: number;
      authorize_start: string | null;
      authorize_end: string | null;
      juristic_start: string | null;
      verify_date: string | null;
    }>;
  }>;
}

export interface ExternalCitizenProfile {
  external_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

export interface IdentityProvider {
  /** Authenticate เจ้าหน้าที่ (ใช้ username + password) */
  authenticateOfficer(
    username: string,
    password: string,
    departmentID: string,
  ): Promise<ExternalOfficerProfile | null>;

  /** Authenticate ผู้ประกอบการ (ใช้ username + password) */
  authenticateOperator(
    username: string,
    password: string,
  ): Promise<ExternalOperatorProfile | null>;

  /** Authenticate ประชาชนทั่วไป */
  authenticateCitizen(
    username: string,
    password: string,
  ): Promise<ExternalCitizenProfile | null>;
}
