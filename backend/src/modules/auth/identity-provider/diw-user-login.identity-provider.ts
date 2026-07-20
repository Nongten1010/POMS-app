import { logger } from '../../../config/logger';
import {
  IdentityProvider,
  ExternalOfficerProfile,
  ExternalOperatorProfile,
  ExternalCitizenProfile,
} from './identity-provider.interface';

type FetchLike = typeof fetch;

interface DiwUserLoginOptions {
  operatorUrl: string;
  officerUrl: string;
  clientId: string;
  timeoutMs: number;
  defaultProvinceId: string;
  fetchImpl?: FetchLike;
}

interface DiwUserLoginResponse {
  status?: boolean | string;
  citizen_id?: unknown;
  userCode?: unknown;
  userFirstName?: unknown;
  userLastName?: unknown;
  userPhone?: unknown;
  userEmail?: unknown;
  userRegisDate?: unknown;
  juristic?: unknown;
}

interface DiwOfficerLoginResponse {
  status?: boolean | string;
  msg?: unknown;
}

interface DiwOfficer {
  organize_id?: unknown;
  organize_th?: unknown;
  percardno?: unknown;
  per_cardno?: unknown;
  prename_th?: unknown;
  per_name?: unknown;
  per_surname?: unknown;
  pos_no?: unknown;
  pertype_id?: unknown;
  pertype?: unknown;
  positiontype_id?: unknown;
  positiontype_th?: unknown;
  line_id?: unknown;
  linename_th?: unknown;
  level_id?: unknown;
  levelname_th?: unknown;
  mposition_id?: unknown;
  mposition?: unknown;
  division?: unknown;
  department_id?: unknown;
  department?: unknown;
  ministry_id?: unknown;
  ministry?: unknown;
  province_id?: unknown;
  province_th?: unknown;
  per_status?: unknown;
  per_status_name?: unknown;
  relocation_type?: unknown;
  relocation_name?: unknown;
}

interface DiwJuristic {
  JuristicID?: unknown;
  JuristicNameTh?: unknown;
  JuristicNameEn?: unknown;
  FactoryList?: unknown;
}

interface DiwFactory {
  FID?: unknown;
  CODE?: unknown;
  FNAME?: unknown;
  PROVINCE_ID?: unknown;
  province_id?: unknown;
  SYSTEM_ID?: unknown;
  system_id?: unknown;
  VERIFY_STATUS?: unknown;
  verify_status?: unknown;
}

export class DiwUserLoginIdentityProvider implements IdentityProvider {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: DiwUserLoginOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async authenticateOfficer(
    username: string,
    password: string,
    departmentID: string,
  ): Promise<ExternalOfficerProfile | null> {
    const data = await this.postUserLogin(this.options.officerUrl, {
      clientId: this.options.clientId,
      username,
      password,
      departmentID,
    });
    if (!data) return null;
    return parseDiwOfficerLoginResponse(data, username);
  }

  async authenticateOperator(
    username: string,
    password: string,
  ): Promise<ExternalOperatorProfile | null> {
    const data = await this.postUserLogin(this.options.operatorUrl, {
      clientId: this.options.clientId,
      username,
      password,
    });
    if (!data) return null;
    return parseDiwOperatorLoginResponse(data, this.options.defaultProvinceId);
  }

  async authenticateCitizen(
    _username: string,
    _password: string,
  ): Promise<ExternalCitizenProfile | null> {
    return null;
  }

