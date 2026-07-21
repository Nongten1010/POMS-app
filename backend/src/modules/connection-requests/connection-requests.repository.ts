import type { Knex } from 'knex';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { factorySourceDb } from '../../config/factory-source-database';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import {
  deriveHasEiaFromAssessment,
  resolveStoredConnectionRequestEia,
} from './connection-request-eia';
import {
  buildConnectedFactoryProfilePatch,
  buildEligibleFactoryProfilePatch,
  type FactoryProfileSyncSource,
} from './connected-factory-profile';
import {
  CANCELLABLE_CONNECTION_REQUEST_STATUSES,
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_SUBMISSION_SOURCE,
  CONNECTION_REQUEST_TYPE,
  CONNECTION_REQUEST_TYPE_LABELS,
  CONNECTION_REQUEST_STATUS_LABELS,
  type ContactPersonInput,
  type ConnectionRequestDTO,
  type ConnectionRequestStatus,
  type ConnectionRequestType,
  type CreateConnectionRequestInput,
  type CurrentFactoryMeasurementPointDTO,
  type DirectConnectionRequestInput,
  type FactoryFavoriteDTO,
  type FactoryGeneralDTO,
  type FactorySummaryDTO,
  type MeasurementInstrumentsInput,
  type MeasurementPointDetailsInput,
  type ListConnectionRequestsQuery,
  type MeasurementPointDTO,
  type MeasurementPointInput,
  type RequestDocumentImageInput,
  type StatusDurationSummaryDTO,
  type StatusHistoryDTO,
} from './connection-requests.types';

const FACTORY_TYPE_CODE_LENGTH = 5;

interface ConnectionRequestRow {
  id: number | string;
  eligible_factory_id: number | string | null;
  request_no: string;
  submission_source: 'OPERATOR_FORM' | 'OFFICER_DIRECT_API' | null;
  request_type: ConnectionRequestType;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  industry_main_order: string | null;
  industry_sub_order: string | null;
  business_activity: string | null;
  eia_assessment: string | null;
  eia_other: string | null;
  has_eia: boolean | number | null;
  project_name: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  system_type: 'CEMS' | 'WPMS';
  status: ConnectionRequestStatus;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  contact_persons_json: string | null;
  notification_emails_json: string | null;
  officer_notification_emails_json: string | null;
  information_provider_name: string | null;
  information_provider_position: string | null;
  remarks: string | null;
  revision_reason: string | null;
  officer_note: string | null;
  connection_due_at: Date | string | null;
  confirmed_at: Date | string | null;
  verified_at: Date | string | null;
  created_by: number | string;
  updated_by?: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RequestFactorySnapshotRow {
  request_id: number | string;
  region_code: string | null;
  region_name: string | null;
  province_code: string | null;
  province_name: string | null;
  district_code: string | null;
  district_name: string | null;
  subdistrict_code: string | null;
  subdistrict_name: string | null;
  industrial_estate_code: string | null;
  industrial_estate_name: string | null;
  factory_main_type_code: string | null;
  factory_main_type_label: string | null;
}

interface MeasurementPointRow {
  id: number | string;
  request_id: number | string;
  point_name: string;
  point_code: string | null;
  point_type: 'STACK' | 'WASTEWATER' | 'OTHER';
  latitude: number | string | null;
  longitude: number | string | null;
  parameters_json: string;
  description: string | null;
  details_json: string | null;
  documents_json: string | null;
  instruments_json: string | null;
}

interface ConnectedMeasurementPointRow {
  id: number | string;
  parameters_json: string;
}

interface ConnectedFactoryProfileRow {
  factory_latitude: number | string | null;
  factory_longitude: number | string | null;
  factory_eia_assessment: string | null;
  factory_eia_other: string | null;
  factory_has_eia: boolean | number | null;
  factory_project_name: string | null;
  factory_front_photos_json: string | null;
  factory_logo_json: string | null;
}

interface CurrentFactoryMeasurementPointRow {
  factory_id: string;
  point_name: string;
  point_code: string | null;
  system_type: 'CEMS' | 'WPMS';
  parameters_json: string;
  factory_logo_json: string | null;
  documents_json: string | null;
}

interface StatusHistoryRow {
  id: number | string;
  request_id: number | string;
  status: ConnectionRequestStatus;
  note: string | null;
  changed_by: number | string;
  changed_by_username: string | null;
  changed_by_prename_th: string | null;
  changed_by_first_name: string | null;
  changed_by_last_name: string | null;
  changed_at: Date | string;
}

interface ListAccess {
  actorUserId: number;
  scope: AccessScope;
  regionalAccess?: RegionalAccessDTO | null;
}

interface FactoryRow {
  id: number | string;
  fid: string;
  code: string;
  name: string;
  system_detail: string | null;
  province_id: string | null;
  province_region: string | null;
  province_name: string | null;
  industrial_estate_code: string | null;
  industrial_estate_name: string | null;
  is_active: boolean | number;
  factory_registration_no_old: string | null;
  factory_type_sequence: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_activity: string | null;
  has_eia: boolean | number | null;
  eligible_factory_id: number | string | null;
}

interface FactoryMainTypeLabelRow {
  CLASS: string | null;
  DISP_CLASS: string | null;
  DESCRIPT: string | null;
  FULL_DESCRIPTION: string | null;
}

interface FactoryGeneralRow {
  id: number | string;
  fid: string;
  code: string;
  name: string;
  system_id: number | string | null;
  system_detail: string | null;
  verify_status: number | string | null;
  authorize_start: Date | string | null;
  authorize_end: Date | string | null;
  province_name: string | null;
  province_id: string | null;
  province_region: string | null;
  industrial_estate_code: string | null;
  industrial_estate_name: string | null;
  juristic_id: string | null;
  juristic_name: string | null;
  source_factory_id: string | null;
  factory_registration_no_old: string | null;
  factory_type_sequence: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_activity: string | null;
  operation_status: string | null;
  capital_amount: number | string | null;
  machinery_horsepower: number | string | null;
  production_capacity: string | null;
  wastewater_discharge_info: string | null;
  boiler_count: number | string | null;
  boiler_size_each: string | null;
  fuel_used: string | null;
  has_eia: boolean | number | null;
  eligible_factory_id: number | string | null;
}

interface FactorySnapshotSourceRow {
  province_id: string | null;
  province_name: string | null;
  province_region: string | null;
  industrial_estate_code: string | null;
  industrial_estate_name: string | null;
}

interface FactoryAccess {
  actorUserId: number;
  scope: AccessScope;
  regionalAccess?: RegionalAccessDTO | null;
}

type AccessScope = string | null | undefined | PermissionScopeDetails;

interface StatusUpdate {
  revisionReason?: string | null;
  officerNote?: string | null;
  connectionDueAt?: string | null;
  confirmedAt?: string | null;
  verifiedAt?: string | null;
}

interface StatusUpdateOptions {
  issueWaitingConnectionSideEffects?: boolean;
}

interface PointCodeSequenceRow {
  system_type: 'CEMS' | 'WPMS';
  prefix: 'S' | 'W';
  last_sequence: number | string;
}

interface FactoryFavoriteRow {
  id: number | string;
  factory_id: string;
  deleted_at: Date | string | null;
}

interface ProvinceRegionRow {
  name_th: string;
  region: string | null;
}

interface OfficerNotificationEmailRecipientRow {
  recipient_type: 'PROVINCE' | 'INDUSTRIAL_ESTATE';
  province_name: string | null;
  emails_json: string;
}

interface OfficerNotificationEmailLookupInput {
  factoryId: string;
  provinceName: string | null | undefined;
  industrialAreaType?: 'INDUSTRIAL_ESTATE' | 'OUTSIDE_INDUSTRIAL_ESTATE';
}

interface EligibleFactoryReferenceRow {
  id: number | string;
  source_factory_id: string | null;
  factory_registration_no_new: string;
}

interface DirectConnectionFactoryRow {
  eligible_factory_id: number | string;
  factory_registration_no_new: string;
  factory_name: string;
}

interface EligibleFactoryProfileRow {
  id: number | string;
  latitude: number | string | null;
  longitude: number | string | null;
  eia_assessment: string | null;
  eia_other: string | null;
  has_eia: boolean | number | null;
  project_name: string | null;
}

const TEMPORARY_FACTORY_TEXT = 'ไม่ระบุ';
const TEMPORARY_EIA_LABEL = 'ไม่มี' as const;
const POINT_CODE_INITIAL_SEQUENCE = 2000;
const TERMINAL_CONNECTION_REQUEST_STATUSES: ConnectionRequestStatus[] = ['CONNECTED', 'CANCELED'];
const CONNECTION_TIMEOUT_AUTO_CANCEL_NOTE =
  'ระบบยกเลิกคำขออัตโนมัติเนื่องจากครบกำหนดเชื่อมต่อ 30 วัน';

export const connectionRequestsRepository = {
  async findActiveEligibleFactoryReference(input: {
    factoryId: string;
    factoryRegistrationNo: string;
  }): Promise<{
    id: number;
    sourceFactoryId: string | null;
    factoryRegistrationNoNew: string;
  } | null> {
    const row = await db<EligibleFactoryReferenceRow>('eligible_factories')
      .whereNull('deleted_at')
      .where((builder) => {
        builder
          .where('source_factory_id', input.factoryId)
          .orWhere('factory_registration_no_new', input.factoryId)
          .orWhere('factory_registration_no_new', input.factoryRegistrationNo);
      })
      .select('id', 'source_factory_id', 'factory_registration_no_new')
      .first();

    return row
      ? {
          id: Number(row.id),
          sourceFactoryId: row.source_factory_id,
          factoryRegistrationNoNew: row.factory_registration_no_new,
        }
      : null;
  },

  async findDirectConnectionFactory(
    input: { factoryId: string; factoryRegistrationNo: string },
    access: FactoryAccess,
  ): Promise<{
    eligibleFactoryId: number;
    factoryId: string;
    factoryName: string;
    newRegistrationNo: string;
  } | null> {
    const row = await buildDirectConnectionFactoryQuery(input, access).first();
    if (!row) return null;

    return {
      eligibleFactoryId: Number(row.eligible_factory_id),
      factoryId: row.factory_registration_no_new,
      factoryName: row.factory_name,
      newRegistrationNo: row.factory_registration_no_new,
    };
  },

  async list(
    query: ListConnectionRequestsQuery,
    access: ListAccess,
  ): Promise<{ rows: ConnectionRequestDTO[]; total: number }> {
    const baseQuery = buildBaseQuery(query, access);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rows = await baseQuery.clone().orderBy('created_at', 'desc').orderBy('id', 'desc');
    const data = await hydrateMany(rows);
    return { rows: data, total };
  },

  async listFactoriesForAccess(access: FactoryAccess): Promise<FactorySummaryDTO[]> {
    const builder = buildFactoriesForAccessQuery(access);

    const rows = await builder;
    return rows.map(toFactorySummaryDTO);
  },

  async listFactoryMainTypeLabels(codes: string[]): Promise<Map<string, string>> {
    const normalizedCodes = [...new Set(codes.map(normalizeFactoryMainTypeCode).filter(isString))];
    if (normalizedCodes.length === 0) return new Map();

    const rows = await factorySourceDb<FactoryMainTypeLabelRow>(`${env.FACTORY_DB_SCHEMA}.TCLASS`)
      .whereIn(
        'CLASS',
        normalizedCodes.map((code) => code.padStart(5, '0')),
      )
      .select('CLASS', 'DISP_CLASS', 'DESCRIPT', 'FULL_DESCRIPTION');

    return new Map(
      rows
        .map((row): [string, string] | null => {
          const code = normalizeFactoryMainTypeCode(row.CLASS);
          if (!code) return null;
          const displayClass = row.DISP_CLASS?.trim();
          const description = (row.FULL_DESCRIPTION ?? row.DESCRIPT)?.trim();
          if (!displayClass || !description) return null;
          return [code, `ประเภทโรงงานลำดับที่ ${displayClass}: ${description}`];
        })
        .filter(isTuple),
    );
  },

  async listProvinceRegions(provinceNames: string[]): Promise<Map<string, string>> {
    const normalizedProvinceNames = [...new Set(provinceNames.map((value) => value.trim()))].filter(
      Boolean,
    );
    if (normalizedProvinceNames.length === 0) return new Map();

    const rows = await db<ProvinceRegionRow>('provinces')
      .whereIn('name_th', normalizedProvinceNames)
      .select('name_th', 'region');

    return new Map(
      rows
        .filter((row) => row.name_th && row.region)
        .map((row) => [row.name_th, row.region as string]),
    );
  },

  async findFactoryGeneral(
    factoryId: string,
    access: FactoryAccess,
  ): Promise<FactoryGeneralDTO | null> {
    const builder = db<FactoryGeneralRow>('factories as f')
      .leftJoin('provinces as p', 'p.id', 'f.province_id')
      .leftJoin('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
      .leftJoin('juristics as j', 'j.id', 'f.juristic_id')
      .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
        this.on('ef.factory_registration_no_new', '=', 'f.code').andOnNull('ef.deleted_at');
      })
      .whereNull('f.deleted_at')
      .where((whereBuilder) => {
        whereBuilder
          .where('f.fid', factoryId)
          .orWhere('f.code', factoryId)
          .orWhere('ef.source_factory_id', factoryId)
          .orWhere('ef.factory_registration_no_new', factoryId);
      })
      .select(
        'f.id',
        'f.fid',
        'f.code',
        'f.name',
        'f.system_id',
        'f.system_detail',
        'f.verify_status',
        'f.authorize_start',
        'f.authorize_end',
        'f.province_id',
        'p.region as province_region',
        'ie.code as industrial_estate_code',
        'p.name_th as province_name',
        'ie.name_th as industrial_estate_name',
        'j.juristic_id as juristic_id',
        'j.name_th as juristic_name',
        'ef.source_factory_id',
        'ef.factory_registration_no_old',
        'ef.factory_type_sequence',
        'ef.address',
        'ef.latitude',
        'ef.longitude',
        'ef.business_activity',
        'ef.operation_status',
        'ef.capital_amount',
        'ef.machinery_horsepower',
        'ef.production_capacity',
        'ef.wastewater_discharge_info',
        'ef.boiler_count',
        'ef.boiler_size_each',
        'ef.fuel_used',
        'ef.has_eia',
        'ef.id as eligible_factory_id',
      );

    if (requiresAssignedFactoryAccess(access.scope)) {
      applyAssignedFactoryAccessFilter(builder, access.actorUserId);
    }
    applyFactoryPermissionLocationFilter(builder, access.scope);
    applyFactoryRegionalAccessFilter(builder, access.regionalAccess);

    const row = await builder.first();
    return row ? toFactoryGeneralDTO(row) : null;
  },

