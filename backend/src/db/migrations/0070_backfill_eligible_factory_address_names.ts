import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';

const BACKUP_TABLE = 'eligible_factory_address_cleanup_0070';
const EXTERNAL_QUERY_TIMEOUT_MS = 300000;
const FACTORY_SOURCE_LOOKUP_CHUNK_SIZE = 500;
const LEGACY_AREA_CODE_PATTERN = /(?:ตำบล|อำเภอ)\s*\d+(?:\s|$)/u;

interface EligibleFactoryAddressRow {
  id: number | string;
  source_factory_id: string | null;
  factory_registration_no_new: string;
  address: string | null;
}

interface BackupRow {
  eligible_factory_id: number | string;
  original_address: string | null;
  normalized_address: string;
}

interface FactorySourceAddressRow {
  FID: string | null;
  FACREG: string | null;
  DISPFACREG: string | null;
  FADDR: string | null;
  FMOO: string | null;
  SOI: string | null;
  ROAD: string | null;
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  ZIPCODE: string | number | null;
}

interface AdministrativeAreaRow {
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  TUMNAME: string | null;
  AMPNAME: string | null;
}

interface AdministrativeAreaNames {
  subdistrictName: string;
  districtName: string;
}

interface FactorySourceIndexes {
  byFid: Map<string, FactorySourceAddressRow>;
  byFacreg: Map<string, FactorySourceAddressRow>;
  byDisplayFacreg: Map<string, FactorySourceAddressRow>;
}

