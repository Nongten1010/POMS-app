import type { Knex } from 'knex';

const REPORTS_TABLE = 'bod_cod_result_notice_backfill_reports_0063';
const STEPS_TABLE = 'bod_cod_result_notice_backfill_steps_0063';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${REPORTS_TABLE}', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${REPORTS_TABLE} (
        report_id BIGINT NOT NULL PRIMARY KEY,
        status VARCHAR(32) NOT NULL,
        updated_by BIGINT NULL,
        updated_at DATETIME2 NOT NULL,
        moved_current_step BIT NOT NULL
      );
    END;
  `);

  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${STEPS_TABLE}', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${STEPS_TABLE} (
        report_id BIGINT NOT NULL,
        step_id BIGINT NOT NULL PRIMARY KEY,
        track VARCHAR(16) NOT NULL,
        step_no INT NOT NULL,
        role_code VARCHAR(32) NOT NULL,
        role_label NVARCHAR(120) NOT NULL,
        status VARCHAR(32) NOT NULL,
        actor_user_id BIGINT NULL,
        actor_name NVARCHAR(255) NULL,
        actor_position NVARCHAR(255) NULL,
        decision VARCHAR(32) NULL,
        comment NVARCHAR(MAX) NULL,
        decided_at DATETIME2 NULL,
        revision_no INT NOT NULL,
        is_current BIT NOT NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NOT NULL,
        deleted_at DATETIME2 NULL
      );
    END;
  `);

  await knex.schema.raw(`
    ;WITH affected_reports AS (
      SELECT
        r.id,
        r.status,
        r.updated_by,
        r.updated_at,
        CASE
          WHEN r.status IN ('WAITING_APPROVAL', 'WAITING_REVIEW')
            AND current_step.id IS NOT NULL
            AND current_step.role_code IN ('APPROVER', 'REVIEWER')
            AND current_step.status = 'PENDING'
          THEN 1
          ELSE 0
        END AS moved_current_step
      FROM dbo.bod_cod_deviation_reports AS r
      OUTER APPLY (
        SELECT TOP 1 s.id, s.role_code, s.status
        FROM dbo.bod_cod_approval_steps AS s
        WHERE s.report_id = r.id
          AND s.is_current = 1
          AND s.deleted_at IS NULL
        ORDER BY s.step_no ASC
      ) AS current_step
      WHERE r.deleted_at IS NULL
        AND r.status IN ('SUBMITTED', 'REVISED_PENDING_REVIEW', 'WAITING_APPROVAL', 'WAITING_REVIEW')
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.bod_cod_approval_steps AS result_notice_step
          WHERE result_notice_step.report_id = r.id
            AND result_notice_step.role_code = 'RESULT_NOTICE'
            AND result_notice_step.deleted_at IS NULL
        )
        AND EXISTS (
          SELECT 1
          FROM dbo.bod_cod_approval_steps AS later_step
          WHERE later_step.report_id = r.id
            AND later_step.step_no >= 2
            AND later_step.role_code IN ('APPROVER', 'REVIEWER')
            AND later_step.deleted_at IS NULL
        )
    )
    INSERT INTO dbo.${REPORTS_TABLE} (
      report_id,
      status,
      updated_by,
      updated_at,
      moved_current_step
    )
    SELECT
      affected_reports.id,
      affected_reports.status,
      affected_reports.updated_by,
      affected_reports.updated_at,
      affected_reports.moved_current_step
    FROM affected_reports
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.${REPORTS_TABLE} AS bkp
      WHERE bkp.report_id = affected_reports.id
    );
  `);

  await knex.schema.raw(`
    INSERT INTO dbo.${STEPS_TABLE} (
      report_id,
      step_id,
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
    SELECT
      step.report_id,
      step.id,
      step.track,
      step.step_no,
      step.role_code,
      step.role_label,
      step.status,
      step.actor_user_id,
      step.actor_name,
      step.actor_position,
      step.decision,
      step.comment,
      step.decided_at,
      step.revision_no,
      step.is_current,
      step.created_at,
      step.updated_at,
      step.deleted_at
    FROM dbo.bod_cod_approval_steps AS step
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = step.report_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.${STEPS_TABLE} AS bkp
      WHERE bkp.step_id = step.id
    );
  `);

  await knex.schema.raw(`
    UPDATE step
    SET
      step.step_no = step.step_no + 100,
      step.updated_at = SYSDATETIME()
    FROM dbo.bod_cod_approval_steps AS step
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = step.report_id
    WHERE step.step_no >= 2
      AND step.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.bod_cod_approval_steps AS result_notice_step
        WHERE result_notice_step.report_id = step.report_id
          AND result_notice_step.role_code = 'RESULT_NOTICE'
          AND result_notice_step.deleted_at IS NULL
      );
  `);

  await knex.schema.raw(`
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
    SELECT
      report.id,
      report.approval_track,
      2,
      'RESULT_NOTICE',
      CASE
        WHEN report.approval_track = 'CENTRAL'
          THEN N'เจ้าหน้าที่กฝม. (บันทึก/แก้ไขแบบแจ้งผล)'
        ELSE N'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)'
      END,
      CASE WHEN affected_report.moved_current_step = 1 THEN 'PENDING' ELSE 'WAITING' END,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      1,
      affected_report.moved_current_step,
      SYSDATETIME(),
      SYSDATETIME(),
      NULL
    FROM dbo.bod_cod_deviation_reports AS report
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = report.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.bod_cod_approval_steps AS result_notice_step
      WHERE result_notice_step.report_id = report.id
        AND result_notice_step.role_code = 'RESULT_NOTICE'
        AND result_notice_step.deleted_at IS NULL
    );
  `);

  await knex.schema.raw(`
    UPDATE step
    SET
      step.step_no = step.step_no - 99,
      step.status = CASE
        WHEN affected_report.moved_current_step = 1 AND step.is_current = 1 THEN 'WAITING'
        ELSE step.status
      END,
      step.is_current = CASE
        WHEN affected_report.moved_current_step = 1 AND step.is_current = 1 THEN 0
        ELSE step.is_current
      END,
      step.updated_at = SYSDATETIME()
    FROM dbo.bod_cod_approval_steps AS step
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = step.report_id
    WHERE step.step_no >= 102
      AND step.deleted_at IS NULL;
  `);

  await knex.schema.raw(`
    UPDATE report
    SET
      report.status = 'WAITING_RESULT_NOTICE',
      report.updated_at = SYSDATETIME()
    FROM dbo.bod_cod_deviation_reports AS report
    INNER JOIN dbo.${REPORTS_TABLE} AS affected_report
      ON affected_report.report_id = report.id
    WHERE affected_report.moved_current_step = 1
      AND report.status IN ('WAITING_APPROVAL', 'WAITING_REVIEW');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF OBJECT_ID('dbo.${REPORTS_TABLE}', 'U') IS NOT NULL
      AND OBJECT_ID('dbo.${STEPS_TABLE}', 'U') IS NOT NULL
    BEGIN
      UPDATE report
      SET
        report.status = bkp.status,
        report.updated_by = bkp.updated_by,
        report.updated_at = bkp.updated_at
      FROM dbo.bod_cod_deviation_reports AS report
      INNER JOIN dbo.${REPORTS_TABLE} AS bkp
        ON bkp.report_id = report.id;

      DELETE step
      FROM dbo.bod_cod_approval_steps AS step
      INNER JOIN dbo.${REPORTS_TABLE} AS bkp
        ON bkp.report_id = step.report_id;

      SET IDENTITY_INSERT dbo.bod_cod_approval_steps ON;

      INSERT INTO dbo.bod_cod_approval_steps (
        id,
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
      SELECT
        step_id,
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
      FROM dbo.${STEPS_TABLE}
      ORDER BY step_id ASC;

      SET IDENTITY_INSERT dbo.bod_cod_approval_steps OFF;
    END;
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