  async listFavoriteFactoryIds(actorUserId: number): Promise<string[]> {
    const rows = await db<FactoryFavoriteRow>('user_factory_favorites')
      .where('user_id', actorUserId)
      .whereNull('deleted_at')
      .select('factory_id')
      .orderBy('factory_id', 'asc');

    return rows.map((row) => row.factory_id);
  },

  async setFactoryFavorite(
    actorUserId: number,
    factoryId: string,
    isFavorite: boolean,
  ): Promise<FactoryFavoriteDTO> {
    const existing = await db<FactoryFavoriteRow>('user_factory_favorites')
      .where('user_id', actorUserId)
      .where('factory_id', factoryId)
      .first('id', 'factory_id', 'deleted_at');

    if (isFavorite) {
      if (existing) {
        await db('user_factory_favorites').where('id', existing.id).update({
          deleted_at: null,
          updated_by: actorUserId,
          updated_at: db.fn.now(),
        });
      } else {
        await db('user_factory_favorites').insert({
          user_id: actorUserId,
          factory_id: factoryId,
          created_by: actorUserId,
          updated_by: actorUserId,
        });
      }
    } else if (existing && existing.deleted_at === null) {
      await db('user_factory_favorites').where('id', existing.id).update({
        deleted_at: db.fn.now(),
        updated_by: actorUserId,
        updated_at: db.fn.now(),
      });
    }

    return { factoryId, isFavorite };
  },

  async findFactorySummariesForRequests(
    requests: ConnectionRequestDTO[],
  ): Promise<Map<string, FactorySummaryDTO>> {
    const factoryIds = [...new Set(requests.map((request) => request.factoryId))];
    const registrationNos = [...new Set(requests.map((request) => request.factoryRegistrationNo))];

    if (factoryIds.length === 0 && registrationNos.length === 0) return new Map();

    const rows = await db<FactoryRow>('factories as f')
      .leftJoin('provinces as p', 'p.id', 'f.province_id')
      .whereNull('f.deleted_at')
      .where((builder) => {
        if (factoryIds.length > 0) builder.whereIn('f.fid', factoryIds);
        if (registrationNos.length > 0) builder.orWhereIn('f.code', registrationNos);
      })
      .select(
        'f.id',
        'f.fid',
        'f.code',
        'f.name',
        'f.system_detail',
        'f.is_active',
        'p.name_th as province_name',
      );

    const map = new Map<string, FactorySummaryDTO>();
    rows.forEach((row) => {
      const dto = toFactorySummaryDTO(row);
      map.set(row.fid, dto);
      map.set(row.code, dto);
    });
    return map;
  },

  async listRequestsForFactories(factoryIds: string[]): Promise<ConnectionRequestDTO[]> {
    if (factoryIds.length === 0) return [];

    const rows = await db<ConnectionRequestRow>('cems_wpms_connection_requests')
      .whereNull('deleted_at')
      .whereIn('factory_id', factoryIds)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .select(
        'id',
        'request_no',
        'submission_source',
        'request_type',
        'eligible_factory_id',
        'factory_id',
        'factory_name',
        'factory_registration_no',
        'industry_main_order',
        'industry_sub_order',
        'business_activity',
        'eia_assessment',
        'eia_other',
        'has_eia',
        'project_name',
        'address',
        'latitude',
        'longitude',
        'system_type',
        'status',
        'contact_name',
        'contact_phone',
        'contact_email',
        'contact_persons_json',
        'notification_emails_json',
        'officer_notification_emails_json',
        'information_provider_name',
        'information_provider_position',
        'remarks',
        'revision_reason',
        'officer_note',
        'connection_due_at',
        'confirmed_at',
        'verified_at',
        'created_by',
        'created_at',
        'updated_at',
      );

    return hydrateMany(rows);
  },

  async listOfficerNotificationEmailsForFactories(
    factories: OfficerNotificationEmailLookupInput[],
  ): Promise<Map<string, string[]>> {
    if (factories.length === 0) return new Map();

    const lookupInputs = factories.map((factory) => ({
      factoryId: factory.factoryId,
      recipientType:
        factory.industrialAreaType === 'INDUSTRIAL_ESTATE'
          ? ('INDUSTRIAL_ESTATE' as const)
          : ('PROVINCE' as const),
      provinceName: normalizeLookupText(factory.provinceName),
    }));
    const provinceNames = [
      ...new Set(
        lookupInputs
          .filter((factory) => factory.recipientType === 'PROVINCE')
          .map((factory) => factory.provinceName)
          .filter(isString),
      ),
    ];
    const recipientTypes = new Set<OfficerNotificationEmailRecipientRow['recipient_type']>(
      lookupInputs.map((factory) => factory.recipientType),
    );
    const emptyResult = new Map(lookupInputs.map((factory) => [factory.factoryId, []]));
    if (!recipientTypes.has('INDUSTRIAL_ESTATE') && provinceNames.length === 0) {
      return emptyResult;
    }

    const query = db<OfficerNotificationEmailRecipientRow>('officer_notification_email_recipients')
      .where('is_active', true)
      .whereNull('deleted_at')
      .where((builder) => {
        if (recipientTypes.has('INDUSTRIAL_ESTATE')) {
          builder.orWhere('recipient_type', 'INDUSTRIAL_ESTATE');
        }
        if (provinceNames.length > 0) {
          builder.orWhere((provinceBuilder) => {
            provinceBuilder
              .where('recipient_type', 'PROVINCE')
              .whereIn('province_name', provinceNames);
          });
        }
      })
      .select('recipient_type', 'province_name', 'emails_json');

    const rows = await query;
    const emailsByLookupKey = new Map<string, string[]>();
    rows.forEach((row) => {
      const key =
        row.recipient_type === 'INDUSTRIAL_ESTATE'
          ? 'INDUSTRIAL_ESTATE'
          : `PROVINCE:${normalizeLookupText(row.province_name) ?? ''}`;
      emailsByLookupKey.set(key, normalizeEmailList(parseJsonArray<string>(row.emails_json)));
    });

    return new Map(
      lookupInputs.map((factory) => {
        const key =
          factory.recipientType === 'INDUSTRIAL_ESTATE'
            ? 'INDUSTRIAL_ESTATE'
            : `PROVINCE:${factory.provinceName ?? ''}`;
        return [
          factory.factoryId,
          emailsByLookupKey.get(key) ?? emptyResult.get(factory.factoryId) ?? [],
        ];
      }),
    );
  },

  async listConnectedMeasurementPointsForFactories(
    factoryIds: string[],
  ): Promise<CurrentFactoryMeasurementPointDTO[]> {
    const lookupKeys = [...new Set(factoryIds.filter((factoryId) => factoryId.trim().length > 0))];
    if (lookupKeys.length === 0) return [];

    const rows = await db<CurrentFactoryMeasurementPointRow>(
      'cems_wpms_connected_measurement_points',
    )
      .whereNull('deleted_at')
      .whereIn('factory_id', lookupKeys)
      .select(
        'factory_id',
        'point_name',
        'point_code',
        'system_type',
        'parameters_json',
        'factory_logo_json',
        'documents_json',
      )
      .orderBy('factory_id', 'asc')
      .orderBy('point_code', 'asc')
      .orderBy('point_name', 'asc');

    return rows.map((row) => ({
      factoryId: row.factory_id,
      stationId: row.point_code ?? row.point_name,
      pointName: row.point_name,
      pointCode: row.point_code,
      systemType: row.system_type,
      parameters: parseParameters(row.parameters_json),
      factoryLogo: parseJsonObject<RequestDocumentImageInput>(row.factory_logo_json),
      documentsAndImages: parseJsonArray<RequestDocumentImageInput>(row.documents_json),
      data: [],
    }));
  },

