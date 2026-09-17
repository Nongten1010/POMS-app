import type { RegionalAccessDTO } from '../auth/regional-access';
import { kwpFormReportsRepository } from './kwp-form-reports.repository';
import { db } from '../../config/database';
import { connectionRequestsService } from '../connection-requests/connection-requests.service';
import {
  getKwpEligibleParameters,
  parameterKey,
} from '../kwp-form-submissions/kwp-form-parameters';
import type {
  KwpFormReportAccess,
  KwpFormFactoryTableRowDTO,
  KwpFormRequestTableRowDTO,
  ListKwpFormRequestsQuery,
  PaginatedKwpFormTableRowsDTO,
} from './kwp-form-reports.types';

export const kwpFormReportsService = {
  async listMeasurementPoints(
    factoryId: string,
    actorUserId: number,
    scope: KwpFormReportAccess['scope'],
    regionalAccess?: RegionalAccessDTO | null,
  ) {
    const result = await connectionRequestsService.getConnectedMeasurementPointDetailsByFactory(
      factoryId,
      actorUserId,
      scope,
      regionalAccess,
    );
    const data = await Promise.all(
      result.data.map(async (point) => {
        const parameters = await getKwpEligibleParameters(db, {
          factoryId,
          connectedPointId: point.connectedPointId,
          pointCode: point.pointCode,
          pointName: point.pointName,
        });
        return {
          ...point,
          parameterDetails: parameters,
          parameterInstrumentDetails:
            point.pointType === 'CEMS'
              ? parameters.map((parameter) => ({
                  parameter,
                  cemsModel:
                    point.parameterInstrumentDetails.find(
                      (item) => parameterKey(item.parameter) === parameterKey(parameter),
                    )?.cemsModel ?? null,
                }))
              : [],
        };
      }),
    );
    return { data, meta: { total: data.length } };
  },
  listFactories(
    actorUserId: number,
    scope: KwpFormReportAccess['scope'],
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedKwpFormTableRowsDTO<KwpFormFactoryTableRowDTO>> {
    return kwpFormReportsRepository
      .listFactories({ actorUserId, scope, regionalAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },

  listRequests(
    query: ListKwpFormRequestsQuery,
    actorUserId: number,
    scope: KwpFormReportAccess['scope'],
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedKwpFormTableRowsDTO<KwpFormRequestTableRowDTO>> {
    return kwpFormReportsRepository
      .listRequests(query, { actorUserId, scope, regionalAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },
};
