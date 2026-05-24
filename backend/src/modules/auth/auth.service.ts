import { db } from '../../config/database';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { signAccessToken, parseDurationToSeconds } from '../../shared/utils/jwt';
import { verifyPassword, bufferToHashString } from '../../shared/utils/password';
import { getIdentityProvider } from './identity-provider';
import { authRepository } from './auth.repository';
import { groupPermissions } from './permissions';
import type {
  LoginRequest,
  LoginResponse,
  OfficerProfileDTO,
  OperatorProfileDTO,
  UserSummary,
} from './auth.types';

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const provider = getIdentityProvider();

    // 1. Authenticate กับ identity provider (mock หรือ external)
    if (payload.userType === 'officer') {
      const profile = await provider.authenticateOfficer(
        payload.username!,
        payload.password,
        payload.departmentID!,
      );
      if (!profile) throw new UnauthorizedError('Invalid credentials');
      return await this.completeLoginAsOfficer(profile);
    }

    if (payload.userType === 'operator') {
      const profile = await provider.authenticateOperator(payload.username!, payload.password);
      if (!profile) throw new UnauthorizedError('Invalid credentials');
      return await this.completeLoginAsOperator(profile);
    }

    // citizen
    const profile = await provider.authenticateCitizen(payload.username!, payload.password);
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

  async completeLoginAsOfficer(
    profile: Awaited<ReturnType<ReturnType<typeof getIdentityProvider>['authenticateOfficer']>>,
  ): Promise<LoginResponse> {
    if (!profile) throw new UnauthorizedError('Invalid credentials');
    const user = await authRepository.findUserByProviderAndExternalId(
      'mock',
      profile.external_id,
    );
    if (!user) {
      throw new UnauthorizedError(
        `Officer ${profile.external_id} not provisioned in POMS — run seed first`,
      );
    }
    await authRepository.updateLastLogin(user.id);

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
    const user = await authRepository.findUserByProviderAndExternalId(
      'mock',
      profile.citizen_id,
    );
    if (!user) {
      throw new UnauthorizedError(
        `Operator ${profile.citizen_id} not provisioned in POMS — run seed first`,
      );
    }
    await authRepository.updateLastLogin(user.id);

    const opProfile = await authRepository.getOperatorProfile(user.id);
    const factories = await authRepository.getOperatorFactories(user.id);
    const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);

    const juristicsMap = new Map<
      string,
      OperatorProfileDTO['juristics'][number]
    >();
    for (const f of factories) {
      const existing = juristicsMap.get(f.juristic_id);
      if (existing) {
        existing.factories.push({
          fid: f.fid,
          code: f.code,
          name: f.name,
          provinceId: f.province_id,
          systemId: f.system_id,
          verifyStatus: f.verify_status,
          authorizeStart: f.authorize_start,
          authorizeEnd: f.authorize_end,
        });
      } else {
        juristicsMap.set(f.juristic_id, {
          juristicId: f.juristic_id,
          nameTh: f.juristic_name_th,
          nameEn: f.juristic_name_en,
          factories: [
            {
              fid: f.fid,
              code: f.code,
              name: f.name,
              provinceId: f.province_id,
              systemId: f.system_id,
              verifyStatus: f.verify_status,
              authorizeStart: f.authorize_start,
              authorizeEnd: f.authorize_end,
            },
          ],
        });
      }
    }

    const operatorProfile: OperatorProfileDTO = {
      userCode: opProfile?.user_code ?? null,
      regisDate: opProfile?.regis_date ?? null,
      juristics: Array.from(juristicsMap.values()),
    };

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
    const user = await authRepository.findUserByProviderAndExternalId(
      'mock',
      profile.external_id,
    );
    if (!user) {
      throw new UnauthorizedError(`Citizen ${profile.external_id} not provisioned in POMS`);
    }
    await authRepository.updateLastLogin(user.id);
    const { roles, scopes } = await authRepository.getRolesAndPermissions(user.id);
    return buildLoginResponse({
      user: toUserSummary(user),
      profile: null,
      roles,
      scopes,
    });
  },
};

function toUserSummary(row: {
  id: number | string;
  external_id: string;
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

function toOfficerDTO(row: NonNullable<Awaited<ReturnType<typeof authRepository.getOfficerProfile>>>): OfficerProfileDTO {
  return {
    posNo: row.pos_no,
    pertype: row.pertype,
    positionTypeTh: row.position_type_th,
    lineNameTh: row.line_name_th,
    levelNameTh: row.level_name_th,
    organizeId: row.organize_id,
    divisionId: row.division_id,
    departmentId: row.department_id,
    ministryId: row.ministry_id,
    provinceId: row.province_id,
    perStatusName: row.per_status_name,
  };
}

function buildLoginResponse(args: {
  user: UserSummary;
  profile: OfficerProfileDTO | OperatorProfileDTO | null;
  roles: string[];
  scopes: Record<string, string | null>;
}): LoginResponse {
  const expiresIn = parseDurationToSeconds(env.JWT_EXPIRES_IN);
  const accessToken = signAccessToken({
    sub: String(args.user.id),
    userType: args.user.userType,
    roles: args.roles,
    scopes: args.scopes,
  });
  return {
    accessToken,
    expiresIn,
    user: args.user,
    profile: args.profile,
    roles: args.roles,
    scopes: args.scopes,
    permissions: groupPermissions(args.scopes),
  };
}