  async listPublicConnectedMeasurementPointsForFactories(
    factoryIds: string[],
  ): Promise<CurrentFactoryMeasurementPointDTO[]> {
    const lookupKeys = [...new Set(factoryIds.filter((factoryId) => factoryId.trim().length > 0))];
    if (lookupKeys.length === 0) return [];

    const rows = await db<CurrentFactoryMeasurementPointRow>(
      'cems_wpms_connected_measurement_points',
    )
      .whereNull('deleted_at')
      .whereIn('factory_id', lookupKeys)
      .select(
        'factory_id',
        'point_name',
        'point_code',
        'system_type',
        'parameters_json',
        'factory_logo_json',
        'documents_json',
      )
      .orderBy('factory_id', 'asc')
      .orderBy('point_code', 'asc')
      .orderBy('point_name', 'asc');

    return rows.map((row) => ({
      factoryId: row.factory_id,
      stationId: row.point_code ?? row.point_name,
      pointName: row.point_name,
      pointCode: row.point_code,
      systemType: row.system_type,
      parameters: parseParameters(row.parameters_json),
      factoryLogo: parseJsonObject<RequestDocumentImageInput>(row.factory_logo_json),
      documentsAndImages: parseJsonArray<RequestDocumentImageInput>(row.documents_json),
      data: [],
    }));
  },

  async create(
    input: CreateConnectionRequestInput,
    actorUserId: number,
    initialStatus: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      await requireActiveEligibleFactoryInTransaction(trx, input.eligibleFactoryId);
      const requestNo = await nextRequestNo(trx, input.systemType);
      const [{ id }] = await trx('cems_wpms_connection_requests')
        .insert({
          request_no: requestNo,
          request_type: input.requestType ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
          ...toRequestRow(input),
          status: initialStatus,
          created_by: actorUserId,
          updated_by: actorUserId,
        })
        .returning('id');

      const requestId = Number(id);
      await upsertFactorySnapshot(trx, requestId, input, actorUserId);
      await insertMeasurementPoints(trx, requestId, input.measurementPoints, actorUserId);
      await insertHistory(trx, requestId, initialStatus, actorUserId, 'ผู้ประกอบการส่งฟอร์ม');

      const created = await findByIdInTransaction(trx, requestId);
      if (!created) throw new Error('Created connection request could not be loaded');
      return created;
    });
  },

  async createDirectConnection(
    input: DirectConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const point = input.measurementPoints[0];
    const pointCode = point?.pointCode?.trim();
    if (input.measurementPoints.length !== 1 || !point || !pointCode) {
      throw new Error(
        'Direct connection repository requires exactly one measurement point with a code',
      );
    }

    try {
      return await db.transaction(async (trx) => {
        const activeEligibleFactory = await requireActiveEligibleFactoryInTransaction(
          trx,
          input.eligibleFactoryId,
        );
        await ensureDirectPointCodeAvailable(trx, pointCode);
        const connectedAt = new Date();
        const requestNo = await nextDirectRequestNo(trx, input.systemType, connectedAt);
        const [{ id }] = await trx('cems_wpms_connection_requests')
          .insert({
            request_no: requestNo,
            request_type: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
            submission_source: CONNECTION_REQUEST_SUBMISSION_SOURCE.OFFICER_DIRECT_API,
            ...toRequestRow(input),
            status: CONNECTION_REQUEST_STATUS.CONNECTED,
            verified_at: connectedAt,
            created_by: actorUserId,
            updated_by: actorUserId,
          })
          .returning('id');

        const requestId = Number(id);
        await upsertFactorySnapshot(trx, requestId, input, actorUserId);
        const pointId = await insertDirectMeasurementPoint(
          trx,
          requestId,
          { ...point, pointCode },
          actorUserId,
        );

        await insertHistory(
          trx,
          requestId,
          CONNECTION_REQUEST_STATUS.CONNECTED,
          actorUserId,
          'เจ้าหน้าที่เพิ่มจุดตรวจวัดและเชื่อมต่อโดยตรงผ่าน API',
        );
        const factoryProfile = await syncFactoryProfileInTransaction(
          trx,
          activeEligibleFactory,
          input,
          actorUserId,
        );
        await trx('cems_wpms_connected_measurement_points').insert({
          source_request_id: requestId,
          source_measurement_point_id: pointId,
          eligible_factory_id: Number(activeEligibleFactory.id),
          factory_id: input.factoryId,
          factory_name: input.factoryName,
          factory_registration_no: input.factoryRegistrationNo,
          factory_address: input.address ?? null,
          ...factoryProfile,
          system_type: input.systemType,
          point_name: point.pointName,
          point_code: pointCode,
          point_type: point.pointType,
          parameters_json: JSON.stringify(point.parameters ?? []),
          details_json: point.details ? JSON.stringify(point.details) : null,
          documents_json:
            point.documentsAndImages && point.documentsAndImages.length > 0
              ? JSON.stringify(point.documentsAndImages)
              : null,
          instruments_json: point.measurementInstruments
            ? JSON.stringify(point.measurementInstruments)
            : null,
          connected_at: connectedAt,
          created_by: actorUserId,
          updated_by: actorUserId,
        });

        const created = await findByIdInTransaction(trx, requestId);
        if (!created) throw new Error('Created direct connection request could not be loaded');
        return created;
      });
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      if (isActivePointCodeUniqueViolation(error)) throw directPointCodeConflict(pointCode);
      throw error;
    }
  },

  async findById(id: number): Promise<ConnectionRequestDTO | null> {
    const row = await db<ConnectionRequestRow>('cems_wpms_connection_requests')
      .where('id', id)
      .whereNull('deleted_at')
      .first();
    return row ? hydrate(row) : null;
  },

  async replaceForm(
    id: number,
    input: CreateConnectionRequestInput,
    actorUserId: number,
    nextStatus: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      await requireActiveEligibleFactoryInTransaction(trx, input.eligibleFactoryId);
      await trx('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          request_type: input.requestType ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
          ...toRequestRow(input),
          status: nextStatus,
          revision_reason: null,
          officer_note: null,
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await trx('cems_wpms_measurement_points')
        .where('request_id', id)
        .whereNull('deleted_at')
        .update({
          deleted_at: trx.fn.now(),
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await insertMeasurementPoints(trx, id, input.measurementPoints, actorUserId);
      await upsertFactorySnapshot(trx, id, input, actorUserId);
      await insertHistory(trx, id, nextStatus, actorUserId, 'ผู้ประกอบการแก้ไขและส่งฟอร์มอีกครั้ง');

      const updated = await findByIdInTransaction(trx, id);
      if (!updated) throw new Error('Updated connection request could not be loaded');
      return updated;
    });
  },

  async updateStatus(
    id: number,
    status: ConnectionRequestStatus,
    actorUserId: number,
    update: StatusUpdate,
    options: StatusUpdateOptions = {},
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      if (shouldIssueWaitingConnectionSideEffects(status, options)) {
        await softDeleteDuplicateActiveMeasurementPoints(trx, id, actorUserId);
        await issuePointCodesForRequest(trx, id, actorUserId);
      }

      await trx('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          status,
          revision_reason: update.revisionReason ?? null,
          officer_note: update.officerNote ?? null,
          ...(update.connectionDueAt !== undefined
            ? { connection_due_at: update.connectionDueAt }
            : {}),
          ...(update.confirmedAt !== undefined ? { confirmed_at: update.confirmedAt } : {}),
          ...(update.verifiedAt !== undefined ? { verified_at: update.verifiedAt } : {}),
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await insertHistory(trx, id, status, actorUserId, buildStatusHistoryNote(update));

      const updated = await findByIdInTransaction(trx, id);
      if (!updated) throw new Error('Updated connection request could not be loaded');
      return updated;
    });
  },

  async connect(
    id: number,
    actorUserId: number,
    update: Pick<StatusUpdate, 'verifiedAt' | 'officerNote'>,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      const current = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first('id', 'status', 'eligible_factory_id');

      if (!current) throw new NotFoundError('Connection request not found');
      if (current.status !== CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED) {
        throw new ConflictError('Connection request cannot be connected from its current status', {
          currentStatus: current.status,
          allowedStatuses: [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED],
        });
      }

      const eligibleFactoryId = Number(current.eligible_factory_id);
      if (!Number.isFinite(eligibleFactoryId)) {
        throw new ConflictError('Connection request is not linked to an eligible factory');
      }

      const activeEligibleFactory = await requireActiveEligibleFactoryInTransaction(
        trx,
        eligibleFactoryId,
      );

      await trx('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          status: CONNECTION_REQUEST_STATUS.CONNECTED,
          revision_reason: null,
          officer_note: update.officerNote ?? null,
          verified_at: update.verifiedAt ?? null,
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await insertHistory(
        trx,
        id,
        CONNECTION_REQUEST_STATUS.CONNECTED,
        actorUserId,
        buildStatusHistoryNote(update),
      );

      const connected = await findByIdInTransaction(trx, id);
      if (!connected) throw new Error('Connected request could not be loaded');
      await syncConnectedMeasurementPointsInTransaction(
        trx,
        connected,
        actorUserId,
        activeEligibleFactory,
      );
      return connected;
    });
  },

  async cancelOperatorRequest(
    id: number,
    actorUserId: number,
    reason: string | null,
  ): Promise<ConnectionRequestDTO> {
    await db.transaction(async (trx) => {
      const current = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first('id', 'status', 'submission_source', 'created_by');

      if (!current) throw new NotFoundError('Connection request not found');
      if (Number(current.created_by) !== actorUserId) {
        throw new ForbiddenError('Only the request owner can perform this action');
      }

      const submissionSource =
        current.submission_source ?? CONNECTION_REQUEST_SUBMISSION_SOURCE.OPERATOR_FORM;
      if (submissionSource !== CONNECTION_REQUEST_SUBMISSION_SOURCE.OPERATOR_FORM) {
        throw new ConflictError('Only operator-form connection requests can be canceled', {
          submissionSource,
        });
      }

      if (current.status === CONNECTION_REQUEST_STATUS.CANCELED) return;
      if (!CANCELLABLE_CONNECTION_REQUEST_STATUSES.includes(current.status)) {
        throw new ConflictError('Connection request cannot be canceled from its current status', {
          currentStatus: current.status,
          allowedStatuses: CANCELLABLE_CONNECTION_REQUEST_STATUSES,
        });
      }

      await trx('cems_wpms_connection_requests').where('id', id).whereNull('deleted_at').update({
        status: CONNECTION_REQUEST_STATUS.CANCELED,
        revision_reason: reason,
        officer_note: null,
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      });

      await insertHistory(trx, id, CONNECTION_REQUEST_STATUS.CANCELED, actorUserId, reason);
    });

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Connection request not found');
    return updated;
  },

  async autoCancelExpiredWaitingConnectionRequests(cutoffIso: string): Promise<number> {
    return db.transaction(async (trx) => {
      const expiredRows = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
        .whereNull('deleted_at')
        .where('status', CONNECTION_REQUEST_STATUS.WAITING_CONNECTION)
        .whereNotNull('connection_due_at')
        .where('connection_due_at', '<', cutoffIso)
        .select('id', 'created_by', 'updated_by');

      const rowsWithActors = expiredRows.filter((row) => Number.isFinite(findAuditActorId(row)));
      if (rowsWithActors.length === 0) return 0;

      const requestIds = rowsWithActors.map((row) => Number(row.id));
      await trx('cems_wpms_connection_requests')
        .whereIn('id', requestIds)
        .where('status', CONNECTION_REQUEST_STATUS.WAITING_CONNECTION)
        .whereNull('deleted_at')
        .update({
          status: CONNECTION_REQUEST_STATUS.CANCELED,
          revision_reason: CONNECTION_TIMEOUT_AUTO_CANCEL_NOTE,
          officer_note: null,
          confirmed_at: null,
          updated_by: trx.raw('COALESCE(updated_by, created_by)'),
          updated_at: trx.fn.now(),
        });

      for (const row of rowsWithActors) {
        await insertHistory(
          trx,
          Number(row.id),
          CONNECTION_REQUEST_STATUS.CANCELED,
          findAuditActorId(row),
          CONNECTION_TIMEOUT_AUTO_CANCEL_NOTE,
        );
      }

      return rowsWithActors.length;
    });
  },

  async syncConnectedMeasurementPoints(
    request: ConnectionRequestDTO,
    actorUserId: number,
  ): Promise<void> {
    await db.transaction(async (trx) => {
      const activeEligibleFactory = await requireActiveEligibleFactoryInTransaction(
        trx,
        request.eligibleFactoryId ?? undefined,
      );
      await syncConnectedMeasurementPointsInTransaction(
        trx,
        request,
        actorUserId,
        activeEligibleFactory,
      );
    });
  },
};

