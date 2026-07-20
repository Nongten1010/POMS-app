import { db } from '../../config/database';
import { logger } from '../../config/logger';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { signAccessToken } from '../../shared/utils/jwt';
import { verifyPassword, bufferToHashString } from '../../shared/utils/password';
import { getIdentityProvider } from './identity-provider';
import { authRepository } from './auth.repository';
import { flattenPermissionScopes, groupPermissions } from './permissions';
import type { PermissionScopeDetails } from './permissions';
import { inferRegionalAccessFromText, parseRegionalAccessJson } from './regional-access';
import type { UserRow } from './auth.repository';
import type { RegionalAccessDTO } from './regional-access';
import type {
  AuthUserDTO,
  LoginRequest,
  LoginResponse,
  MeResponse,
  OfficerProfileDTO,
  OperatorProfileDTO,
  UserSummary,
} from './auth.types';

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    if (payload.accountType === 'poms' || payload.provider === 'local') {
      return this.loginLocal(payload);
    }

    if (payload.accountType === undefined) {
      const localResponse = await this.tryLoginLocalFirst(payload);
      if (localResponse) return localResponse;
    }

    const provider = getIdentityProvider();

    // 1. Authenticate กับ identity provider (mock หรือ external)
    if (payload.userType === 'officer') {
      if (!payload.departmentID) throw new UnauthorizedError('Invalid credentials');
      const profile = await provider.authenticateOfficer(
        payload.username,
        payload.password,
        payload.departmentID,
      );
      if (!profile) throw new UnauthorizedError('Invalid credentials');
      return await this.completeLoginAsOfficer(profile);
    }

    if (payload.userType === 'operator') {
      const profile = await provider.authenticateOperator(payload.username, payload.password);
      if (!profile) throw new UnauthorizedError('Invalid credentials');
      return await this.completeLoginAsOperator(profile);
    }

    // citizen
    const profile = await provider.authenticateCitizen(payload.username, payload.password);
    if (!profile) throw new UnauthorizedError('Invalid credentials');
    return await this.completeLoginAsCitizen(profile);
  },

  /**
   * Local login (สำหรับ admin หรือ mock — ใช้ password ใน DB)
   * ตอนนี้ใน mock เราใช้ identity provider เป็นทาง verify หลัก, fallback ไม่จำเป็น
   * Function นี้เก็บไว้สำหรับกรณีจะ verify password ใน DB ตรง ๆ (เช่น admin)
   */
  async verifyLocalPassword(userId: number, plaintext: string): Promise<boolean> {
    const user = await db('users').where({ id: userId }).first('password_hash');
    if (!user || !user.password_hash) return false;
    const hashString = bufferToHashString(user.password_hash);
    if (!hashString) return false;
    return verifyPassword(plaintext, hashString);
  },

  async tryLoginLocalFirst(payload: LoginRequest): Promise<LoginResponse | null> {
    const user = await authRepository.findUserByProviderAndExternalId('local', payload.username);
    if (!user) return null;
    return completeLocalLogin(payload, user);
  },

  async loginLocal(payload: LoginRequest): Promise<LoginResponse> {
    const user = await authRepository.findUserByProviderAndExternalId('local', payload.username);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    return completeLocalLogin(payload, user);
  },

  async completeLoginAsOfficer(
    profile: Awaited<ReturnType<ReturnType<typeof getIdentityProvider>['authenticateOfficer']>>,
  ): Promise<LoginResponse> {
    if (!profile) throw new UnauthorizedError('Invalid credentials');
    const isApiOfficer =
      profile.identity_provider !== undefined && profile.identity_provider !== 'mock';
    const user = isApiOfficer
      ? await authRepository.upsertExternalOfficerUser(profile, getOfficerRoleCode(profile))
      : await authRepository.findUserByProviderAndExternalId('mock', profile.external_id);
    ensureLoginUserAvailable(user, 'officer');
    await authRepository.updateLastLogin(user.id);
    if (!isApiOfficer) {
      await authRepository.syncExternalOfficerProfile(user.id, profile);
    }

    const officerProfile = await authRepository.getOfficerProfile(user.id);
    const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);

    return buildLoginResponse({
      user: toUserSummary(user),
      profile: officerProfile ? toOfficerDTO(officerProfile) : null,
      roles,
      scopes,
    });
  },

  async completeLoginAsOperator(
    profile: Awaited<ReturnType<ReturnType<typeof getIdentityProvider>['authenticateOperator']>>,
  ): Promise<LoginResponse> {
    if (!profile) throw new UnauthorizedError('Invalid credentials');
    const user = await authRepository.findUserByProviderAndExternalId('mock', profile.citizen_id);
    ensureLoginUserAvailable(user, 'operator');
    await authRepository.updateLastLogin(user.id);
    await authRepository.syncExternalOperatorProfile(user.id, profile);

    const operatorProfile = await buildOperatorProfile(user.id);
    const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);

    return buildLoginResponse({
      user: toUserSummary(user),
      profile: operatorProfile,
      roles,
      scopes,
    });
  },

  async completeLoginAsCitizen(
    profile: Awaited<ReturnType<ReturnType<typeof getIdentityProvider>['authenticateCitizen']>>,
  ): Promise<LoginResponse> {
    if (!profile) throw new UnauthorizedError('Invalid credentials');
    const user = await authRepository.findUserByProviderAndExternalId('mock', profile.external_id);
    ensureLoginUserAvailable(user, 'citizen');
    await authRepository.updateLastLogin(user.id);
    const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);
    return buildLoginResponse({
      user: toUserSummary(user),
      profile: null,
      roles,
      scopes,
    });
  },

  async me(userId: number): Promise<MeResponse> {
    const user = await authRepository.findUserById(userId);
    ensureLoginUserAvailable(user, 'citizen');

    const profile = await buildProfileForUser(user);
    const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);

    return buildMeResponse({
      user: toUserSummary(user),
      profile,
      roles,
      scopes,
    });
  },
};

