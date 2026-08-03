import type { Knex } from 'knex';
import { withProvinceInFactoryAddress } from '../../modules/eligible-factories/factory-address';

const BACKUP_TABLE = 'factory_address_province_backfill_0084';
const UPDATE_BATCH_SIZE = 500;

interface AddressRow {
  id: number | string;
  address: string | null;
  province_name: string | null;
}

interface AddressTarget {
  entityType: string;
  tableName: string;
  addressColumn: 'address' | 'factory_address';
  rows: AddressRow[];
}

interface AddressChange {
  id: number | string;
  originalAddress: string;
  normalizedAddress: string;
}

export async function up(knex: Knex): Promise<void> {
  await ensureBackupTable(knex);
  const targets = await loadAddressTargets(knex);

  await knex.transaction(async (trx) => {
    for (const target of targets) {
      const changes = addressChanges(target.rows);
      for (const batch of chunks(changes, UPDATE_BATCH_SIZE)) {
        const { sql, bindings } = buildBatchUpdate(target, batch);
        await trx.raw(sql, bindings);
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(BACKUP_TABLE);
  if (!exists) return;
  const backupEntityTypes = await knex<{ entity_type: string }>(BACKUP_TABLE).distinct(
    'entity_type',
  );

  await knex.transaction(async (trx) => {
    for (const { entity_type: entityType } of backupEntityTypes) {
      const target = rollbackTarget(entityType);
      if (!target) continue;
      const tableName = quoteIdentifier(target.tableName);
      const addressColumn = quoteIdentifier(target.addressColumn);
      await trx.raw(
        `UPDATE target
         SET ${addressColumn} = backup.original_address,
             updated_at = SYSUTCDATETIME()
         FROM ${tableName} AS target
         INNER JOIN ${quoteIdentifier(BACKUP_TABLE)} AS backup
           ON backup.entity_id = target.id
          AND backup.entity_type = ?
         WHERE target.${addressColumn} = backup.normalized_address;`,
        [entityType],
      );
    }
  });
  await knex.schema.dropTable(BACKUP_TABLE);
}

function addressChanges(rows: AddressRow[]): AddressChange[] {
  return rows.flatMap((row) => {
    const normalizedAddress = withProvinceInFactoryAddress(row.address, row.province_name);
    if (!row.address || !normalizedAddress || normalizedAddress === row.address) return [];
    return [{ id: row.id, originalAddress: row.address, normalizedAddress }];
  });
}

function buildBatchUpdate(
  target: Pick<AddressTarget, 'entityType' | 'tableName' | 'addressColumn'>,
  changes: AddressChange[],
): { sql: string; bindings: Array<number | string> } {
  const tableName = quoteIdentifier(target.tableName);
  const addressColumn = quoteIdentifier(target.addressColumn);
  const valuesSql = changes.map(() => '(?, ?, ?)').join(', ');
  const bindings: Array<number | string> = [
    target.entityType,
    ...changes.flatMap((change) => [change.id, change.originalAddress, change.normalizedAddress]),
    target.entityType,
  ];
  return {
    sql: `UPDATE target
          SET ${addressColumn} = source.normalized_address,
              updated_at = SYSUTCDATETIME()
          OUTPUT ?, INSERTED.id, DELETED.${addressColumn}, INSERTED.${addressColumn}
          INTO ${quoteIdentifier(BACKUP_TABLE)}
            (entity_type, entity_id, original_address, normalized_address)
          FROM ${tableName} AS target
          INNER JOIN (VALUES ${valuesSql}) AS source
            (id, original_address, normalized_address)
            ON source.id = target.id
          WHERE target.${addressColumn} = source.original_address
            AND target.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM ${quoteIdentifier(BACKUP_TABLE)} AS existing_backup
              WHERE existing_backup.entity_type = ?
                AND existing_backup.entity_id = target.id
            );`,
    bindings,
  };
}

function quoteIdentifier(value: string): string {
  return `[${value.replace(/\]/gu, ']]')}]`;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadAddressTargets(knex: Knex): Promise<AddressTarget[]> {
  const eligibleRows = await knex<AddressRow>('eligible_factories')
    .whereNull('deleted_at')
    .select('id', 'address', 'province_name');
  const monitoringRows = await knex<AddressRow>('factory_monitoring_point_forms')
    .whereNull('deleted_at')
    .select('id', 'address', 'province_name');
  const requestRows = await knex<AddressRow>('cems_wpms_connection_requests as r')
    .leftJoin('cems_wpms_request_factory_snapshots as fs', function joinSnapshot() {
      this.on('fs.request_id', '=', 'r.id').andOnNull('fs.deleted_at');
    })
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.id', '=', 'r.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .whereNull('r.deleted_at')
    .whereNot('r.status', 'CANCELED')
    .select(
      'r.id',
      'r.address',
      knex.raw('COALESCE(fs.province_name, ef.province_name) AS province_name'),
    );
  const connectedRows = await knex<AddressRow>('cems_wpms_connected_measurement_points as cp')
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.id', '=', 'cp.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .whereNull('cp.deleted_at')
    .select('cp.id', 'cp.factory_address as address', 'ef.province_name');

  return [
    {
      entityType: 'eligible_factory',
      tableName: 'eligible_factories',
      addressColumn: 'address',
      rows: eligibleRows,
    },
    {
      entityType: 'monitoring_point_form',
      tableName: 'factory_monitoring_point_forms',
      addressColumn: 'address',
      rows: monitoringRows,
    },
    {
      entityType: 'connection_request',
      tableName: 'cems_wpms_connection_requests',
      addressColumn: 'address',
      rows: requestRows,
    },
    {
      entityType: 'connected_poms',
      tableName: 'cems_wpms_connected_measurement_points',
      addressColumn: 'factory_address',
      rows: connectedRows,
    },
  ];
}

function rollbackTarget(
  entityType: string,
): Pick<AddressTarget, 'tableName' | 'addressColumn'> | null {
  const targets: Record<string, Pick<AddressTarget, 'tableName' | 'addressColumn'>> = {
    eligible_factory: { tableName: 'eligible_factories', addressColumn: 'address' },
    monitoring_point_form: {
      tableName: 'factory_monitoring_point_forms',
      addressColumn: 'address',
    },
    connection_request: {
      tableName: 'cems_wpms_connection_requests',
      addressColumn: 'address',
    },
    connected_poms: {
      tableName: 'cems_wpms_connected_measurement_points',
      addressColumn: 'factory_address',
    },
  };
  return targets[entityType] ?? null;
}

async function ensureBackupTable(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(BACKUP_TABLE)) return;
  await knex.schema.createTable(BACKUP_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('entity_type', 'VARCHAR(64) NOT NULL');
    table.specificType('entity_id', 'BIGINT NOT NULL');
    table.specificType('original_address', 'NVARCHAR(1000) NOT NULL');
    table.specificType('normalized_address', 'NVARCHAR(1000) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.unique(['entity_type', 'entity_id'], {
      indexName: 'uq_factory_address_province_backfill_0084_entity',
    });
  });
}
