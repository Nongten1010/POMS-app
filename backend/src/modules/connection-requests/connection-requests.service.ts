import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { isAnnualMonitoringPointCode } from '../../shared/utils/monitoring-point-code';
import { toCanonicalStatusDateTime } from '../device-connections/device-connection-status-datetime';
import { deviceConnectionsService } from '../device-connections/device-connections.service';
import type {
  CreateDeviceConnectionConfigInput,
  CreateDeviceConnectionConfigsInput,
  DeviceConnectionConfigDTO,
} from '../device-connections/device-connections.types';
import { measurementDisplayValue } from '../parameter-values/parameter-status';
import { parameterValuesService } from '../parameter-values/parameter-values.service';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { resolveAssignedRegions } from '../auth/regional-access';
import { eligibleFactoriesService } from '../eligible-factories/eligible-factories.service';
import type { SelectedEligibleFactoryDTO } from '../eligible-factories/eligible-factories.types';
import type {
  CalendarStatusDetailsQuerySchemaInput,
  CalendarStatusQuerySchemaInput,
  MeasurementCsvExportQuerySchemaInput,
  MeasurementStatisticsQuerySchemaInput,
} from '../parameter-values/parameter-values.validator';
import type { ParameterEvaluationOptions } from '../parameter-values/parameter-values.types';
import { connectionRequestsRepository } from './connection-requests.repository';
import {
  CANCELLABLE_CONNECTION_REQUEST_STATUSES,
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_STATUS_LABELS,
  CONNECTION_REQUEST_SUBMISSION_SOURCE,
  CONNECTION_REQUEST_TYPE,
  POMS_MEMBERSHIP_STATUS,
  type AddParameterFormDetailDTO,
  type AddMeasurementPointRequestInput,
  type AddParameterRequestInput,
  type CancelConnectionRequestInput,
  type ChangeConnectionRequestStatusInput,
  type ConnectedMeasurementPointDetailDTO,
  type ConnectionSystemType,
  type ConfirmConnectionInput,
  type ConnectionRequestDTO,
  type ConnectionRequestDetailDTO,
  type ConnectionRequestStatus,
  type ConnectionRequestTableRowDTO,
  type ConnectionRequestType,
  type ConnectedMeasurementPointModalDetailDTO,
  type CreateConnectionRequestInput,
  type CurrentFactoryMeasurementPointDTO,
  type DeviceConfigFormConnectionDTO,
  type DeviceConfigFormDetailDTO,
  type DeviceConfigFormParameterMappingDTO,
  type DeviceConfigPayloadResponseDTO,
  type DirectConnectionRequestInput,
  type FactoryGeneralDTO,
  type FactoryFavoriteDTO,
  type FactorySummaryDTO,
  type ListConnectedMeasurementPointsQuery,
  type ListConnectionRequestsQuery,
  type ListOperatorFactoriesQuery,
  type ListOperatorFactoryOverviewQuery,
  type ListPublicFactoryMapPointsQuery,
  type MeasurementInstrumentsInput,
  type MeasurementPointDetailsInput,
  type MeasurementPointDTO,
  type MeasurementPointInput,
  type OperatorFactoryDashboardRowDTO,
  type OperatorFactoryMeasurementPointDTO,
  type OperatorFactoryOverviewResultDTO,
  type OperatorFactoryOverviewRowDTO,
  type OperatorFactoryParameterStandardDTO,
  type OperatorFactoryTableRowDTO,
  type PaginatedConnectionRequestsDTO,
  type PaginatedTableRowsDTO,
  type PublicFactoryMapPointDTO,
  type ResubmitConnectionRequestInput,
  type ReviewConnectionRequestInput,
  type VerifyConnectionInput,
} from './connection-requests.types';
import { resubmitConnectionRequestWithTypeSchema } from './connection-requests.validator';

const DESIGN_REVIEW_STATUSES: ConnectionRequestStatus[] = [
  CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
  CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
];

let nowProvider = () => new Date();

const CONNECTION_TIMEOUT_AUTO_CANCEL_NOTE =
  'ระบบยกเลิกคำขออัตโนมัติเนื่องจากครบกำหนดเชื่อมต่อ 30 วัน';

const FACTORY_LOGO_DOCUMENT_TITLE = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท';
const FACTORY_LOGO_DOCUMENT_INDEX = 3;
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const bangkokDateHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

export interface DirectConnectionActorContext {
  actorUserId: number;
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
  scope: AccessScope;
  regionalAccess?: RegionalAccessDTO | null;
}

export interface MeasurementPointSubmissionActorContext {
  actorUserId: number;
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
  editScope?: AccessScope;
  directConnectScope?: AccessScope;
  regionalAccess?: RegionalAccessDTO | null;
}