export function getOfficerRoleCode(profile: {
  department_id: string;
  department_name_th?: string;
}): string {
  const departmentName = normalizeOrganizationName(profile.department_name_th);
  if (departmentName.includes('การนิคมอุตสาหกรรมแห่งประเทศไทย')) {
    return 'industrial_estate';
  }
  if (departmentName.includes('กรมโรงงานอุตสาหกรรม')) {
    return 'diw_central';
  }
  if (profile.department_id === '01000' || profile.department_id === '100') {
    return 'industrial_estate';
  }
  if (profile.department_id === '3010000' || profile.department_id === '2') return 'diw_central';
  return 'provincial_office';
}

function normalizeOrganizationName(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function ensureLocalLoginTypeAllowed(
  storedUserType: 'citizen' | 'operator' | 'officer' | 'admin',
  requestedUserType: LoginRequest['userType'],
): void {
  const allowed =
    storedUserType === requestedUserType ||
    (requestedUserType === 'officer' && storedUserType === 'admin');
  if (!allowed) throw new UnauthorizedError('Invalid credentials');
}

function ensureLoginUserAvailable(
  user:
    | {
        id: number;
        is_active: boolean;
      }
    | undefined,
  userType: LoginRequest['userType'],
): asserts user is { id: number; is_active: boolean } {
  if (!user) {
    logger.warn(`[auth] ${userType} login rejected: external identity is not provisioned`, {
      userType,
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!Boolean(user.is_active)) {
    logger.warn(`[auth] ${userType} login rejected: inactive account`, {
      userType,
      userId: user.id,
    });
    throw new UnauthorizedError('Invalid credentials');
  }
}

async function completeLocalLogin(payload: LoginRequest, user: UserRow): Promise<LoginResponse> {
  const hashString = bufferToHashString(user.password_hash);
  if (!hashString) throw new UnauthorizedError('Invalid credentials');

  const matches = await verifyPassword(payload.password, hashString);
  if (!matches) throw new UnauthorizedError('Invalid credentials');
  ensureLocalLoginTypeAllowed(user.user_type, payload.userType);
  ensureLoginUserAvailable(user, payload.userType);
  await authRepository.updateLastLogin(user.id);

  const profile = await buildProfileForUser(user);
  const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);

  return buildLoginResponse({
    user: toUserSummary(user),
    profile,
    roles,
    scopes,
  });
}

function toUserSummary(row: {
  id: number | string;
  external_id: string;
  identity_provider: string;
  user_type: 'citizen' | 'operator' | 'officer' | 'admin';
  username: string | null;
  prename_th: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}): UserSummary {
  const isActive = Boolean(row.is_active);

  return {
    id: Number(row.id), // BIGINT จาก MSSQL driver มาเป็น string — cast เป็น number (precision-safe จนถึง 2^53)
    userType: row.user_type,
    externalId: row.external_id,
    identityProvider: row.identity_provider,
    username: row.username,
    prenameTh: row.prename_th,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    isActive,
    statusLabel: isActive ? 'ใช้งาน' : 'ระงับใช้งาน',
  };
}

function toOfficerDTO(
  row: NonNullable<Awaited<ReturnType<typeof authRepository.getOfficerProfile>>>,
): OfficerProfileDTO {
  return {
    posNo: row.pos_no,
    pertype: row.pertype,
    positionTypeTh: row.position_type_th,
    lineNameTh: row.line_name_th,
    levelNameTh: row.level_name_th,
    mposition: row.mposition ?? null,
    organizeId: row.organize_id,
    organizeNameTh: row.organize_name_th ?? null,
    divisionNameTh: row.division_name_th ?? null,
    departmentId: row.department_id,
    departmentNameTh: row.department_name_th,
    ministryId: row.ministry_id,
    provinceId: row.province_id,
    perStatusName: row.per_status_name,
    regionalAccess:
      parseRegionalAccessJson(row.regional_access_json) ??
      inferRegionalAccessFromText(row.department_name_th, row.line_name_th),
  };
}

async function buildProfileForUser(
  user: Pick<UserRow, 'id' | 'user_type'>,
): Promise<OfficerProfileDTO | OperatorProfileDTO | null> {
  if (user.user_type === 'officer' || user.user_type === 'admin') {
    const officerProfile = await authRepository.getOfficerProfile(user.id);
    return officerProfile ? toOfficerDTO(officerProfile) : null;
  }

  if (user.user_type === 'operator') {
    return buildOperatorProfile(user.id);
  }

  return null;
}

async function buildOperatorProfile(userId: number): Promise<OperatorProfileDTO> {
  const opProfile = await authRepository.getOperatorProfile(userId);
  const factories = await authRepository.getOperatorFactories(userId);
  const juristicsMap = new Map<string, OperatorProfileDTO['juristics'][number]>();

  for (const factory of factories) {
    const factoryDTO = {
      fid: factory.fid,
      code: factory.code,
      name: factory.name,
      provinceId: factory.province_id,
      systemId: factory.system_id,
      verifyStatus: factory.verify_status,
      authorizeStart: factory.authorize_start,
      authorizeEnd: factory.authorize_end,
    };
    const existing = juristicsMap.get(factory.juristic_id);

    if (existing) {
      juristicsMap.set(factory.juristic_id, {
        ...existing,
        factories: [...existing.factories, factoryDTO],
      });
      continue;
    }

    juristicsMap.set(factory.juristic_id, {
      juristicId: factory.juristic_id,
      nameTh: factory.juristic_name_th,
      nameEn: factory.juristic_name_en,
      factories: [factoryDTO],
    });
  }

  return {
    userCode: opProfile?.user_code ?? null,
    regisDate: opProfile?.regis_date ?? null,
    juristics: Array.from(juristicsMap.values()),
  };
}

function buildLoginResponse(args: {
  user: UserSummary;
  profile: OfficerProfileDTO | OperatorProfileDTO | null;
  roles: string[];
  scopes: Record<string, string | null | PermissionScopeDetails>;
}): LoginResponse {
  const regionalAccess = getRegionalAccessFromProfile(args.profile);
  const accessToken = signAccessToken({
    sub: String(args.user.id),
    userType: args.user.userType,
    roles: args.roles,
    scopes: flattenPermissionScopes(args.scopes),
    scopeDetails: normalizePermissionScopeDetails(args.scopes),
    regionalAccess,
  });
  return {
    accessToken,
    user: toAuthUserDTO(args.user, args.profile, args.roles),
    permissions: groupPermissions(args.scopes),
  };
}

function buildMeResponse(args: {
  user: UserSummary;
  profile: OfficerProfileDTO | OperatorProfileDTO | null;
  roles: string[];
  scopes: Record<string, string | null | PermissionScopeDetails>;
}): MeResponse {
  return {
    user: toAuthUserDTO(args.user, args.profile, args.roles),
    permissions: groupPermissions(args.scopes),
  };
}

function toAuthUserDTO(
  user: UserSummary,
  profile: OfficerProfileDTO | OperatorProfileDTO | null,
  roles: string[],
): AuthUserDTO {
  const officerProfile = isOfficerProfile(profile) ? profile : null;
  const operatorProfile = isOperatorProfile(profile) ? profile : null;
  const fullName = [joinNamePrefix(user.prenameTh, user.firstName), user.lastName]
    .filter(Boolean)
    .join(' ');
  const operatorFields = operatorProfile
    ? {
        ownedFactoryIds: operatorProfile.juristics.flatMap((juristic) =>
          juristic.factories.map((factory) => factory.fid),
        ),
      }
    : {};

  return {
    accountType: user.identityProvider === 'local' ? 'poms' : 'api',
    userType: user.userType,
    username: user.externalId,
    fullName,
    name: {
      prenameTh: user.prenameTh,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName,
    },
    prenameTh: user.prenameTh,
    firstName: user.firstName,
    lastName: user.lastName,
    department: normalizeOptionalText(officerProfile?.departmentNameTh),
    lineNameTh: normalizeOptionalText(officerProfile?.lineNameTh),
    levelNameTh: normalizeOptionalText(officerProfile?.levelNameTh),
    mposition: normalizeOptionalText(officerProfile?.mposition),
    organize: normalizeOptionalText(officerProfile?.organizeNameTh),
    division: normalizeOptionalText(officerProfile?.divisionNameTh),
    provinceId: normalizeOptionalText(officerProfile?.provinceId),
    roles: roles[0] ?? user.userType,
    roleCodes: [...roles],
    isActive: user.isActive,
    officerProfile: officerProfile
      ? {
          lineNameTh: normalizeOptionalText(officerProfile.lineNameTh),
          levelNameTh: normalizeOptionalText(officerProfile.levelNameTh),
          mposition: normalizeOptionalText(officerProfile.mposition),
          organize: {
            id: normalizeOptionalText(officerProfile.organizeId),
            name: normalizeOptionalText(officerProfile.organizeNameTh),
          },
          division: normalizeOptionalText(officerProfile.divisionNameTh),
          department: {
            id: normalizeOptionalText(officerProfile.departmentId),
            name: normalizeOptionalText(officerProfile.departmentNameTh),
          },
        }
      : null,
    ...(officerProfile?.regionalAccess ? { regionalAccess: officerProfile.regionalAccess } : {}),
    ...operatorFields,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getRegionalAccessFromProfile(
  profile: OfficerProfileDTO | OperatorProfileDTO | null,
): RegionalAccessDTO | null {
  return isOfficerProfile(profile) ? profile.regionalAccess : null;
}

function normalizePermissionScopeDetails(
  scopes: Record<string, string | null | PermissionScopeDetails>,
): Record<string, PermissionScopeDetails> {
  return Object.fromEntries(
    Object.entries(scopes).map(([code, details]) => [
      code,
      typeof details === 'object' && details !== null
        ? details
        : { scope: details as PermissionScopeDetails['scope'] },
    ]),
  );
}

function joinNamePrefix(prenameTh: string | null, firstName: string): string {
  return `${prenameTh ?? ''}${firstName}`;
}

function isOfficerProfile(
  profile: OfficerProfileDTO | OperatorProfileDTO | null,
): profile is OfficerProfileDTO {
  return profile !== null && 'departmentId' in profile;
}

function isOperatorProfile(
  profile: OfficerProfileDTO | OperatorProfileDTO | null,
): profile is OperatorProfileDTO {
  return profile !== null && 'juristics' in profile;
}
