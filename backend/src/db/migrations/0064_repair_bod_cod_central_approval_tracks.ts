import type { Knex } from 'knex';

const REPORTS_TABLE = 'bod_cod_central_track_repair_reports_0064';
const STEPS_TABLE = 'bod_cod_central_track_repair_steps_0064';
const INSERTED_STEPS_TABLE = 'bod_cod_central_track_repair_inserted_steps_0064';

const CENTRAL_PROVINCES_SQL = `
  N'กรุงเทพมหานคร',
  N'สมุทรปราการ',
  N'นนทบุรี',
  N'ปทุมธานี',
  N'พระนครศรีอยุธยา',
  N'อ่างทอง',
  N'ลพบุรี',
  N'สิงห์บุรี',
  N'ชัยนาท',
  N'สระบุรี',
  N'นครนายก',
  N'นครสวรรค์',
  N'อุทัยธานี',
  N'กำแพงเพชร',
  N'สุพรรณบุรี',
  N'นครปฐม',
  N'สมุทรสาคร',
  N'สมุทรสงคราม'
`;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${REPORTS_TABLE}', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${REPORTS_TABLE} (
        report_id BIGINT NOT NULL PRIMARY KEY,
        approval_track VARCHAR(16) NOT NULL,
        status VARCHAR(32) NOT NULL,
        updated_at DATETIME2 NOT NULL
      );
    END;
  `);

  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${STEPS_TABLE}', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${STEPS_TABLE} (
        step_id BIGINT NOT NULL PRIMARY KEY,
        report_id BIGINT NOT NULL,
        track VARCHAR(16) NOT NULL,
        step_no INT NOT NULL,
        role_code VARCHAR(32) NOT NULL,
        role_label NVARCHAR(120) NOT NULL,
        status VARCHAR(32) NOT NULL,
        is_current BIT NOT NULL,
        updated_at DATETIME2 NOT NULL
      );
    END;
  `);

  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${INSERTED_STEPS_TABLE}', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${INSERTED_STEPS_TABLE} (
        step_id BIGINT NOT NULL PRIMARY KEY,
        report_id BIGINT NOT NULL
      );
    END;
  `);

  await knex.schema.raw(`
    ;WITH affected_reports AS (
      SELECT r.id
      FROM dbo.bod_cod_deviation_reports AS r
      WHERE r.deleted_at IS NULL
        AND r.province_name IN (${CENTRAL_PROVINCES_SQL})
        AND r.approval_track = 'REGIONAL'
        AND r.status IN (
          'SUBMITTED',
          'REVISED_PENDING_REVIEW',
          'WAITING_RESULT_NOTICE',
          'WAITING_APPROVAL'
        )
        AND EXISTS (
          SELECT 1
          FROM dbo.bod_cod_approval_steps AS approver_step
          WHERE approver_step.report_id = r.id
            AND approver_step.role_code = 'APPROVER'
            AND approver_step.deleted_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.bod_cod_approval_steps AS reviewer_step
          WHERE reviewer_step.report_id = r.id
            AND reviewer_step.role_code = 'REVIEWER'
            AND reviewer_step.deleted_at IS NULL
        )
    )
    INSERT INTO dbo.${REPORTS_TABLE} (
      report_id,
      approval_track,
      status,
      updated_at
    )
    SELECT
      r.id,
      r.approval_track,
      r.status,
      r.updated_at
    FROM dbo.bod_cod_deviation_reports AS r
    INNER JOIN affected_reports AS affected_report
      ON affected_report.id = r.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.${REPORTS_TABLE} AS bkp
      WHERE bkp.report_id = r.id
    );
  `);

  await knex.schema.raw(`
    INSERT INTO dbo.${STEPS_TABLE} (
      step_id,
      report_id,
      track,
      step_no,
      role_code,
      role_label,
      status,
      is_current,
      updated_at
    )
    SELECT
      step.id,
      step.report_id,
      step.track,
      step.step_no,
      step.role_code,
      step.role_label,
      step.status,
      step.is_current,
      step.updated_at
    FROM dbo.bod_cod_approval_steps AS step
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = step.report_id
    WHERE step.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.${STEPS_TABLE} AS bkp
        WHERE bkp.step_id = step.id
      );
  `);

  await knex.schema.raw(`
    UPDATE report
    SET
      report.approval_track = 'CENTRAL',
      report.status = CASE
        WHEN report.status = 'WAITING_APPROVAL'
          AND current_step.role_code = 'APPROVER'
          AND current_step.status = 'PENDING'
        THEN 'WAITING_REVIEW'
        ELSE report.status
      END,
      report.updated_at = SYSDATETIME()
    FROM dbo.bod_cod_deviation_reports AS report
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = report.id
    OUTER APPLY (
      SELECT TOP 1 step.role_code, step.status
      FROM dbo.bod_cod_approval_steps AS step
      WHERE step.report_id = report.id
        AND step.is_current = 1
        AND step.deleted_at IS NULL
      ORDER BY step.step_no ASC
    ) AS current_step;
  `);

  await knex.schema.raw(`
    UPDATE step
    SET
      step.track = 'CENTRAL',
      step.step_no = CASE
        WHEN step.role_code = 'APPROVER' THEN 4
        ELSE step.step_no
      END,
      step.role_label = CASE
        WHEN step.role_code = 'INSPECTOR'
          THEN N'เจ้าหน้าที่กฝม. (ตรวจสอบความถูกต้อง)'
        WHEN step.role_code = 'RESULT_NOTICE'
          THEN N'เจ้าหน้าที่กฝม. (บันทึก/แก้ไขแบบแจ้งผล)'
        WHEN step.role_code = 'APPROVER'
          THEN N'ผอ.กวภ. (อนุมัติ)'
        ELSE step.role_label
      END,
      step.status = CASE
        WHEN step.role_code = 'APPROVER'
          AND step.is_current = 1
          AND step.status = 'PENDING'
        THEN 'WAITING'
        ELSE step.status
      END,
      step.is_current = CASE
        WHEN step.role_code = 'APPROVER'
          AND step.is_current = 1
          AND step.status = 'PENDING'
        THEN 0
        ELSE step.is_current
      END,
      step.updated_at = SYSDATETIME()
    FROM dbo.bod_cod_approval_steps AS step
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = step.report_id
    WHERE step.deleted_at IS NULL;
  `);

  await knex.schema.raw(`
    DECLARE @insertedReviewerSteps TABLE (
      step_id BIGINT NOT NULL,
      report_id BIGINT NOT NULL
    );

    INSERT INTO dbo.bod_cod_approval_steps (
      report_id,
      track,
      step_no,
      role_code,
      role_label,
      status,
      actor_user_id,
      actor_name,
      actor_position,
      decision,
      comment,
      decided_at,
      revision_no,
      is_current,
      created_at,
      updated_at,
      deleted_at
    )
    OUTPUT inserted.id, inserted.report_id
      INTO @insertedReviewerSteps (step_id, report_id)
    SELECT
      report.id,
      'CENTRAL',
      3,
      'REVIEWER',
      N'ผอ.กฝม. (ทบทวน)',
      CASE
        WHEN report.status = 'WAITING_REVIEW' THEN 'PENDING'
        ELSE 'WAITING'
      END,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      1,
      CASE
        WHEN report.status = 'WAITING_REVIEW' THEN 1
        ELSE 0
      END,
      SYSDATETIME(),
      SYSDATETIME(),
      NULL
    FROM dbo.bod_cod_deviation_reports AS report
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = report.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.bod_cod_approval_steps AS reviewer_step
      WHERE reviewer_step.report_id = report.id
        AND reviewer_step.role_code = 'REVIEWER'
        AND reviewer_step.deleted_at IS NULL
    );

    INSERT INTO dbo.${INSERTED_STEPS_TABLE} (
      step_id,
      report_id
    )
    SELECT
      inserted_step.step_id,
      inserted_step.report_id
    FROM @insertedReviewerSteps AS inserted_step
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.${INSERTED_STEPS_TABLE} AS bkp
      WHERE bkp.step_id = inserted_step.step_id
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${REPORTS_TABLE}', 'U') IS NOT NULL
      AND OBJECT_ID('dbo.${STEPS_TABLE}', 'U') IS NOT NULL
      AND OBJECT_ID('dbo.${INSERTED_STEPS_TABLE}', 'U') IS NOT NULL
    BEGIN
      DELETE step
      FROM dbo.bod_cod_approval_steps AS step
      INNER JOIN dbo.${INSERTED_STEPS_TABLE} AS inserted_step
        ON inserted_step.step_id = step.id;

      UPDATE step
      SET
        step.track = bkp.track,
        step.step_no = bkp.step_no,
        step.role_code = bkp.role_code,
        step.role_label = bkp.role_label,
        step.status = bkp.status,
        step.is_current = bkp.is_current,
        step.updated_at = bkp.updated_at
      FROM dbo.bod_cod_approval_steps AS step
      INNER JOIN dbo.${STEPS_TABLE} AS bkp
        ON bkp.step_id = step.id;

      UPDATE report
      SET
        report.approval_track = bkp.approval_track,
        report.status = bkp.status,
        report.updated_at = bkp.updated_at
      FROM dbo.bod_cod_deviation_reports AS report
      INNER JOIN dbo.${REPORTS_TABLE} AS bkp
        ON bkp.report_id = report.id;
    END;
  `);

  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${INSERTED_STEPS_TABLE}', 'U') IS NOT NULL
      DROP TABLE dbo.${INSERTED_STEPS_TABLE};
  `);

  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${STEPS_TABLE}', 'U') IS NOT NULL
      DROP TABLE dbo.${STEPS_TABLE};
  `);

  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${REPORTS_TABLE}', 'U') IS NOT NULL
      DROP TABLE dbo.${REPORTS_TABLE};
  `);
}
