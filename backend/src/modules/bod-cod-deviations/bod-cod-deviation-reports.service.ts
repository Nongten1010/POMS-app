import type { RegionalAccessDTO } from '../auth/regional-access';
import { bodCodDeviationReportsRepository } from './bod-cod-deviation-reports.repository';
import type {
  BodCodDeviationAccess,
  BodCodDeviationFactoryTableRowDTO,
  BodCodDeviationReportDetailDTO,
  BodCodDeviationReportTableRowDTO,
  ChangeBodCodWorkflowStatusDTO,
  CreateBodCodDeviationReportAccess,
  CreateBodCodDeviationReportDTO,
  CreatedBodCodDeviationReportDTO,
  ListBodCodDeviationReportsQuery,
  PaginatedBodCodDeviationTableRowsDTO,
  ResubmitBodCodDeviationReportDTO,
  UpsertBodCodResultNoticeDTO,
  UpsertedBodCodResultNoticeResponseDTO,
} from './bod-cod-deviation-reports.types';

export const bodCodDeviationReportsService = {
  listFactories(
    actorUserId: number,
    scope: BodCodDeviationAccess['scope'],
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedBodCodDeviationTableRowsDTO<BodCodDeviationFactoryTableRowDTO>> {
    return bodCodDeviationReportsRepository
      .listFactories({ actorUserId, scope, regionalAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },

  listReports(
    query: ListBodCodDeviationReportsQuery,
    actorUserId: number,
    scope: BodCodDeviationAccess['scope'],
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PaginatedBodCodDeviationTableRowsDTO<BodCodDeviationReportTableRowDTO>> {
    return bodCodDeviationReportsRepository
      .listReports(query, { actorUserId, scope, regionalAccess })
      .then(({ rows, total }) => ({ data: rows, meta: { total } }));
  },

  createReport(
    input: CreateBodCodDeviationReportDTO,
    access: CreateBodCodDeviationReportAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return bodCodDeviationReportsRepository.createReport(input, access);
  },

  cancelReport(
    id: number,
    access: BodCodDeviationAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return bodCodDeviationReportsRepository.cancelReport(id, access);
  },

  resubmitReport(
    id: number,
    input: ResubmitBodCodDeviationReportDTO,
    access: CreateBodCodDeviationReportAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return bodCodDeviationReportsRepository.resubmitReport(id, input, access);
  },

  changeWorkflowStatus(
    id: number,
    input: ChangeBodCodWorkflowStatusDTO,
    access: BodCodDeviationAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return bodCodDeviationReportsRepository.changeWorkflowStatus(id, input, access);
  },

  upsertResultNotice(
    id: number,
    input: UpsertBodCodResultNoticeDTO,
    access: BodCodDeviationAccess,
  ): Promise<UpsertedBodCodResultNoticeResponseDTO> {
    return bodCodDeviationReportsRepository.upsertResultNotice(id, input, access);
  },

  getReportById(
    id: number,
    access: BodCodDeviationAccess,
  ): Promise<BodCodDeviationReportDetailDTO> {
    return bodCodDeviationReportsRepository.getReportById(id, access);
  },
};
