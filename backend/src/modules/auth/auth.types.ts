import type { PermissionGroups } from './permissions';
import type { RegionalAccessDTO } from './regional-access';

export type UserType = 'citizen' | 'operator' | 'officer' | 'admin';
export type AccountType = 'poms' | 'api';

export interface LoginRequest {
  /** Deprecated route hint for older clients. New clients omit it and let the backend resolve the account. */
  accountType?: AccountType;
  userType: 'officer' | 'operator' | 'citizen';
  /** local = username/password in POMS DB, omitted = external/mock IdP flow */
  provider?: 'local';
  /** ทุก user type ใช้ username */
  username: string;
  /** officer: department selector from DIW login flow */
  departmentID?: string;
  password: string;
}

export interface UserSummary {
  id: number;
  userType: UserType;
  externalId: string;
  identityProvider: string;
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
  accountType: AccountType;
  userType: UserType;
  username: string;
  fullName: string;
  name: {
    prenameTh: string | null;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  prenameTh: string | null;
  firstName: string;
  lastName: string;
  department: string | null;
  lineNameTh: string | null;
  levelNameTh: string | null;
  mposition: string | null;
  organize: string | null;
  division: string | null;
  provinceId?: string | null;
  provinceName?: string | null;
  roles: string;
  roleCodes: string[];
  isActive: boolean;
  officerProfile: {
    lineNameTh: string | null;
    levelNameTh: string | null;
    mposition: string | null;
    organize: { id: string | null; name: string | null };
    division: string | null;
    department: { id: string | null; name: string | null };
  } | null;
  regionalAccess?: RegionalAccessDTO;
  ownedFactoryIds?: string[];
}

export interface OfficerProfileDTO {
  posNo: string | null;
  pertype: string | null;
  positionTypeTh: string | null;
  lineNameTh: string | null;
  levelNameTh: string | null;
  mposition: string | null;
  organizeId: string | null;
  organizeNameTh: string | null;
  divisionNameTh: string | null;
  departmentId: string | null;
  departmentNameTh: string | null;
  ministryId: string | null;
  provinceId: string | null;
  perStatusName: string | null;
  regionalAccess: RegionalAccessDTO | null;
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
