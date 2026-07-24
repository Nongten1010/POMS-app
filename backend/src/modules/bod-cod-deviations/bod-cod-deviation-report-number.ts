import {
  formatRegionalDocumentNumber,
  type RegionalDocumentRegionCode,
} from '../../shared/utils/regional-document-number';

const BOD_COD_DEVIATION_REPORT_PREFIX = 'Error';

export function formatBodCodDeviationReportNo(
  regionCode: RegionalDocumentRegionCode,
  sequence: number,
  reportYear: number,
): string {
  return formatRegionalDocumentNumber(
    BOD_COD_DEVIATION_REPORT_PREFIX,
    regionCode,
    sequence,
    String(reportYear),
  );
}
