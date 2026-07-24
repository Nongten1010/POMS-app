import type { Knex } from 'knex';
import { db } from '../../config/database';
import { BadRequestError, ConflictError, ForbiddenError } from '../../shared/errors/AppError';
import {
  regionalDocumentRegionCode,
  type RegionalDocumentRegionCode,
} from '../../shared/utils/regional-document-number';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { formatBodCodDeviationReportNo } from './bod-cod-deviation-report-number';
import type {
  CreateBodCodDeviationReportAccess,
  CreateBodCodDeviationReportDTO,
} from './bod-cod-deviation-reports.types';

interface NumberingFactoryRow {
  factory_internal_id: number | string;
  province_name: string | null;
  region_name: string | null;
}

export interface BodCodCreateNumberingContext {
  factoryInternalId: number | null;
  provinceName: string;
  regionCode: RegionalDocumentRegionCode;
}

export interface ReservedBodCodDeviationReportNumber {
  reportNo: string;
  regionCode: RegionalDocumentRegionCode;
  reportYear: number;
  sequence: number;
}

export function buildBodCodNumberingFactoryQueryForTests(
  input: Pick<CreateBodCodDeviationReportDTO, 'factoryId' | 'factoryRegistrationNo'>,
  access: CreateBodCodDeviationReportAccess,
) {
  return buildNumberingFactoryQuery(input, access);
}

export function reserveBodCodDeviationReportNumberForTests(
  trx: Knex.Transaction,
  regionCode: RegionalDocumentRegionCode,
  reportYear: number,
) {
  return reserveBodCodDeviationReportNumber(trx, regionCode, reportYear);
}

export async function resolveBodCodCreateNumberingContext(
  input: Pick<
    CreateBodCodDeviationReportDTO,
    'factoryId' | 'factoryRegistrationNo' | 'provinceName'
  >,
  access: CreateBodCodDeviationReportAccess,
  trx: Knex.Transaction,
): Promise<BodCodCreateNumberingContext> {
  const factory = (await buildNumberingFactoryQuery(input, access, trx)) as
    | NumberingFactoryRow
    | undefined;

  if (!factory) {
    if (access.scope === 'OWN_FACTORY') {
      throw new ForbiddenError('Factory is not available for this user');
    }
    throw new BadRequestError('Factory is unavailable for BOD/COD report numbering', {
      factoryId: input.factoryId ?? null,
      factoryRegistrationNo: input.factoryRegistrationNo,
    });
  }

  const authoritativeProvince = factory.province_name?.trim() ?? null;
  if (!authoritativeProvince || authoritativeProvince !== input.provinceName.trim()) {
    throw new BadRequestError('Factory province does not match BOD/COD report province', {
      factoryProvinceName: authoritativeProvince,
      reportProvinceName: input.provinceName.trim(),
    });
  }

  return {
    factoryInternalId: toNumberOrNull(factory.factory_internal_id),
    provinceName: authoritativeProvince,
    regionCode: requireRegionCode(factory.region_name, authoritativeProvince),
  };
}

export async function reserveBodCodDeviationReportNumber(
  trx: Knex.Transaction,
  regionCode: RegionalDocumentRegionCode,
  reportYear: number,
): Promise<ReservedBodCodDeviationReportNumber> {
  await ensureBodCodDeviationReportSequence(trx, regionCode, reportYear);

  const sequenceRow = await trx<{ last_sequence: number | string }>(
    'bod_cod_deviation_report_sequences',
  )
    .where({ region_code: regionCode, report_year: reportYear })
    .forUpdate()
    .first('last_sequence');
  if (!sequenceRow) {
    throw new Error(
      `BOD/COD deviation report sequence is unavailable for ${regionCode}-${reportYear}`,
    );
  }

  const sequence = Number(sequenceRow.last_sequence) + 1;
  if (sequence > 9_999) {
    throw new ConflictError('BOD/COD deviation report sequence has reached 9999', {
      regionCode,
      reportYear,
    });
  }

  await trx('bod_cod_deviation_report_sequences')
    .where({ region_code: regionCode, report_year: reportYear })
    .update({
      last_sequence: sequence,
      updated_at: trx.fn.now(),
    });

  return {
    reportNo: formatBodCodDeviationReportNo(regionCode, sequence, reportYear),
    regionCode,
    reportYear,
    sequence,
  };
}

function buildNumberingFactoryQuery(
  input: Pick<CreateBodCodDeviationReportDTO, 'factoryId' | 'factoryRegistrationNo'>,
  access: CreateBodCodDeviationReportAccess,
  connection: Knex | Knex.Transaction = db,
): Knex.QueryBuilder<NumberingFactoryRow, NumberingFactoryRow | undefined> {
  const builder = connection<NumberingFactoryRow>('factories as f')
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .select('f.id as factory_internal_id', 'p.name_th as province_name', 'p.region as region_name')
    .first();
  if (access.scope === 'OWN_FACTORY') {
    applyAssignedFactoryAccessFilter(builder, access.actorUserId);
  }
  builder.where((factoryBuilder) => {
    const factoryId = input.factoryId ?? '';
    const numericFactoryId = numericIdOrNull(factoryId);
    if (numericFactoryId !== null) factoryBuilder.orWhere('f.id', numericFactoryId);
    if (factoryId) {
      factoryBuilder.orWhere('f.fid', factoryId).orWhere('f.code', factoryId);
    }
    factoryBuilder
      .orWhere('f.fid', input.factoryRegistrationNo)
      .orWhere('f.code', input.factoryRegistrationNo);
  });
  return builder as unknown as Knex.QueryBuilder<
    NumberingFactoryRow,
    NumberingFactoryRow | undefined
  >;
}

async function ensureBodCodDeviationReportSequence(
  trx: Knex.Transaction,
  regionCode: RegionalDocumentRegionCode,
  reportYear: number,
): Promise<void> {
  await trx.raw(
    `
      IF NOT EXISTS (
        SELECT 1
        FROM bod_cod_deviation_report_sequences WITH (UPDLOCK, HOLDLOCK)
        WHERE region_code = ? AND report_year = ?
      )
      BEGIN
        INSERT INTO bod_cod_deviation_report_sequences
          (region_code, report_year, last_sequence)
        VALUES (?, ?, 0);
      END;
    `,
    [regionCode, reportYear, regionCode, reportYear],
  );
}

function requireRegionCode(
  regionName: string | null,
  provinceName: string,
): RegionalDocumentRegionCode {
  const regionCode = regionalDocumentRegionCode(regionName);
  if (!regionName || !regionCode) {
    throw new BadRequestError('Factory region is unavailable for BOD/COD report numbering', {
      provinceName,
      regionName,
    });
  }
  return regionCode;
}

function numericIdOrNull(value: string | number | null): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
