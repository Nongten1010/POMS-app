import type { RegionalAccessDTO } from '../auth/regional-access';
import { kwpFormReportsRepository } from './kwp-form-reports.repository';
import type {
  KwpFormReportAccess,
  KwpFormFactoryTableRowDTO,
  KwpFormRequestTableRowDTO,
  ListKwpFormRequestsQuery,
  PaginatedKwpFormTableRowsDTO,
} from './kwp-form-reports.types';

export const kwpFormReportsService = {
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