async function syncConnectedMeasurementPointsInTransaction(
  trx: Knex.Transaction,
  request: ConnectionRequestDTO,
  actorUserId: number,
  activeEligibleFactory: EligibleFactoryProfileRow,
): Promise<void> {
  const factoryProfile = await syncFactoryProfileInTransaction(
    trx,
    activeEligibleFactory,
    request,
    actorUserId,
  );
  for (const point of request.measurementPoints) {
    const existing = await findConnectedPointForMeasurementPoint(trx, point);
    const pointParameters = getConnectedMeasurementPointParameters(point);
    const parameters = uniqueParameters([
      ...(pointParameters.length > 0
        ? []
        : existing
          ? parseParameters(existing.parameters_json)
          : []),
      ...pointParameters,
    ]);

    await softDeleteConnectedPoint(trx, point, actorUserId);
    await trx('cems_wpms_connected_measurement_points').insert({
      source_request_id: request.id,
      source_measurement_point_id: point.id,
      eligible_factory_id: Number(activeEligibleFactory.id),
      factory_id: request.factoryId,
      factory_name: request.factoryName,
      factory_registration_no: request.factoryRegistrationNo,
      factory_address: request.address,
      ...factoryProfile,
      system_type: request.systemType,
      point_name: point.pointName,
      point_code: point.pointCode,
      point_type: point.pointType,
      parameters_json: JSON.stringify(parameters),
      details_json: point.details ? JSON.stringify(point.details) : null,
      documents_json:
        point.documentsAndImages && point.documentsAndImages.length > 0
          ? JSON.stringify(point.documentsAndImages)
          : null,
      instruments_json: point.measurementInstruments
        ? JSON.stringify(point.measurementInstruments)
        : null,
      connected_at: request.verifiedAt,
      created_by: actorUserId,
      updated_by: actorUserId,
    });
  }
}

async function requireActiveEligibleFactoryInTransaction(
  trx: Knex.Transaction,
  eligibleFactoryId: number | undefined,
): Promise<EligibleFactoryProfileRow> {
  if (!Number.isFinite(eligibleFactoryId)) {
    throw new ConflictError('Connection request is not linked to an eligible factory');
  }

  const activeEligibleFactory = await trx<EligibleFactoryProfileRow>('eligible_factories')
    .where('id', eligibleFactoryId as number)
    .whereNull('deleted_at')
    .forUpdate()
    .first('id', 'latitude', 'longitude', 'eia_assessment', 'eia_other', 'has_eia', 'project_name');
  if (!activeEligibleFactory) {
    throw new ConflictError('Eligible factory is no longer active', { eligibleFactoryId });
  }
  return activeEligibleFactory;
}

async function syncFactoryProfileInTransaction(
  trx: Knex.Transaction,
  activeEligibleFactory: EligibleFactoryProfileRow,
  source: FactoryProfileSyncSource,
  actorUserId: number,
): Promise<ConnectedFactoryProfileRow> {
  const eligibleFactoryId = Number(activeEligibleFactory.id);
  const existingProfile = await trx<ConnectedFactoryProfileRow>(
    'cems_wpms_connected_measurement_points',
  )
    .where('eligible_factory_id', eligibleFactoryId)
    .whereNull('deleted_at')
    .orderBy('id', 'desc')
    .first(
      'factory_latitude',
      'factory_longitude',
      'factory_eia_assessment',
      'factory_eia_other',
      'factory_has_eia',
      'factory_project_name',
      'factory_front_photos_json',
      'factory_logo_json',
    );
  const connectedPatch = buildConnectedFactoryProfilePatch(source);
  const eligiblePatch = buildEligibleFactoryProfilePatch(source);

  if (existingProfile && Object.keys(connectedPatch).length > 0) {
    await trx('cems_wpms_connected_measurement_points')
      .where('eligible_factory_id', eligibleFactoryId)
      .whereNull('deleted_at')
      .update({
        ...connectedPatch,
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      });
  }
  if (Object.keys(eligiblePatch).length > 0) {
    await trx('eligible_factories')
      .where('id', eligibleFactoryId)
      .whereNull('deleted_at')
      .update({
        ...eligiblePatch,
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      });
  }

  return {
    factory_latitude: activeEligibleFactory.latitude,
    factory_longitude: activeEligibleFactory.longitude,
    factory_eia_assessment: activeEligibleFactory.eia_assessment,
    factory_eia_other: activeEligibleFactory.eia_other,
    factory_has_eia: activeEligibleFactory.has_eia,
    factory_project_name: activeEligibleFactory.project_name,
    factory_front_photos_json: null,
    factory_logo_json: null,
    ...(existingProfile ?? {}),
    ...connectedPatch,
  };
}

export function buildBaseQueryForTests(
  query: ListConnectionRequestsQuery,
  access: ListAccess,
): Knex.QueryBuilder<ConnectionRequestRow, ConnectionRequestRow[]> {
  return buildBaseQuery(query, access);
}

export function buildFactoriesForAccessQueryForTests(
  access: FactoryAccess,
): Knex.QueryBuilder<FactoryRow, FactoryRow[]> {
  return buildFactoriesForAccessQuery(access);
}

export function buildDirectConnectionFactoryQueryForTests(
  input: { factoryId: string; factoryRegistrationNo: string },
  access: FactoryAccess,
): Knex.QueryBuilder<DirectConnectionFactoryRow, DirectConnectionFactoryRow[]> {
  return buildDirectConnectionFactoryQuery(input, access);
}

export function buildStatusHistoryTimelineForTests(historyRows: StatusHistoryRow[]): {
  statusHistory: StatusHistoryDTO[];
  statusDurationSummary: StatusDurationSummaryDTO;
} {
  return buildStatusHistoryTimeline(historyRows);
}

function buildFactoriesForAccessQuery(
  access: FactoryAccess,
): Knex.QueryBuilder<FactoryRow, FactoryRow[]> {
  const builder = db<FactoryRow>('factories as f')
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .leftJoin('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on(function joinFactoryKeys() {
        this.on('ef.factory_registration_no_new', '=', 'f.code')
          .orOn('ef.factory_registration_no_new', '=', 'f.fid')
          .orOn('ef.source_factory_id', '=', 'f.fid')
          .orOn('ef.source_factory_id', '=', 'f.code');
      }).andOnNull('ef.deleted_at');
    })
    .whereNull('f.deleted_at')
    .select(
      'f.id',
      'f.fid',
      'f.code',
      'f.name',
      'f.system_detail',
      'f.is_active',
      'p.id as province_id',
      'p.region as province_region',
      'p.name_th as province_name',
      'ie.code as industrial_estate_code',
      'ie.name_th as industrial_estate_name',
      'ef.factory_registration_no_old',
      'ef.factory_type_sequence',
      'ef.address',
      'ef.latitude',
      'ef.longitude',
      'ef.business_activity',
      'ef.has_eia',
      'ef.id as eligible_factory_id',
    )
    .orderBy('f.name', 'asc')
    .orderBy('f.id', 'asc');

  if (requiresAssignedFactoryAccess(access.scope)) {
    applyAssignedFactoryAccessFilter(builder, access.actorUserId);
  }
  applyFactoryPermissionLocationFilter(builder, access.scope);
  applyFactoryRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<FactoryRow, FactoryRow[]>;
}

function buildDirectConnectionFactoryQuery(
  input: { factoryId: string; factoryRegistrationNo: string },
  access: FactoryAccess,
): Knex.QueryBuilder<DirectConnectionFactoryRow, DirectConnectionFactoryRow[]> {
  const identifiers = [...new Set([input.factoryId, input.factoryRegistrationNo])]
    .map((value) => value.trim())
    .filter(Boolean);
  const builder = db<DirectConnectionFactoryRow>('eligible_factories as ef')
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .whereNull('ef.deleted_at')
    .where((identifierBuilder) => {
      identifierBuilder
        .whereIn('ef.source_factory_id', identifiers)
        .orWhereIn('ef.factory_registration_no_new', identifiers)
        .orWhereIn('ef.factory_registration_no_old', identifiers);
    })
    .select('ef.id as eligible_factory_id', 'ef.factory_registration_no_new', 'ef.factory_name');

  applyDirectConnectionFactoryAccessFilter(builder, access.scope);
  applyFactoryRegionalAccessFilter(builder, access.regionalAccess);
  return builder as unknown as Knex.QueryBuilder<
    DirectConnectionFactoryRow,
    DirectConnectionFactoryRow[]
  >;
}

