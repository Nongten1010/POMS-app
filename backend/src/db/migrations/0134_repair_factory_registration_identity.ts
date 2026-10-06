import type { Knex } from 'knex';
import { REGISTRATION_REPAIR_BACKUP } from './0132_create_factory_registration_repair_backup';

export const config = { transaction: true };

interface EligibleRepair {
  id: number;
  newNumber: string;
  oldNumber: string;
  sourceSystem: string;
  deleted: boolean;
}

interface AddRequestRepair {
  id: number;
  newNumber: string;
  oldNumber: string;
  factoryMasterId: number;
  eligibleFactoryId: number | null;
  status: 'APPROVED' | 'REJECTED';
}

/** Frozen, source-verified manifest. Never infer identities from company names. */
export const ELIGIBLE_FACTORY_REPAIRS: readonly EligibleRepair[] = [
  {
    id: 12,
    newNumber: '10150000125204',
    oldNumber: '3-44-1/20อท',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 13,
    newNumber: '10560000125311',
    oldNumber: '3-1-1/31พย',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 14,
    newNumber: '20860071825668',
    oldNumber: 'จ3-8(2)-2/66ชพ',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 15,
    newNumber: '20860119425661',
    oldNumber: 'จ3-8(2)-3/66ชพ',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 16,
    newNumber: '10190000225448',
    oldNumber: '3-101-2/44สบ',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 17,
    newNumber: '10550000125197',
    oldNumber: '3-1-1/19นน',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 18,
    newNumber: '10560000125584',
    oldNumber: '3-1-1/58พย',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 933,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    sourceSystem: 'eligible_factory_add_requests',
    deleted: true,
  },
  {
    id: 934,
    newNumber: '91090000325549',
    oldNumber: 'ข3-42(1)-3/54รย',
    sourceSystem: 'eligible_factory_add_requests',
    deleted: true,
  },
  {
    id: 935,
    newNumber: '91090041825671',
    oldNumber: 'ข3-53(5)-19/67รย',
    sourceSystem: 'eligible_factory_add_requests',
    deleted: true,
  },
  {
    id: 936,
    newNumber: '91090100125450',
    oldNumber: 'ข3-53(5)-1/45รย',
    sourceSystem: 'eligible_factory_add_requests',
    deleted: true,
  },
  {
    id: 939,
    newNumber: '91120225425673',
    oldNumber: 'ข3-59-6/67ปจ',
    sourceSystem: 'diw.fac_import',
    deleted: true,
  },
  {
    id: 940,
    newNumber: '91120225825674',
    oldNumber: 'ข3-59-7/67ปจ',
    sourceSystem: 'diw.fac_import',
    deleted: false,
  },
  {
    id: 941,
    newNumber: '10130100125437',
    oldNumber: '3-60-1/43ปท',
    sourceSystem: 'diw.fac_import',
    deleted: false,
  },
];

export const REQUEST_REPAIRS = [
  {
    id: 10043,
    requestNo: 'CEMS-0020/2569',
    newNumber: '91120225825674',
    oldNumber: 'ข3-59-7/67ปจ',
    corruptedId: '?3-59-7/67??',
  },
  {
    id: 10044,
    requestNo: 'CEMS-0021/2569',
    newNumber: '91120225825674',
    oldNumber: 'ข3-59-7/67ปจ',
    corruptedId: '?3-59-7/67??',
  },
] as const;

