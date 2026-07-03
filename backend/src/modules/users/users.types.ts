import type { PermissionGroups } from '../auth/permissions';
import type { AuthUserDTO } from '../auth/auth.types';
import type { RegionalAccessDTO } from '../auth/regional-access';

export type ManagedUserType = 'officer' | 'admin';
export type ManagedUserStatus = 'active' | 'suspended';

export interface RoleSummaryDTO {
  code: string;
  nameTh: string;
  nameEn: string;
}

export type PermissionScope =
  | 'ALL'
  | 'IN_REGION'
  | 'IN_PROVINCE'
  | 'IN_ESTATE'
  | 'OWN_FACTORY'
  | null;
export type UserPermissionEffect = 'allow' | 'deny';

export interface PermissionOverrideInput {
  code: string;
  effect: UserPermissionEffect;
  scope?: PermissionScope;
  region?: string | null;
  province?: string | null;
}

export interface PermissionGrantDTO {
  code: string;
  resource: string;
  action: string;
  description: string | null;
  scope: PermissionScope;
  region: string | null;
  provinceId: string | null;
  provinceName: string | null;
}

export interface UserPermissionOverrideDTO extends PermissionGrantDTO {
  effect: UserPermissionEffect;
}

export interface UserPermissionsDTO {
  userId: number;
  rolePermissions: PermissionGrantDTO[];
  overrides: UserPermissionOverrideDTO[];
  effectiveScopes: Record<string, PermissionScope>;
  permissions: PermissionGroups;
}

export interface OfficerProfileInput {
  posNo?: string | null;
  pertypeId?: string | null;
  pertype?: string | null;
  positionTypeId?: string | null;
  positionTypeTh?: string | null;
  lineId?: string | null;
  lineNameTh?: string | null;
  levelId?: string | null;
  levelNameTh?: string | null;
  mpositionId?: string | null;
  mposition?: string | null;
  organizeId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  departmentNameTh?: string | null;
  ministryId?: string | null;
  provinceId?: string | null;
  /** Form-only input; resolved to provinceId before persistence. */
  provinceName?: string | null;
  perStatus?: string | null;
  perStatusName?: string | null;
  relocationType?: string | null;
  relocationName?: string | null;
  regionalAccess?: RegionalAccessDTO | null;
}

export interface ManagedUserTableDTO {
  id: number;
  username: string;
  fullName: string;
  department: string | null;
  lineNameTh: string | null;
  levelNameTh: string | null;
  roles: string;
  isActive: boolean;
}

export interface ManagedUserDetailDTO extends ManagedUserTableDTO {
  userType: ManagedUserType;
  externalId: string;
  identityProvider: string;
  prenameTh: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  profile: Required<OfficerProfileInput>;
}

export type ManagedUserSource = 'api' | 'created';

export interface ManagedUserEditUserDTO extends AuthUserDTO {
  source: ManagedUserSource;
}

export interface ManagedUserAuthDetailDTO {
  user: ManagedUserEditUserDTO;
  permissions: PermissionGroups;
}

export interface ListManagedUsersQuery {
  page?: number;
  perPage?: number;
  search?: string;
  roleCode?: string;
  status?: 'active' | 'suspended' | 'all';
}

export interface CreateManagedUserInput {
  username: string;
  externalId?: string;
  userType: ManagedUserType;
  prenameTh?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  roleCodes: string[];
  profile?: OfficerProfileInput;
}

export interface CreateLocalAccountInput {
  fullName: string;
  username: string;
  password: string;
  userType: ManagedUserType;
  isActive: boolean;
  roleCodes: string[];
  profile?: OfficerProfileInput;
  permissionOverrides?: PermissionOverrideInput[];
}

export interface UpdateManagedUserInput {
  username?: string;
  externalId?: string;
  userType?: ManagedUserType;
  prenameTh?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  passwordHash?: string;
  isActive?: boolean;
  roleCodes?: string[];
  profile?: OfficerProfileInput;
  permissionOverrides?: PermissionOverrideInput[];
}

export interface ReplaceUserPermissionsInput {
  permissions: PermissionOverrideInput[];
}

export interface PaginatedManagedUsersDTO {
  data: ManagedUserTableDTO[];
  meta: {
    total: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
  };
}