function applyDirectConnectionFactoryAccessFilter(
  builder: Knex.QueryBuilder,
  scope: AccessScope,
): void {
  const scopeValue = getAccessScopeValue(scope);
  if (scopeValue === 'ALL') return;
  if (!scope || typeof scope !== 'object') {
    builder.whereRaw('1 = 0');
    return;
  }

  const region = normalizeLocationValue(scope.region);
  const province = normalizeLocationValue(scope.province);
  if (scope.scope === 'IN_REGION' && region) {
    builder.where('p.region', region);
    return;
  }
  if (scope.scope === 'IN_PROVINCE' && province) {
    builder.where('ef.province_name', province);
    return;
  }
  builder.whereRaw('1 = 0');
}

function buildBaseQuery(
  query: ListConnectionRequestsQuery,
  access: ListAccess,
): Knex.QueryBuilder<ConnectionRequestRow, ConnectionRequestRow[]> {
  const builder = db<ConnectionRequestRow>('cems_wpms_connection_requests').whereNull('deleted_at');

  if (query.status) builder.where('status', query.status);
  if (query.requestType) builder.where('request_type', query.requestType);
  if (query.factoryId) builder.where('factory_id', query.factoryId);
  applyFactorySnapshotFilters(builder, query);
  if (query.stationId) {
    const stationId = query.stationId;
    builder.whereExists(function stationFilter() {
      this.select(db.raw('1'))
        .from('cems_wpms_measurement_points as mp')
        .whereRaw('mp.request_id = cems_wpms_connection_requests.id')
        .whereNull('mp.deleted_at')
        .where((pointBuilder) => {
          pointBuilder
            .where('mp.point_code', stationId)
            .orWhere('mp.point_name', stationId)
            .orWhereExists(function connectedPointAliasFilter() {
              this.select(db.raw('1'))
                .from('cems_wpms_connected_measurement_points as cmp')
                .whereNull('cmp.deleted_at')
                .whereRaw('cmp.factory_id = cems_wpms_connection_requests.factory_id')
                .where((connectedPointBuilder) => {
                  connectedPointBuilder
                    .where('cmp.point_code', stationId)
                    .orWhere('cmp.point_name', stationId);
                })
                .where((aliasBuilder) => {
                  aliasBuilder
                    .whereRaw('mp.point_code = cmp.point_code')
                    .orWhereRaw('mp.id = cmp.source_measurement_point_id');
                });
            });
        });
    });
  }
  if (requiresAssignedRequestAccess(access.scope)) {
    builder.where('created_by', access.actorUserId);
  }
  applyRequestPermissionLocationFilter(builder, access.scope);
  applyRequestRegionalAccessFilter(builder, access.regionalAccess);

  return builder.select(
    'id',
    'request_no',
    'submission_source',
    'request_type',
    'eligible_factory_id',
    'factory_id',
    'factory_name',
    'factory_registration_no',
    'industry_main_order',
    'industry_sub_order',
    'business_activity',
    'eia_assessment',
    'eia_other',
    'has_eia',
    'project_name',
    'address',
    'latitude',
    'longitude',
    'system_type',
    'status',
    'contact_name',
    'contact_phone',
    'contact_email',
    'contact_persons_json',
    'notification_emails_json',
    'officer_notification_emails_json',
    'information_provider_name',
    'information_provider_position',
    'remarks',
    'revision_reason',
    'officer_note',
    'connection_due_at',
    'confirmed_at',
    'verified_at',
    'created_by',
    'created_at',
    'updated_at',
  );
}

function applyRequestRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  regionalAccess: RegionalAccessDTO | null | undefined,
): void {
  const regionValues = getRegionalFilterValues(regionalAccess);
  if (regionValues.length === 0) return;

  builder.whereExists(function regionalAccessFilter() {
    this.select(db.raw('1'))
      .from('cems_wpms_request_factory_snapshots as fs')
      .whereRaw('fs.request_id = cems_wpms_connection_requests.id')
      .whereNull('fs.deleted_at')
      .where((regionBuilder) => {
        regionBuilder
          .whereIn('fs.region_name', regionValues)
          .orWhereIn('fs.region_code', regionValues);
      });
  });
}

function getAccessScopeValue(scope: AccessScope): string | null | undefined {
  return scope && typeof scope === 'object' ? scope.scope : scope;
}

function requiresAssignedFactoryAccess(scope: AccessScope): boolean {
  const scopeValue = getAccessScopeValue(scope);
  if (scopeValue === 'ALL') return false;
  return !hasPermissionLocationFilter(scope);
}

function requiresAssignedRequestAccess(scope: AccessScope): boolean {
  const scopeValue = getAccessScopeValue(scope);
  if (scopeValue === 'ALL') return false;
  return !hasPermissionLocationFilter(scope);
}

function hasPermissionLocationFilter(scope: AccessScope): boolean {
  if (!scope || typeof scope !== 'object') return false;
  if (scope.scope === 'IN_REGION') return Boolean(normalizeLocationValue(scope.region));
  if (scope.scope === 'IN_PROVINCE') return Boolean(normalizeLocationValue(scope.province));
  return false;
}

function applyFactoryRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  regionalAccess: RegionalAccessDTO | null | undefined,
): void {
  const regionValues = getRegionalFilterValues(regionalAccess);
  if (regionValues.length === 0) return;
  builder.whereIn('p.region', regionValues);
}

function applyFactoryPermissionLocationFilter(
  builder: Knex.QueryBuilder,
  scope: AccessScope,
): void {
  if (!scope || typeof scope !== 'object') return;
  const region = normalizeLocationValue(scope.region);
  const province = normalizeLocationValue(scope.province);

  if (scope.scope === 'IN_REGION' && region) {
    builder.where('p.region', region);
  }

  if (scope.scope === 'IN_PROVINCE' && province) {
    builder.where('p.name_th', province);
  }
}

function applyRequestPermissionLocationFilter(
  builder: Knex.QueryBuilder,
  scope: AccessScope,
): void {
  if (!scope || typeof scope !== 'object') return;
  const region = normalizeLocationValue(scope.region);
  const province = normalizeLocationValue(scope.province);
  if (scope.scope !== 'IN_REGION' && scope.scope !== 'IN_PROVINCE') return;
  if (scope.scope === 'IN_REGION' && !region) return;
  if (scope.scope === 'IN_PROVINCE' && !province) return;

  builder.whereExists(function permissionLocationFilter() {
    this.select(db.raw('1'))
      .from('cems_wpms_request_factory_snapshots as fs')
      .whereRaw('fs.request_id = cems_wpms_connection_requests.id')
      .whereNull('fs.deleted_at');

    if (scope.scope === 'IN_REGION' && region) {
      this.where((regionBuilder) => {
        regionBuilder.where('fs.region_name', region).orWhere('fs.region_code', region);
      });
    }

    if (scope.scope === 'IN_PROVINCE' && province) {
      this.where((provinceBuilder) => {
        provinceBuilder.where('fs.province_name', province).orWhere('fs.province_code', province);
      });
    }
  });
}

