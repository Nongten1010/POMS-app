import type { RegionalAccessDTO } from '../auth/regional-access';
import { kwpFormReportsRepository } from './kwp-form-reports.repository';
import type {
  KwpFormFactoryTableRowDTO,
  KwpFormReportAccess,
  KwpFormRequestTableRowDTO,
  ListKwpFormRequestsQuery,
  PaginatedKwpFormTableRowsDTO,
} from './kwp-form-reports.types';

export const kwpFormReportsService = {
  listFactories(
    actorUserId: number,
    scope: string | null | undefined,
    regionalAccess?: RegionalAccessDTO | null,
    locationAccess?: KwpFormReportAccess['locationAccess'],
  ): Promise<PaginatedKwpFormTableRowsDTO<KwpFormFactoryTableRowDTO>> {
    return kwpFormReportsRepository
      .listFactories({ actorUserId, scope, regionalAccess, locationAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },

  listRequests(
    query: ListKwpFormRequestsQuery,
    actorUserId: number,
    scope: string | null | undefined,
    regionalAccess?: RegionalAccessDTO | null,
    locationAccess?: KwpFormReportAccess['locationAccess'],
  ): Promise<PaginatedKwpFormTableRowsDTO<KwpFormRequestTableRowDTO>> {
    return kwpFormReportsRepository
      .listRequests(query, { actorUserId, scope, regionalAccess, locationAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },
};