export async function up(knex: Knex): Promise<void> {
  await ensureBackupTable(knex);

  const rows = (
    await knex<EligibleFactoryAddressRow>('eligible_factories')
      .whereNull('deleted_at')
      .select('id', 'source_factory_id', 'factory_registration_no_new', 'address')
  ).filter((row) => hasLegacyAreaCodes(row.address));
  if (rows.length === 0) return;

  const sourceRows = await loadFactorySourceRows(rows);
  const sourceIndexes = indexFactorySourceRows(sourceRows);
  const administrativeAreaNames = await loadAdministrativeAreaNames(sourceRows);

  await knex.transaction(async (trx) => {
    for (const row of rows) {
      const sourceRow = findFactorySourceRow(row, sourceIndexes);
      if (!sourceRow) continue;

      const resolvedAddress = resolveEligibleFactoryAddress(
        row.address,
        sourceRow,
        administrativeAreaNames,
      );
      if (!resolvedAddress || resolvedAddress === row.address) continue;

      const affected = await trx('eligible_factories')
        .where('id', row.id)
        .where('address', row.address)
        .whereNull('deleted_at')
        .update({
          address: resolvedAddress,
          updated_at: trx.fn.now(),
        });
      if (affected === 0) continue;

      const existingBackup = await trx(BACKUP_TABLE)
        .where('eligible_factory_id', row.id)
        .first<{ eligible_factory_id: number | string }>('eligible_factory_id');
      if (!existingBackup) {
        await trx(BACKUP_TABLE).insert({
          eligible_factory_id: row.id,
          original_address: row.address,
          normalized_address: resolvedAddress,
        });
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (!hasBackupTable) return;

  await knex.transaction(async (trx) => {
    const backups = await trx<BackupRow>(BACKUP_TABLE).select(
      'eligible_factory_id',
      'original_address',
      'normalized_address',
    );

    for (const backup of backups) {
      await trx('eligible_factories')
        .where('id', backup.eligible_factory_id)
        .where('address', backup.normalized_address)
        .update({
          address: backup.original_address,
          updated_at: trx.fn.now(),
        });
    }
  });

  await knex.schema.dropTable(BACKUP_TABLE);
}

async function ensureBackupTable(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (hasBackupTable) return;

  await knex.schema.createTable(BACKUP_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('eligible_factory_id', 'BIGINT NOT NULL');
    table.specificType('original_address', 'NVARCHAR(1000) NULL');
    table.specificType('normalized_address', 'NVARCHAR(1000) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.unique(['eligible_factory_id'], {
      indexName: 'uq_eligible_factory_address_cleanup_0070_factory',
    });
  });
}

async function loadFactorySourceRows(
  rows: EligibleFactoryAddressRow[],
): Promise<FactorySourceAddressRow[]> {
  const result: FactorySourceAddressRow[] = [];
  for (const keyChunk of chunks(factorySourceKeys(rows), FACTORY_SOURCE_LOOKUP_CHUNK_SIZE)) {
    const chunkRows = await factorySourceDb<FactorySourceAddressRow>(factorySourceTableName())
      .where((builder) => {
        builder
          .whereIn('FID', keyChunk)
          .orWhereIn('DISPFACREG', keyChunk)
          .orWhereIn('FACREG', keyChunk);
      })
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select(
        'FID',
        'FACREG',
        'DISPFACREG',
        'FADDR',
        'FMOO',
        'SOI',
        'ROAD',
        'PROV',
        'AMP',
        'TUMBOL',
        'ZIPCODE',
      );
    result.push(...chunkRows);
  }
  return result;
}

async function loadAdministrativeAreaNames(
  rows: FactorySourceAddressRow[],
): Promise<Map<string, AdministrativeAreaNames>> {
  const provinceCodes = uniqueText(rows.map((row) => normalizedCode(row.PROV)));
  if (provinceCodes.length === 0) return new Map();

  const areaRows = await factorySourceDb<AdministrativeAreaRow>(`${env.FACTORY_DB_SCHEMA}.TUMBOL`)
    .whereIn('PROV', provinceCodes)
    .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
    .select('PROV', 'AMP', 'TUMBOL', 'TUMNAME', 'AMPNAME');

  const result = new Map<string, AdministrativeAreaNames>();
  for (const row of areaRows) {
    const key = buildAdministrativeAreaKey(row.PROV, row.AMP, row.TUMBOL);
    const subdistrictName = normalizedText(row.TUMNAME);
    const districtName = normalizedText(row.AMPNAME);
    if (!key || !subdistrictName || !districtName) continue;
    result.set(key, { subdistrictName, districtName });
  }
  return result;
}

function indexFactorySourceRows(rows: FactorySourceAddressRow[]): FactorySourceIndexes {
  const result: FactorySourceIndexes = {
    byFid: new Map(),
    byFacreg: new Map(),
    byDisplayFacreg: new Map(),
  };
  for (const row of rows) {
    const fid = normalizedText(row.FID);
    const facreg = normalizedText(row.FACREG);
    const displayFacreg = normalizedText(row.DISPFACREG);
    if (fid && !result.byFid.has(fid)) result.byFid.set(fid, row);
    if (facreg && !result.byFacreg.has(facreg)) result.byFacreg.set(facreg, row);
    if (displayFacreg && !result.byDisplayFacreg.has(displayFacreg)) {
      result.byDisplayFacreg.set(displayFacreg, row);
    }
  }
  return result;
}

function findFactorySourceRow(
  row: EligibleFactoryAddressRow,
  sourceIndexes: FactorySourceIndexes,
): FactorySourceAddressRow | null {
  const sourceFactoryId = normalizedText(row.source_factory_id);
  const registrationNo = normalizedText(row.factory_registration_no_new);
  return (
    (sourceFactoryId ? sourceIndexes.byFid.get(sourceFactoryId) : undefined) ??
    (registrationNo ? sourceIndexes.byDisplayFacreg.get(registrationNo) : undefined) ??
    (registrationNo ? sourceIndexes.byFacreg.get(registrationNo) : undefined) ??
    (registrationNo ? sourceIndexes.byFid.get(registrationNo) : undefined) ??
    null
  );
}

export function findMatchingFactorySourceRow(
  row: Pick<EligibleFactoryAddressRow, 'source_factory_id' | 'factory_registration_no_new'>,
  sourceRows: FactorySourceAddressRow[],
): FactorySourceAddressRow | null {
  return findFactorySourceRow(
    {
      id: 0,
      address: null,
      ...row,
    },
    indexFactorySourceRows(sourceRows),
  );
}

export function resolveEligibleFactoryAddress(
  storedAddress: string | null,
  sourceRow: Pick<
    FactorySourceAddressRow,
    'FADDR' | 'FMOO' | 'SOI' | 'ROAD' | 'PROV' | 'AMP' | 'TUMBOL' | 'ZIPCODE'
  >,
  administrativeAreaNames: Map<string, AdministrativeAreaNames>,
): string | null {
  if (!hasLegacyAreaCodes(storedAddress)) return null;

  const administrativeAreaKey = buildAdministrativeAreaKey(
    sourceRow.PROV,
    sourceRow.AMP,
    sourceRow.TUMBOL,
  );
  const names = administrativeAreaKey
    ? administrativeAreaNames.get(administrativeAreaKey)
    : undefined;
  if (!names) return null;

  return (
    storedAddress
      ?.replace(/ตำบล\s*\d+(?=\s|$)/u, `ตำบล${names.subdistrictName}`)
      .replace(/อำเภอ\s*\d+(?=\s|$)/u, `อำเภอ${names.districtName}`) ?? null
  );
}

export function buildAdministrativeAreaKey(
  provinceCode: string | number | null | undefined,
  districtCode: string | number | null | undefined,
  subdistrictCode: string | number | null | undefined,
): string | null {
  const province = normalizedCode(provinceCode);
  const district = normalizedCode(districtCode);
  const subdistrict = normalizedCode(subdistrictCode);
  if (!province || !district || !subdistrict) return null;
  return `${province}:${district}:${subdistrict}`;
}

function hasLegacyAreaCodes(address: string | null): boolean {
  return Boolean(address && LEGACY_AREA_CODE_PATTERN.test(address));
}

function normalizedText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizedCode(value: string | number | null | undefined): string | null {
  const text = normalizedText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : text;
}

function factorySourceKeys(rows: EligibleFactoryAddressRow[]): string[] {
  return uniqueText(
    rows.flatMap((row) => [row.source_factory_id, row.factory_registration_no_new]),
  );
}

function uniqueText(values: Array<string | number | null | undefined>): string[] {
  return [
    ...new Set(values.map(normalizedText).filter((value): value is string => Boolean(value))),
  ];
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