function getRegionalFilterValues(regionalAccess: RegionalAccessDTO | null | undefined): string[] {
  const values = regionalAccess?.regions ?? [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}

function applyFactorySnapshotFilters(
  builder: Knex.QueryBuilder<ConnectionRequestRow, ConnectionRequestRow[]>,
  query: ListConnectionRequestsQuery,
): void {
  const filters = {
    regionName: query.regionName,
    provinceName: query.provinceName,
    districtName: query.districtName,
    subdistrictName: query.subdistrictName,
    industrialEstateName: query.industrialEstateName,
    factoryMainTypeCode: query.factoryMainTypeCode,
  };
  const hasFilter = Object.values(filters).some((value) => Boolean(value));
  if (!hasFilter) return;

  builder.whereExists(function factorySnapshotFilter() {
    this.select(db.raw('1'))
      .from('cems_wpms_request_factory_snapshots as fs')
      .whereRaw('[fs].[request_id] = [cems_wpms_connection_requests].[id]')
      .whereNull('fs.deleted_at');

    if (filters.regionName) this.where('fs.region_name', filters.regionName);
    if (filters.provinceName) this.where('fs.province_name', filters.provinceName);
    if (filters.districtName) this.where('fs.district_name', filters.districtName);
    if (filters.subdistrictName) this.where('fs.subdistrict_name', filters.subdistrictName);
    if (filters.industrialEstateName) {
      this.where('fs.industrial_estate_name', filters.industrialEstateName);
    }
    if (filters.factoryMainTypeCode) {
      this.where('fs.factory_main_type_code', filters.factoryMainTypeCode);
    }
  });
}

function toFactorySummaryDTO(row: FactoryRow): FactorySummaryDTO {
  const { factoryClass, factorySubclass } = splitFactoryTypeSequence(row.factory_type_sequence);
  const hasEia = toNullableBoolean(row.has_eia);
  const isEligible = row.eligible_factory_id !== null && row.eligible_factory_id !== undefined;
  const industrialArea = toIndustrialArea(row.industrial_estate_code, row.industrial_estate_name);
  return {
    id: Number(row.id),
    factoryId: row.fid,
    factoryName: row.name,
    newRegistrationNo: row.code,
    oldRegistrationNo: row.factory_registration_no_old,
    industryType: row.system_detail,
    industryMainOrder: factoryClass ?? TEMPORARY_FACTORY_TEXT,
    industrySubOrder: factorySubclass ?? TEMPORARY_FACTORY_TEXT,
    businessActivity: row.business_activity,
    eia: hasEia === null ? TEMPORARY_EIA_LABEL : hasEia ? 'มี' : 'ไม่มี',
    hasEia,
    projectName: TEMPORARY_FACTORY_TEXT,
    address: row.address,
    latitude: nullableValueToString(row.latitude),
    longitude: nullableValueToString(row.longitude),
    regionCode: row.province_region,
    regionName: row.province_region,
    provinceCode: row.province_id,
    provinceName: row.province_name,
    province: row.province_name,
    districtCode: null,
    districtName: null,
    industrialAreaType: industrialArea.type,
    industrialAreaTypeLabel: industrialArea.label,
    industrialEstateCode: row.industrial_estate_code,
    industrialEstateName: row.industrial_estate_name,
    isEligible,
    eligibilityStatus: isEligible ? 'เข้าข่าย' : 'ไม่เข้าข่าย',
    isActive: toNullableBoolean(row.is_active) ?? false,
  };
}

function toIndustrialArea(
  industrialEstateCode: string | null,
  industrialEstateName: string | null,
): {
  type: 'INDUSTRIAL_ESTATE' | 'OUTSIDE_INDUSTRIAL_ESTATE';
  label: 'ในนิคมอุตสาหกรรม' | 'นอกนิคมอุตสาหกรรม';
} {
  return industrialEstateCode || industrialEstateName
    ? { type: 'INDUSTRIAL_ESTATE', label: 'ในนิคมอุตสาหกรรม' }
    : { type: 'OUTSIDE_INDUSTRIAL_ESTATE', label: 'นอกนิคมอุตสาหกรรม' };
}

function toFactoryGeneralDTO(row: FactoryGeneralRow): FactoryGeneralDTO {
  const { factoryClass, factorySubclass } = splitFactoryTypeSequence(row.factory_type_sequence);
  return {
    id: Number(row.id),
    factoryId: row.fid,
    factoryName: row.name,
    newRegistrationNo: row.code,
    oldRegistrationNo: row.factory_registration_no_old,
    industryType: row.system_detail,
    industryMainOrder: factoryClass ?? TEMPORARY_FACTORY_TEXT,
    industrySubOrder: factorySubclass ?? TEMPORARY_FACTORY_TEXT,
    businessActivity: row.business_activity,
    eia:
      toNullableBoolean(row.has_eia) === null
        ? TEMPORARY_EIA_LABEL
        : toNullableBoolean(row.has_eia)
          ? 'มี'
          : 'ไม่มี',
    projectName: TEMPORARY_FACTORY_TEXT,
    address: row.address,
    latitude: nullableValueToString(row.latitude),
    longitude: nullableValueToString(row.longitude),
    province: row.province_name,
    juristicId: row.juristic_id,
    juristicName: row.juristic_name,
    industrialEstateName: row.industrial_estate_name,
    systemId: toNullableNumber(row.system_id),
    systemDetail: row.system_detail,
    verifyStatus: toNullableNumber(row.verify_status),
    authorizeStart: toNullableDateString(row.authorize_start),
    authorizeEnd: toNullableDateString(row.authorize_end),
    operationStatus: row.operation_status,
    capitalAmount: toNullableNumber(row.capital_amount),
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
    productionCapacity: row.production_capacity,
    wastewaterDischargeInfo: row.wastewater_discharge_info,
    boilerCount: toNullableNumber(row.boiler_count),
    boilerSizeEach: row.boiler_size_each,
    fuelUsed: row.fuel_used,
    hasEia: toNullableBoolean(row.has_eia),
    isEligible: row.eligible_factory_id !== null && row.eligible_factory_id !== undefined,
    eligibleFactoryId: toNullableNumber(row.eligible_factory_id),
    formDefaults: {
      factoryId: row.fid,
      factoryName: row.name,
      factoryRegistrationNo: row.code,
    },
  };
}

function splitFactoryTypeSequence(value: string | null): {
  factoryClass: string | null;
  factorySubclass: string | null;
} {
  if (!value) return { factoryClass: null, factorySubclass: null };
  const [factoryClass, factorySubclass] = value.split(' / ', 2);
  const normalizedFactoryClass = normalizeFactoryMainTypeCode(factoryClass);
  const normalizedFactorySubclass =
    factorySubclass
      ?.split(/[,\s/|;]+/)
      .map(normalizeFactoryMainTypeCode)
      .filter((code): code is string => Boolean(code && code !== normalizedFactoryClass))
      .join(',') || null;

  return {
    factoryClass: normalizedFactoryClass,
    factorySubclass: normalizedFactorySubclass,
  };
}

function normalizeFactoryMainTypeCode(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  if (!digits) {
    return text.length > FACTORY_TYPE_CODE_LENGTH
      ? text.slice(-FACTORY_TYPE_CODE_LENGTH)
      : text.padStart(FACTORY_TYPE_CODE_LENGTH, '0');
  }
  return digits.slice(-FACTORY_TYPE_CODE_LENGTH).padStart(FACTORY_TYPE_CODE_LENGTH, '0');
}

function isString(value: string | null): value is string {
  return value !== null;
}

function normalizeLookupText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeEmailList(values: string[]): string[] {
  const emails = new Set<string>();
  values.forEach((value) => {
    const email = value.trim();
    if (email) emails.add(email);
  });
  return [...emails];
}

function isTuple(value: [string, string] | null): value is [string, string] {
  return value !== null;
}

async function findByIdInTransaction(
  trx: Knex.Transaction,
  id: number,
): Promise<ConnectionRequestDTO | null> {
  const row = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
    .where('id', id)
    .whereNull('deleted_at')
    .first();
  return row ? hydrate(row, trx) : null;
}

async function hydrate(
  row: ConnectionRequestRow,
  trx?: Knex.Transaction,
): Promise<ConnectionRequestDTO> {
  const executor = trx ?? db;
  const requestId = Number(row.id);
  const [pointRows, historyRows, snapshotRow] = await Promise.all([
    executor<MeasurementPointRow>('cems_wpms_measurement_points')
      .where('request_id', requestId)
      .whereNull('deleted_at')
      .orderBy('id', 'asc'),
    executor<StatusHistoryRow>('cems_wpms_request_status_history')
      .leftJoin(
        'users as changed_by_user',
        'changed_by_user.id',
        'cems_wpms_request_status_history.changed_by',
      )
      .where('request_id', requestId)
      .select(
        'cems_wpms_request_status_history.id',
        'cems_wpms_request_status_history.request_id',
        'cems_wpms_request_status_history.status',
        'cems_wpms_request_status_history.note',
        'cems_wpms_request_status_history.changed_by',
        'cems_wpms_request_status_history.changed_at',
        'changed_by_user.username as changed_by_username',
        'changed_by_user.prename_th as changed_by_prename_th',
        'changed_by_user.first_name as changed_by_first_name',
        'changed_by_user.last_name as changed_by_last_name',
      )
      .orderBy('cems_wpms_request_status_history.changed_at', 'asc')
      .orderBy('cems_wpms_request_status_history.id', 'asc'),
    executor<RequestFactorySnapshotRow>('cems_wpms_request_factory_snapshots')
      .where('request_id', requestId)
      .whereNull('deleted_at')
      .first(),
  ]);

  return toConnectionRequestDTO(row, pointRows, historyRows, snapshotRow ?? null);
}

async function hydrateMany(rows: ConnectionRequestRow[]): Promise<ConnectionRequestDTO[]> {
  if (rows.length === 0) return [];

  const requestIds = rows.map((row) => Number(row.id));
  const [pointRows, historyRows, snapshotRows] = await Promise.all([
    db<MeasurementPointRow>('cems_wpms_measurement_points')
      .whereIn('request_id', requestIds)
      .whereNull('deleted_at')
      .orderBy('request_id', 'asc')
      .orderBy('id', 'asc'),
    db<StatusHistoryRow>('cems_wpms_request_status_history')
      .leftJoin(
        'users as changed_by_user',
        'changed_by_user.id',
        'cems_wpms_request_status_history.changed_by',
      )
      .whereIn('request_id', requestIds)
      .select(
        'cems_wpms_request_status_history.id',
        'cems_wpms_request_status_history.request_id',
        'cems_wpms_request_status_history.status',
        'cems_wpms_request_status_history.note',
        'cems_wpms_request_status_history.changed_by',
        'cems_wpms_request_status_history.changed_at',
        'changed_by_user.username as changed_by_username',
        'changed_by_user.prename_th as changed_by_prename_th',
        'changed_by_user.first_name as changed_by_first_name',
        'changed_by_user.last_name as changed_by_last_name',
      )
      .orderBy('cems_wpms_request_status_history.request_id', 'asc')
      .orderBy('cems_wpms_request_status_history.changed_at', 'asc')
      .orderBy('cems_wpms_request_status_history.id', 'asc'),
    db<RequestFactorySnapshotRow>('cems_wpms_request_factory_snapshots')
      .whereIn('request_id', requestIds)
      .whereNull('deleted_at'),
  ]);

  const pointsByRequestId = groupRowsByRequestId(pointRows);
  const historyByRequestId = groupRowsByRequestId(historyRows);
  const snapshotsByRequestId = new Map(
    snapshotRows.map((snapshot) => [Number(snapshot.request_id), snapshot]),
  );

  return rows.map((row) => {
    const requestId = Number(row.id);
    return toConnectionRequestDTO(
      row,
      pointsByRequestId.get(requestId) ?? [],
      historyByRequestId.get(requestId) ?? [],
      snapshotsByRequestId.get(requestId) ?? null,
    );
  });
}

function groupRowsByRequestId<T extends { request_id: number | string }>(
  rows: T[],
): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  rows.forEach((row) => {
    const requestId = Number(row.request_id);
    grouped.set(requestId, [...(grouped.get(requestId) ?? []), row]);
  });
  return grouped;
}

