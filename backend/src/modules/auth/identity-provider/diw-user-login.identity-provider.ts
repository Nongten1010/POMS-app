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
  JuristicList?: unknown;
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
  fid?: unknown;
  CODE?: unknown;
  code?: unknown;
  FNAME?: unknown;
  fname?: unknown;
  PROVINCE_ID?: unknown;
  province_id?: unknown;
  SYSTEM_ID?: unknown;
  system_id?: unknown;
  VERIFY_STATUS?: unknown;
  verify_status?: unknown;
  AUTHORIZE_START?: unknown;
  authorize_start?: unknown;
  AUTHORIZE_END?: unknown;
  authorize_end?: unknown;
  JURISTIC_START?: unknown;
  juristic_start?: unknown;
  VERIFY_DATE?: unknown;
  verify_date?: unknown;
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
    const externalId = username.trim();
    if (!isOperatorIdentity(externalId)) return null;

    const data = await this.postUserLogin(this.options.operatorUrl, {
      clientId: this.options.clientId,
      username: externalId,
      password,
    });
    if (!data) return null;
    return parseDiwOperatorLoginResponse(data, this.options.defaultProvinceId, externalId);
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
  submittedUsername: string,
): ExternalOperatorProfile | null {
  const first = Array.isArray(data) ? data[0] : data;
  if (!isRecord(first)) return null;

  const payload = first as DiwUserLoginResponse;
  if (!isSuccessStatus(payload.status)) return null;

  const accountKey = submittedUsername.trim();
  if (!isOperatorIdentity(accountKey)) return null;

  const citizenId = toStringValue(payload.citizen_id);
  if (!citizenId || citizenId !== accountKey) return null;

  const firstName = toStringValue(payload.userFirstName) ?? '';
  const lastName = toStringValue(payload.userLastName) ?? '';

  return {
    identity_provider: 'i_industry',
    external_id: accountKey,
    citizen_id: citizenId,
    user_code: toStringValue(payload.userCode) ?? citizenId,
    first_name: firstName,
    last_name: lastName,
    email: toStringValue(payload.userEmail),
    phone: toStringValue(payload.userPhone),
    regis_date: normalizeDiwDateTime(payload.userRegisDate),
    juristics: parseJuristics(payload.juristic ?? payload.JuristicList, defaultProvinceId),
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
    const fid = toStringValue(factory.FID ?? factory.fid);
    const code = toStringValue(factory.CODE ?? factory.code);
    const name = toStringValue(factory.FNAME ?? factory.fname);
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
        authorize_start: normalizeDiwDate(factory.AUTHORIZE_START ?? factory.authorize_start),
        authorize_end: normalizeDiwDate(factory.AUTHORIZE_END ?? factory.authorize_end),
        juristic_start: normalizeDiwDate(factory.JURISTIC_START ?? factory.juristic_start),
        verify_date: normalizeDiwDate(factory.VERIFY_DATE ?? factory.verify_date),
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

function isOperatorIdentity(value: string): boolean {
  return /^\d{13}$/.test(value);
}

function normalizeDiwDate(value: unknown): string | null {
  const normalized = normalizeDiwDateTime(value);
  return normalized?.slice(0, 10) ?? null;
}

function normalizeDiwDateTime(value: unknown): string | null {
  const raw = toStringValue(value);
  if (!raw) return null;

  const dayFirst =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,7})?)?$/.exec(raw);
  if (dayFirst) {
    return buildSqlDateTime({
      year: Number(dayFirst[3]),
      month: Number(dayFirst[2]),
      day: Number(dayFirst[1]),
      hour: dayFirst[4] === undefined ? undefined : Number(dayFirst[4]),
      minute: dayFirst[5] === undefined ? undefined : Number(dayFirst[5]),
      second: dayFirst[6] === undefined ? undefined : Number(dayFirst[6]),
      fraction: dayFirst[7],
    });
  }

  const yearFirst = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,7})?)?$/.exec(
    raw,
  );
  if (!yearFirst) return null;

  return buildSqlDateTime({
    year: Number(yearFirst[1]),
    month: Number(yearFirst[2]),
    day: Number(yearFirst[3]),
    hour: yearFirst[4] === undefined ? undefined : Number(yearFirst[4]),
    minute: yearFirst[5] === undefined ? undefined : Number(yearFirst[5]),
    second: yearFirst[6] === undefined ? undefined : Number(yearFirst[6]),
    fraction: yearFirst[7],
  });
}

function buildSqlDateTime(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  fraction?: string;
}): string | null {
  const { year, month, day, hour, minute, second, fraction } = parts;
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const validDate =
    year >= 1900 &&
    year <= 9999 &&
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day;
  if (!validDate) return null;

  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (hour === undefined || minute === undefined || second === undefined) return date;
  if (hour > 23 || minute > 59 || second > 59) return null;

  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${fraction ?? ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
