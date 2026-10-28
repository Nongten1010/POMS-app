import { jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { parameterSourceDb } from '../../src/config/parameter-source-database';
import { createDeviceConfigApiFixture } from './device-config-api-fixture';
import { parameterCleanupSourceFixture } from './parameter-cleanup-source-fixture';

/** Real approval workflow; translate SQL Server syntax only at the SQL boundary. */
export async function createConnectionRequestApprovalApiFixture() {
  const primary = await createDeviceConfigApiFixture();
  const source = await parameterCleanupSourceFixture(parameterSourceDb);
  source.execute(`CREATE TABLE ingest.connection_measurement_cleanup_receipts (
    source_key TEXT, station_id TEXT, request_id INTEGER, actor_user_id INTEGER,
    cleared_at TEXT, table_results_json TEXT, PRIMARY KEY (source_key, station_id)
  )`);
  const columns: Record<string, string[]> = {
    cems_wpms_request_factory_snapshots: [
      'region_code',
      'region_name',
      'district_code',
      'district_name',
      'subdistrict_code',
      'subdistrict_name',
      'industrial_estate_code',
      'industrial_estate_name',
      'factory_main_type_code',
      'factory_main_type_label',
      'created_by',
      'updated_by',
      'updated_at',
    ],
    cems_wpms_measurement_points: [
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
      'point_code_assignment_mode',
      'point_code_assignment_reason',
      'point_code_assigned_by',
      'point_code_assigned_at',
    ],
    cems_wpms_connected_measurement_points: [
      'factory_name',
      'factory_registration_no',
      'factory_address',
      'factory_latitude',
      'factory_longitude',
      'factory_eia_assessment',
      'factory_eia_other',
      'factory_has_eia',
      'factory_project_name',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ],
  };
  for (const [table, fields] of Object.entries(columns)) {
    for (const field of fields) primary.execute(`ALTER TABLE ${table} ADD COLUMN ${field}`);
  }
  const setup = `
    DELETE FROM cems_wpms_connected_measurement_points;
    DELETE FROM cems_wpms_connection_requests WHERE id = 102;
    DELETE FROM cems_wpms_measurement_points WHERE request_id = 102;
    UPDATE cems_wpms_connection_requests
      SET request_type = 'ADD_MEASUREMENT_POINT', status = 'PENDING_DESIGN_REVIEW' WHERE id = 101;
    UPDATE cems_wpms_measurement_points SET point_code = NULL, parameters_json = '[]',
      monitoring_point_status = 'อยู่ระหว่างขยายเวลา',
      details_json = '{"requestedParameters":[]}', instruments_json = '{"parameters":[]}';
    CREATE TABLE eligible_factories (
      id INTEGER PRIMARY KEY, source_factory_id TEXT, source_system TEXT,
      factory_registration_no_new TEXT, factory_registration_no_old TEXT,
      latitude REAL, longitude REAL, eia_assessment TEXT, eia_other TEXT, has_eia INTEGER,
      project_name TEXT, factory_name TEXT, address TEXT, updated_by INTEGER, updated_at TEXT,
      deleted_at TEXT, province_name TEXT, industrial_estate_name TEXT
    );
    INSERT INTO eligible_factories (id, source_factory_id, source_system,
      factory_registration_no_new, latitude, longitude)
      VALUES (17, 'fixture-factory', 'POMS', 'TEST-001', 14, 101);
    CREATE TABLE cems_wpms_point_code_sequences (
      system_type TEXT, prefix TEXT, last_sequence INTEGER, updated_at TEXT
    );
    CREATE TABLE cems_wpms_point_code_registry (
      id INTEGER PRIMARY KEY, point_code TEXT, normalized_point_code TEXT UNIQUE,
      system_type TEXT, prefix TEXT, numeric_sequence INTEGER, assignment_mode TEXT,
      source_request_id INTEGER, source_measurement_point_id INTEGER, reason TEXT,
      assigned_by INTEGER, assigned_at TEXT
    );
    CREATE TABLE provinces (id TEXT, name_th TEXT, region TEXT);
    CREATE TABLE industrial_estates (id INTEGER, code TEXT, name_th TEXT);
    CREATE TABLE factories (id INTEGER, fid TEXT, code TEXT, name TEXT,
      system_detail TEXT, is_active INTEGER, province_id TEXT, deleted_at TEXT);
  `;
  for (const statement of setup.split(';').filter((sql) => sql.trim())) {
    primary.execute(statement);
  }
  primary.execute(`CREATE TRIGGER history_audit_defaults AFTER INSERT ON cems_wpms_request_status_history
    BEGIN
      UPDATE cems_wpms_request_status_history SET changed_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END;
  `);
  primary.execute(`CREATE TRIGGER request_audit_defaults AFTER INSERT ON cems_wpms_connection_requests
    BEGIN
      UPDATE cems_wpms_connection_requests SET created_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
  const run = jest.mocked(db.client.runner).getMockImplementation();
  if (!run) throw new Error('Approval SQL fixture runner is unavailable');
  jest.mocked(db.client.runner).mockImplementation((builder: unknown) => {
    const query = (builder as Knex.QueryBuilder).toSQL();
    let sql = query.sql
      .replace(/\b(?:SYSDATETIME|GETDATE)\(\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/\bLEN\(/g, 'LENGTH(')
      .replace(/ COLLATE Latin1_General_100_BIN2/g, '')
      .replace(/NOT LIKE '%\[\^0-9\]%'/g, "NOT GLOB '*[^0-9]*'")
      .replace('MAX(TRY_CONVERT(BIGINT, SUBSTRING(', 'MAX(CAST(SUBSTRING(')
      .replace('END))) AS', 'END) AS INTEGER)) AS');
    // Preserve the production duplicate ranking predicate while translating UPDATE ... FROM.
    if (sql.includes('WITH ranked_points AS')) {
      sql = sql.replace(
        /UPDATE mp[\s\S]+?WHERE ranked\.duplicate_rank > 1;/,
        `UPDATE cems_wpms_measurement_points SET deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP, updated_by = ?
          WHERE id IN (SELECT id FROM ranked_points WHERE duplicate_rank > 1);`,
      );
    }
    if (sql !== query.sql)
      return {
        run: async () => {
          const result = await run(db.raw(sql, [...query.bindings])).run();
          return query.method === 'first' ? result[0] : result;
        },
      };
    return run(builder);
  });
  return {
    execute: primary.execute,
    cleanupState: source.state,
    close: () => {
      source.close();
      primary.close();
    },
  };
}