function toConnectionRequestDTO(
  row: ConnectionRequestRow,
  pointRows: MeasurementPointRow[],
  historyRows: StatusHistoryRow[],
  snapshotRow: RequestFactorySnapshotRow | null = null,
): ConnectionRequestDTO {
  const statusTimeline = buildStatusHistoryTimeline(historyRows);
  const environmentalAssessment = resolveStoredConnectionRequestEia({
    eiaAssessment: row.eia_assessment,
    eiaOther: row.eia_other,
    hasEia: row.has_eia,
  });
  return {
    id: Number(row.id),
    eligibleFactoryId: toNullableNumber(row.eligible_factory_id),
    requestNo: row.request_no,
    submissionSource: row.submission_source ?? CONNECTION_REQUEST_SUBMISSION_SOURCE.OPERATOR_FORM,
    requestType: row.request_type ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    requestTypeLabel:
      CONNECTION_REQUEST_TYPE_LABELS[row.request_type ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION],
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    industryMainOrder: row.industry_main_order,
    industryMainOrderLabel: snapshotRow?.factory_main_type_label ?? null,
    industrySubOrder: row.industry_sub_order,
    businessActivity: row.business_activity,
    eia: environmentalAssessment.eia,
    eiaOther: environmentalAssessment.eiaOther,
    hasEia: environmentalAssessment.hasEia,
    projectName: row.project_name,
    address: row.address,
    regionCode: snapshotRow?.region_code ?? null,
    regionName: snapshotRow?.region_name ?? null,
    provinceCode: snapshotRow?.province_code ?? null,
    provinceName: snapshotRow?.province_name ?? null,
    districtCode: snapshotRow?.district_code ?? null,
    districtName: snapshotRow?.district_name ?? null,
    subdistrictCode: snapshotRow?.subdistrict_code ?? null,
    subdistrictName: snapshotRow?.subdistrict_name ?? null,
    industrialEstateCode: snapshotRow?.industrial_estate_code ?? null,
    industrialEstateName: snapshotRow?.industrial_estate_name ?? null,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    systemType: row.system_type,
    status: row.status,
    statusLabel: CONNECTION_REQUEST_STATUS_LABELS[row.status],
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    contactPersons: toContactPersons(row),
    notificationEmails: toNotificationEmails(row),
    officerNotificationEmails: toOfficerNotificationEmails(row),
    informationProviderName: row.information_provider_name,
    informationProviderPosition: row.information_provider_position,
    remarks: row.remarks,
    revisionReason: row.revision_reason,
    officerNote: row.officer_note,
    connectionDueAt: toNullableIsoString(row.connection_due_at),
    confirmedAt: toNullableIsoString(row.confirmed_at),
    verifiedAt: toNullableIsoString(row.verified_at),
    measurementPoints: pointRows.map(toMeasurementPointDTO),
    statusHistory: statusTimeline.statusHistory,
    statusDurationSummary: statusTimeline.statusDurationSummary,
    createdBy: Number(row.created_by),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toRequestRow(input: CreateConnectionRequestInput): Record<string, unknown> {
  const hasEia = input.eia ? deriveHasEiaFromAssessment(input.eia) : (input.hasEia ?? null);
  return {
    eligible_factory_id: input.eligibleFactoryId ?? null,
    factory_id: input.factoryId,
    factory_name: input.factoryName,
    factory_registration_no: input.factoryRegistrationNo,
    industry_main_order: input.industryMainOrder ?? null,
    industry_sub_order: input.industrySubOrder ?? null,
    business_activity: input.businessActivity ?? null,
    eia_assessment: input.eia ?? null,
    eia_other: input.eia === 'อื่นๆ' ? (input.eiaOther ?? null) : null,
    has_eia: hasEia,
    project_name: input.projectName ?? null,
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    system_type: input.systemType,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail ?? null,
    contact_persons_json:
      input.contactPersons && input.contactPersons.length > 0
        ? JSON.stringify(input.contactPersons)
        : null,
    notification_emails_json:
      input.notificationEmails && input.notificationEmails.length > 0
        ? JSON.stringify(input.notificationEmails)
        : null,
    officer_notification_emails_json:
      input.officerNotificationEmails && input.officerNotificationEmails.length > 0
        ? JSON.stringify(input.officerNotificationEmails)
        : null,
    information_provider_name: input.informationProviderName ?? null,
    information_provider_position: input.informationProviderPosition ?? null,
    remarks: input.remarks ?? null,
  };
}

export function toRequestRowForTests(input: CreateConnectionRequestInput): Record<string, unknown> {
  return toRequestRow(input);
}

async function upsertFactorySnapshot(
  trx: Knex.Transaction,
  requestId: number,
  input: CreateConnectionRequestInput,
  actorUserId: number,
): Promise<void> {
  const source = await findFactorySnapshotSource(trx, input);
  const snapshotRow = toFactorySnapshotInsertRow(requestId, input, source, actorUserId);

  await trx('cems_wpms_request_factory_snapshots')
    .where('request_id', requestId)
    .whereNull('deleted_at')
    .update({
      deleted_at: trx.fn.now(),
      updated_by: actorUserId,
      updated_at: trx.fn.now(),
    });

  await trx('cems_wpms_request_factory_snapshots').insert(snapshotRow);
}

async function findFactorySnapshotSource(
  trx: Knex.Transaction,
  input: CreateConnectionRequestInput,
): Promise<FactorySnapshotSourceRow | null> {
  return (
    (await trx<FactorySnapshotSourceRow>('factories as f')
      .leftJoin('provinces as p', 'p.id', 'f.province_id')
      .leftJoin('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
      .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
        this.on(function joinFactoryKeys() {
          this.on('ef.factory_registration_no_new', '=', 'f.code')
            .orOn('ef.factory_registration_no_new', '=', 'f.fid')
            .orOn('ef.source_factory_id', '=', 'f.fid')
            .orOn('ef.source_factory_id', '=', 'f.code');
        }).andOnNull('ef.deleted_at');
      })
      .whereNull('f.deleted_at')
      .where((builder) => {
        builder
          .where('f.fid', input.factoryId)
          .orWhere('f.code', input.factoryId)
          .orWhere('f.code', input.factoryRegistrationNo)
          .orWhere('ef.source_factory_id', input.factoryId)
          .orWhere('ef.factory_registration_no_new', input.factoryRegistrationNo);
      })
      .select(
        'f.province_id',
        'p.name_th as province_name',
        'p.region as province_region',
        'ie.code as industrial_estate_code',
        'ie.name_th as industrial_estate_name',
      )
      .first()) ?? null
  );
}

function toFactorySnapshotInsertRow(
  requestId: number,
  input: CreateConnectionRequestInput,
  source: FactorySnapshotSourceRow | null,
  actorUserId: number,
): Record<string, unknown> {
  const regionName = input.regionName ?? source?.province_region ?? null;
  return {
    request_id: requestId,
    region_code: input.regionCode ?? regionName,
    region_name: regionName,
    province_code: input.provinceCode ?? source?.province_id ?? null,
    province_name: input.provinceName ?? source?.province_name ?? null,
    district_code: input.districtCode ?? null,
    district_name: input.districtName ?? null,
    subdistrict_code: input.subdistrictCode ?? null,
    subdistrict_name: input.subdistrictName ?? null,
    industrial_estate_code: input.industrialEstateCode ?? source?.industrial_estate_code ?? null,
    industrial_estate_name: input.industrialEstateName ?? source?.industrial_estate_name ?? null,
    factory_main_type_code: input.industryMainOrder ?? null,
    factory_main_type_label: input.industryMainOrderLabel ?? null,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

async function insertMeasurementPoints(
  trx: Knex.Transaction,
  requestId: number,
  points: MeasurementPointInput[],
  actorUserId: number,
): Promise<void> {
  await trx('cems_wpms_measurement_points').insert(
    points.map((point) => toMeasurementPointInsertRow(requestId, point, actorUserId)),
  );
}

async function insertDirectMeasurementPoint(
  trx: Knex.Transaction,
  requestId: number,
  point: MeasurementPointInput,
  actorUserId: number,
): Promise<number> {
  const [{ id }] = await trx('cems_wpms_measurement_points')
    .insert(toMeasurementPointInsertRow(requestId, point, actorUserId))
    .returning('id');

  return Number(id);
}

function toMeasurementPointInsertRow(
  requestId: number,
  point: MeasurementPointInput,
  actorUserId: number,
): Record<string, unknown> {
  return {
    request_id: requestId,
    point_name: point.pointName,
    point_code: point.pointCode ?? null,
    point_type: point.pointType,
    latitude: point.latitude ?? null,
    longitude: point.longitude ?? null,
    parameters_json: JSON.stringify(point.parameters ?? []),
    description: point.description ?? null,
    details_json: point.details ? JSON.stringify(point.details) : null,
    documents_json:
      point.documentsAndImages && point.documentsAndImages.length > 0
        ? JSON.stringify(point.documentsAndImages)
        : null,
    instruments_json: point.measurementInstruments
      ? JSON.stringify(point.measurementInstruments)
      : null,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function getConnectedMeasurementPointParameters(point: MeasurementPointDTO): string[] {
  const instrumentParameters =
    point.measurementInstruments?.parameters
      ?.map((parameter) => parameter.parameter)
      .filter((parameter): parameter is string => Boolean(parameter)) ?? [];
  return instrumentParameters.length > 0 ? instrumentParameters : point.parameters;
}

const SOFT_DELETE_DUPLICATE_ACTIVE_MEASUREMENT_POINTS_SQL = `
WITH ranked_points AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY request_id, LOWER(LTRIM(RTRIM(point_name)))
      ORDER BY
        CASE WHEN NULLIF(LTRIM(RTRIM(point_code)), '') IS NULL THEN 1 ELSE 0 END,
        id ASC
    ) AS duplicate_rank
  FROM cems_wpms_measurement_points
  WHERE request_id = ?
    AND deleted_at IS NULL
)
UPDATE mp
SET
  deleted_at = SYSDATETIME(),
  updated_at = SYSDATETIME(),
  updated_by = ?
FROM cems_wpms_measurement_points AS mp
JOIN ranked_points AS ranked
  ON ranked.id = mp.id
WHERE ranked.duplicate_rank > 1;
`;

export function buildDuplicateActiveMeasurementPointCleanupSqlForTests(): string {
  return SOFT_DELETE_DUPLICATE_ACTIVE_MEASUREMENT_POINTS_SQL;
}

async function softDeleteDuplicateActiveMeasurementPoints(
  trx: Knex.Transaction,
  requestId: number,
  actorUserId: number,
): Promise<void> {
  await trx.raw(SOFT_DELETE_DUPLICATE_ACTIVE_MEASUREMENT_POINTS_SQL, [requestId, actorUserId]);
}

async function findConnectedPointForMeasurementPoint(
  trx: Knex.Transaction,
  point: MeasurementPointDTO,
): Promise<ConnectedMeasurementPointRow | null> {
  const query = trx<ConnectedMeasurementPointRow>('cems_wpms_connected_measurement_points')
    .whereNull('deleted_at')
    .select('id', 'parameters_json');

  if (point.pointCode) {
    query.where('point_code', point.pointCode);
  } else {
    query.where('source_measurement_point_id', point.id);
  }

  return (await query.first()) ?? null;
}

async function softDeleteConnectedPoint(
  trx: Knex.Transaction,
  point: MeasurementPointDTO,
  actorUserId: number,
): Promise<void> {
  const query = trx('cems_wpms_connected_measurement_points').whereNull('deleted_at');

  if (point.pointCode) {
    query.where('point_code', point.pointCode);
  } else {
    query.where('source_measurement_point_id', point.id);
  }

  await query.update({
    deleted_at: trx.fn.now(),
    updated_at: trx.fn.now(),
    updated_by: actorUserId,
  });
}

function uniqueParameters(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

async function issuePointCodesForRequest(
  trx: Knex.Transaction,
  requestId: number,
  actorUserId: number,
): Promise<void> {
  const request = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
    .where('id', requestId)
    .whereNull('deleted_at')
    .forUpdate()
    .first('system_type', 'request_type');
  if (!request) return;
  if (request.request_type === CONNECTION_REQUEST_TYPE.ADD_PARAMETER) return;

  const points = await trx<MeasurementPointRow>('cems_wpms_measurement_points')
    .where('request_id', requestId)
    .whereNull('deleted_at')
    .where((builder) => builder.whereNull('point_code').orWhere('point_code', ''))
    .orderBy('id', 'asc')
    .select('id');
  if (points.length === 0) return;

  const pointCodes = await reservePointCodes(trx, request.system_type, points.length);
  await Promise.all(
    points.map((point, index) =>
      trx('cems_wpms_measurement_points').where('id', point.id).whereNull('deleted_at').update({
        point_code: pointCodes[index],
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      }),
    ),
  );
}

async function reservePointCodes(
  trx: Knex.Transaction,
  systemType: 'CEMS' | 'WPMS',
  quantity: number,
): Promise<string[]> {
  const prefix = systemType === 'CEMS' ? 'S' : 'W';
  let sequence = await trx<PointCodeSequenceRow>('cems_wpms_point_code_sequences')
    .where('system_type', systemType)
    .forUpdate()
    .first();

  if (!sequence) {
    await trx('cems_wpms_point_code_sequences').insert({
      system_type: systemType,
      prefix,
      last_sequence: 0,
    });
    sequence = await trx<PointCodeSequenceRow>('cems_wpms_point_code_sequences')
      .where('system_type', systemType)
      .forUpdate()
      .first();
  }

  const currentSequence = Math.max(
    Number(sequence?.last_sequence ?? 0),
    POINT_CODE_INITIAL_SEQUENCE,
  );
  const existingMaxSequence = await findMaxExistingPointCodeSequence(trx, prefix);
  const firstSequence = Math.max(currentSequence, existingMaxSequence) + 1;
  const lastSequence = firstSequence + quantity - 1;

  await trx('cems_wpms_point_code_sequences').where('system_type', systemType).update({
    last_sequence: lastSequence,
    updated_at: trx.fn.now(),
  });

  return Array.from(
    { length: quantity },
    (_, index) => `${prefix}${String(firstSequence + index).padStart(4, '0')}`,
  );
}

async function findMaxExistingPointCodeSequence(
  trx: Knex.Transaction,
  prefix: 'S' | 'W',
): Promise<number> {
  const rows = await trx<MeasurementPointRow>('cems_wpms_measurement_points')
    .whereNull('deleted_at')
    .where('point_code', 'like', `${prefix}%`)
    .select('point_code');

  return rows.reduce((maxSequence, row) => {
    const match = row.point_code?.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!match) return maxSequence;
    return Math.max(maxSequence, Number(match[1]));
  }, 0);
}

async function insertHistory(
  trx: Knex.Transaction,
  requestId: number,
  status: ConnectionRequestStatus,
  actorUserId: number,
  note: string | null,
): Promise<void> {
  await trx('cems_wpms_request_status_history').insert({
    request_id: requestId,
    status,
    note,
    changed_by: actorUserId,
  });
}

function buildStatusHistoryNote(update: StatusUpdate): string | null {
  const notes = [update.revisionReason, update.officerNote].filter((value): value is string =>
    Boolean(value),
  );
  return notes.length > 0 ? notes.join('\n') : null;
}

export function shouldIssueWaitingConnectionSideEffectsForTests(
  status: ConnectionRequestStatus,
  options: StatusUpdateOptions = {},
): boolean {
  return shouldIssueWaitingConnectionSideEffects(status, options);
}

export function buildStatusHistoryNoteForTests(update: StatusUpdate): string | null {
  return buildStatusHistoryNote(update);
}

function shouldIssueWaitingConnectionSideEffects(
  status: ConnectionRequestStatus,
  options: StatusUpdateOptions,
): boolean {
  return status === 'WAITING_CONNECTION' && (options.issueWaitingConnectionSideEffects ?? true);
}

function findAuditActorId(row: Pick<ConnectionRequestRow, 'created_by' | 'updated_by'>): number {
  return Number(row.updated_by ?? row.created_by);
}

async function ensureDirectPointCodeAvailable(
  trx: Knex.Transaction,
  pointCode: string,
): Promise<void> {
  const existing = await trx('cems_wpms_connected_measurement_points')
    .whereNull('deleted_at')
    .whereRaw('LOWER(LTRIM(RTRIM(point_code))) = LOWER(LTRIM(RTRIM(?)))', [pointCode])
    .first('id');
  if (existing) throw directPointCodeConflict(pointCode);
}

function directPointCodeConflict(pointCode: string): ConflictError {
  return new ConflictError('Measurement point code is already connected', {
    path: 'measurementPoints.0.pointCode',
    pointCode,
  });
}

function isActivePointCodeUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    number?: number;
    code?: number | string;
    message?: string;
    originalError?: { info?: { number?: number; message?: string }; message?: string };
  };
  const number = Number(
    candidate.number ?? candidate.code ?? candidate.originalError?.info?.number,
  );
  if (number !== 2601 && number !== 2627) return false;
  const message = [
    candidate.message,
    candidate.originalError?.message,
    candidate.originalError?.info?.message,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  return message.includes('uq_connected_points_point_code');
}

async function nextDirectRequestNo(
  trx: Knex.Transaction,
  systemType: 'CEMS' | 'WPMS',
  date: Date,
): Promise<string> {
  const buddhistYear = buddhistYearSuffix(date);
  const sequenceRow = await trx<{ last_sequence: number | string }>(
    'cems_wpms_direct_request_sequences',
  )
    .where({ system_type: systemType, buddhist_year: buddhistYear })
    .forUpdate()
    .first('last_sequence');
  if (!sequenceRow) {
    throw new Error(`Direct request sequence is not provisioned for ${systemType}-${buddhistYear}`);
  }

  const sequence = Number(sequenceRow.last_sequence) + 1;
  const requestNo = buildDirectRequestNo(systemType, sequence, date);
  await trx('cems_wpms_direct_request_sequences')
    .where({ system_type: systemType, buddhist_year: buddhistYear })
    .update({ last_sequence: sequence, updated_at: trx.fn.now() });
  return requestNo;
}

export function reserveDirectRequestNoForTests(
  trx: Knex.Transaction,
  systemType: 'CEMS' | 'WPMS',
  date: Date,
): Promise<string> {
  return nextDirectRequestNo(trx, systemType, date);
}

function buildDirectRequestNo(systemType: 'CEMS' | 'WPMS', sequence: number, date: Date): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99_999) {
    throw new RangeError('Direct connection request sequence must be between 1 and 99999');
  }
  const prefix = systemType === 'CEMS' ? 'OLDC' : 'OLDW';
  return `${prefix}-${buddhistYearSuffix(date)}-${String(sequence).padStart(5, '0')}`;
}

export function buildDirectRequestNoForTests(
  systemType: 'CEMS' | 'WPMS',
  sequence: number,
  date = new Date(),
): string {
  return buildDirectRequestNo(systemType, sequence, date);
}

async function nextRequestNo(trx: Knex.Transaction, systemType: 'CEMS' | 'WPMS'): Promise<string> {
  const prefix = buildRequestNoPrefix(systemType);
  const totalRow = await trx('cems_wpms_connection_requests')
    .where('request_no', 'like', `${prefix}-%`)
    .count<{ total: number | string }>('id as total')
    .first();
  const sequence = Number(totalRow?.total ?? 0) + 1;
  return `${prefix}-${String(sequence).padStart(5, '0')}`;
}

export function buildRequestNoPrefix(systemType: 'CEMS' | 'WPMS', date = new Date()): string {
  return `${systemType}-${buddhistYearSuffix(date)}`;
}

function buddhistYearSuffix(date: Date): string {
  const gregorianYear = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
    }).format(date),
  );
  return String((gregorianYear + 543) % 100).padStart(2, '0');
}