export const connectionRequestsService = {
  setClockForTests(provider: () => Date): void {
    nowProvider = provider;
  },

  async list(
    query: ListConnectionRequestsQuery,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedConnectionRequestsDTO> {
    const { rows, total } = await connectionRequestsRepository.list(query, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    return { data: rows, meta: { total } };
  },

  async listTableRows(
    query: ListConnectionRequestsQuery,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<ConnectionRequestTableRowDTO>> {
    const { rows, total } = await connectionRequestsRepository.list(query, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
      useAssignedFactoryAccess: true,
    });
    const [factoryMap, currentPomsFactoryNames] = await Promise.all([
      connectionRequestsRepository.findFactorySummariesForRequests(rows),
      connectionRequestsRepository.findCurrentPomsFactoryNamesForRequests(rows),
    ]);
    return {
      data: rows.map((request) =>
        toRequestTableRow(
          request,
          findFactorySummary(request, factoryMap),
          currentPomsFactoryNames.get(request.factoryId) ??
            currentPomsFactoryNames.get(request.factoryRegistrationNo) ??
            null,
        ),
      ),
      meta: { total },
    };
  },

  async listDetails(
    query: ListConnectionRequestsQuery,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<ConnectionRequestDetailDTO>> {
    const { rows, total } = await connectionRequestsRepository.list(query, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
      useAssignedFactoryAccess: true,
    });
    const factoryMap = await connectionRequestsRepository.findFactorySummariesForRequests(rows);
    const data = await Promise.all(
      rows.map(async (request) => {
        const deviceConfigs = await deviceConnectionsService.listByRequestId(request.id);
        return {
          ...request,
          factory: findFactorySummary(request, factoryMap),
          deviceConfigs: toDeviceConfigPayloadGroups(deviceConfigs),
        };
      }),
    );

    return { data, meta: { total } };
  },

  async listOperatorFactories(
    actorUserId: number,
    factoryViewScope: AccessScope,
    query: ListOperatorFactoriesQuery = {},
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<OperatorFactoryTableRowDTO>> {
    void query;
    const factories = await connectionRequestsRepository.listFactoriesForAccess({
      actorUserId,
      scope: factoryViewScope,
      regionalAccess,
    });
    const eligibleFactories = factories.filter((factory) => factory.isEligible === true);
    const factoryIdByLookupKey = buildFactoryLookupKeyMap(eligibleFactories);
    const factoryLookupKeys = [...factoryIdByLookupKey.keys()];
    const [requests, connectedPoints] = await Promise.all([
      connectionRequestsRepository.listRequestsForFactories(
        eligibleFactories.map((factory) => factory.factoryId),
      ),
      connectionRequestsRepository.listConnectedMeasurementPointsForFactories(factoryLookupKeys),
    ]);
    const officerNotificationEmailsByFactory =
      await connectionRequestsRepository.listOfficerNotificationEmailsForFactories(
        eligibleFactories.map((factory) => ({
          factoryId: factory.factoryId,
          provinceName: factory.provinceName ?? factory.province,
          industrialAreaType: factory.industrialAreaType ?? 'OUTSIDE_INDUSTRIAL_ESTATE',
        })),
      );
    const latestRequestByFactory = new Map<string, ConnectionRequestDTO>();
    const connectedPointCountByFactory = new Map<string, number>();

    connectedPoints.forEach((point) => {
      const factoryId = factoryIdByLookupKey.get(point.factoryId) ?? point.factoryId;
      connectedPointCountByFactory.set(
        factoryId,
        (connectedPointCountByFactory.get(factoryId) ?? 0) + 1,
      );
    });

    requests.forEach((request) => {
      if (!latestRequestByFactory.has(request.factoryId)) {
        latestRequestByFactory.set(request.factoryId, request);
      }
    });

    const data = factories
      .map<OperatorFactoryTableRowDTO>((factory) => {
        if (factory.isEligible !== true) {
          return toNonEligibleOperatorFactoryTableRow(factory);
        }

        const latestRequest = latestRequestByFactory.get(factory.factoryId);
        return {
          id: factory.id,
          factoryId: factory.factoryId,
          factoryName: factory.factoryName,
          newRegistrationNo: factory.newRegistrationNo,
          oldRegistrationNo: factory.oldRegistrationNo,
          industryType: factory.industryType,
          industryMainOrder: factory.industryMainOrder,
          industrySubOrder: factory.industrySubOrder,
          businessActivity: factory.businessActivity,
          eia: factory.eia,
          projectName: factory.projectName,
          address: factory.address,
          latitude: factory.latitude,
          longitude: factory.longitude,
          province: factory.province,
          officerNotificationEmails:
            officerNotificationEmailsByFactory.get(factory.factoryId) ?? [],
          isEligible: factory.isEligible ?? false,
          eligibilityStatus: factory.eligibilityStatus ?? 'ไม่เข้าข่าย',
          monitoringPointCount: connectedPointCountByFactory.get(factory.factoryId) ?? 0,
          requestStatusCode: latestRequest?.status ?? null,
          status: 'แสดง',
        };
      })
      .filter((factory) => factory.status === 'แสดง');

    return { data, meta: { total: data.length } };
  },

  async listOfficerEligibleFactories(
    actorUserId: number,
    viewScope: AccessScope,
    query: ListOperatorFactoriesQuery = {},
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<OperatorFactoryTableRowDTO>> {
    const result = await eligibleFactoriesService.list(
      {},
      { actorUserId, scope: viewScope, regionalAccess },
    );
    const accessibleFactories = result.data;
    const factoryIdByLookupKey = buildEligibleFactoryLookupKeyMap(accessibleFactories);
    const connectedPoints =
      await connectionRequestsRepository.listConnectedMeasurementPointsForFactories([
        ...factoryIdByLookupKey.keys(),
      ]);
    const measurementPointsByFactory = mapConnectedMeasurementPointsToEligibleFactories(
      connectedPoints,
      factoryIdByLookupKey,
    );
    const eligibleFactories = filterEligibleFactoryRowsByQuery(
      accessibleFactories,
      query,
      measurementPointsByFactory,
    );
    const officerNotificationEmailsByFactory =
      await connectionRequestsRepository.listOfficerNotificationEmailsForFactories(
        eligibleFactories.map((factory) => ({
          factoryId: factory.factoryId,
          provinceName: factory.provinceName,
          industrialAreaType: factory.industrialEstateName
            ? 'INDUSTRIAL_ESTATE'
            : 'OUTSIDE_INDUSTRIAL_ESTATE',
        })),
      );

    const data = eligibleFactories.map<OperatorFactoryTableRowDTO>((factory) => ({
      ...toOfficerEligibleFactoryTableRow(factory),
      officerNotificationEmails: officerNotificationEmailsByFactory.get(factory.factoryId) ?? [],
      monitoringPointCount: filterMeasurementPointsBySystem(
        measurementPointsByFactory.get(factory.factoryId) ?? [],
        query.systemType,
      ).length,
    }));

    return { data, meta: { total: data.length } };
  },

  async listOperatorFactoryDashboard(
    actorUserId: number,
    factoryViewScope: AccessScope,
    query: ListOperatorFactoriesQuery = {},
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<OperatorFactoryDashboardRowDTO>> {
    const factories = await connectionRequestsRepository.listFactoriesForAccess({
      actorUserId,
      scope: factoryViewScope,
      regionalAccess,
      connectedPomsOnly: query.connectedOnly === true,
    });
    const visibleFactories = factories.filter((factory) => factory.isActive !== false);
    const eligibleVisibleFactories = visibleFactories.filter(
      (factory) => factory.isEligible === true,
    );
    const factoryIdByLookupKey = buildFactoryLookupKeyMap(eligibleVisibleFactories);
    const factoryIdByEligibleFactoryId = buildEligibleFactoryIdMap(eligibleVisibleFactories);
    const factoryLookupKeys = [...factoryIdByLookupKey.keys()];
    const eligibleFactoryIds = [...factoryIdByEligibleFactoryId.keys()];
    const [connectedPoints, favoriteFactoryIds] = await Promise.all([
      eligibleFactoryIds.length > 0
        ? connectionRequestsRepository.listConnectedMeasurementPointsForFactories(
            factoryLookupKeys,
            eligibleFactoryIds,
          )
        : connectionRequestsRepository.listConnectedMeasurementPointsForFactories(
            factoryLookupKeys,
          ),
      connectionRequestsRepository.listFavoriteFactoryIds(actorUserId),
    ]);
    const favoriteFactoryIdSet = new Set(favoriteFactoryIds);
    const factoryMainTypeLabels =
      await listFactoryMainTypeLabelsForDashboard(eligibleVisibleFactories);
    const measurementPointsByFactory = mapConnectedMeasurementPointsToDashboardFactories(
      connectedPoints,
      factoryIdByLookupKey,
      factoryIdByEligibleFactoryId,
    );

    const data = visibleFactories
      .map<OperatorFactoryDashboardRowDTO>((factory) => {
        const currentMeasurementPoints = measurementPointsByFactory.get(factory.factoryId) ?? [];
        const baseRow = toFactoryDashboardBaseRow(
          factory,
          currentMeasurementPoints,
          factoryMainTypeLabels,
        );
        return {
          ...baseRow,
          isFavorite: factory.isEligible === true && favoriteFactoryIdSet.has(factory.factoryId),
          hasLatestHourlyMeasurement: false,
        };
      })
      .filter((factory) => matchesOperatorFactoryDashboardQuery(factory, query));

    const dataWithLatestHourlyMeasurements = await populateLatestHourlyMeasurements(
      data,
      actorUserId,
      factoryViewScope,
    );

    return { data: dataWithLatestHourlyMeasurements, meta: { total: data.length } };
  },

  async listOperatorFactoryOverview(
    actorUserId: number,
    query: ListOperatorFactoryOverviewQuery = {},
  ): Promise<OperatorFactoryOverviewResultDTO> {
    const factories = await connectionRequestsRepository.listFactoriesForAccess({
      actorUserId,
      scope: 'OWN_FACTORY',
    });
    const visibleFactories = factories.filter((factory) => factory.isActive !== false);
    const factoryIdByLookupKey = buildFactoryLookupKeyMap(visibleFactories);
    const factoryIdByEligibleFactoryId = buildEligibleFactoryIdMap(visibleFactories);
    const factoryLookupKeys = [...factoryIdByLookupKey.keys()];
    const eligibleFactoryIds = [...factoryIdByEligibleFactoryId.keys()];
    const [connectedPoints, favoriteFactoryIds, requests, factoryMainTypeLabels] =
      await Promise.all([
        eligibleFactoryIds.length > 0
          ? connectionRequestsRepository.listConnectedMeasurementPointsForFactories(
              factoryLookupKeys,
              eligibleFactoryIds,
            )
          : connectionRequestsRepository.listConnectedMeasurementPointsForFactories(
              factoryLookupKeys,
            ),
        connectionRequestsRepository.listFavoriteFactoryIds(actorUserId),
        connectionRequestsRepository.listRequestsForFactories(factoryLookupKeys),
        listFactoryMainTypeLabelsForDashboard(visibleFactories),
      ]);
    const measurementPointsByFactory = mapConnectedMeasurementPointsToDashboardFactories(
      connectedPoints,
      factoryIdByLookupKey,
      factoryIdByEligibleFactoryId,
    );
    const latestNewConnectionRequestByFactory = mapLatestNewConnectionRequestsToFactories(
      requests,
      factoryIdByLookupKey,
      factoryIdByEligibleFactoryId,
    );
    const favoriteFactoryIdSet = new Set(favoriteFactoryIds);

    const filteredRows = visibleFactories
      .map<OperatorFactoryOverviewRowDTO>((factory) => {
        const currentMeasurementPoints = measurementPointsByFactory.get(factory.factoryId) ?? [];
        const pomsMembershipStatus =
          currentMeasurementPoints.length > 0
            ? POMS_MEMBERSHIP_STATUS.IN_POMS
            : POMS_MEMBERSHIP_STATUS.NOT_IN_POMS;
        return {
          ...toOperatorFactoryOverviewBaseRow(
            factory,
            currentMeasurementPoints,
            factoryMainTypeLabels,
          ),
          isFavorite: favoriteFactoryIdSet.has(factory.factoryId),
          hasLatestHourlyMeasurement: false,
          pomsMembershipStatus,
          pomsMembershipStatusLabel:
            pomsMembershipStatus === POMS_MEMBERSHIP_STATUS.IN_POMS
              ? 'อยู่ในระบบ POMS'
              : 'ยังไม่อยู่ในระบบ POMS',
        };
      })
      .filter((factory) => matchesOperatorFactoryOverviewQuery(factory, query));

    const data = await populateLatestHourlyMeasurements(filteredRows, actorUserId, 'OWN_FACTORY');

    return {
      data,
      meta: {
        total: data.length,
        summary: summarizeOperatorFactoryOverview(data, latestNewConnectionRequestByFactory),
      },
    };
  },

  async listPublicFactoryMapPoints(
    query: ListPublicFactoryMapPointsQuery = {},
  ): Promise<PaginatedTableRowsDTO<PublicFactoryMapPointDTO>> {
    const factories = await connectionRequestsRepository.listFactoriesForAccess({
      actorUserId: 0,
      scope: 'ALL',
      regionalAccess: undefined,
      connectedPomsOnly: true,
    });
    const eligibleFactories = factories.filter(
      (factory) => factory.isEligible !== false && factory.isActive !== false,
    );
    const factoryIdByLookupKey = buildFactoryLookupKeyMap(eligibleFactories);
    const factoryIdByEligibleFactoryId = buildEligibleFactoryIdMap(eligibleFactories);
    const eligibleFactoryIds = [...factoryIdByEligibleFactoryId.keys()];
    const [connectedPoints, factoryMainTypeLabels] = await Promise.all([
      eligibleFactoryIds.length > 0
        ? connectionRequestsRepository.listPublicConnectedMeasurementPointsForFactories(
            [...factoryIdByLookupKey.keys()],
            eligibleFactoryIds,
          )
        : connectionRequestsRepository.listPublicConnectedMeasurementPointsForFactories([
            ...factoryIdByLookupKey.keys(),
          ]),
      listFactoryMainTypeLabelsForDashboard(eligibleFactories),
    ]);
    const measurementPointsByFactory = mapConnectedMeasurementPointsToDashboardFactories(
      connectedPoints,
      factoryIdByLookupKey,
      factoryIdByEligibleFactoryId,
    );

    const data = eligibleFactories
      .map<PublicFactoryMapPointDTO>((factory) => ({
        ...toFactoryDashboardBaseRow(
          factory,
          measurementPointsByFactory.get(factory.factoryId) ?? [],
          factoryMainTypeLabels,
        ),
        hasLatestHourlyMeasurement: false,
      }))
      .filter((factory) => matchesPublicFactoryMapPointsQuery(factory, query));

    const dataWithLatestHourlyMeasurements = await populateLatestHourlyMeasurements(data, 0, 'ALL');

    return { data: dataWithLatestHourlyMeasurements, meta: { total: data.length } };
  },

  async setOperatorFactoryFavorite(
    factoryId: string,
    isFavorite: boolean,
    actorUserId: number,
    factoryViewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<FactoryFavoriteDTO> {
    const factory = await connectionRequestsRepository.findFactoryGeneral(factoryId, {
      actorUserId,
      scope: factoryViewScope,
      regionalAccess,
    });
    if (!factory) throw new NotFoundError('Factory not found for this user');

    return connectionRequestsRepository.setFactoryFavorite(
      actorUserId,
      factory.factoryId,
      isFavorite,
    );
  },

  async getFactoryGeneral(
    factoryId: string,
    actorUserId: number,
    factoryViewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<FactoryGeneralDTO> {
    const factory = await connectionRequestsRepository.findFactoryGeneral(factoryId, {
      actorUserId,
      scope: factoryViewScope,
      regionalAccess,
    });
    if (!factory) throw new NotFoundError('Factory general information not found');
    return factory;
  },

  async getById(
    id: number,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestDTO> {
    const request = await connectionRequestsRepository.findByIdForReadAccess(id, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    if (!request) throw new NotFoundError('Connection request not found');
    return request;
  },

  async getDetail(
    id: number,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestDetailDTO> {
    const request = await this.getById(id, actorUserId, viewScope, regionalAccess);
    const factoryMap = await connectionRequestsRepository.findFactorySummariesForRequests([
      request,
    ]);
    const deviceConfigs = await deviceConnectionsService.listByRequestId(id);

    return {
      ...request,
      factory: findFactorySummary(request, factoryMap),
      deviceConfigs: toDeviceConfigPayloadGroups(deviceConfigs),
    };
  },

  async getDeviceConfigFormDetail(
    id: number,
    stationId: string | undefined,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<DeviceConfigFormDetailDTO> {
    const request = await this.getById(id, actorUserId, viewScope, regionalAccess);
    const configs = await deviceConnectionsService.listByRequestId(id);
    return toDeviceConfigFormDetail(request, configs, stationId);
  },

  async getSingleDeviceConfigFormDetail(
    id: number,
    configId: number,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<DeviceConfigFormDetailDTO> {
    const request = await this.getById(id, actorUserId, viewScope, regionalAccess);
    const configs = await deviceConnectionsService.listByRequestId(id);
    const config = configs.find((item) => item.id === configId);
    if (!config) throw new NotFoundError('Device connection config not found for request');
    return toDeviceConfigFormDetail(request, [config], config.stationId);
  },

  async getAddParameterFormDetail(
    stationId: string,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<AddParameterFormDetailDTO> {
    const { request, point } = await loadLatestConnectedRequestForStation(
      stationId,
      actorUserId,
      viewScope,
      true,
      regionalAccess,
    );

    const [factoryReference, activeDeviceConfigs] = await Promise.all([
      connectionRequestsRepository.findActiveEligibleFactoryReference({
        factoryId: request.factoryId,
        factoryRegistrationNo: request.factoryRegistrationNo,
      }),
      deviceConnectionsService.listActiveSettings({ stationId }),
    ]);

    const inferredOldRegistrationNo =
      request.factoryRegistrationNo !== request.factoryId ? request.factoryRegistrationNo : null;

    return toAddParameterFormDetail(request, point, stationId, {
      newRegistrationNo: factoryReference?.factoryRegistrationNoNew ?? request.factoryId,
      oldRegistrationNo: factoryReference?.factoryRegistrationNoOld ?? inferredOldRegistrationNo,
      activeDeviceConfigs,
    });
  },

  async getCurrentDeviceConfigFormDetail(
    stationId: string,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<DeviceConfigFormDetailDTO> {
    const { request } = await loadLatestConnectedRequestForStation(
      stationId,
      actorUserId,
      viewScope,
      true,
      regionalAccess,
    );
    const configs = await deviceConnectionsService.listActiveSettings({ stationId });
    return toDeviceConfigFormDetail(request, configs, stationId);
  },

  async getConnectedMeasurementPointDetailsByFactory(
    factoryId: string,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<ConnectedMeasurementPointModalDetailDTO>> {
    const result = await connectionRequestsService.listConnectedMeasurementPoints(
      { factoryId },
      actorUserId,
      viewScope,
      regionalAccess,
    );
    const currentPoints =
      await connectionRequestsRepository.listConnectedMeasurementPointsForFactories([factoryId]);
    const connectedPointIdsBySourcePointId = new Map(
      currentPoints.flatMap((point) =>
        point.connectedPointId !== undefined && point.sourceMeasurementPointId !== undefined
          ? [[point.sourceMeasurementPointId, point.connectedPointId] as const]
          : [],
      ),
    );
    return {
      data: result.data.map((detail) =>
        toConnectedMeasurementPointModalDetail(
          detail,
          connectedPointIdsBySourcePointId.get(detail.point.id) ?? null,
        ),
      ),
      meta: { total: result.data.length },
    };
  },

  async listConnectedMeasurementPoints(
    query: ListConnectedMeasurementPointsQuery,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedTableRowsDTO<ConnectedMeasurementPointDetailDTO>> {
    const { rows } = await connectionRequestsRepository.list(
      {
        factoryId: query.factoryId,
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
      },
      {
        actorUserId,
        scope: viewScope,
        regionalAccess,
        useAssignedFactoryAccess: true,
      },
    );
    const factoryMap = await connectionRequestsRepository.findFactorySummariesForRequests(rows);
    const details = await Promise.all(
      rows.flatMap((request) =>
        request.measurementPoints
          .filter((point) => stationMatchesMeasurementPoint(point, query.stationId))
          .map(async (point) => {
            const pointDeviceConfigs = await listActiveDeviceConfigsForPoint(
              point,
              query.stationId,
            );
            return {
              id: point.id,
              requestId: request.id,
              requestNo: request.requestNo,
              factory: findFactorySummary(request, factoryMap),
              type: request.systemType,
              status: request.statusLabel,
              statusCode: request.status,
              connectedAt: request.verifiedAt,
              point,
              deviceConfigs: toDeviceConfigPayloadGroups(pointDeviceConfigs),
            };
          }),
      ),
    );

    return { data: details, meta: { total: details.length } };
  },

  async getMeasurementStatistics(
    stationId: string,
    query: MeasurementStatisticsQuerySchemaInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ) {
    const point = await loadConnectedMeasurementPointDetail(
      stationId,
      actorUserId,
      viewScope,
      regionalAccess,
    );
    const result = await parameterValuesService.measurementStatistics(
      { stationId, ...query },
      { actorUserId, scope: viewScope },
      toParameterEvaluationOptions(point),
    );

    return {
      ...result,
      data: {
        ...result.data,
        factory: toMeasurementDetailFactory(point),
        measurementPoints: result.data.measurementPoints.map((measurementPoint) => ({
          ...measurementPoint,
          pointName: point.point.pointName,
          latitude: measurementPointLatitude(point.point),
          longitude: measurementPointLongitude(point.point),
        })),
      },
    };
  },

  async getCalendarStatus(
    stationId: string,
    query: CalendarStatusQuerySchemaInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ) {
    const point = await loadConnectedMeasurementPointDetail(
      stationId,
      actorUserId,
      viewScope,
      regionalAccess,
    );
    const result = await parameterValuesService.calendarStatus(
      { stationId, ...query },
      { actorUserId, scope: viewScope },
      toParameterEvaluationOptions(point),
    );

    return {
      ...result,
      data: {
        ...result.data,
        factory: toMeasurementDetailFactory(point),
      },
    };
  },

  async getCalendarStatusDetails(
    stationId: string,
    query: CalendarStatusDetailsQuerySchemaInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ) {
    const point = await loadConnectedMeasurementPointDetail(
      stationId,
      actorUserId,
      viewScope,
      regionalAccess,
    );
    const result = await parameterValuesService.calendarStatusDetails(
      { stationId, ...query },
      { actorUserId, scope: viewScope },
      toParameterEvaluationOptions(point),
    );

    return {
      ...result,
      data: {
        ...result.data,
        factory: toMeasurementDetailFactory(point),
      },
    };
  },

  async getMeasurementCsvExport(
    stationId: string,
    query: MeasurementCsvExportQuerySchemaInput,
    actorUserId: number,
    exportScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ) {
    return parameterValuesService.measurementCsvExport(
      { stationId, ...query },
      { actorUserId, scope: exportScope },
      () =>
        loadConnectedMeasurementPointExportContext(
          stationId,
          actorUserId,
          exportScope,
          regionalAccess,
        ),
    );
  },

  async create(
    input: CreateConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const eligibleFactory = await requireActiveEligibleFactory(input);

    return connectionRequestsRepository.create(
      { ...clearPendingPointCodes(input), eligibleFactoryId: eligibleFactory.id },
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  async createMeasurementPointRequest(
    input: AddMeasurementPointRequestInput,
    actor: number | MeasurementPointSubmissionActorContext,
  ): Promise<ConnectionRequestDTO> {
    const actorContext = typeof actor === 'number' ? null : actor;
    const actorUserId = typeof actor === 'number' ? actor : actor.actorUserId;

    if (input.submissionAction === 'REQUEST_FACTORY_REVISION') {
      ensureMeasurementPointWorkflowActor(actorContext);
      const editScope = actorContext.editScope;
      if (!editScope) {
        throw new ForbiddenError(
          'Revision workflow from the add measurement point form requires edit permission',
        );
      }

      const factory = await connectionRequestsRepository.findDirectConnectionFactory(
        {
          factoryId: input.factoryId ?? '',
          factoryRegistrationNo: input.factoryRegistrationNo ?? '',
        },
        {
          actorUserId,
          scope: editScope,
          regionalAccess: actorContext.regionalAccess,
        },
      );
      if (!factory) {
        throw new NotFoundError('Active eligible factory not found within officer access scope');
      }

      return connectionRequestsRepository.create(
        clearPendingPointCodes({
          ...input,
          eligibleFactoryId: factory.eligibleFactoryId,
          factoryId: factory.factoryId,
          factoryName: factory.factoryName,
          factoryRegistrationNo: factory.newRegistrationNo,
          requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
        }),
        actorUserId,
        CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        {
          revisionReason: input.revisionReason,
          officerNote: input.officerNote,
          historyNote: 'เจ้าหน้าที่บันทึกคำขอเพิ่มจุดและส่งกลับให้โรงงานแก้ไข',
        },
      );
    }

    if (input.submissionAction === 'CONNECT') {
      ensureMeasurementPointWorkflowActor(actorContext);
      const directConnectScope = actorContext.directConnectScope;
      if (!directConnectScope) {
        throw new ForbiddenError(
          'Immediate connect from the add measurement point form requires direct-connect permission',
        );
      }

      if (input.measurementPoints.length !== 1) {
        throw new BadRequestError('CONNECT requires exactly one measurement point', {
          path: 'measurementPoints',
        });
      }

      const point = input.measurementPoints[0];
      const pointCode = point?.pointCode?.trim();
      if (!pointCode) {
        throw new BadRequestError('CONNECT requires measurementPoints[0].pointCode', {
          path: 'measurementPoints.0.pointCode',
        });
      }

      const factory = await connectionRequestsRepository.findDirectConnectionFactory(
        {
          factoryId: input.factoryId,
          factoryRegistrationNo: input.factoryRegistrationNo,
        },
        {
          actorUserId,
          scope: directConnectScope,
          regionalAccess: actorContext.regionalAccess,
        },
      );
      if (!factory) {
        throw new NotFoundError('Active eligible factory not found within officer access scope');
      }

      return connectionRequestsRepository.createDirectConnection(
        {
          ...input,
          eligibleFactoryId: factory.eligibleFactoryId,
          requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
          factoryId: factory.factoryId,
          factoryName: factory.factoryName,
          factoryRegistrationNo: factory.newRegistrationNo,
          measurementPoints: [{ ...point, pointCode }],
        },
        actorUserId,
      );
    }

    const eligibleFactory = await requireActiveEligibleFactory(input);

    return connectionRequestsRepository.create(
      clearPendingPointCodes({
        ...input,
        eligibleFactoryId: eligibleFactory.id,
        requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
      }),
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  async createDirectConnection(
    input: DirectConnectionRequestInput,
    actor: DirectConnectionActorContext,
  ): Promise<ConnectionRequestDTO> {
    ensureDirectConnectionActor(actor);
    const initialStatus = input.status ?? CONNECTION_REQUEST_STATUS.CONNECTED;
    if (
      initialStatus !== CONNECTION_REQUEST_STATUS.CONNECTED &&
      initialStatus !== CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION
    ) {
      throw new BadRequestError('Unsupported direct connection status', {
        path: 'status',
        received: initialStatus,
      });
    }
    if (
      initialStatus === CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION &&
      !input.revisionReason?.trim()
    ) {
      throw new BadRequestError(
        'revisionReason is required when status is WAITING_FACTORY_REVISION',
        {
          path: 'revisionReason',
        },
      );
    }

    if (input.measurementPoints.length !== 1) {
      throw new BadRequestError(
        'Direct connection request must contain exactly one measurement point',
        {
          path: 'measurementPoints',
        },
      );
    }

    const point = input.measurementPoints[0];
    if (!point) {
      throw new BadRequestError(
        'Direct connection request must contain exactly one measurement point',
        { path: 'measurementPoints' },
      );
    }
    const pointCode = point.pointCode?.trim();
    if (!pointCode || pointCode.length > 64) {
      throw new BadRequestError(
        'Measurement point code is required and must not exceed 64 characters',
        {
          path: 'measurementPoints.0.pointCode',
        },
      );
    }

    const factory = await connectionRequestsRepository.findDirectConnectionFactory(
      {
        factoryId: input.factoryId,
        factoryRegistrationNo: input.factoryRegistrationNo,
      },
      {
        actorUserId: actor.actorUserId,
        scope: actor.scope,
        regionalAccess: actor.regionalAccess,
      },
    );
    if (!factory) {
      throw new NotFoundError('Active eligible factory not found within officer access scope');
    }

    const directInput: DirectConnectionRequestInput = {
      ...input,
      eligibleFactoryId: factory.eligibleFactoryId,
      requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
      factoryId: factory.factoryId,
      factoryName: factory.factoryName,
      factoryRegistrationNo: factory.newRegistrationNo,
      status: initialStatus,
      revisionReason:
        initialStatus === CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION
          ? (input.revisionReason?.trim() ?? null)
          : null,
      officerNote: input.officerNote ?? null,
      measurementPoints: [{ ...point, pointCode }],
    };

    return connectionRequestsRepository.createDirectConnection(directInput, actor.actorUserId);
  },

  async createParameterRequest(
    input: AddParameterRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    ensureRequestFormSections(input, CONNECTION_REQUEST_TYPE.ADD_PARAMETER);
    const eligibleFactory = await requireActiveEligibleFactory(input);

    return connectionRequestsRepository.create(
      {
        ...input,
        eligibleFactoryId: eligibleFactory.id,
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
      },
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  async resubmit(
    id: number,
    input: ResubmitConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION]);
    if (input.requestType && input.requestType !== request.requestType) {
      throw new BadRequestError('Request type cannot be changed during resubmission', {
        path: 'requestType',
        expected: request.requestType,
        received: input.requestType,
      });
    }
    const effectiveInputResult = resubmitConnectionRequestWithTypeSchema.safeParse({
      ...input,
      requestType: request.requestType,
    });
    if (!effectiveInputResult.success) {
      throw effectiveInputResult.error;
    }
    const effectiveInput = effectiveInputResult.data;
    ensureRequestFormSections(effectiveInput, effectiveInput.requestType);
    const formInput =
      effectiveInput.requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER
        ? effectiveInput
        : clearPendingPointCodes(effectiveInput);
    const eligibleFactory = await requireActiveEligibleFactory(formInput);

    return connectionRequestsRepository.replaceForm(
      id,
      { ...formInput, eligibleFactoryId: eligibleFactory.id },
      actorUserId,
      CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
    );
  },

  async review(
    id: number,
    input: ReviewConnectionRequestInput,
    actorUserId: number,
    approveScope: AccessScope = 'ALL',
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureCanApprove(request, approveScope, regionalAccess);
    ensureStatus(request, DESIGN_REVIEW_STATUSES);

    if (input.decision === 'REQUEST_REVISION') {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        actorUserId,
        {
          officerNote: input.officerNote ?? null,
          revisionReason: input.revisionReason,
        },
      );
    }

    if (isFullyExemptedAddPointRequest(request)) {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.CONNECTED,
        actorUserId,
        {
          officerNote: input.officerNote ?? null,
          revisionReason: null,
          verifiedAt: nowProvider().toISOString(),
        },
        {
          activateFullyExemptedPoints: true,
          ...(input.pointCodeAssignments
            ? { pointCodeAssignments: input.pointCodeAssignments }
            : {}),
        },
      );
    }

    const update = {
      officerNote: input.officerNote ?? null,
      revisionReason: null,
      connectionDueAt: addDays(nowProvider(), 30).toISOString(),
    };
    if (input.pointCodeAssignments) {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        actorUserId,
        update,
        { pointCodeAssignments: input.pointCodeAssignments },
      );
    }

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      actorUserId,
      update,
    );
  },

  changeStatus(
    id: number,
    input: ChangeConnectionRequestStatusInput,
    actorUserId: number,
    approveScope: AccessScope = 'ALL',
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestDTO> {
    if (input.action === 'RETURN_TO_WAITING_CONNECTION') {
      return this.returnToWaitingConnection(id, input, actorUserId, approveScope, regionalAccess);
    }

    if (input.action === 'REQUEST_REVISION') {
      return this.review(
        id,
        {
          decision: 'REQUEST_REVISION',
          revisionReason: input.revisionReason,
          officerNote: input.officerNote,
        },
        actorUserId,
        approveScope,
        regionalAccess,
      );
    }

    return this.review(
      id,
      {
        decision: 'APPROVE_DESIGN',
        officerNote: input.officerNote,
        pointCodeAssignments: input.pointCodeAssignments,
      },
      actorUserId,
      approveScope,
      regionalAccess,
    );
  },

  async cancel(
    id: number,
    input: CancelConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);

    if (request.submissionSource !== CONNECTION_REQUEST_SUBMISSION_SOURCE.OPERATOR_FORM) {
      throw new ConflictError('Only operator-form connection requests can be canceled', {
        submissionSource: request.submissionSource,
      });
    }

    if (request.status === CONNECTION_REQUEST_STATUS.CANCELED) return request;
    if (!CANCELLABLE_CONNECTION_REQUEST_STATUSES.includes(request.status)) {
      throw new ConflictError('Connection request cannot be canceled from its current status', {
        currentStatus: request.status,
        allowedStatuses: CANCELLABLE_CONNECTION_REQUEST_STATUSES,
      });
    }

    return connectionRequestsRepository.cancelOperatorRequest(
      id,
      actorUserId,
      input.reason ?? null,
    );
  },

  async returnToWaitingConnection(
    id: number,
    input: ChangeConnectionRequestStatusInput,
    actorUserId: number,
    approveScope: AccessScope = 'ALL',
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureCanApprove(request, approveScope, regionalAccess);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED]);
    const nextStatus = isPastConnectionDueDate(request.connectionDueAt, nowProvider())
      ? CONNECTION_REQUEST_STATUS.CANCELED
      : CONNECTION_REQUEST_STATUS.WAITING_CONNECTION;

    return connectionRequestsRepository.updateStatus(
      id,
      nextStatus,
      actorUserId,
      {
        officerNote: input.officerNote ?? null,
        revisionReason:
          nextStatus === CONNECTION_REQUEST_STATUS.CANCELED
            ? appendAutoCancelNote(input.revisionReason)
            : input.revisionReason,
        confirmedAt: null,
      },
      {
        issueWaitingConnectionSideEffects: false,
      },
    );
  },

  autoCancelExpiredWaitingConnections(): Promise<number> {
    return connectionRequestsRepository.autoCancelExpiredWaitingConnectionRequests(
      nowProvider().toISOString(),
    );
  },

  async createDeviceConfig(
    id: number,
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
  ): Promise<DeviceConfigPayloadResponseDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);
    ensureStationBelongsToRequest(request, input.stationId);
    ensureStatusScheduleParametersBelongToRequest(request, input);

    const created = await deviceConnectionsService.createForRequest(input, actorUserId, id);
    return toDeviceConfigPayloadResponse([created]);
  },

  async createDeviceConfigs(
    id: number,
    input: CreateDeviceConnectionConfigsInput,
    actorUserId: number,
  ): Promise<DeviceConfigPayloadResponseDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);
    for (const config of input.configs) {
      ensureStationBelongsToRequest(request, config.stationId);
      ensureStatusScheduleParametersBelongToRequest(request, config);
    }

    const created = await deviceConnectionsService.createManyForRequest(
      input.configs,
      actorUserId,
      id,
    );
    return toDeviceConfigPayloadResponse(created);
  },

  async saveCurrentDeviceConfig(
    stationId: string,
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
    editScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<DeviceConfigPayloadResponseDTO> {
    const { request } = await loadLatestConnectedRequestForStation(
      stationId,
      actorUserId,
      editScope,
      false,
      regionalAccess,
    );
    ensureConfigStationMatchesRoute(stationId, input.stationId);
    ensureStatusScheduleParametersBelongToRequest(request, input);

    const [saved] = await deviceConnectionsService.replaceCurrentStation(
      stationId,
      [input],
      actorUserId,
    );
    return toDeviceConfigPayloadResponse([saved]);
  },

  async saveCurrentDeviceConfigs(
    stationId: string,
    input: CreateDeviceConnectionConfigsInput,
    actorUserId: number,
    editScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<DeviceConfigPayloadResponseDTO> {
    const { request } = await loadLatestConnectedRequestForStation(
      stationId,
      actorUserId,
      editScope,
      false,
      regionalAccess,
    );
    for (const config of input.configs) {
      ensureConfigStationMatchesRoute(stationId, config.stationId);
      ensureStatusScheduleParametersBelongToRequest(request, config);
    }

    const saved = await deviceConnectionsService.replaceCurrentStation(
      stationId,
      input.configs,
      actorUserId,
    );
    return toDeviceConfigPayloadResponse(saved);
  },

  async confirmConnection(
    id: number,
    input: ConfirmConnectionInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);

    if ((input.action ?? 'CONFIRM') === 'SAVE') {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        actorUserId,
        {
          officerNote: input.note ?? null,
        },
      );
    }

    if (!request.connectionDueAt) {
      throw new BadRequestError('Connection due date is not set');
    }

    const confirmedAt = input.confirmedAt ?? nowProvider().toISOString();
    if (new Date(confirmedAt).getTime() > new Date(request.connectionDueAt).getTime()) {
      throw new BadRequestError('Connection confirmation must be submitted within 30 days');
    }

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
      actorUserId,
      {
        confirmedAt,
        officerNote: input.note ?? null,
      },
    );
  },

  async verifyConnection(
    id: number,
    input: VerifyConnectionInput,
    actorUserId: number,
    approveScope: AccessScope = 'ALL',
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureCanApprove(request, approveScope, regionalAccess);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED]);

    return connectionRequestsRepository.connect(id, actorUserId, {
      verifiedAt: input.verifiedAt ?? nowProvider().toISOString(),
      officerNote: input.note ?? null,
    });
  },
};

async function requireActiveEligibleFactory(input: {
  factoryId: string;
  factoryRegistrationNo: string;
}): Promise<{ id: number }> {
  const eligibleFactory =
    await connectionRequestsRepository.findActiveEligibleFactoryReference(input);
  if (!eligibleFactory) throw new NotFoundError('Active eligible factory not found');
  return eligibleFactory;
}

function stationMatchesMeasurementPoint(point: MeasurementPointDTO, stationId?: string): boolean {
  if (!stationId) return true;
  return point.pointCode === stationId || point.pointName === stationId;
}

async function loadLatestConnectedRequestForStation(
  stationId: string,
  actorUserId: number,
  scope: AccessScope,
  useAssignedFactoryAccess: boolean,
  regionalAccess?: RegionalAccessDTO | null,
): Promise<{ request: ConnectionRequestDTO; point: MeasurementPointDTO }> {
  const { rows } = await connectionRequestsRepository.list(
    {
      stationId,
      status: CONNECTION_REQUEST_STATUS.CONNECTED,
    },
    {
      actorUserId,
      scope,
      regionalAccess,
      useAssignedFactoryAccess,
    },
  );

  for (const request of rows) {
    const point = findMonitoringPoint(request, stationId);
    if (point) return { request, point };
  }

  throw new NotFoundError('Connected measurement point not found');
}

function toAddParameterFormDetail(
  request: ConnectionRequestDTO,
  point: MeasurementPointDTO,
  stationId: string,
  currentState: {
    newRegistrationNo: string;
    oldRegistrationNo: string | null;
    activeDeviceConfigs: DeviceConnectionConfigDTO[];
  },
): AddParameterFormDetailDTO {
  const currentDetails = deriveCurrentParameterDetails(point, currentState.activeDeviceConfigs);

  return {
    requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
    sourceRequestId: request.id,
    sourceRequestNo: request.requestNo,
    stationId,
    formDefaults: {
      requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
      factoryId: request.factoryId,
      factoryName: request.factoryName,
      // Keep the legacy field as the old registration number because the current
      // request-form client uses it as the old-registration fallback.
      factoryRegistrationNo: currentState.oldRegistrationNo ?? currentState.newRegistrationNo,
      newRegistrationNo: currentState.newRegistrationNo,
      oldRegistrationNo: currentState.oldRegistrationNo,
      industryMainOrder: request.industryMainOrder,
      industrySubOrder: request.industrySubOrder,
      businessActivity: request.businessActivity,
      eia: request.eia,
      eiaOther: request.eiaOther,
      hasEia: request.hasEia,
      projectName: request.projectName,
      address: request.address,
      latitude: request.latitude,
      longitude: request.longitude,
      systemType: request.systemType,
      contactName: request.contactName,
      contactPhone: request.contactPhone,
      contactEmail: request.contactEmail,
      contactPersons: request.contactPersons,
      notificationEmails: request.notificationEmails,
      officerNotificationEmails: request.officerNotificationEmails,
      informationProviderName: request.informationProviderName,
      informationProviderPosition: request.informationProviderPosition,
      measurementPoints: [toMeasurementPointInput(point, currentDetails)],
      remarks: null,
    },
  };
}

function toMeasurementPointInput(
  point: MeasurementPointDTO,
  details: MeasurementPointDetailsInput | null | undefined = point.details,
): MeasurementPointInput {
  return {
    pointName: point.pointName,
    pointCode: point.pointCode,
    pointType: point.pointType,
    latitude: point.latitude,
    longitude: point.longitude,
    parameters: point.parameters,
    description: point.description,
    monitoringPointStatus: point.monitoringPointStatus ?? null,
    details,
    documentsAndImages: point.documentsAndImages,
    measurementInstruments: point.measurementInstruments,
  };
}

function deriveCurrentParameterDetails(
  point: MeasurementPointDTO,
  activeDeviceConfigs: DeviceConnectionConfigDTO[],
): MeasurementPointDetailsInput {
  const details = point.details ?? {};
  const eligibleParameters = stringListDetail(details, 'eligibleParameters');
  const parametersInScope = eligibleParameters.length > 0 ? eligibleParameters : point.parameters;
  const exemptedParameterKeys = new Set(
    stringListDetail(details, 'exemptedParameters').map(normalizeParameterName),
  );
  const connectedParameters = uniqueParameterNames(
    activeDeviceConfigs.flatMap((config) => config.channels.map((channel) => channel.dataType)),
  );
  const connectedParameterKeys = new Set(connectedParameters.map(normalizeParameterName));
  const pendingParameters = parametersInScope.filter((parameter) => {
    const key = normalizeParameterName(parameter);
    return (
      key !== normalizeParameterName('ไม่มี') &&
      !connectedParameterKeys.has(key) &&
      !exemptedParameterKeys.has(key)
    );
  });

  return {
    ...details,
    connectedParameters,
    pendingParameters,
  };
}

function uniqueParameterNames(parameters: string[]): string[] {
  const uniqueParameters = new Map<string, string>();

  for (const parameter of parameters) {
    const trimmed = parameter.trim();
    const key = normalizeParameterName(trimmed);
    if (trimmed && key !== normalizeParameterName('ไม่มี') && !uniqueParameters.has(key)) {
      uniqueParameters.set(key, trimmed);
    }
  }

  return [...uniqueParameters.values()];
}

function stringListDetail(details: MeasurementPointDTO['details'], key: string): string[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];

  const value = details[key];
  if (!Array.isArray(value)) return [];

  return uniqueParameterNames(value.filter((item): item is string => typeof item === 'string'));
}

function measurementPointLatitude(point: MeasurementPointDTO): number | null {
  return (
    point.latitude ??
    coordinateFromDetails(point.details, 'stackLatitude') ??
    coordinateFromDetails(point.details, 'instrumentLatitude')
  );
}

function measurementPointLongitude(point: MeasurementPointDTO): number | null {
  return (
    point.longitude ??
    coordinateFromDetails(point.details, 'stackLongitude') ??
    coordinateFromDetails(point.details, 'instrumentLongitude')
  );
}

function coordinateFromDetails(
  details: MeasurementPointDTO['details'],
  key: string,
): number | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;

  const value = (details as Record<string, unknown>)[key];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toRequestTableRow(
  request: ConnectionRequestDTO,
  factory: FactorySummaryDTO | null,
  currentPomsFactoryName: string | null,
): ConnectionRequestTableRowDTO {
  const firstPoint = request.measurementPoints[0] ?? null;
  const codeIssuedAt = findCodeIssuedAt(request);
  const waitingConnection = toWaitingConnectionCountdown(request);
  return {
    id: request.id,
    factoryId: request.factoryId,
    factoryName: currentPomsFactoryName ?? factory?.factoryName ?? request.factoryName,
    industryType: factory?.industryType ?? null,
    province: request.provinceName ?? factory?.province ?? null,
    type: request.systemType,
    requestNo: request.requestNo,
    submittedAt: request.createdAt,
    submittedDate: formatThaiDate(request.createdAt),
    monitoringPointCode: firstPoint?.pointCode ?? null,
    codeIssuedAt,
    codeIssuedDate: codeIssuedAt ? formatThaiDate(codeIssuedAt) : null,
    connectionDueAt: waitingConnection.connectionDueAt,
    waitingConnectionDaysRemaining: waitingConnection.daysRemaining,
    waitingConnectionText: waitingConnection.text,
    form: request.requestTypeLabel,
    status: request.statusLabel,
    statusCode: request.status,
    requestType: request.requestType,
  };
}

function toWaitingConnectionCountdown(request: ConnectionRequestDTO): {
  connectionDueAt: string | null;
  daysRemaining: number | null;
  text: string | null;
} {
  if (request.status !== CONNECTION_REQUEST_STATUS.WAITING_CONNECTION || !request.connectionDueAt) {
    return { connectionDueAt: null, daysRemaining: null, text: null };
  }

  const dueAt = new Date(request.connectionDueAt);
  const now = nowProvider();
  if (Number.isNaN(dueAt.getTime())) {
    return { connectionDueAt: null, daysRemaining: null, text: null };
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(
    0,
    Math.ceil((dueAt.getTime() - now.getTime()) / millisecondsPerDay),
  );

  return {
    connectionDueAt: request.connectionDueAt,
    daysRemaining,
    text: `${CONNECTION_REQUEST_STATUS_LABELS.WAITING_CONNECTION} ${daysRemaining} วัน`,
  };
}

async function listActiveDeviceConfigsForPoint(
  point: MeasurementPointDTO,
  stationId?: string,
): Promise<DeviceConnectionConfigDTO[]> {
  const stationIds = stationId
    ? [stationId]
    : [point.pointCode, point.pointName].filter((value): value is string => Boolean(value));

  for (const stationId of stationIds) {
    const configs = await deviceConnectionsService.listActiveSettings({ stationId });
    if (configs.length > 0) return configs;
  }

  return [];
}

function toDeviceConfigFormDetail(
  request: ConnectionRequestDTO,
  configs: DeviceConnectionConfigDTO[],
  requestedStationId?: string,
): DeviceConfigFormDetailDTO {
  const monitoringPoint = findMonitoringPoint(request, requestedStationId);
  const stationId =
    requestedStationId ??
    monitoringPoint?.pointCode ??
    monitoringPoint?.pointName ??
    request.measurementPoints[0]?.pointCode ??
    request.measurementPoints[0]?.pointName ??
    '';
  const stationAliases = new Set(
    [stationId, monitoringPoint?.pointCode, monitoringPoint?.pointName].filter(Boolean),
  );
  const instrumentParameterOptions = getMeasurementInstrumentParameterOptions(monitoringPoint);
  const monitoringPointParameterOptions = getDeviceConfigParameterOptions(monitoringPoint);
  const allowedParameterOptions =
    instrumentParameterOptions.length > 0 ? new Set(instrumentParameterOptions) : null;
  const stationConfigs = configs
    .filter((config) => stationAliases.has(config.stationId))
    .map((config) =>
      allowedParameterOptions
        ? {
            ...config,
            channels: config.channels.filter((channel) =>
              allowedParameterOptions.has(channel.dataType),
            ),
          }
        : config,
    );
  const responseMonitoringPoint = monitoringPoint
    ? { ...monitoringPoint, parameters: monitoringPointParameterOptions }
    : null;
  const parameterOptions = [
    ...new Set([
      ...monitoringPointParameterOptions,
      ...stationConfigs.flatMap((config) => config.channels.map((channel) => channel.dataType)),
    ]),
  ];
  const connectionForms = stationConfigs.map((config, index) =>
    toDeviceConfigFormConnection(config, stationId, index),
  );
  const deviceCodeOptions =
    connectionForms.length > 0
      ? connectionForms.map((connection) => connection.deviceCode)
      : [toDeviceCode(stationId, 0)];
  const savedStatusManagement = stationConfigs.find(
    (config) => config.statusManagement,
  )?.statusManagement;
  const statusManagement = normalizeStatusManagementDateTimes(
    savedStatusManagement ?? {
      selectedParameters: ['ทั้งหมด'],
      startAt: null,
      endAt: null,
      status: 'Normal',
      schedules: [],
    },
  );

  return {
    requestId: request.id,
    requestNo: request.requestNo,
    stationId,
    monitoringPoint: responseMonitoringPoint,
    parameterOptions,
    deviceCodeOptions,
    connectionForms,
    statusManagement,
    parameterMappings: stationConfigs.flatMap((config, configIndex) =>
      config.channels.map((channel) =>
        toDeviceConfigParameterMapping(
          config.id,
          getDeviceCode(config, stationId, configIndex),
          channel,
        ),
      ),
    ),
    testResults: [],
    rawConfigs: toDeviceConfigRawConfig(stationId, stationConfigs, statusManagement),
  };
}

function getDeviceConfigParameterOptions(point: MeasurementPointDTO | null): string[] {
  if (!point) return [];
  const instrumentParameters = getMeasurementInstrumentParameterOptions(point);
  return instrumentParameters.length > 0 ? instrumentParameters : point.parameters;
}

function getMeasurementInstrumentParameterOptions(point: MeasurementPointDTO | null): string[] {
  return (
    point?.measurementInstruments?.parameters
      ?.map((parameter) => parameter.parameter)
      .filter((parameter): parameter is string => Boolean(parameter)) ?? []
  );
}

function findMonitoringPoint(
  request: ConnectionRequestDTO,
  stationId?: string,
): MeasurementPointDTO | null {
  if (!stationId) return request.measurementPoints[0] ?? null;
  return (
    request.measurementPoints.find(
      (point) => point.pointCode === stationId || point.pointName === stationId,
    ) ?? null
  );
}

function toDeviceConfigFormConnection(
  config: DeviceConnectionConfigDTO,
  stationId: string,
  index: number,
): DeviceConfigFormConnectionDTO {
  return {
    id: config.id,
    configId: config.id,
    type: protocolToConnectionType(config.protocol),
    protocol: config.protocol,
    deviceCode: getDeviceCode(config, stationId, index),
    values: settingsToFormValues(config.protocol, config.settings),
  };
}

function toDeviceConfigParameterMapping(
  configId: number,
  deviceCode: string,
  channel: DeviceConnectionConfigDTO['channels'][number],
): DeviceConfigFormParameterMappingDTO {
  return {
    configId,
    deviceCode,
    addressId: valueToString(channel.addressId),
    parameter: channel.dataType,
    testMode: channel.testMode ?? false,
    min: channel.valueRange ? valueToString(channel.valueRange.min) : '',
    max: channel.valueRange ? valueToString(channel.valueRange.max) : '',
    alertLow: channel.alertLow == null ? '' : String(channel.alertLow),
    alertHigh: channel.alertHigh == null ? '' : String(channel.alertHigh),
    valueFormat: valueFormatToThai(channel.valueFormat ?? null),
    offset: valueToString(channel.offset),
    encodingData: encodingToFormLabel(channel.encoding ?? null),
    status: channel.status ?? '',
  };
}

function toDeviceConfigRawConfig(
  stationId: string,
  configs: DeviceConnectionConfigDTO[],
  statusManagement: DeviceConfigFormDetailDTO['statusManagement'],
): DeviceConfigFormDetailDTO['rawConfigs'] {
  return {
    stationId,
    device: configs.map((config, index) => ({
      deviceCode: getDeviceCode(config, stationId, index),
      protocol: config.protocol,
      settings: config.settings,
    })),
    channels: configs.flatMap((config, configIndex) =>
      config.channels.map((channel) => ({
        deviceCode: getDeviceCode(config, stationId, configIndex),
        addressId: channel.addressId,
        dataType: channel.dataType,
        testMode: channel.testMode ?? false,
        valueRange: channel.valueRange ?? null,
        alertLow: channel.alertLow ?? null,
        alertHigh: channel.alertHigh ?? null,
        valueFormat: channel.valueFormat ?? null,
        offset: channel.offset,
        encoding: channel.encoding ?? null,
        status: channel.status ?? null,
      })),
    ),
    statusManagement,
  };
}

function toDeviceConfigPayloadGroups(
  configs: DeviceConnectionConfigDTO[],
): DeviceConfigFormDetailDTO['rawConfigs'][] {
  const groups = new Map<string, DeviceConnectionConfigDTO[]>();
  for (const config of configs) {
    const group = groups.get(config.stationId) ?? [];
    group.push(config);
    groups.set(config.stationId, group);
  }

  return Array.from(groups.entries()).map(([stationId, stationConfigs]) =>
    toDeviceConfigRawConfig(stationId, stationConfigs, toStatusManagement(stationConfigs)),
  );
}

function toDeviceConfigPayloadResponse(
  configs: DeviceConnectionConfigDTO[],
): DeviceConfigPayloadResponseDTO {
  const groups = toDeviceConfigPayloadGroups(configs);
  return groups.length === 1 ? groups[0] : groups;
}

function toStatusManagement(
  configs: DeviceConnectionConfigDTO[],
): DeviceConfigFormDetailDTO['statusManagement'] {
  return normalizeStatusManagementDateTimes(
    configs.find((config) => config.statusManagement)?.statusManagement ?? {
      selectedParameters: ['ทั้งหมด'],
      startAt: null,
      endAt: null,
      status: 'Normal',
      schedules: [],
    },
  );
}

function normalizeStatusManagementDateTimes(
  statusManagement: DeviceConfigFormDetailDTO['statusManagement'],
): DeviceConfigFormDetailDTO['statusManagement'] {
  return {
    ...statusManagement,
    startAt: toCanonicalStatusDateTime(statusManagement.startAt),
    endAt: toCanonicalStatusDateTime(statusManagement.endAt),
    schedules: statusManagement.schedules.map((schedule) => ({
      ...schedule,
      startAt: toCanonicalStatusDateTime(schedule.startAt),
      endAt: toCanonicalStatusDateTime(schedule.endAt),
    })),
  };
}

function getDeviceCode(
  config: Pick<DeviceConnectionConfigDTO, 'deviceCode'>,
  stationId: string,
  index: number,
): string {
  return config.deviceCode || toDeviceCode(stationId, index);
}

function protocolToConnectionType(protocol: string): DeviceConfigFormConnectionDTO['type'] {
  if (protocol === 'POMS_BOX') return 'POMS Box';
  if (protocol === 'MODBUS_RTU') return 'Modbus RTU';
  if (protocol === 'MODBUS_TCP') return 'Modbus TCP';
  if (protocol === 'MSSQL') return 'Microsoft SQL';
  return 'MySQL';
}

function settingsToFormValues(
  protocol: string,
  settings: Record<string, unknown>,
): Record<string, string> {
  if (protocol === 'POMS_BOX') return {};

  if (protocol === 'MODBUS_RTU') {
    const range = readRange(settings.valueRange);
    return {
      comport: valueToString(settings.comPort),
      slaveId: valueToString(settings.slaveId),
      baudRate: valueToString(settings.baudRate),
      parity: parityToFormLabel(settings.parity),
      stopBits: valueToString(settings.stopBits),
      dataBits: valueToString(settings.dataBits),
      measureMin: range.min,
      measureMax: range.max,
      quantity: valueToString(settings.quantity),
    };
  }

  if (protocol === 'MODBUS_TCP') {
    const range = readRange(settings.valueRange);
    return {
      slaveId: valueToString(settings.slaveId),
      hostIp: valueToString(settings.hostIp),
      port: valueToString(settings.port),
      measureMin: range.min,
      measureMax: range.max,
    };
  }

  const range = readRange(settings.valueRange);
  return {
    hostIp: valueToString(settings.hostIp),
    port: valueToString(settings.port),
    dbUser: valueToString(settings.dbUser),
    dbPass: valueToString(settings.dbPass),
    dbName: valueToString(settings.dbName),
    minuteTableName: valueToString(settings.minuteTableName),
    fiveMinuteTableName: valueToString(settings.fiveMinuteTableName),
    hourlyTableName: valueToString(settings.hourlyTableName),
    measureMin: range.min,
    measureMax: range.max,
  };
}

function readRange(value: unknown): { min: string; max: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { min: '', max: '' };
  }
  const range = value as { min?: unknown; max?: unknown };
  return {
    min: valueToString(range.min),
    max: valueToString(range.max),
  };
}

function parityToFormLabel(value: unknown): string {
  if (value === 'EVEN') return 'Even';
  if (value === 'ODD') return 'Odd';
  if (value === 'NONE') return 'None';
  return valueToString(value);
}

function valueFormatToThai(value: string | null): string {
  if (!value) return '';
  if (value === 'CURRENT') return 'ค่ากระแสไฟฟ้า';
  if (value === 'VOLTAGE') return 'ค่าแรงดันไฟฟ้า';
  if (value === 'MEASUREMENT_VALUE') return 'ค่าข้อมูลตรวจวัด';
  return value;
}

function encodingToFormLabel(value: string | null): string {
  if (!value) return '';
  const known: Record<string, string> = {
    SIGNED: 'Signed',
    UNSIGNED: 'Unsigned',
    BIG_ENDIAN: 'Big Endian',
    LITTLE_ENDIAN: 'Little Endian',
    SIGNED16_BIG_ENDIAN: 'Signed16 - Big Endian',
    SIGNED16_LITTLE_ENDIAN: 'Signed16 - Little Endian',
    UNSIGNED16_BIG_ENDIAN: 'Unsigned16 - Big Endian',
    UNSIGNED16_LITTLE_ENDIAN: 'Unsigned16 - Little Endian',
    SIGNED32_BIG_ENDIAN: 'Signed32 - Big Endian',
    SIGNED32_LITTLE_ENDIAN: 'Signed32 - Little Endian',
    UNSIGNED32_BIG_ENDIAN: 'Unsigned32 - Big Endian',
    UNSIGNED32_LITTLE_ENDIAN: 'Unsigned32 - Little Endian',
    FLOAT32_BIG_ENDIAN: 'Float32 - Big Endian',
    FLOAT32_LITTLE_ENDIAN: 'Float32 - Little Endian',
    FLOAT64_BIG_ENDIAN: 'Float64 - Big Endian',
    FLOAT64_LITTLE_ENDIAN: 'Float64 - Little Endian',
  };
  return known[value] ?? value;
}

function toDeviceCode(stationId: string, index: number): string {
  return `${stationId || 'STATION'}/${String(index + 1).padStart(2, '0')}`;
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function findFactorySummary(
  request: ConnectionRequestDTO,
  factoryMap: Map<string, FactorySummaryDTO>,
): FactorySummaryDTO | null {
  const summary =
    factoryMap.get(request.factoryId) ?? factoryMap.get(request.factoryRegistrationNo);
  if (summary) {
    return {
      ...summary,
      industryMainOrder: summary.industryMainOrder ?? request.industryMainOrder,
      industrySubOrder: summary.industrySubOrder ?? request.industrySubOrder,
      businessActivity: summary.businessActivity ?? request.businessActivity,
      eia: summary.eia ?? toLegacyEiaLabel(request.hasEia),
      projectName: summary.projectName ?? request.projectName,
      address: summary.address ?? request.address,
      latitude: summary.latitude ?? (request.latitude === null ? null : String(request.latitude)),
      longitude:
        summary.longitude ?? (request.longitude === null ? null : String(request.longitude)),
    };
  }

  return {
    id: null,
    factoryId: request.factoryId,
    factoryName: request.factoryName,
    newRegistrationNo: request.factoryRegistrationNo,
    oldRegistrationNo: null,
    industryType: null,
    industryMainOrder: request.industryMainOrder,
    industrySubOrder: request.industrySubOrder,
    businessActivity: request.businessActivity,
    eia: toLegacyEiaLabel(request.hasEia),
    projectName: request.projectName,
    address: request.address,
    latitude: request.latitude === null ? null : String(request.latitude),
    longitude: request.longitude === null ? null : String(request.longitude),
    province: null,
  };
}

function toLegacyEiaLabel(hasEia: boolean | null): 'มี' | 'ไม่มี' | null {
  if (hasEia === null) return null;
  return hasEia ? 'มี' : 'ไม่มี';
}

function findCodeIssuedAt(request: ConnectionRequestDTO): string | null {
  const history = request.statusHistory.find(
    (item) => item.status === CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
  );
  return history?.changedAt ?? request.connectionDueAt ?? null;
}

function isFullyExemptedAddPointRequest(request: ConnectionRequestDTO): boolean {
  return (
    request.requestType === CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT &&
    request.measurementPoints.length > 0 &&
    request.measurementPoints.every(
      (point) => point.monitoringPointStatus === 'ได้รับการยกเว้นทั้งหมด',
    )
  );
}

function isPastConnectionDueDate(connectionDueAt: string | null, now: Date): boolean {
  if (!connectionDueAt) return false;
  return new Date(connectionDueAt).getTime() < now.getTime();
}

function appendAutoCancelNote(revisionReason: string | null | undefined): string {
  return [revisionReason, CONNECTION_TIMEOUT_AUTO_CANCEL_NOTE]
    .filter((note): note is string => typeof note === 'string' && note.length > 0)
    .join('\n');
}

function formatThaiDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear() + 543}`;
}

function ensureSingleMeasurementPoint(input: CreateConnectionRequestInput): void {
  if (input.measurementPoints.length !== 1) {
    throw new BadRequestError('Add parameter request must reference exactly one measurement point');
  }
}

function ensureRequestFormSections(
  input: CreateConnectionRequestInput,
  requestType: ConnectionRequestType,
): void {
  if (requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER) {
    ensureSingleMeasurementPoint(input);
  }

  input.measurementPoints.forEach((point, index) => {
    if (requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER && !point.pointCode) {
      throw new BadRequestError(
        'Existing measurement point code is required for add parameter request',
        {
          path: `measurementPoints.${index}.pointCode`,
        },
      );
    }

    if (
      requestType === CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT ||
      requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER
    ) {
      if (!point.details || Object.keys(point.details).length === 0) {
        throw new BadRequestError('Measurement point detail section is required', {
          path: `measurementPoints.${index}.details`,
        });
      }
      if (
        requestType === CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT &&
        input.systemType === 'CEMS' &&
        (!point.documentsAndImages || point.documentsAndImages.length === 0)
      ) {
        throw new BadRequestError('Documents and images section is required for CEMS', {
          path: `measurementPoints.${index}.documentsAndImages`,
        });
      }
    }

    if (
      requestType === CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT ||
      requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER
    ) {
      if (!point.measurementInstruments) {
        throw new BadRequestError('Measurement instruments section is required', {
          path: `measurementPoints.${index}.measurementInstruments`,
        });
      }
    }
  });
}

function clearPendingPointCodes(input: CreateConnectionRequestInput): CreateConnectionRequestInput {
  return {
    ...input,
    measurementPoints: input.measurementPoints.map((point) => ({
      ...point,
      pointCode: null,
    })),
  };
}

function toOperatorFactoryMeasurementPoint(
  point: CurrentFactoryMeasurementPointDTO,
): OperatorFactoryMeasurementPointDTO {
  const parameters = uniqueParameterDisplayNames(point.parameters);

  return {
    stationId: point.stationId,
    pointName: point.pointName,
    pointCode: point.pointCode,
    systemType: point.systemType,
    parameters,
    monitoringPointStatus: point.monitoringPointStatus ?? null,
    parameterStandards: toParameterStandards(parameters, point.measurementInstruments),
    data: [],
  };
}

function getFactoryLogoUrl(points: CurrentFactoryMeasurementPointDTO[]): string | null {
  for (const point of points) {
    if (point.factoryLogo?.fileUrl) return point.factoryLogo.fileUrl;
  }

  const cemsPoints = points.filter((point) => point.systemType === 'CEMS');

  for (const point of cemsPoints) {
    const documentsAndImages = point.documentsAndImages ?? [];
    const logoDocument = documentsAndImages.find(
      (document) => document.title.trim() === FACTORY_LOGO_DOCUMENT_TITLE && document.fileUrl,
    );
    if (logoDocument?.fileUrl) return logoDocument.fileUrl;
  }

  for (const point of cemsPoints) {
    const fallbackDocument = point.documentsAndImages?.[FACTORY_LOGO_DOCUMENT_INDEX];
    if (fallbackDocument?.fileUrl) return fallbackDocument.fileUrl;
  }

  return null;
}

function buildFactoryLookupKeyMap(factories: FactorySummaryDTO[]): Map<string, string> {
  const keys = new Map<string, string>();

  factories.forEach((factory) => {
    [factory.factoryId, factory.newRegistrationNo, factory.oldRegistrationNo].forEach((key) => {
      if (key) keys.set(key, factory.factoryId);
    });
  });

  return keys;
}

function buildEligibleFactoryIdMap(factories: FactorySummaryDTO[]): Map<number, string> {
  return new Map(
    factories.flatMap((factory) =>
      factory.eligibleFactoryId === null || factory.eligibleFactoryId === undefined
        ? []
        : [[factory.eligibleFactoryId, factory.factoryId] as const],
    ),
  );
}

const parameterUnitLabels: Record<string, string> = {
  co: 'CO (ppm)',
  nox: 'NOx (ppm)',
  temp: 'Temp. (°C)',
  temperature: 'Temp. (°C)',
  o2: 'O2 (%)',
  flow: 'Flow Rate (m3/hr)',
  bod: 'BOD (mg/L)',
  cod: 'COD (mg/L)',
  tss: 'TSS (mg/L)',
};
const canonicalFlowRateLabel = parameterUnitLabels.flow;

function toParameterDisplayName(parameter: string): string {
  const trimmed = parameter.trim();
  if (!trimmed) return trimmed;
  if (isCubicMetersPerHourFlowParameter(trimmed)) return canonicalFlowRateLabel;
  if (/\([^)]*\)/.test(trimmed)) return trimmed;

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return parameterUnitLabels[normalized] ?? trimmed;
}

function uniqueParameterDisplayNames(parameters: string[]): string[] {
  const displayNames = new Map<string, string>();

  for (const parameter of parameters) {
    const displayName = toParameterDisplayName(parameter);
    const key = displayName.toLowerCase();
    if (displayName && !displayNames.has(key)) displayNames.set(key, displayName);
  }

  return [...displayNames.values()];
}

function toParameterStandards(
  parameters: string[],
  measurementInstruments: MeasurementInstrumentsInput | null | undefined,
): OperatorFactoryParameterStandardDTO[] {
  const candidates = (measurementInstruments?.parameters ?? []).flatMap((instrument) => {
    const rawParameter = instrument.parameter?.trim();
    if (!rawParameter) return [];

    const displayParameter = toParameterDisplayName(rawParameter);
    return [
      {
        rawExactKey: normalizeParameterDisplayKey(rawParameter),
        displayExactKey: normalizeParameterDisplayKey(displayParameter),
        identityKey: toParameterIdentityKey(displayParameter),
        looseKey: toCanonicalParameterNameKey(displayParameter),
        unit: normalizeParameterUnit(extractParameterUnit(displayParameter)),
        standardCriteria: toOperatorFactoryMeasurementCriteria(instrument.standardCriteria),
        eiaCriteria: toOperatorFactoryMeasurementCriteria(instrument.eiaCriteria),
      },
    ];
  });

  return parameters.map((parameter) => {
    const exactKey = normalizeParameterDisplayKey(parameter);
    const identityKey = toParameterIdentityKey(parameter);
    const looseKey = toCanonicalParameterNameKey(parameter);
    const unit = normalizeParameterUnit(extractParameterUnit(parameter));
    const looseMatches = candidates.filter(
      (candidate) => candidate.looseKey === looseKey && (!unit || !candidate.unit),
    );
    const standards =
      candidates.find((candidate) => candidate.rawExactKey === exactKey) ??
      candidates.find((candidate) => candidate.displayExactKey === exactKey) ??
      candidates.find((candidate) => candidate.identityKey === identityKey) ??
      (looseMatches.length === 1 ? looseMatches[0] : undefined);

    return {
      parameter,
      standardCriteria: standards?.standardCriteria ?? null,
      eiaCriteria: standards?.eiaCriteria ?? null,
    };
  });
}

function toOperatorFactoryMeasurementCriteria(
  value: unknown,
): OperatorFactoryParameterStandardDTO['standardCriteria'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const criteria = value as Record<string, unknown>;
  if (typeof criteria.enabled !== 'boolean') return null;

  const standardValue = toOperatorFactoryStandardValue(criteria.standardValue);
  if (standardValue === undefined) return null;

  if (!Array.isArray(criteria.rows) || criteria.rows.length > 3) return null;
  const rows = criteria.rows.map(toOperatorFactoryMeasurementCriteriaRow);
  if (rows.some((row) => row === null)) return null;

  return {
    enabled: criteria.enabled,
    standardValue,
    rows: rows.filter((row): row is NonNullable<typeof row> => row !== null),
  };
}

function toOperatorFactoryStandardValue(value: unknown): string | number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= 255 ? trimmed : undefined;
}

function toOperatorFactoryMeasurementCriteriaRow(value: unknown): {
  level: 'normal' | 'warning' | 'critical';
  min: number | null;
  max: number | null;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const row = value as Record<string, unknown>;
  if (row.level !== 'normal' && row.level !== 'warning' && row.level !== 'critical') return null;
  if (!isNullableFiniteNumber(row.min) || !isNullableFiniteNumber(row.max)) return null;

  return { level: row.level, min: row.min, max: row.max };
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function toParameterIdentityKey(parameter: string): string {
  return `${toCanonicalParameterNameKey(parameter)}:${normalizeParameterUnit(
    extractParameterUnit(parameter),
  )}`;
}

function toCanonicalParameterNameKey(parameter: string): string {
  const key = toParameterColumnPrefix(parameter);
  if (key === 'temperature') return 'temp';
  if (key === 'flowrate') return 'flow';
  return key;
}

function normalizeParameterDisplayKey(parameter: string): string {
  return parameter
    .normalize('NFKD')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, '');
}

function isCubicMetersPerHourFlowParameter(parameter: string): boolean {
  const normalizedName = toParameterColumnPrefix(parameter);
  const normalizedUnit = normalizeParameterUnit(extractParameterUnit(parameter));
  const isFlowName = normalizedName === 'flow' || normalizedName === 'flowrate';
  return isFlowName && (!normalizedUnit || normalizedUnit === 'm3hr');
}

function filterEligibleFactoryRowsByQuery(
  factories: SelectedEligibleFactoryDTO[],
  query: ListOperatorFactoriesQuery,
  measurementPointsByFactory: Map<string, CurrentFactoryMeasurementPointDTO[]>,
): SelectedEligibleFactoryDTO[] {
  if (!query.systemType) return factories;

  return factories.filter(
    (factory) =>
      filterMeasurementPointsBySystem(
        measurementPointsByFactory.get(factory.factoryId) ?? [],
        query.systemType,
      ).length > 0,
  );
}

function buildEligibleFactoryLookupKeyMap(
  factories: SelectedEligibleFactoryDTO[],
): Map<string, string> {
  const keys = new Map<string, string>();

  factories.forEach((factory) => {
    [factory.factoryId, factory.factoryRegistrationNo].forEach((key) => {
      if (key) keys.set(key, factory.factoryId);
    });
  });

  return keys;
}

function mapConnectedMeasurementPointsToEligibleFactories(
  connectedPoints: CurrentFactoryMeasurementPointDTO[],
  factoryIdByLookupKey: Map<string, string>,
): Map<string, CurrentFactoryMeasurementPointDTO[]> {
  const measurementPointsByFactory = new Map<string, CurrentFactoryMeasurementPointDTO[]>();

  connectedPoints.forEach((point) => {
    const factoryId = factoryIdByLookupKey.get(point.factoryId) ?? point.factoryId;
    const currentPoints = measurementPointsByFactory.get(factoryId) ?? [];
    measurementPointsByFactory.set(factoryId, [...currentPoints, { ...point, factoryId }]);
  });

  return measurementPointsByFactory;
}

function mapConnectedMeasurementPointsToDashboardFactories(
  connectedPoints: CurrentFactoryMeasurementPointDTO[],
  factoryIdByLookupKey: Map<string, string>,
  factoryIdByEligibleFactoryId: Map<number, string>,
): Map<string, CurrentFactoryMeasurementPointDTO[]> {
  const measurementPointsByFactory = new Map<string, CurrentFactoryMeasurementPointDTO[]>();

  connectedPoints.forEach((point) => {
    const factoryId =
      (point.eligibleFactoryId === null || point.eligibleFactoryId === undefined
        ? undefined
        : factoryIdByEligibleFactoryId.get(point.eligibleFactoryId)) ??
      factoryIdByLookupKey.get(point.factoryId) ??
      point.factoryId;
    const currentPoints = measurementPointsByFactory.get(factoryId) ?? [];
    measurementPointsByFactory.set(factoryId, [...currentPoints, { ...point, factoryId }]);
  });

  return measurementPointsByFactory;
}

function mapLatestNewConnectionRequestsToFactories(
  requests: ConnectionRequestDTO[],
  factoryIdByLookupKey: Map<string, string>,
  factoryIdByEligibleFactoryId: Map<number, string>,
): Map<string, ConnectionRequestDTO> {
  const latestRequestByFactory = new Map<string, ConnectionRequestDTO>();

  requests.forEach((request) => {
    if (request.requestType !== CONNECTION_REQUEST_TYPE.NEW_CONNECTION) return;

    const factoryId =
      (request.eligibleFactoryId === null || request.eligibleFactoryId === undefined
        ? undefined
        : factoryIdByEligibleFactoryId.get(request.eligibleFactoryId)) ??
      factoryIdByLookupKey.get(request.factoryId) ??
      factoryIdByLookupKey.get(request.factoryRegistrationNo);
    if (!factoryId) return;

    const currentLatest = latestRequestByFactory.get(factoryId);
    if (!currentLatest || isRequestNewer(request, currentLatest)) {
      latestRequestByFactory.set(factoryId, request);
    }
  });

  return latestRequestByFactory;
}

function isRequestNewer(candidate: ConnectionRequestDTO, current: ConnectionRequestDTO): boolean {
  const candidateUpdatedAt = Date.parse(candidate.updatedAt);
  const currentUpdatedAt = Date.parse(current.updatedAt);
  if (
    Number.isFinite(candidateUpdatedAt) &&
    Number.isFinite(currentUpdatedAt) &&
    candidateUpdatedAt !== currentUpdatedAt
  ) {
    return candidateUpdatedAt > currentUpdatedAt;
  }
  return candidate.id > current.id;
}

function toOperatorFactoryOverviewBaseRow(
  factory: FactorySummaryDTO,
  currentMeasurementPoints: CurrentFactoryMeasurementPointDTO[],
  factoryMainTypeLabels: Map<string, string>,
): Omit<
  OperatorFactoryOverviewRowDTO,
  'isFavorite' | 'hasLatestHourlyMeasurement' | 'pomsMembershipStatus' | 'pomsMembershipStatusLabel'
> {
  const isInIndustrialEstate = Boolean(
    factory.industrialEstateCode || factory.industrialEstateName,
  );

  return {
    id: factory.id,
    eligibleFactoryId: factory.eligibleFactoryId ?? null,
    factoryId: factory.factoryId,
    factoryName: factory.factoryName,
    newRegistrationNo: factory.newRegistrationNo,
    oldRegistrationNo: factory.oldRegistrationNo,
    factoryLogoUrl: getFactoryLogoUrl(currentMeasurementPoints),
    industryMainOrder: factory.industryMainOrder,
    industryMainOrderLabel:
      (factory.industryMainOrder
        ? factoryMainTypeLabels.get(factory.industryMainOrder)
        : undefined) ??
      factory.industryMainOrderLabel ??
      null,
    industrySubOrder: factory.industrySubOrder,
    eia: factory.eia,
    hasEia: factory.hasEia ?? null,
    regionCode: factory.regionCode ?? factory.regionName ?? null,
    regionName: factory.regionName ?? factory.regionCode ?? null,
    provinceCode: factory.provinceCode ?? null,
    provinceName: factory.provinceName ?? factory.province,
    province: factory.province,
    address: factory.address,
    latitude: factory.latitude,
    longitude: factory.longitude,
    districtCode: factory.districtCode ?? null,
    districtName: factory.districtName ?? null,
    industrialAreaType:
      factory.industrialAreaType ??
      (isInIndustrialEstate ? 'INDUSTRIAL_ESTATE' : 'OUTSIDE_INDUSTRIAL_ESTATE'),
    industrialAreaTypeLabel:
      factory.industrialAreaTypeLabel ??
      (isInIndustrialEstate ? 'ในนิคมอุตสาหกรรม' : 'นอกนิคมอุตสาหกรรม'),
    industrialEstateCode: factory.industrialEstateCode ?? null,
    industrialEstateName: factory.industrialEstateName ?? null,
    isEligible: factory.isEligible === true,
    eligibilityStatus:
      factory.eligibilityStatus ?? (factory.isEligible === true ? 'เข้าข่าย' : 'ไม่เข้าข่าย'),
    monitoringPointCountBySystem: countMeasurementPointsBySystem(currentMeasurementPoints),
    status: 'แสดง',
    measurementPoints: currentMeasurementPoints.map(toOperatorFactoryMeasurementPoint),
  };
}

function toFactoryDashboardBaseRow(
  factory: FactorySummaryDTO,
  currentMeasurementPoints: CurrentFactoryMeasurementPointDTO[],
  factoryMainTypeLabels: Map<string, string>,
): Omit<PublicFactoryMapPointDTO, 'hasLatestHourlyMeasurement'> {
  if (factory.isEligible !== true) {
    return {
      id: factory.id,
      eligibleFactoryId: null,
      factoryId: factory.factoryId,
      factoryName: factory.factoryName,
      newRegistrationNo: null,
      oldRegistrationNo: null,
      factoryLogoUrl: null,
      industryMainOrder: null,
      industryMainOrderLabel: null,
      industrySubOrder: null,
      eia: null,
      hasEia: null,
      regionCode: null,
      regionName: null,
      provinceCode: null,
      provinceName: null,
      province: null,
      address: null,
      latitude: null,
      longitude: null,
      districtCode: null,
      districtName: null,
      industrialAreaType: null,
      industrialAreaTypeLabel: null,
      industrialEstateCode: null,
      industrialEstateName: null,
      isEligible: false,
      eligibilityStatus: 'ไม่เข้าข่าย',
      monitoringPointCountBySystem: countMeasurementPointsBySystem([]),
      status: 'แสดง',
      measurementPoints: [],
    };
  }

  const isInIndustrialEstate = Boolean(
    factory.industrialEstateCode || factory.industrialEstateName,
  );

  return {
    id: factory.id,
    eligibleFactoryId: factory.eligibleFactoryId ?? null,
    factoryId: factory.factoryId,
    factoryName: factory.factoryName,
    newRegistrationNo: factory.newRegistrationNo,
    oldRegistrationNo: factory.oldRegistrationNo,
    factoryLogoUrl: getFactoryLogoUrl(currentMeasurementPoints),
    industryMainOrder: factory.industryMainOrder,
    industryMainOrderLabel:
      (factory.industryMainOrder
        ? factoryMainTypeLabels.get(factory.industryMainOrder)
        : undefined) ??
      factory.industryMainOrderLabel ??
      null,
    industrySubOrder: factory.industrySubOrder,
    eia: factory.eia,
    hasEia: factory.hasEia ?? null,
    regionCode: factory.regionCode ?? factory.regionName ?? null,
    regionName: factory.regionName ?? factory.regionCode ?? null,
    provinceCode: factory.provinceCode ?? null,
    provinceName: factory.provinceName ?? factory.province,
    province: factory.province,
    address: factory.address,
    latitude: factory.latitude,
    longitude: factory.longitude,
    districtCode: factory.districtCode ?? null,
    districtName: factory.districtName ?? null,
    industrialAreaType:
      factory.industrialAreaType ??
      (isInIndustrialEstate ? 'INDUSTRIAL_ESTATE' : 'OUTSIDE_INDUSTRIAL_ESTATE'),
    industrialAreaTypeLabel:
      factory.industrialAreaTypeLabel ??
      (isInIndustrialEstate ? 'ในนิคมอุตสาหกรรม' : 'นอกนิคมอุตสาหกรรม'),
    industrialEstateCode: factory.industrialEstateCode ?? null,
    industrialEstateName: factory.industrialEstateName ?? null,
    isEligible: factory.isEligible ?? false,
    eligibilityStatus: factory.eligibilityStatus ?? 'ไม่เข้าข่าย',
    monitoringPointCountBySystem: countMeasurementPointsBySystem(currentMeasurementPoints),
    status: 'แสดง',
    measurementPoints: currentMeasurementPoints.map(toOperatorFactoryMeasurementPoint),
  };
}

function toNonEligibleOperatorFactoryTableRow(
  factory: FactorySummaryDTO,
): OperatorFactoryTableRowDTO {
  return {
    id: factory.id,
    factoryId: factory.factoryId,
    factoryName: factory.factoryName,
    newRegistrationNo: null,
    oldRegistrationNo: null,
    industryType: null,
    industryMainOrder: null,
    industrySubOrder: null,
    businessActivity: null,
    eia: null,
    projectName: null,
    address: null,
    latitude: null,
    longitude: null,
    province: null,
    officerNotificationEmails: [],
    isEligible: false,
    eligibilityStatus: 'ไม่เข้าข่าย',
    monitoringPointCount: 0,
    requestStatusCode: null,
    status: 'แสดง',
  };
}

function toOfficerEligibleFactoryTableRow(
  factory: SelectedEligibleFactoryDTO,
): Omit<OperatorFactoryTableRowDTO, 'officerNotificationEmails' | 'monitoringPointCount'> {
  return {
    id: factory.id,
    factoryId: factory.factoryId,
    factoryName: factory.factoryName,
    newRegistrationNo: factory.factoryId,
    oldRegistrationNo:
      factory.factoryRegistrationNo === factory.factoryId ? null : factory.factoryRegistrationNo,
    industryType: factory.businessActivity,
    industryMainOrder: factory.factoryClass,
    industrySubOrder: factory.factorySubclass,
    businessActivity: factory.businessActivity,
    eia: toEiaLabel(factory.hasEia),
    projectName: null,
    address: factory.address,
    latitude: toStringOrNull(factory.latitude),
    longitude: toStringOrNull(factory.longitude),
    province: factory.provinceName,
    isEligible: true,
    eligibilityStatus: 'เข้าข่าย',
    requestStatusCode: null,
    status: 'แสดง',
  };
}

function filterMeasurementPointsBySystem<T extends { systemType: ConnectionSystemType }>(
  measurementPoints: T[],
  systemType: ConnectionSystemType | undefined,
): T[] {
  if (!systemType) return measurementPoints;
  return measurementPoints.filter((point) => point.systemType === systemType);
}

function toEiaLabel(value: boolean | null | undefined): 'มี' | 'ไม่มี' | null {
  if (value === null || value === undefined) return null;
  return value ? 'มี' : 'ไม่มี';
}

function toStringOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

async function populateLatestHourlyMeasurements<
  TFactory extends { measurementPoints: OperatorFactoryMeasurementPointDTO[] },
>(factories: TFactory[], actorUserId: number, factoryViewScope: AccessScope): Promise<TFactory[]> {
  const now = nowProvider();
  const latestCompletedBangkokHour = toBangkokDateHour(new Date(now.getTime() - 60 * 60 * 1000));
  const factoriesWithLatestMeasurements = await Promise.all(
    factories.map(async (factory) => {
      const measurementPoints = await Promise.all(
        factory.measurementPoints.map(async (point) => ({
          ...point,
          data: await loadLatestHourlyMeasurementData(
            point.stationId,
            actorUserId,
            factoryViewScope,
            point.parameters,
            latestCompletedBangkokHour,
          ),
        })),
      );
      const factoryWithLatestMeasurements = {
        ...factory,
        measurementPoints,
      };
      return factoryWithLatestMeasurements;
    }),
  );

  return factoriesWithLatestMeasurements.map((factory) => ({
    ...factory,
    hasLatestHourlyMeasurement: hasMeasurementsForHour(
      factory.measurementPoints,
      latestCompletedBangkokHour,
    ),
  }));
}

interface DateHour {
  date: string;
  hour: number;
}

function toBangkokDateHour(date: Date): DateHour | null {
  const parts = bangkokDateHourFormatter.formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = valueByType.get('year');
  const month = valueByType.get('month');
  const day = valueByType.get('day');
  const hour = Number(valueByType.get('hour'));
  if (!year || !month || !day || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  return { date: `${year}-${month}-${day}`, hour };
}

function hasMeasurementsForHour(
  measurementPoints: OperatorFactoryMeasurementPointDTO[],
  currentHour: DateHour | null,
): boolean {
  if (!currentHour || measurementPoints.length === 0) return false;

  return measurementPoints.every(
    (point) =>
      point.data.length > 0 && point.data.every((row) => isMeasurementRowInHour(row, currentHour)),
  );
}

function isMeasurementRowInHour(row: Record<string, unknown>, currentHour: DateHour): boolean {
  if (typeof row.cdate !== 'string' || row.cdate.trim() !== currentHour.date) return false;
  if (typeof row.ctime !== 'string') return false;

  const hourMatch = row.ctime.trim().match(/^(\d{1,2})(?::|\.)/);
  if (!hourMatch) return false;

  return Number(hourMatch[1]) === currentHour.hour;
}

async function listFactoryMainTypeLabelsForDashboard(
  factories: FactorySummaryDTO[],
): Promise<Map<string, string>> {
  const codes = [
    ...new Set(
      factories
        .map((factory) => factory.industryMainOrder)
        .filter((code): code is string => Boolean(code?.trim()) && code !== 'ไม่ระบุ'),
    ),
  ];
  if (codes.length === 0) return new Map();

  try {
    return await connectionRequestsRepository.listFactoryMainTypeLabels(codes);
  } catch (error) {
    logger.warn('[operator-factories] Failed to load factory main type labels', {
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Map();
  }
}

async function loadLatestHourlyMeasurementData(
  stationId: string | null,
  actorUserId: number,
  factoryViewScope: AccessScope,
  parameterDisplayNames: string[],
  cutoff: DateHour | null,
): Promise<Record<string, unknown>[]> {
  if (!stationId || !isSafeStationId(stationId) || !cutoff) return [];

  try {
    const result = await parameterValuesService.latestHourly(
      stationId,
      {
        actorUserId,
        scope: factoryViewScope,
      },
      cutoff,
    );
    return result.data.map((row) => toDashboardMeasurementRow(row, parameterDisplayNames));
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) return [];
    logger.warn('[operator-factories] Failed to load latest hourly measurement values', {
      stationId,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

const dashboardBaseMeasurementColumns = new Set(['station_id', 'cdate', 'ctime']);
type AccessScope = string | null | undefined | PermissionScopeDetails;

function ensureMeasurementPointWorkflowActor(
  actor: MeasurementPointSubmissionActorContext | null,
): asserts actor is MeasurementPointSubmissionActorContext {
  if (!actor) {
    throw new ForbiddenError('Submission action requires an authenticated workflow actor');
  }

  const isOfficerUser = actor.userType === 'officer' || actor.userType === 'admin';
  const isAdmin = actor.roles.includes('admin');
  const hasKpmRole = actor.roles.includes('monitoring_kpm');
  if (!isOfficerUser || (!hasKpmRole && !isAdmin)) {
    throw new ForbiddenError(
      'Officer workflow submission is limited to monitoring_kpm and admin users',
    );
  }
}

function ensureDirectConnectionActor(actor: DirectConnectionActorContext): void {
  const isOfficerUser = actor.userType === 'officer' || actor.userType === 'admin';
  const isAdmin = actor.roles.includes('admin');
  const hasKpmRole = actor.roles.includes('monitoring_kpm');
  if (!isOfficerUser || (!hasKpmRole && !isAdmin)) {
    throw new ForbiddenError('Officer direct connection is limited to monitoring_kpm and admin');
  }

  if (isAdmin) return;

  const scopeValue = getAccessScopeValue(actor.scope);
  const effectiveRegions = resolveEffectiveRegionValues(actor.scope, actor.regionalAccess);
  if (
    !(
      scopeValue === 'ALL' ||
      (scopeValue === 'IN_REGION' &&
        effectiveRegions.length > 0 &&
        effectiveRegions.every((value) => value === 'ภาคกลาง'))
    )
  ) {
    throw new ForbiddenError('Officer direct connection is limited to central monitoring_kpm');
  }

  const regionalValues = normalizedRegionalValues(actor.regionalAccess);
  if (regionalValues.length > 0 && regionalValues.some((value) => value !== 'ภาคกลาง')) {
    throw new ForbiddenError('Officer direct connection is limited to central monitoring_kpm');
  }
}

function getAccessScopeValue(scope: AccessScope): string | null | undefined {
  return scope && typeof scope === 'object' ? scope.scope : scope;
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}

function getScopeRegion(scope: AccessScope): string | null {
  if (!scope || typeof scope !== 'object') return null;
  const region = Reflect.get(scope as unknown as Record<string, unknown>, 'region');
  return typeof region === 'string' ? normalizeLocationValue(region) : null;
}

function resolveEffectiveRegionValues(
  scope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): string[] {
  if (!scope || typeof scope !== 'object' || scope.scope !== 'IN_REGION') return [];
  return resolveAssignedRegions(getScopeRegion(scope), regionalAccess);
}

function toDashboardMeasurementRow(
  row: Record<string, unknown>,
  parameterDisplayNames: string[],
): Record<string, unknown> {
  const parametersByColumnPrefix = groupParametersByColumnPrefix(parameterDisplayNames);
  const result: Record<string, unknown> = Object.fromEntries(
    parameterDisplayNames.map((parameter) => [parameter, null]),
  );

  Object.entries(row).forEach(([key, value]) => {
    if (dashboardBaseMeasurementColumns.has(key)) {
      result[key] = value;
      return;
    }

    const valueColumnMatch = key.match(/^(.+)_value$/i);
    if (!valueColumnMatch) return;

    const columnPrefix = valueColumnMatch[1].toLowerCase();
    const displayName = findDashboardParameterDisplayName(
      parametersByColumnPrefix.get(columnPrefix) ?? [],
      row[`${columnPrefix}_units`],
      columnPrefix,
    );
    if (displayName) {
      result[displayName] = toDashboardMeasurementDisplayValue(
        value,
        row[`${columnPrefix}_status`],
      );
    }
  });

  return result;
}

function toDashboardMeasurementDisplayValue(value: unknown, status: unknown): unknown {
  const displayValue = measurementDisplayValue(value, status);
  if (typeof displayValue === 'number') return displayValue < 0 ? 'ERROR' : displayValue;
  if (typeof displayValue !== 'string' || displayValue.trim() === '') return displayValue;

  const numericValue = Number(displayValue.trim());
  return Number.isFinite(numericValue) && numericValue < 0 ? 'ERROR' : displayValue;
}

function groupParametersByColumnPrefix(parameters: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const parameter of parameters) {
    const prefix =
      parameter === canonicalFlowRateLabel ? 'flow' : toParameterColumnPrefix(parameter);
    grouped.set(prefix, [...(grouped.get(prefix) ?? []), parameter]);
  }
  return grouped;
}

function findDashboardParameterDisplayName(
  candidates: string[],
  sourceUnit: unknown,
  columnPrefix: string,
): string | null {
  if (candidates.length === 1) return candidates[0];

  const unit = typeof sourceUnit === 'string' ? normalizeParameterUnit(sourceUnit) : '';
  if (unit) {
    const unitMatch = candidates.find(
      (candidate) => normalizeParameterUnit(extractParameterUnit(candidate)) === unit,
    );
    if (unitMatch) return unitMatch;
  }

  if (candidates.length > 1) return null;
  return parameterUnitLabels[columnPrefix] ?? null;
}

function extractParameterUnit(parameter: string): string {
  const match = parameter.match(/\(([^)]+)\)/);
  return match?.[1] ?? '';
}

function normalizeParameterUnit(unit: string): string {
  return unit
    .normalize('NFKD')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, '');
}

function toParameterColumnPrefix(parameter: string): string {
  return parameter
    .split('(')[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isSafeStationId(stationId: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(stationId) || isAnnualMonitoringPointCode(stationId);
}

function countMeasurementPointsBySystem(
  points: Array<{ systemType: ConnectionSystemType }>,
): OperatorFactoryDashboardRowDTO['monitoringPointCountBySystem'] {
  return [
    { systemType: 'CEMS', count: points.filter((point) => point.systemType === 'CEMS').length },
    { systemType: 'WPMS', count: points.filter((point) => point.systemType === 'WPMS').length },
  ];
}

function matchesOperatorFactoryDashboardQuery(
  factory: OperatorFactoryDashboardRowDTO,
  query: ListOperatorFactoriesQuery,
): boolean {
  if (query.connectedOnly && factory.measurementPoints.length === 0) return false;
  if (
    query.systemType &&
    !factory.measurementPoints.some((point) => point.systemType === query.systemType)
  ) {
    return false;
  }
  if (query.favoriteOnly && !factory.isFavorite) return false;
  return true;
}

function matchesOperatorFactoryOverviewQuery(
  factory: OperatorFactoryOverviewRowDTO,
  query: ListOperatorFactoryOverviewQuery,
): boolean {
  if (
    query.systemType &&
    !factory.measurementPoints.some((point) => point.systemType === query.systemType)
  ) {
    return false;
  }
  if (query.favoriteOnly && !factory.isFavorite) return false;
  if (query.pomsMembershipStatus && factory.pomsMembershipStatus !== query.pomsMembershipStatus) {
    return false;
  }
  return true;
}

function summarizeOperatorFactoryOverview(
  factories: OperatorFactoryOverviewRowDTO[],
  latestNewConnectionRequestByFactory: ReadonlyMap<string, ConnectionRequestDTO>,
): OperatorFactoryOverviewResultDTO['meta']['summary'] {
  return factories.reduce<OperatorFactoryOverviewResultDTO['meta']['summary']>(
    (summary, factory) => {
      summary.all += 1;
      if (factory.pomsMembershipStatus === POMS_MEMBERSHIP_STATUS.IN_POMS) {
        summary.inPoms += 1;
      } else if (
        isConnectionRequestInProgress(latestNewConnectionRequestByFactory.get(factory.factoryId))
      ) {
        summary.connectionInProgress += 1;
      } else {
        summary.notConnected += 1;
      }
      return summary;
    },
    { all: 0, inPoms: 0, connectionInProgress: 0, notConnected: 0 },
  );
}

function isConnectionRequestInProgress(request: ConnectionRequestDTO | undefined): boolean {
  return (
    request !== undefined &&
    request.status !== CONNECTION_REQUEST_STATUS.CONNECTED &&
    request.status !== CONNECTION_REQUEST_STATUS.CANCELED
  );
}

function matchesPublicFactoryMapPointsQuery(
  factory: PublicFactoryMapPointDTO,
  query: ListPublicFactoryMapPointsQuery,
): boolean {
  if (factory.measurementPoints.length === 0) return false;
  if (
    query.systemType &&
    !factory.measurementPoints.some((point) => point.systemType === query.systemType)
  ) {
    return false;
  }
  return true;
}

async function loadConnectedMeasurementPointDetail(
  stationId: string,
  actorUserId: number,
  viewScope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): Promise<ConnectedMeasurementPointDetailDTO> {
  const result = await connectionRequestsService.listConnectedMeasurementPoints(
    { stationId },
    actorUserId,
    viewScope,
    regionalAccess,
  );
  const point = result.data[0];
  if (!point) throw new NotFoundError(`Connected measurement point ${stationId} not found`);
  return point;
}

async function loadConnectedMeasurementPointExportContext(
  stationId: string,
  actorUserId: number,
  exportScope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): Promise<{ factoryName: string; factoryRegistrationNumber: string }> {
  const { rows } = await connectionRequestsRepository.list(
    { stationId, status: CONNECTION_REQUEST_STATUS.CONNECTED },
    {
      actorUserId,
      scope: exportScope,
      regionalAccess,
      useAssignedFactoryAccess: true,
    },
  );
  const request = rows.find((row) =>
    row.measurementPoints.some((point) => stationMatchesMeasurementPoint(point, stationId)),
  );
  if (!request) throw new NotFoundError(`Connected measurement point ${stationId} not found`);

  const currentNames = await connectionRequestsRepository.findCurrentPomsFactoryNamesForRequests([
    request,
  ]);
  return {
    factoryName:
      currentNames.get(request.factoryId) ??
      currentNames.get(request.factoryRegistrationNo) ??
      request.factoryName,
    factoryRegistrationNumber: request.factoryRegistrationNo,
  };
}

function toConnectedMeasurementPointModalDetail(
  detail: ConnectedMeasurementPointDetailDTO,
  connectedPointId: number | null,
): ConnectedMeasurementPointModalDetailDTO {
  const isCems = detail.type === 'CEMS';
  const productionCapacity = isCems
    ? deriveCemsProductionCapacity(detail.point.details)
    : { value: null, unit: null };
  const baseDetail = {
    connectedPointId,
    pointCode: detail.point.pointCode ?? null,
    pointName: detail.point.pointName,
    pointType: detail.type,
    parameterDetails: detail.point.parameters,
    parameterInstrumentDetails: isCems ? deriveCemsParameterInstrumentDetails(detail.point) : [],
    primaryFuel: stringDetail(detail.point.details, 'primaryFuel'),
    secondaryFuel: stringDetail(detail.point.details, 'secondaryFuel'),
    productionStack: isCems
      ? firstStringDetail(detail.point.details, 'productionStack', 'productionUnitType')
      : null,
    combustionSystem: isCems ? deriveCemsCombustionSystem(detail.point.details) : null,
    productionCapacity: productionCapacity.value,
    productionCapacityUnit: productionCapacity.unit,
    cemsModel: isCems ? deriveCemsModel(detail.point) : null,
  };

  if (detail.type !== 'WPMS') return baseDetail;

  return {
    ...baseDetail,
    instruments: deriveWpmsInstrumentOptions(detail.point),
    measurementTimes: deriveWpmsMeasurementTimes(detail.point),
    wastewaterSource: stringDetail(detail.point.details, 'wastewaterSource'),
    receivingSource: stringDetail(detail.point.details, 'dischargeReceivingSource'),
    treatmentSystemType: joinedStringDetail(detail.point.details, 'treatmentSystem'),
    dischargePoint: buildWpmsDischargePoint(detail.point.details),
    averageDischarge: scalarDetail(detail.point.details, 'averageWastewaterDischarge'),
    minimumDischarge: scalarDetail(detail.point.details, 'minWastewaterDischarge'),
    maximumDischarge: scalarDetail(detail.point.details, 'maxWastewaterDischarge'),
  };
}

function stringDetail(details: MeasurementPointDTO['details'], key: string): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;

  const value = details[key];
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstStringDetail(
  details: MeasurementPointDTO['details'],
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = stringDetail(details, key);
    if (value) return value;
  }
  return null;
}

function deriveCemsCombustionSystem(
  details: MeasurementPointDTO['details'],
): 'ระบบปิด' | 'ระบบเปิด' | null {
  const value = firstStringDetail(details, 'combustionSystem', 'combustionControlSystem');
  return value === 'ระบบปิด' || value === 'ระบบเปิด' ? value : null;
}

function deriveCemsProductionCapacity(details: MeasurementPointDTO['details']): {
  value: string | null;
  unit: string | null;
} {
  const unit = stringDetail(details, 'productionCapacityUnit');
  const explicitValue = scalarTextDetail(details, 'productionCapacityValue');
  if (explicitValue) return { value: explicitValue, unit };

  const combinedValue = scalarTextDetail(details, 'productionCapacity');
  if (!combinedValue || !unit || !combinedValue.endsWith(unit)) {
    return { value: combinedValue, unit };
  }

  const valueWithoutUnit = combinedValue.slice(0, -unit.length).trim();
  return { value: valueWithoutUnit || combinedValue, unit };
}

function deriveCemsModel(point: MeasurementPointDTO): string | null {
  const brands =
    point.measurementInstruments?.parameters
      .map((parameter) => parameter.brand?.trim())
      .filter((brand): brand is string => Boolean(brand)) ?? [];
  const uniqueBrands = [...new Set(brands)];
  return uniqueBrands.length > 0 ? uniqueBrands.join(', ') : null;
}

function deriveCemsParameterInstrumentDetails(
  point: MeasurementPointDTO,
): ConnectedMeasurementPointModalDetailDTO['parameterInstrumentDetails'] {
  const instrumentParameters = point.measurementInstruments?.parameters ?? [];

  return point.parameters.map((parameter) => {
    const normalizedParameter = normalizeParameterName(parameter);
    const brands = instrumentParameters
      .filter(
        (instrumentParameter) =>
          normalizeParameterName(instrumentParameter.parameter) === normalizedParameter,
      )
      .map((instrumentParameter) => instrumentParameter.brand?.trim())
      .filter((brand): brand is string => Boolean(brand));
    const uniqueBrands = [...new Set(brands)];

    return {
      parameter,
      cemsModel: uniqueBrands.length > 0 ? uniqueBrands.join(', ') : null,
    };
  });
}

function normalizeParameterName(parameter: string): string {
  return parameter.trim().toLowerCase();
}

function joinedStringDetail(details: MeasurementPointDTO['details'], key: string): string | null {
  const scalarValue = stringDetail(details, key);
  if (scalarValue) return scalarValue;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;

  const value = details[key];
  if (!Array.isArray(value)) return null;

  const normalizedValues = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return normalizedValues.length > 0 ? [...new Set(normalizedValues)].join(', ') : null;
}

function scalarDetail(
  details: MeasurementPointDTO['details'],
  key: string,
): number | string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;

  const value = details[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function scalarTextDetail(details: MeasurementPointDTO['details'], key: string): string | null {
  const value = scalarDetail(details, key);
  return value === null ? null : String(value);
}

function buildWpmsDischargePoint(details: MeasurementPointDTO['details']): string | null {
  const directValue = stringDetail(details, 'dischargePoint');
  if (directValue) return directValue;

  const latitude = scalarDetail(details, 'instrumentLatitude');
  const longitude = scalarDetail(details, 'instrumentLongitude');
  if (latitude === null || longitude === null) return null;

  return `${latitude}, ${longitude}`;
}

function deriveWpmsInstrumentOptions(point: MeasurementPointDTO): string[] {
  const parameterNames = point.parameters.map((parameter) => parameter.toLowerCase());
  const hasBod = parameterNames.some((parameter) => parameter.includes('bod'));
  const hasCod = parameterNames.some((parameter) => parameter.includes('cod'));

  if (hasBod && hasCod) return ['ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)'];
  if (hasBod) return ['ค่าบีโอดี (BOD)'];
  if (hasCod) return ['ค่าซีโอดี (COD)'];

  return [];
}

function deriveWpmsMeasurementTimes(point: MeasurementPointDTO): string[] {
  const measurementTimes = point.measurementInstruments?.parameters
    .map((parameter) => parameter.technique?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(measurementTimes ?? [])];
}

function toMeasurementDetailFactory(point: ConnectedMeasurementPointDetailDTO): {
  factoryId: string;
  factoryName: string;
  systemType: string;
} {
  return {
    factoryId: point.factory?.factoryId ?? '',
    factoryName: point.factory?.factoryName ?? '',
    systemType: point.type,
  };
}

function toParameterEvaluationOptions(
  point: ConnectedMeasurementPointDetailDTO,
): ParameterEvaluationOptions {
  const instrumentParameters = point.point.measurementInstruments?.parameters ?? [];
  const instrumentsByParameter = new Map(
    instrumentParameters.map((parameter) => [
      toParameterColumnPrefix(parameter.parameter),
      parameter,
    ]),
  );
  const channelStatusesByParameter = buildChannelStatusesByParameter(point);
  const parameterNamesByKey = new Map<string, string>();

  for (const parameter of point.point.parameters) {
    parameterNamesByKey.set(toParameterColumnPrefix(parameter), parameter);
  }
  for (const parameter of instrumentParameters) {
    parameterNamesByKey.set(toParameterColumnPrefix(parameter.parameter), parameter.parameter);
  }
  for (const [key, channel] of channelStatusesByParameter) {
    parameterNamesByKey.set(key, channel.parameter);
  }

  return {
    parameterEvaluations: [...parameterNamesByKey.entries()].map(([key, parameter]) => ({
      parameter,
      standardCriteria: instrumentsByParameter.get(key)?.standardCriteria ?? null,
      eiaCriteria: instrumentsByParameter.get(key)?.eiaCriteria ?? null,
      channelStatus: channelStatusesByParameter.get(key)?.status ?? null,
    })),
  };
}

function buildChannelStatusesByParameter(
  point: ConnectedMeasurementPointDetailDTO,
): Map<string, { parameter: string; status: string | null }> {
  const statuses = new Map<string, { parameter: string; status: string | null }>();

  for (const config of point.deviceConfigs) {
    for (const channel of config.channels) {
      const key = toParameterColumnPrefix(channel.dataType);
      const current = statuses.get(key);
      const nextStatus = channel.status ?? null;
      statuses.set(key, {
        parameter: current?.parameter ?? channel.dataType,
        status: mergeChannelStatus(current?.status ?? null, nextStatus),
      });
    }
  }

  return statuses;
}

function mergeChannelStatus(current: string | null, next: string | null): string | null {
  if (current && !isNormalDeviceChannelStatus(current)) return current;
  if (next && !isNormalDeviceChannelStatus(next)) return next;
  return current ?? next;
}

function isNormalDeviceChannelStatus(value: string): boolean {
  return value.trim().toLowerCase() === 'normal';
}

async function loadRequest(id: number): Promise<ConnectionRequestDTO> {
  const request = await connectionRequestsRepository.findById(id);
  if (!request) throw new NotFoundError('Connection request not found');
  return request;
}

function ensureCanApprove(
  request: ConnectionRequestDTO,
  approveScope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): void {
  if (
    requestMatchesPermissionScope(request, approveScope, regionalAccess) &&
    requestMatchesRegionalAccess(request, approveScope, regionalAccess)
  ) {
    return;
  }
  throw new NotFoundError('Connection request not found');
}

function requestMatchesPermissionScope(
  request: ConnectionRequestDTO,
  scope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): boolean {
  const scopeValue = getAccessScopeValue(scope);
  if (scopeValue === 'ALL') return true;
  if (!scope || typeof scope !== 'object') return false;

  const regionValues = resolveEffectiveRegionValues(scope, regionalAccess);
  const province = normalizeLocationValue(scope.province);
  if (scope.scope === 'IN_REGION' && regionValues.length > 0) {
    return (
      regionValues.includes(request.regionName ?? '') ||
      regionValues.includes(request.regionCode ?? '')
    );
  }
  if (scope.scope === 'IN_PROVINCE' && province) {
    return request.provinceName === province || request.provinceCode === province;
  }
  if (scope.scope === 'IN_ESTATE') {
    const estateCode = getScopeEstateCode(scope);
    return Boolean(estateCode && request.industrialEstateCode === estateCode);
  }
  return false;
}

function requestMatchesRegionalAccess(
  request: ConnectionRequestDTO,
  scope: AccessScope,
  regionalAccess: RegionalAccessDTO | null | undefined,
): boolean {
  if (getAccessScopeValue(scope) === 'ALL') return true;
  const allowedRegions = new Set(normalizedRegionalValues(regionalAccess));
  if (allowedRegions.size === 0) return true;
  return Boolean(
    (request.regionName && allowedRegions.has(request.regionName)) ||
    (request.regionCode && allowedRegions.has(request.regionCode)),
  );
}

function normalizedRegionalValues(regionalAccess: RegionalAccessDTO | null | undefined): string[] {
  return (regionalAccess?.regions ?? []).map((value) => value.trim()).filter(Boolean);
}

function getScopeEstateCode(scope: PermissionScopeDetails): string | null {
  const estateCode = Reflect.get(scope as unknown as Record<string, unknown>, 'estateCode');
  if (typeof estateCode === 'string') return normalizeLocationValue(estateCode);

  const legacyEstateCode = Reflect.get(
    scope as unknown as Record<string, unknown>,
    'industrialEstateCode',
  );
  if (typeof legacyEstateCode === 'string') return normalizeLocationValue(legacyEstateCode);

  const estate = Reflect.get(scope as unknown as Record<string, unknown>, 'estate');
  if (typeof estate === 'string') return normalizeLocationValue(estate);

  const estateId = Reflect.get(scope as unknown as Record<string, unknown>, 'estateId');
  if (typeof estateId === 'string') return normalizeLocationValue(estateId);
  if (typeof estateId === 'number' && Number.isFinite(estateId)) return String(estateId);

  const legacyEstateId = Reflect.get(
    scope as unknown as Record<string, unknown>,
    'industrialEstateId',
  );
  if (typeof legacyEstateId === 'string') return normalizeLocationValue(legacyEstateId);
  if (typeof legacyEstateId === 'number' && Number.isFinite(legacyEstateId)) {
    return String(legacyEstateId);
  }
  return null;
}

function ensureOwner(request: ConnectionRequestDTO, actorUserId: number): void {
  if (request.createdBy !== actorUserId) {
    throw new ForbiddenError('Only the request owner can perform this action');
  }
}

function ensureStatus(
  request: ConnectionRequestDTO,
  allowedStatuses: ConnectionRequestStatus[],
): void {
  if (!allowedStatuses.includes(request.status)) {
    throw new BadRequestError('Invalid connection request status for this action', {
      currentStatus: request.status,
      allowedStatuses,
    });
  }
}

function ensureStationBelongsToRequest(request: ConnectionRequestDTO, stationId: string): void {
  const matched = request.measurementPoints.some(
    (point) => point.pointCode === stationId || point.pointName === stationId,
  );
  if (!matched) {
    throw new BadRequestError('Device config stationId must match a measurement point in request', {
      stationId,
      measurementPoints: request.measurementPoints.map((point) => ({
        pointCode: point.pointCode,
        pointName: point.pointName,
      })),
    });
  }
}

function ensureStatusScheduleParametersBelongToRequest(
  request: ConnectionRequestDTO,
  config: CreateDeviceConnectionConfigInput,
): void {
  const schedules = config.statusManagement?.schedules ?? [];
  if (schedules.length === 0) return;

  const monitoringPoint = findMonitoringPoint(request, config.stationId);
  const monitoringPointParameters = getDeviceConfigParameterOptions(monitoringPoint);
  const allowedParameters = new Set([
    ...monitoringPointParameters,
    ...config.channels
      .map((channel) => channel.dataType)
      .filter((label) => isDerivedParameterLabel(label, monitoringPointParameters)),
  ]);
  const invalidParameters = [
    ...new Set(
      schedules.flatMap((schedule) =>
        schedule.selectedParameters.filter(
          (parameter) => parameter !== 'ทั้งหมด' && !allowedParameters.has(parameter),
        ),
      ),
    ),
  ];

  if (invalidParameters.length > 0) {
    throw new BadRequestError(
      'Status schedule parameters must match the selected measurement point',
      {
        stationId: config.stationId,
        invalidParameters,
        allowedParameters: [...allowedParameters],
      },
    );
  }
}

function isDerivedParameterLabel(label: string, parameterOptions: string[]): boolean {
  const normalizedLabel = normalizeParameterName(label);
  const labelWithoutUnit = normalizeParameterName(label.replace(/\s*\([^)]*\)\s*$/, ''));

  return parameterOptions.some((option) => {
    const normalizedOption = normalizeParameterName(option);
    if (normalizedOption === normalizedLabel) return true;
    if (/\([^)]*\)\s*$/.test(option)) return false;
    return normalizedOption === labelWithoutUnit;
  });
}

function ensureConfigStationMatchesRoute(routeStationId: string, payloadStationId: string): void {
  if (routeStationId === payloadStationId) return;
  throw new BadRequestError('Device config stationId must match selected measurement point', {
    stationId: payloadStationId,
    selectedStationId: routeStationId,
  });
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
