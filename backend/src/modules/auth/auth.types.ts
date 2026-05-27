import type { PermissionGroups } from './permissions';

export type UserType = 'citizen' | 'operator' | 'officer' | 'admin';

export interface LoginRequest {
  userType: 'officer' | 'operator' | 'citizen';
  /** local = username/password in POMS DB, omitted = external/mock IdP flow */
  provider?: 'local';
  /** ทุก user type ใช้ username */
  username?: string;
  /** officer: department selector from DIW login flow */
  departmentID?: string;
  password: string;
}

export interface UserSummary {
  id: number;
  userType: UserType;
  externalId: string;
  username: string | null;
  prenameTh: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  statusLabel: 'ใช้งาน' | 'ระงับใช้งาน';
}

export interface AuthUserDTO {
  userType: UserType;
  username: string;
  fullName: string;
  department: string | null;
  lineNameTh: string | null;
  levelNameTh: string | null;
  roles: string;
  isActive: boolean;
  ownedFactoryIds?: string[];
}

export interface OfficerProfileDTO {
  posNo: string | null;
  pertype: string | null;
  positionTypeTh: string | null;
  lineNameTh: string | null;
  levelNameTh: string | null;
  organizeId: string | null;
  divisionId: string | null;
  departmentId: string | null;
  departmentNameTh: string | null;
  ministryId: string | null;
  provinceId: string | null;
  perStatusName: string | null;
}

export interface OperatorProfileDTO {
  userCode: string | null;
  regisDate: string | null;
  juristics: Array<{
    juristicId: string;
    nameTh: string;
    nameEn: string | null;
    factories: Array<{
      fid: string;
      code: string;
      name: string;
      provinceId: string;
      systemId: number | null;
      verifyStatus: number;
      authorizeStart: string | null;
      authorizeEnd: string | null;
    }>;
  }>;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserDTO;
  permissions: PermissionGroups;
}

export interface MeResponse {
  user: AuthUserDTO;
  permissions: PermissionGroups;
}
