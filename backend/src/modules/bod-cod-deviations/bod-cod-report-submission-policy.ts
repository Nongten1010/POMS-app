import { ConflictError, ForbiddenError } from '../../shared/errors/AppError';
import type {
  BodCodDeviationAccess,
  BodCodDeviationReportStatus,
  CreateBodCodDeviationReportDTO,
} from './bod-cod-deviation-reports.types';

export function currentBodCodPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')!.value) + 543;
  const month = Number(parts.find((part) => part.type === 'month')!.value);
  return { reportYear: year, reportRoundNo: month <= 6 ? 1 : 2 };
}

export function assertCurrentBodCodPeriod(
  input: Pick<CreateBodCodDeviationReportDTO, 'reportYear' | 'reportRoundNo'>,
  now = new Date(),
): void {
  const current = currentBodCodPeriod(now);
  if (input.reportYear !== current.reportYear || input.reportRoundNo !== current.reportRoundNo) {
    throw new ConflictError('BOD/COD report period is closed', {
      reason: 'REPORT_PERIOD_CLOSED',
      ...current,
    });
  }
}

export function isBodCodOperator(access: BodCodDeviationAccess): boolean {
  const scope =
    typeof access.scope === 'object' && access.scope !== null ? access.scope.scope : access.scope;
  return scope === 'OWN_FACTORY' && (access.roles ?? []).includes('factory_operator');
}

export function assertBodCodCreator(access: BodCodDeviationAccess): void {
  if (!isBodCodOperator(access) && !(access.roles ?? []).includes('admin')) {
    throw new ForbiddenError('Only own-factory operators or admins can create BOD/COD reports');
  }
}

export interface BodCodAnnualReport {
  id: number | string;
  status: BodCodDeviationReportStatus;
  report_sequence_no: number | string | null;
}

export function nextBodCodReportSequence(reports: BodCodAnnualReport[]): number {
  const pending = reports.find(
    (report) => !['APPROVED', 'REJECTED', 'CANCELLED'].includes(report.status),
  );
  if (pending) {
    throw new ConflictError(
      'A BOD/COD report is still pending for this point, parameter and year',
      {
        reason: 'PENDING_REPORT_EXISTS',
        reportId: Number(pending.id),
        currentStatus: pending.status,
      },
    );
  }
  const approved = reports.filter((report) => report.status === 'APPROVED');
  const highestApproved = approved.reduce(
    (highest, report) => Math.max(highest, Number(report.report_sequence_no ?? 0)),
    0,
  );
  // Legacy approved reports count towards new submissions without inventing old numbers.
  const next = Math.max(approved.length, highestApproved) + 1;
  if (next > 2_147_483_647) throw new ConflictError('BOD/COD annual sequence exhausted');
  return next;
}