  private async postUserLogin(url: string, body: Record<string, string>): Promise<unknown | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn('[auth] DIW UserLogin request failed', {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      return (await response.json()) as unknown;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      logger.warn('[auth] DIW UserLogin request could not be completed', {
        reason: isAbort ? 'timeout' : 'request_failed',
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parseDiwOfficerLoginResponse(
  data: unknown,
  submittedUsername: string,
): ExternalOfficerProfile | null {
  if (!isRecord(data)) return null;

  const payload = data as DiwOfficerLoginResponse;
  if (!isSuccessStatus(payload.status)) return null;

  const rawMsg = parseMaybeJson(payload.msg);
  const first = Array.isArray(rawMsg) ? rawMsg[0] : rawMsg;
  if (!isRecord(first)) return null;

  const officer = first as DiwOfficer;
  const accountIdentity = classifyOfficerAccountIdentity(submittedUsername);
  if (!accountIdentity) return null;

  return {
    identity_provider: accountIdentity.provider,
    external_id: accountIdentity.externalId,
    prename_th: toStringValue(officer.prename_th) ?? '',
    first_name: toStringValue(officer.per_name) ?? '',
    last_name: toStringValue(officer.per_surname) ?? '',
    email: null,
    phone: null,
    pos_no: toStringValue(officer.pos_no) ?? '',
    pertype_id: toStringValue(officer.pertype_id) ?? '',
    pertype: toStringValue(officer.pertype) ?? '',
    position_type_id: toStringValue(officer.positiontype_id) ?? '',
    position_type_th: toStringValue(officer.positiontype_th) ?? '',
    line_id: toStringValue(officer.line_id) ?? '',
    line_name_th: toStringValue(officer.linename_th) ?? '',
    level_id: toStringValue(officer.level_id) ?? '',
    level_name_th: toStringValue(officer.levelname_th) ?? '',
    mposition_id: toStringValue(officer.mposition_id) ?? '',
    mposition: toStringValue(officer.mposition) ?? '',
    organize_id: toOrganizationId(officer.organize_id) ?? '',
    organize_name_th: toStringValue(officer.organize_th) ?? '',
    division_name_th: toStringValue(officer.division) ?? '',
    department_id: toOrganizationId(officer.department_id) ?? '',
    department_name_th: toStringValue(officer.department) ?? '',
    ministry_id: toStringValue(officer.ministry_id) ?? '',
    province_id: toStringValue(officer.province_id) ?? '',
    per_status: toStringValue(officer.per_status) ?? '',
    per_status_name: toStringValue(officer.per_status_name) ?? '',
    relocation_type: toStringValue(officer.relocation_type) ?? '',
    relocation_name: toStringValue(officer.relocation_name) ?? '',
  };
}

function classifyOfficerAccountIdentity(
  submittedUsername: string,
): { provider: 'diw_dpis' | 'i_industry'; externalId: string } | null {
  const externalId = submittedUsername.trim();
  if (/^\d{13}$/.test(externalId)) return { provider: 'i_industry', externalId };
  if (/^U[A-Za-z0-9._-]+$/i.test(externalId)) return { provider: 'diw_dpis', externalId };
  return null;
}

export function parseDiwOperatorLoginResponse(
  data: unknown,
  defaultProvinceId: string,
): ExternalOperatorProfile | null {
  const first = Array.isArray(data) ? data[0] : data;
  if (!isRecord(first)) return null;

  const payload = first as DiwUserLoginResponse;
  if (!isSuccessStatus(payload.status)) return null;

  const citizenId = toStringValue(payload.citizen_id);
  if (!citizenId) return null;

  const firstName = toStringValue(payload.userFirstName) ?? '';
  const lastName = toStringValue(payload.userLastName) ?? '';

  return {
    citizen_id: citizenId,
    user_code: toStringValue(payload.userCode) ?? citizenId,
    first_name: firstName,
    last_name: lastName,
    email: toStringValue(payload.userEmail),
    phone: toStringValue(payload.userPhone),
    regis_date: toStringValue(payload.userRegisDate),
    juristics: parseJuristics(payload.juristic, defaultProvinceId),
  };
}

function parseJuristics(
  value: unknown,
  defaultProvinceId: string,
): ExternalOperatorProfile['juristics'] {
  const rawJuristics = parseMaybeJson(value);
  if (!Array.isArray(rawJuristics)) return [];

  return rawJuristics.flatMap((raw): ExternalOperatorProfile['juristics'] => {
    if (!isRecord(raw)) return [];
    const juristic = raw as DiwJuristic;
    const juristicId = toStringValue(juristic.JuristicID);
    const nameTh = toStringValue(juristic.JuristicNameTh);
    if (!juristicId || !nameTh) return [];

    return [
      {
        juristic_id: juristicId,
        name_th: nameTh,
        name_en: toStringValue(juristic.JuristicNameEn) ?? '',
        factories: parseFactories(juristic.FactoryList, defaultProvinceId),
      },
    ];
  });
}

function parseFactories(
  value: unknown,
  defaultProvinceId: string,
): ExternalOperatorProfile['juristics'][number]['factories'] {
  const rawFactories = parseMaybeJson(value);
  if (!Array.isArray(rawFactories)) return [];

  return rawFactories.flatMap((raw): ExternalOperatorProfile['juristics'][number]['factories'] => {
    if (!isRecord(raw)) return [];
    const factory = raw as DiwFactory;
    const fid = toStringValue(factory.FID);
    const code = toStringValue(factory.CODE);
    const name = toStringValue(factory.FNAME);
    if (!fid || !code || !name) return [];

    return [
      {
        fid,
        code,
        name,
        province_id:
          toStringValue(factory.PROVINCE_ID) ??
          toStringValue(factory.province_id) ??
          defaultProvinceId,
        system_id: toNumberValue(factory.SYSTEM_ID ?? factory.system_id),
        verify_status: toNumberValue(factory.VERIFY_STATUS ?? factory.verify_status) ?? 0,
        authorize_start: null,
        authorize_end: null,
        juristic_start: null,
        verify_date: null,
      },
    ];
  });
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isSuccessStatus(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function toOrganizationId(value: unknown): string | null {
  const normalized = toStringValue(value);
  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,15}$/.test(normalized)) return null;
  return normalized;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