function toMeasurementPointDTO(row: MeasurementPointRow): MeasurementPointDTO {
  return {
    id: Number(row.id),
    pointName: row.point_name,
    pointCode: row.point_code,
    pointType: row.point_type,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    parameters: parseParameters(row.parameters_json),
    description: row.description,
    details: parseJsonObject(row.details_json),
    documentsAndImages: parseJsonArray<RequestDocumentImageInput>(row.documents_json),
    measurementInstruments: parseJsonObject<MeasurementInstrumentsInput>(row.instruments_json),
  };
}

function buildStatusHistoryTimeline(historyRows: StatusHistoryRow[]): {
  statusHistory: StatusHistoryDTO[];
  statusDurationSummary: StatusDurationSummaryDTO;
} {
  const statusHistory = historyRows.map((row, index) =>
    toStatusHistoryDTO(row, historyRows[index + 1] ?? null),
  );

  return {
    statusHistory,
    statusDurationSummary: toStatusDurationSummary(statusHistory),
  };
}

function toStatusHistoryDTO(
  row: StatusHistoryRow,
  nextRow: StatusHistoryRow | null,
): StatusHistoryDTO {
  const changedAt = toIsoString(row.changed_at);
  const nextChangedAt = nextRow ? toIsoString(nextRow.changed_at) : null;
  const isTerminal = TERMINAL_CONNECTION_REQUEST_STATUSES.includes(row.status);
  const endedAt = nextChangedAt ?? (isTerminal ? changedAt : null);
  const durationDays = endedAt ? countInclusiveDateDays(changedAt, endedAt) : null;
  return {
    id: Number(row.id),
    status: row.status,
    statusLabel: CONNECTION_REQUEST_STATUS_LABELS[row.status],
    note: row.note,
    changedById: Number(row.changed_by),
    changedBy: toChangedByName(row),
    changedAt,
    endedAt,
    durationDays,
    durationText: durationDays === null ? null : `${durationDays} วัน`,
    isTerminal,
  };
}

function toStatusDurationSummary(statusHistory: StatusHistoryDTO[]): StatusDurationSummaryDTO {
  const first = statusHistory[0] ?? null;
  const last = statusHistory[statusHistory.length - 1] ?? null;
  const canCloseSummary = Boolean(first && last?.isTerminal);
  const totalDurationDays =
    canCloseSummary && first && last
      ? countInclusiveDateDays(first.changedAt, last.changedAt)
      : null;

  return {
    startedAt: first?.changedAt ?? null,
    startDate: first ? toDatePart(first.changedAt) : null,
    startStatus: first?.status ?? null,
    startStatusLabel: first?.statusLabel ?? null,
    endedAt: canCloseSummary ? (last?.changedAt ?? null) : null,
    endDate: canCloseSummary && last ? toDatePart(last.changedAt) : null,
    endStatus: last?.status ?? null,
    endStatusLabel: last?.statusLabel ?? null,
    isTerminal: Boolean(last?.isTerminal),
    terminalStatuses: [...TERMINAL_CONNECTION_REQUEST_STATUSES],
    totalDurationDays,
    totalDurationText: totalDurationDays === null ? null : `${totalDurationDays} วัน`,
  };
}

function toChangedByName(row: StatusHistoryRow): string {
  const firstNameWithPrefix = [row.changed_by_prename_th, row.changed_by_first_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('');
  const fullName = [firstNameWithPrefix, row.changed_by_last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim();

  if (fullName) return fullName;
  if (row.changed_by_username?.trim()) return row.changed_by_username.trim();
  return `User #${Number(row.changed_by)}`;
}

function countInclusiveDateDays(startAt: string, endAt: string): number {
  const start = toUtcDateStart(toDatePart(startAt));
  const end = toUtcDateStart(toDatePart(endAt));
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function toUtcDateStart(datePart: string): Date {
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDatePart(value: string): string {
  return value.slice(0, 10);
}

function toContactPersons(row: ConnectionRequestRow): ContactPersonInput[] {
  const contacts = parseJsonArray<ContactPersonInput>(row.contact_persons_json).filter(
    (contact) => contact.name && contact.phone,
  );
  if (contacts.length > 0) return contacts;
  return [
    {
      name: row.contact_name,
      phone: row.contact_phone,
      email: row.contact_email,
      position: null,
    },
  ];
}

function toNotificationEmails(row: ConnectionRequestRow): string[] {
  const emails = parseJsonArray<string>(row.notification_emails_json).filter(
    (email) => typeof email === 'string' && email.length > 0,
  );
  if (emails.length > 0) return emails;
  return row.contact_email ? [row.contact_email] : [];
}

function toOfficerNotificationEmails(row: ConnectionRequestRow): string[] {
  return parseJsonArray<string>(row.officer_notification_emails_json).filter(
    (email) => typeof email === 'string' && email.length > 0,
  );
}

function parseParameters(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends object = MeasurementPointDetailsInput>(
  value: string | null,
): T | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    return null;
  }
  return null;
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  return Number(value);
}

function toNullableBoolean(value: boolean | number | null): boolean | null {
  if (value === null) return null;
  return Boolean(value);
}

function nullableValueToString(value: number | string | null): string | null {
  if (value === null) return null;
  return String(value);
}

function toNullableDateString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  return toIsoString(value);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
