export type UserType = 'citizen' | 'operator' | 'officer' | 'admin';

export interface LoginRequest {
  userType: 'officer' | 'operator' | 'citizen';
  /** officer/citizen: ใช้ username; operator: ใช้ citizenId */
  username?: string;
  citizenId?: string;
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
  expiresIn: number;
  user: UserSummary;
  profile: OfficerProfileDTO | OperatorProfileDTO | null;
  roles: string[];
  scopes: Record<string, string | null>;
  permissions: string[];
}