export const ADD_REQUEST_REPAIRS: readonly AddRequestRepair[] = [
  {
    id: 1,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    factoryMasterId: 30,
    eligibleFactoryId: 933,
    status: 'APPROVED',
  },
  {
    id: 2,
    newNumber: '91090000325549',
    oldNumber: 'ข3-42(1)-3/54รย',
    factoryMasterId: 29,
    eligibleFactoryId: 934,
    status: 'APPROVED',
  },
  {
    id: 3,
    newNumber: '91090041825671',
    oldNumber: 'ข3-53(5)-19/67รย',
    factoryMasterId: 35,
    eligibleFactoryId: 935,
    status: 'APPROVED',
  },
  {
    id: 4,
    newNumber: '91090100125450',
    oldNumber: 'ข3-53(5)-1/45รย',
    factoryMasterId: 33,
    eligibleFactoryId: 936,
    status: 'APPROVED',
  },
  {
    id: 5,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    factoryMasterId: 30,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 6,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    factoryMasterId: 30,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 7,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    factoryMasterId: 30,
    eligibleFactoryId: null,
    status: 'REJECTED',
  },
  {
    id: 8,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    factoryMasterId: 30,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 9,
    newNumber: '10600105225655',
    oldNumber: '3-101-1/65นว',
    factoryMasterId: 490,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 10,
    newNumber: '10100700125368',
    oldNumber: '3-40(1)-1/36',
    factoryMasterId: 500,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 11,
    newNumber: '10100300425515',
    oldNumber: '3-42(2)-4/51',
    factoryMasterId: 497,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 12,
    newNumber: '10100700125178',
    oldNumber: '3-50(4)-1/17',
    factoryMasterId: 498,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
  {
    id: 13,
    newNumber: '91090001125583',
    oldNumber: 'ข3-42(1)-11/58รย',
    factoryMasterId: 30,
    eligibleFactoryId: null,
    status: 'APPROVED',
  },
];

type Binding = string | number | null;

/** Fixed temporary names let SQL Server tests execute the identical batch safely. */
export function buildRegistrationIdentityRepairSql(
  direction: 'up' | 'down',
  mode: 'production' | 'fixture' = 'production',
): { sql: string; bindings: Binding[] } {
  const eligible =
    mode === 'fixture' ? '[#registration_repair_eligible]' : '[dbo].[eligible_factories]';
  const requests =
    mode === 'fixture'
      ? '[#registration_repair_requests]'
      : '[dbo].[cems_wpms_connection_requests]';
  const additions =
    mode === 'fixture'
      ? '[#registration_repair_add_requests]'
      : '[dbo].[eligible_factory_add_requests]';
  const backup =
    mode === 'fixture' ? '[#registration_repair_backup]' : `[dbo].[${REGISTRATION_REPAIR_BACKUP}]`;
  const bindings: Binding[] = [];
  const values: string[] = [];
  const addTarget = (row: Binding[]): void => {
    values.push(`(${row.map(() => '?').join(', ')})`);
    bindings.push(...row);
  };
  for (const row of ELIGIBLE_FACTORY_REPAIRS) {
    addTarget([
      'eligible',
      row.id,
      row.newNumber,
      row.oldNumber,
      row.sourceSystem,
      Number(row.deleted),
      null,
      null,
      null,
      null,
      null,
    ]);
  }
  for (const row of REQUEST_REPAIRS) {
    addTarget([
      'request',
      row.id,
      row.newNumber,
      row.oldNumber,
      null,
      0,
      row.requestNo,
      null,
      940,
      'WAITING_FACTORY_REVISION',
      row.corruptedId,
    ]);
  }
  for (const row of ADD_REQUEST_REPAIRS) {
    addTarget([
      'addition',
      row.id,
      row.newNumber,
      row.oldNumber,
      null,
      0,
      null,
      row.factoryMasterId,
      row.eligibleFactoryId,
      row.status,
      null,
    ]);
  }
  const rowHashes = (variable: string): string => `
INSERT INTO ${variable} (entity_type, record_id, row_hash)
SELECT t.entity_type, e.id, HASHBYTES('SHA2_256',
  (SELECT e.* FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER))
FROM ${eligible} e WITH (UPDLOCK, HOLDLOCK)
INNER JOIN @targets t ON t.entity_type = 'eligible' AND t.record_id = e.id;
INSERT INTO ${variable} (entity_type, record_id, row_hash)
SELECT t.entity_type, r.id, HASHBYTES('SHA2_256',
  (SELECT r.* FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER))
FROM ${requests} r WITH (UPDLOCK, HOLDLOCK)
INNER JOIN @targets t ON t.entity_type = 'request' AND t.record_id = r.id;
INSERT INTO ${variable} (entity_type, record_id, row_hash)
SELECT t.entity_type, a.id, HASHBYTES('SHA2_256',
  (SELECT a.* FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER))
FROM ${additions} a WITH (UPDLOCK, HOLDLOCK)
INNER JOIN @targets t ON t.entity_type = 'addition' AND t.record_id = a.id;`;
  const json =
    "CASE WHEN ISJSON(a.factory_snapshot_json) = 1 THEN a.factory_snapshot_json ELSE N'{}' END";
  const validation = (after: boolean, repeatedRun = false): string => `
IF (SELECT COUNT(*) FROM ${eligible} e INNER JOIN @targets t
    ON t.entity_type = 'eligible' AND t.record_id = e.id
  WHERE e.source_factory_id COLLATE Latin1_General_100_BIN2 = t.new_number
    AND e.source_system COLLATE Latin1_General_100_BIN2 = t.source_system
    ${repeatedRun ? '' : 'AND e.monitoring_point_form_id IS NULL\n    AND CASE WHEN e.deleted_at IS NULL THEN 0 ELSE 1 END = t.is_deleted'}
    AND e.factory_registration_no_new COLLATE Latin1_General_100_BIN2 = t.${after ? 'new' : 'old'}_number
    AND ${after ? 'e.factory_registration_no_old COLLATE Latin1_General_100_BIN2 = t.old_number' : 'e.factory_registration_no_old IS NULL'}) <> 14
  THROW 51331, 'Eligible factory identity or registration repair precondition failed', 1;
IF (SELECT COUNT(*) FROM ${requests} r INNER JOIN @targets t
    ON t.entity_type = 'request' AND t.record_id = r.id
  WHERE r.request_no COLLATE Latin1_General_100_BIN2 = t.request_no
    AND r.eligible_factory_id = t.eligible_factory_id
    AND r.factory_id COLLATE Latin1_General_100_BIN2 = t.${after ? 'new_number' : 'corrupted_id'}
    AND r.factory_registration_no COLLATE Latin1_General_100_BIN2 = t.old_number
    ${repeatedRun ? '' : "AND r.request_type = 'ADD_MEASUREMENT_POINT'\n    AND r.status = t.expected_status AND r.deleted_at IS NULL"}) <> 2
  THROW 51332, 'Connection request identity or registration repair precondition failed', 1;
IF (SELECT COUNT(*) FROM ${additions} a INNER JOIN @targets t
    ON t.entity_type = 'addition' AND t.record_id = a.id
  WHERE a.source_factory_id COLLATE Latin1_General_100_BIN2 = t.new_number
    AND a.factory_master_id = t.factory_master_id
    AND ((a.eligible_factory_id IS NULL AND t.eligible_factory_id IS NULL)
      OR a.eligible_factory_id = t.eligible_factory_id)
    ${repeatedRun ? '' : 'AND a.status = t.expected_status AND a.deleted_at IS NULL'}
    AND a.factory_registration_no COLLATE Latin1_General_100_BIN2 = t.old_number
    ${repeatedRun ? '' : 'AND a.factory_registration_no_old IS NULL'}
    AND ISJSON(a.factory_snapshot_json) = 1
    AND JSON_VALUE(${json}, '$.sourceFactoryId') COLLATE Latin1_General_100_BIN2 = t.new_number
    AND JSON_VALUE(${json}, '$.factoryRegistrationNoNew') COLLATE Latin1_General_100_BIN2 = t.${after ? 'new' : 'old'}_number
    AND ${after ? `JSON_VALUE(${json}, '$.factoryRegistrationNoOld') COLLATE Latin1_General_100_BIN2 = t.old_number` : `JSON_VALUE(${json}, '$.factoryRegistrationNoOld') IS NULL`}) <> 13
  THROW 51333, 'Add request snapshot identity or registration repair precondition failed', 1;`;
  const header = `
SET XACT_ABORT ON;
IF @@TRANCOUNT = 0
  THROW 51330, 'Registration identity repair requires an explicit transaction', 1;
DECLARE @targets TABLE (
  entity_type VARCHAR(48) NOT NULL, record_id BIGINT NOT NULL,
  new_number NVARCHAR(64) NOT NULL, old_number NVARCHAR(64) NOT NULL,
  source_system NVARCHAR(64) NULL, is_deleted BIT NOT NULL,
  request_no NVARCHAR(64) NULL, factory_master_id BIGINT NULL,
  eligible_factory_id BIGINT NULL, expected_status VARCHAR(64) NULL,
  corrupted_id NVARCHAR(64) NULL, PRIMARY KEY (entity_type, record_id)
);
INSERT INTO @targets VALUES ${values.join(',\n')};
DECLARE @current TABLE (entity_type VARCHAR(48), record_id BIGINT, row_hash VARBINARY(32), PRIMARY KEY (entity_type, record_id));
${rowHashes('@current')}
DECLARE @present INT = (SELECT COUNT(*) FROM @current);
DECLARE @backups INT = (SELECT COUNT(*) FROM ${backup} WITH (UPDLOCK, HOLDLOCK));
IF @present = 0 AND @backups = 0
BEGIN
  SELECT 'no_targets' AS repair_action, 0 AS eligible_count, 0 AS request_count, 0 AS snapshot_count, 0 AS backup_count;
  RETURN;
END;
IF @present <> 29 OR (@backups <> 0 AND @backups <> 29)
  THROW 51334, 'Registration repair requires the complete audited set of 29 rows', 1;
IF @backups > 0 AND (SELECT COUNT(*) FROM ${backup} b INNER JOIN @targets t
  ON b.entity_type = t.entity_type AND b.record_id = t.record_id) <> 29
  THROW 51335, 'Registration repair backup identities do not match the audited manifest', 1;`;
  const captureAfter = `
DECLARE @after TABLE (entity_type VARCHAR(48), record_id BIGINT, row_hash VARBINARY(32), PRIMARY KEY (entity_type, record_id));
${rowHashes('@after')}`;
  const sql =
    direction === 'up'
      ? `${header}
IF @backups = 29 AND NOT EXISTS (SELECT 1 FROM ${backup} WHERE restored_at IS NOT NULL)
BEGIN
  IF EXISTS (SELECT 1 FROM ${backup} WHERE after_row_hash IS NULL)
    THROW 51336, 'Registration repair after-state backups are incomplete', 1;
  ${validation(true, true)}
  SELECT 'already_repaired' AS repair_action, 0 AS eligible_count, 0 AS request_count, 0 AS snapshot_count, 29 AS backup_count;
  RETURN;
END;
IF @backups = 29 AND (SELECT COUNT(*) FROM ${backup} b INNER JOIN @current c
    ON b.entity_type = c.entity_type AND b.record_id = c.record_id
    WHERE b.restored_at IS NOT NULL AND b.before_row_hash = c.row_hash) <> 29
  THROW 51337, 'Registration repair refuses partial recovery or changed original rows', 1;
${validation(false)}
DECLARE @expected TABLE (entity_type VARCHAR(48), record_id BIGINT, row_json NVARCHAR(MAX), PRIMARY KEY (entity_type, record_id));
INSERT INTO @expected
SELECT t.entity_type, e.id,
  JSON_MODIFY(JSON_MODIFY((SELECT e.* FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER),
    '$.factory_registration_no_new', t.new_number), '$.factory_registration_no_old', t.old_number)
FROM ${eligible} e INNER JOIN @targets t ON t.entity_type = 'eligible' AND t.record_id = e.id;
INSERT INTO @expected
SELECT t.entity_type, r.id,
  JSON_MODIFY((SELECT r.* FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER), '$.factory_id', t.new_number)
FROM ${requests} r INNER JOIN @targets t ON t.entity_type = 'request' AND t.record_id = r.id;
INSERT INTO @expected
SELECT t.entity_type, a.id, (SELECT a.* FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER)
FROM ${additions} a INNER JOIN @targets t ON t.entity_type = 'addition' AND t.record_id = a.id;
-- Materialize the new snapshot as plain text. It remains a JSON string inside
-- the serialized SQL row, matching the NVARCHAR column and its original type.
DECLARE @expectedSnapshots TABLE (record_id BIGINT PRIMARY KEY, snapshot_json NVARCHAR(MAX));
INSERT INTO @expectedSnapshots
SELECT a.id, JSON_MODIFY(JSON_MODIFY(a.factory_snapshot_json,
  '$.factoryRegistrationNoNew', t.new_number), '$.factoryRegistrationNoOld', t.old_number)
FROM ${additions} a INNER JOIN @targets t ON t.entity_type = 'addition' AND t.record_id = a.id;
UPDATE e SET row_json = JSON_MODIFY(e.row_json, '$.factory_snapshot_json', s.snapshot_json)
FROM @expected e INNER JOIN @expectedSnapshots s ON e.entity_type = 'addition' AND e.record_id = s.record_id;
IF @backups = 0
BEGIN
  INSERT INTO ${backup} (entity_type, record_id, before_registration_no_new, before_registration_no_old, before_row_hash)
  SELECT c.entity_type, e.id, e.factory_registration_no_new, e.factory_registration_no_old, c.row_hash
  FROM ${eligible} e INNER JOIN @current c ON c.entity_type = 'eligible' AND c.record_id = e.id;
  IF @@ROWCOUNT <> 14 THROW 51338, 'Expected 14 eligible registration backups', 1;
  INSERT INTO ${backup} (entity_type, record_id, before_factory_id, before_row_hash)
  SELECT c.entity_type, r.id, r.factory_id, c.row_hash
  FROM ${requests} r INNER JOIN @current c ON c.entity_type = 'request' AND c.record_id = r.id;
  IF @@ROWCOUNT <> 2 THROW 51339, 'Expected two connection request identity backups', 1;
  INSERT INTO ${backup} (entity_type, record_id, before_factory_snapshot_json, before_row_hash)
  SELECT c.entity_type, a.id, a.factory_snapshot_json, c.row_hash
  FROM ${additions} a INNER JOIN @current c ON c.entity_type = 'addition' AND c.record_id = a.id;
  IF @@ROWCOUNT <> 13 THROW 51340, 'Expected 13 original add request snapshot backups', 1;
END;
UPDATE e SET factory_registration_no_new = t.new_number, factory_registration_no_old = t.old_number
FROM ${eligible} e INNER JOIN @targets t ON t.entity_type = 'eligible' AND t.record_id = e.id;
IF @@ROWCOUNT <> 14 THROW 51341, 'Eligible registration repair row count changed', 1;
UPDATE r SET factory_id = t.new_number
FROM ${requests} r INNER JOIN @targets t ON t.entity_type = 'request' AND t.record_id = r.id;
IF @@ROWCOUNT <> 2 THROW 51342, 'Connection request registration repair row count changed', 1;
UPDATE a SET factory_snapshot_json = JSON_MODIFY(
  JSON_MODIFY(a.factory_snapshot_json, '$.factoryRegistrationNoNew', t.new_number),
  '$.factoryRegistrationNoOld', t.old_number)
FROM ${additions} a INNER JOIN @targets t ON t.entity_type = 'addition' AND t.record_id = a.id;
IF @@ROWCOUNT <> 13 THROW 51343, 'Add request snapshot repair row count changed', 1;
${validation(true)}
${captureAfter}
IF (SELECT COUNT(*) FROM @after a INNER JOIN @expected e
  ON a.entity_type = e.entity_type AND a.record_id = e.record_id
  WHERE a.row_hash = HASHBYTES('SHA2_256', e.row_json)) <> 29
  THROW 51352, 'Registration repair changed a field outside the approved registration columns', 1;
UPDATE b SET after_row_hash = a.row_hash, restored_at = NULL
FROM ${backup} b INNER JOIN @after a ON b.entity_type = a.entity_type AND b.record_id = a.record_id;
IF @@ROWCOUNT <> 29 THROW 51344, 'Registration repair after-state backup verification failed', 1;
SELECT 'repaired' AS repair_action, 14 AS eligible_count, 2 AS request_count, 13 AS snapshot_count, 29 AS backup_count;
`
      : `${header}
IF @backups <> 29
  THROW 51345, 'Registration identity recovery requires all original backups', 1;
IF (SELECT COUNT(*) FROM ${backup} b INNER JOIN @current c
  ON b.entity_type = c.entity_type AND b.record_id = c.record_id
  WHERE b.restored_at IS NOT NULL AND b.before_row_hash = c.row_hash) = 29
BEGIN
  SELECT 'already_restored' AS repair_action, 0 AS eligible_count, 0 AS request_count, 0 AS snapshot_count, 29 AS backup_count;
  RETURN;
END;
IF (SELECT COUNT(*) FROM ${backup} b INNER JOIN @current c
  ON b.entity_type = c.entity_type AND b.record_id = c.record_id
  WHERE b.restored_at IS NULL AND b.after_row_hash = c.row_hash) <> 29
  THROW 51346, 'Registration recovery refused because rows changed after repair', 1;
${validation(true)}
UPDATE e SET factory_registration_no_new = b.before_registration_no_new,
  factory_registration_no_old = b.before_registration_no_old
FROM ${eligible} e INNER JOIN ${backup} b ON b.entity_type = 'eligible' AND b.record_id = e.id;
IF @@ROWCOUNT <> 14 THROW 51347, 'Eligible registration recovery row count changed', 1;
UPDATE r SET factory_id = b.before_factory_id
FROM ${requests} r INNER JOIN ${backup} b ON b.entity_type = 'request' AND b.record_id = r.id;
IF @@ROWCOUNT <> 2 THROW 51348, 'Request registration recovery row count changed', 1;
UPDATE a SET factory_snapshot_json = b.before_factory_snapshot_json
FROM ${additions} a INNER JOIN ${backup} b ON b.entity_type = 'addition' AND b.record_id = a.id;
IF @@ROWCOUNT <> 13 THROW 51349, 'Snapshot registration recovery row count changed', 1;
${validation(false)}
${captureAfter}
IF (SELECT COUNT(*) FROM ${backup} b INNER JOIN @after a
  ON b.entity_type = a.entity_type AND b.record_id = a.record_id
  WHERE b.before_row_hash = a.row_hash) <> 29
  THROW 51350, 'Registration recovery did not restore the exact original rows', 1;
UPDATE ${backup} SET restored_at = SYSDATETIME();
IF @@ROWCOUNT <> 29 THROW 51351, 'Registration recovery backup row count changed', 1;
SELECT 'restored' AS repair_action, 14 AS eligible_count, 2 AS request_count, 13 AS snapshot_count, 29 AS backup_count;
`;
  return { sql, bindings };
}

export async function up(knex: Knex): Promise<void> {
  const batch = buildRegistrationIdentityRepairSql('up');
  await knex.raw(batch.sql, batch.bindings);
}

/** Use a separately reviewed forward migration for production recovery. */
export async function down(knex: Knex): Promise<void> {
  const batch = buildRegistrationIdentityRepairSql('down');
  await knex.raw(batch.sql, batch.bindings);
}
