import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const mainCleanupPath = path.resolve(__dirname, '../../db/cleanup_poms_test_data.sql');
const parameterCleanupPath = path.resolve(__dirname, '../../db/cleanup_parameter_test_data.sql');
const evidencePath = path.resolve(
  __dirname,
  '../../../docs/backend/evidence/shared/test-data-cleanup.tdd.md',
);

function readSql(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

function expectCommonSafetyGuards(sql: string): void {
  expect(sql).toMatch(/SET\s+XACT_ABORT\s+ON/i);
  expect(sql).toMatch(/DECLARE\s+@ExpectedDatabase\s+SYSNAME\s*=\s*N'CHANGE_ME'/i);
  expect(sql).toMatch(/DECLARE\s+@Execute\s+BIT\s*=\s*0/i);
  expect(sql).toMatch(/DECLARE\s+@BackupConfirmed\s+BIT\s*=\s*0/i);
  expect(sql).toMatch(/DB_NAME\(\)\s*<>\s*@ExpectedDatabase/i);
  expect(sql).toMatch(/BEGIN\s+TRANSACTION/i);
  expect(sql).toMatch(/IF\s+@Execute\s*=\s*0/i);
  expect(sql).toMatch(/ROLLBACK\s+TRANSACTION/i);
  expect(sql).toMatch(/COMMIT\s+TRANSACTION/i);
  expect(sql).toMatch(/IF\s+@BackupConfirmed\s*<>\s*1/i);
  expect(sql).not.toMatch(/\bTRUNCATE\b/i);

  const dryRunGuardIndex = sql.search(/IF\s+@Execute\s*=\s*0/i);
  const backupGuardIndex = sql.search(/IF\s+@BackupConfirmed\s*<>\s*1/i);
  const firstDeleteIndex = sql.search(/^\s*DELETE\s+/im);
  const commitIndex = sql.search(/COMMIT\s+TRANSACTION/i);

  expect(firstDeleteIndex).toBeGreaterThan(dryRunGuardIndex);
  expect(firstDeleteIndex).toBeGreaterThan(backupGuardIndex);
  expect(commitIndex).toBeGreaterThan(firstDeleteIndex);
}

function expectSessionTempTablesReset(sql: string, tableNames: string[]): void {
  for (const tableName of tableNames) {
    const dropIndex = sql.indexOf(`DROP TABLE IF EXISTS ${tableName};`);
    const createIndex = sql.indexOf(`CREATE TABLE ${tableName}`);

    expect(dropIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThan(dropIndex);
  }
}

describe('test-data cleanup SQL scripts', () => {
  it('provides one guarded script for each database', () => {
    expect(existsSync(mainCleanupPath)).toBe(true);
    expect(existsSync(parameterCleanupPath)).toBe(true);
  });

  it('documents TDD evidence for the cleanup workflow', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });

  it('keeps the main POMS cleanup in dry-run mode until explicitly enabled', () => {
    const sql = readSql(mainCleanupPath);

    expectCommonSafetyGuards(sql);
    expect(sql).toContain('CEMS-DEMO-S0001');
    expect(sql).toContain('WPMS-DEMO-P0001');
    expect(sql).toContain('mock-alert-events-%');
    expect(sql).toMatch(/DECLARE\s+@IncludeLinkedKwpSubmissions\s+BIT\s*=\s*0/i);
    expect(sql).toMatch(/DECLARE\s+@IncludeLinkedBodCodReports\s+BIT\s*=\s*0/i);
    expect(sql).toContain('#TargetKwpSubmissionNos');
    expect(sql).toContain('#TargetBodCodReportNos');
    expect(sql).toContain('#BlockedKwpSubmissionIds');
    expect(sql).toContain('#BlockedBodCodReportIds');
  });

  it('shows every targeted mock alert during the POMS dry run', () => {
    const sql = readSql(mainCleanupPath);

    expect(sql).toMatch(
      /SELECT\s+alert\.id,[\s\S]*alert\.idempotency_key,[\s\S]*alert\.source_table[\s\S]*FROM\s+dbo\.alert_events\s+AS\s+alert[\s\S]*INNER\s+JOIN\s+#TargetAlertEventIds/i,
    );
  });

  it('preserves master data, accounts, eligible factories, and number sequences', () => {
    const sql = readSql(mainCleanupPath);

    const preservedTables = [
      'users',
      'juristics',
      'factories',
      'eligible_factories',
      'roles',
      'permissions',
      'cems_wpms_point_code_sequences',
      'cems_wpms_annual_point_code_sequences',
      'cems_wpms_direct_request_sequences',
      'kwp_form_submission_sequences',
    ];

    for (const tableName of preservedTables) {
      expect(sql).not.toMatch(new RegExp(`DELETE\\s+FROM\\s+(?:dbo\\.)?${tableName}\\b`, 'i'));
    }
  });

  it('limits parameter cleanup to allow-listed stations, tables, and date windows', () => {
    const sql = readSql(parameterCleanupPath);
    const executableSql = stripSqlComments(sql);

    expectCommonSafetyGuards(sql);
    expect(sql).toContain('#TargetParameterTables');
    expect(sql).toContain('#TargetDateWindows');
    expect(sql).toContain('S0001');
    expect(sql).toContain('P0001');
    expect(sql).toContain('2026-06-01');
    expect(sql).toContain('2026-06-10');
    expect(sql).toMatch(/QUOTENAME\(@SchemaName\)/i);
    expect(sql).toMatch(/sp_executesql/i);
    expect(executableSql).not.toMatch(
      /INSERT\s+INTO\s+#TargetDateWindows[\s\S]*?\bVALUES\b/i,
    );
    expect(executableSql).not.toMatch(
      /INSERT\s+INTO\s+#TargetParameterTables[\s\S]*?\bVALUES\b/i,
    );
    expect(sql).toMatch(/DECLARE\s+@ParameterScopeConfirmed\s+BIT\s*=\s*0/i);
    expect(sql).toMatch(/DECLARE\s+@ExpectedTotalRowsToDelete\s+BIGINT\s*=\s*NULL/i);
    expect(sql).toMatch(/@ParameterScopeConfirmed\s*<>\s*1/i);
    expect(sql).toMatch(/SUM\(candidate_count\)[\s\S]*@ExpectedTotalRowsToDelete/i);
  });

  it('can be rerun in the same SQL session after a dry run', () => {
    expectSessionTempTablesReset(readSql(mainCleanupPath), [
      '#TargetConnectionRequestNos',
      '#TargetKwpSubmissionNos',
      '#TargetBodCodReportNos',
    ]);
    expectSessionTempTablesReset(readSql(parameterCleanupPath), [
      '#TargetDateWindows',
      '#TargetParameterTables',
      '#CandidateCounts',
    ]);
  });
});
