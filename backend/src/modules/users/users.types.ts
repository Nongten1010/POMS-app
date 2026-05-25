import type { PermissionGroups } from '../auth/permissions';

export type ManagedUserType = 'officer' | 'admin';
export type ManagedUserStatus = 'active' | 'suspended';

export interface RoleSummaryDTO {
  code: string;
  nameTh: string;
  nameEn: string;
}

export type PermissionScope = 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null;
export type UserPermissionEffect = 'allow' | 'deny';

export interface PermissionOverrideInput {
  code: string;
  effect: UserPermissionEffect;
  scope?: PermissionScope;
}

export interface PermissionGrantDTO {
  code: string;
  resource: string;
  action: string;
  description: string | null;
  scope: PermissionScope;
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
  ministryId?: string | null;
  provinceId?: string | null;
  perStatus?: string | null;
  perStatusName?: string | null;
  relocationType?: string | null;
  relocationName?: string | null;
}

export interface ManagedUserTableDTO {
  id: number;
  username: string;
  fullName: string;
  affiliation: string | null;
  position: string | null;
  level: string | null;
  roles: RoleSummaryDTO[];
  primaryRole: RoleSummaryDTO | null;
  status: ManagedUserStatus;
  statusLabel: 'ใช้งาน' | 'ระงับใช้งาน';
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
  isActive?: boolean;
  roleCodes?: string[];
  profile?: OfficerProfileInput;
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
