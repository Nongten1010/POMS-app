import type { RegionalAccessDTO } from '../auth/regional-access';
import { bodCodDeviationReportsRepository } from './bod-cod-deviation-reports.repository';
import type {
  BodCodDeviationFactoryTableRowDTO,
  BodCodDeviationReportTableRowDTO,
  ListBodCodDeviationReportsQuery,
  PaginatedBodCodDeviationTableRowsDTO,
} from './bod-cod-deviation-reports.types';

export const bodCodDeviationReportsService = {
  listFactories(
    actorUserId: number,
    scope: string | null | undefined,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedBodCodDeviationTableRowsDTO<BodCodDeviationFactoryTableRowDTO>> {
    return bodCodDeviationReportsRepository
      .listFactories({ actorUserId, scope, regionalAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },

  listReports(
    query: ListBodCodDeviationReportsQuery,
    actorUserId: number,
    scope: string | null | undefined,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedBodCodDeviationTableRowsDTO<BodCodDeviationReportTableRowDTO>> {
    return bodCodDeviationReportsRepository
      .listReports(query, { actorUserId, scope, regionalAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },
};
