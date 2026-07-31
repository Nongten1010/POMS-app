/*
  POMS main database test-data cleanup (SQL Server)

  Default behavior is a dry run. The script selects the rows in scope and rolls
  the transaction back. To execute:
    1. Set @ExpectedDatabase to the exact current database name.
    2. Review every dry-run result set.
    3. Take a recoverable database backup.
    4. Set @BackupConfirmed = 1 and @Execute = 1.

  Preserved by design:
    - users, juristic persons, factories, eligible factories, roles, permissions
    - all point-code/request-number sequence tables
    - active device configurations whose request_id is NULL
    - KWP/BOD-COD rows merely linked to a targeted point, unless explicitly
      listed or enabled by include flags after review

  This script does not clean the separate Parameter database.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ExpectedDatabase SYSNAME = N'CHANGE_ME';
DECLARE @Execute BIT = 0;
DECLARE @BackupConfirmed BIT = 0;
DECLARE @IncludeKnownSeedRequests BIT = 1;
DECLARE @IncludeKnownMockAlerts BIT = 1;
DECLARE @IncludeLinkedKwpSubmissions BIT = 0;
DECLARE @IncludeLinkedBodCodReports BIT = 0;

IF @ExpectedDatabase = N'CHANGE_ME' OR LTRIM(RTRIM(@ExpectedDatabase)) = N''
BEGIN
  THROW 51000, 'Set @ExpectedDatabase to the exact POMS database name before running.', 1;
END;

IF DB_NAME() <> @ExpectedDatabase
BEGIN
  DECLARE @WrongDatabaseMessage NVARCHAR(2048) =
    CONCAT(N'Wrong database. Expected ', @ExpectedDatabase, N' but connected to ', DB_NAME(), N'.');
  THROW 51001, @WrongDatabaseMessage, 1;
END;

DECLARE @RequiredObjects TABLE (
  object_name SYSNAME NOT NULL PRIMARY KEY
);

INSERT INTO @RequiredObjects (object_name)
VALUES
  (N'dbo.cems_wpms_connection_requests'),
  (N'dbo.cems_wpms_measurement_points'),
  (N'dbo.cems_wpms_request_status_history'),
  (N'dbo.cems_wpms_request_factory_snapshots'),
  (N'dbo.cems_wpms_connected_measurement_points'),
  (N'dbo.device_connection_configs'),
  (N'dbo.device_measurement_channels'),
  (N'dbo.alert_events'),
  (N'dbo.alert_notifications'),
  (N'dbo.kwp_form_submissions'),
  (N'dbo.kwp_form_attachments'),
  (N'dbo.bod_cod_deviation_reports'),
  (N'dbo.bod_cod_deviation_measurements'),
  (N'dbo.bod_cod_deviation_reviews'),
  (N'dbo.bod_cod_deviation_attachments'),
  (N'dbo.bod_cod_approval_steps'),
  (N'dbo.bod_cod_approval_events'),
  (N'dbo.bod_cod_result_notices');

DECLARE @MissingObjects NVARCHAR(MAX);

SELECT @MissingObjects = STRING_AGG(object_name, N', ')
FROM @RequiredObjects
WHERE OBJECT_ID(object_name, N'U') IS NULL;

IF @MissingObjects IS NOT NULL
BEGIN
  DECLARE @MissingObjectsMessage NVARCHAR(2048) =
    CONCAT(N'Required tables are missing: ', LEFT(@MissingObjects, 1900), N'. Run current migrations first.');
  THROW 51002, @MissingObjectsMessage, 1;
END;

-- Reset session-local objects so this file can be rerun in the same query tab.
DROP TABLE IF EXISTS #CandidateCounts;
DROP TABLE IF EXISTS #TargetAlertEventIds;
DROP TABLE IF EXISTS #TargetBodCodReportIds;
DROP TABLE IF EXISTS #BlockedBodCodReportIds;
DROP TABLE IF EXISTS #LinkedBodCodReportIds;
DROP TABLE IF EXISTS #ExplicitBodCodReportIds;
DROP TABLE IF EXISTS #TargetKwpSubmissionIds;
DROP TABLE IF EXISTS #BlockedKwpSubmissionIds;
DROP TABLE IF EXISTS #LinkedKwpSubmissionIds;
DROP TABLE IF EXISTS #ExplicitKwpSubmissionIds;
DROP TABLE IF EXISTS #TargetDeviceConfigIds;
DROP TABLE IF EXISTS #TargetConnectedPointIds;
DROP TABLE IF EXISTS #TargetMeasurementPointIds;
DROP TABLE IF EXISTS #TargetConnectionRequestIds;
DROP TABLE IF EXISTS #TargetBodCodReportNos;
DROP TABLE IF EXISTS #TargetKwpSubmissionNos;
DROP TABLE IF EXISTS #TargetConnectionRequestNos;

CREATE TABLE #TargetConnectionRequestNos (
  request_no VARCHAR(32) NOT NULL PRIMARY KEY
);

IF @IncludeKnownSeedRequests = 1
BEGIN
  INSERT INTO #TargetConnectionRequestNos (request_no)
  VALUES
    ('CEMS-DEMO-S0001'),
    ('WPMS-DEMO-P0001');
END;

-- Add only request numbers that you have verified are test data.
-- INSERT INTO #TargetConnectionRequestNos (request_no) VALUES ('CEMS-TEST-EXAMPLE');

CREATE TABLE #TargetKwpSubmissionNos (
  submission_no VARCHAR(32) NOT NULL PRIMARY KEY
);

-- KWP numbers are never inferred from their format. Add verified test numbers only.
-- INSERT INTO #TargetKwpSubmissionNos (submission_no) VALUES ('F01-04-0001/2569');

CREATE TABLE #TargetBodCodReportNos (
  report_no VARCHAR(40) NOT NULL PRIMARY KEY
);

-- Add verified BOD/COD test report numbers only.
-- INSERT INTO #TargetBodCodReportNos (report_no) VALUES ('BODCOD-TEST-0001');

BEGIN TRY
  BEGIN TRANSACTION;

  SELECT request_row.id
  INTO #TargetConnectionRequestIds
  FROM dbo.cems_wpms_connection_requests AS request_row
  INNER JOIN #TargetConnectionRequestNos AS target
    ON target.request_no = request_row.request_no;

  SELECT measurement_point.id
  INTO #TargetMeasurementPointIds
  FROM dbo.cems_wpms_measurement_points AS measurement_point
  INNER JOIN #TargetConnectionRequestIds AS target
    ON target.id = measurement_point.request_id;

  SELECT connected_point.id
  INTO #TargetConnectedPointIds
  FROM dbo.cems_wpms_connected_measurement_points AS connected_point
  WHERE EXISTS (
      SELECT 1
      FROM #TargetConnectionRequestIds AS target
      WHERE target.id = connected_point.source_request_id
    )
    OR EXISTS (
      SELECT 1
      FROM #TargetMeasurementPointIds AS target
      WHERE target.id = connected_point.source_measurement_point_id
    );

  SELECT config_row.id
  INTO #TargetDeviceConfigIds
  FROM dbo.device_connection_configs AS config_row
  INNER JOIN #TargetConnectionRequestIds AS target
    ON target.id = config_row.request_id;

  SELECT submission.id
  INTO #ExplicitKwpSubmissionIds
  FROM dbo.kwp_form_submissions AS submission
  WHERE EXISTS (
    SELECT 1
    FROM #TargetKwpSubmissionNos AS target
    WHERE target.submission_no = submission.submission_no
  );

  SELECT submission.id
  INTO #LinkedKwpSubmissionIds
  FROM dbo.kwp_form_submissions AS submission
  WHERE EXISTS (
    SELECT 1
    FROM #TargetConnectedPointIds AS target
    WHERE target.id = submission.connected_point_id
  );

  SELECT linked.id
  INTO #BlockedKwpSubmissionIds
  FROM #LinkedKwpSubmissionIds AS linked
  WHERE @IncludeLinkedKwpSubmissions = 0
    AND NOT EXISTS (
      SELECT 1
      FROM #ExplicitKwpSubmissionIds AS explicit_target
      WHERE explicit_target.id = linked.id
    );

  SELECT target_ids.id
  INTO #TargetKwpSubmissionIds
  FROM (
    SELECT explicit_target.id
    FROM #ExplicitKwpSubmissionIds AS explicit_target
    UNION
    SELECT linked.id
    FROM #LinkedKwpSubmissionIds AS linked
    WHERE @IncludeLinkedKwpSubmissions = 1
  ) AS target_ids;

  SELECT report.id
  INTO #ExplicitBodCodReportIds
  FROM dbo.bod_cod_deviation_reports AS report
  WHERE EXISTS (
    SELECT 1
    FROM #TargetBodCodReportNos AS target
    WHERE target.report_no = report.report_no
  );

  SELECT report.id
  INTO #LinkedBodCodReportIds
  FROM dbo.bod_cod_deviation_reports AS report
  WHERE EXISTS (
    SELECT 1
    FROM #TargetConnectedPointIds AS target
    WHERE target.id = report.connected_measurement_point_id
  );

  SELECT linked.id
  INTO #BlockedBodCodReportIds
  FROM #LinkedBodCodReportIds AS linked
  WHERE @IncludeLinkedBodCodReports = 0
    AND NOT EXISTS (
      SELECT 1
      FROM #ExplicitBodCodReportIds AS explicit_target
      WHERE explicit_target.id = linked.id
    );

  SELECT target_ids.id
  INTO #TargetBodCodReportIds
  FROM (
    SELECT explicit_target.id
    FROM #ExplicitBodCodReportIds AS explicit_target
    UNION
    SELECT linked.id
    FROM #LinkedBodCodReportIds AS linked
    WHERE @IncludeLinkedBodCodReports = 1
  ) AS target_ids;

  SELECT alert.id
  INTO #TargetAlertEventIds
  FROM dbo.alert_events AS alert
  WHERE @IncludeKnownMockAlerts = 1
    AND (
      alert.idempotency_key LIKE 'mock-alert-events-%'
      OR alert.source_table = 'mock_alert_events_html'
    );

  CREATE TABLE #CandidateCounts (
    sort_order INT NOT NULL,
    entity_name NVARCHAR(128) NOT NULL,
    candidate_count BIGINT NOT NULL
  );

  INSERT INTO #CandidateCounts (sort_order, entity_name, candidate_count)
  SELECT 10, N'connection requests', COUNT_BIG(*) FROM #TargetConnectionRequestIds
  UNION ALL
  SELECT 20, N'measurement points', COUNT_BIG(*) FROM #TargetMeasurementPointIds
  UNION ALL
  SELECT 30, N'connected measurement points', COUNT_BIG(*) FROM #TargetConnectedPointIds
  UNION ALL
  SELECT 40, N'request status history', COUNT_BIG(*)
  FROM dbo.cems_wpms_request_status_history AS history
  INNER JOIN #TargetConnectionRequestIds AS target ON target.id = history.request_id
  UNION ALL
  SELECT 50, N'request factory snapshots', COUNT_BIG(*)
  FROM dbo.cems_wpms_request_factory_snapshots AS snapshot_row
  INNER JOIN #TargetConnectionRequestIds AS target ON target.id = snapshot_row.request_id
  UNION ALL
  SELECT 60, N'device configurations bound to requests', COUNT_BIG(*) FROM #TargetDeviceConfigIds
  UNION ALL
  SELECT 70, N'device measurement channels', COUNT_BIG(*)
  FROM dbo.device_measurement_channels AS channel
  INNER JOIN #TargetDeviceConfigIds AS target ON target.id = channel.config_id
  UNION ALL
  SELECT 80, N'KWP submissions (children cascade)', COUNT_BIG(*) FROM #TargetKwpSubmissionIds
  UNION ALL
  SELECT 90, N'KWP attachments (database rows cascade)', COUNT_BIG(*)
  FROM dbo.kwp_form_attachments AS attachment
  INNER JOIN #TargetKwpSubmissionIds AS target ON target.id = attachment.submission_id
  UNION ALL
  SELECT 100, N'BOD/COD reports', COUNT_BIG(*) FROM #TargetBodCodReportIds
  UNION ALL
  SELECT 110, N'BOD/COD measurements', COUNT_BIG(*)
  FROM dbo.bod_cod_deviation_measurements AS measurement
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = measurement.report_id
  UNION ALL
  SELECT 120, N'BOD/COD reviews', COUNT_BIG(*)
  FROM dbo.bod_cod_deviation_reviews AS review
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = review.report_id
  UNION ALL
  SELECT 130, N'BOD/COD attachments', COUNT_BIG(*)
  FROM dbo.bod_cod_deviation_attachments AS attachment
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = attachment.report_id
  UNION ALL
  SELECT 140, N'BOD/COD approval steps', COUNT_BIG(*)
  FROM dbo.bod_cod_approval_steps AS step_row
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = step_row.report_id
  UNION ALL
  SELECT 150, N'BOD/COD approval events', COUNT_BIG(*)
  FROM dbo.bod_cod_approval_events AS event_row
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = event_row.report_id
  UNION ALL
  SELECT 160, N'BOD/COD result notices', COUNT_BIG(*)
  FROM dbo.bod_cod_result_notices AS notice
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = notice.report_id
  UNION ALL
  SELECT 170, N'mock alert events', COUNT_BIG(*) FROM #TargetAlertEventIds
  UNION ALL
  SELECT 180, N'mock alert notifications', COUNT_BIG(*)
  FROM dbo.alert_notifications AS notification
  INNER JOIN #TargetAlertEventIds AS target ON target.id = notification.alert_event_id;

  SELECT
    request_row.id,
    request_row.request_no,
    request_row.factory_id,
    request_row.factory_name,
    request_row.system_type,
    request_row.status,
    request_row.created_at
  FROM dbo.cems_wpms_connection_requests AS request_row
  INNER JOIN #TargetConnectionRequestIds AS target ON target.id = request_row.id
  ORDER BY request_row.request_no;

  SELECT
    connected_point.id,
    connected_point.point_code,
    connected_point.factory_id,
    connected_point.factory_name,
    connected_point.source_request_id,
    connected_point.source_measurement_point_id
  FROM dbo.cems_wpms_connected_measurement_points AS connected_point
  INNER JOIN #TargetConnectedPointIds AS target ON target.id = connected_point.id
  ORDER BY connected_point.point_code;

  SELECT
    alert.id,
    alert.idempotency_key,
    alert.source_table,
    alert.factory_id,
    alert.station_id,
    alert.parameter_code,
    alert.event_date
  FROM dbo.alert_events AS alert
  INNER JOIN #TargetAlertEventIds AS target ON target.id = alert.id
  ORDER BY alert.id;

  SELECT
    submission.id,
    submission.submission_no,
    submission.form_type,
    submission.status,
    submission.connected_point_id
  FROM dbo.kwp_form_submissions AS submission
  INNER JOIN #TargetKwpSubmissionIds AS target ON target.id = submission.id
  ORDER BY submission.submission_no;

  SELECT
    N'KWP' AS source_module,
    submission.id,
    submission.submission_no,
    submission.form_type,
    submission.status,
    submission.connected_point_id,
    N'Linked to a targeted connected point but not selected for deletion. Add the number explicitly or set @IncludeLinkedKwpSubmissions = 1 after review.' AS action_required
  FROM dbo.kwp_form_submissions AS submission
  INNER JOIN #BlockedKwpSubmissionIds AS target ON target.id = submission.id
  ORDER BY submission.submission_no;

  SELECT
    report.id,
    report.report_no,
    report.status,
    report.connected_measurement_point_id,
    report.factory_name
  FROM dbo.bod_cod_deviation_reports AS report
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = report.id
  ORDER BY report.report_no;

  SELECT
    N'BOD/COD' AS source_module,
    report.id,
    report.report_no,
    report.status,
    report.connected_measurement_point_id,
    report.factory_name,
    N'Linked to a targeted connected point but not selected for deletion. Add the number explicitly or set @IncludeLinkedBodCodReports = 1 after review.' AS action_required
  FROM dbo.bod_cod_deviation_reports AS report
  INNER JOIN #BlockedBodCodReportIds AS target ON target.id = report.id
  ORDER BY report.report_no;

  SELECT
    N'KWP' AS source_module,
    attachment.original_file_name,
    attachment.stored_file_name,
    attachment.storage_path
  FROM dbo.kwp_form_attachments AS attachment
  INNER JOIN #TargetKwpSubmissionIds AS target ON target.id = attachment.submission_id
  UNION ALL
  SELECT
    N'BOD/COD',
    attachment.original_file_name,
    attachment.stored_file_name,
    attachment.storage_path
  FROM dbo.bod_cod_deviation_attachments AS attachment
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = attachment.report_id
  ORDER BY source_module, storage_path;

  SELECT entity_name, candidate_count
  FROM #CandidateCounts
  ORDER BY sort_order;

  SELECT
    N'blocked linked KWP submissions' AS entity_name,
    COUNT_BIG(*) AS candidate_count
  FROM #BlockedKwpSubmissionIds
  UNION ALL
  SELECT
    N'blocked linked BOD/COD reports',
    COUNT_BIG(*)
  FROM #BlockedBodCodReportIds;

  IF @Execute = 0
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT
      N'DRY_RUN_ROLLED_BACK' AS cleanup_status,
      N'No rows were deleted. Review the result sets, then enable execution only after backup.' AS message;
    RETURN;
  END;

  IF @BackupConfirmed <> 1
  BEGIN
    THROW 51003, 'Execution requires @BackupConfirmed = 1 after a recoverable backup is complete.', 1;
  END;

  IF EXISTS (SELECT 1 FROM #BlockedKwpSubmissionIds)
    OR EXISTS (SELECT 1 FROM #BlockedBodCodReportIds)
  BEGIN
    THROW 51005, 'Linked KWP or BOD/COD rows are still blocked. Add explicit numbers or enable the include flags after review.', 1;
  END;

  DELETE notification
  FROM dbo.alert_notifications AS notification
  INNER JOIN #TargetAlertEventIds AS target ON target.id = notification.alert_event_id;

  DELETE alert
  FROM dbo.alert_events AS alert
  INNER JOIN #TargetAlertEventIds AS target ON target.id = alert.id;

  DELETE notice
  FROM dbo.bod_cod_result_notices AS notice
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = notice.report_id;

  DELETE event_row
  FROM dbo.bod_cod_approval_events AS event_row
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = event_row.report_id;

  DELETE step_row
  FROM dbo.bod_cod_approval_steps AS step_row
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = step_row.report_id;

  DELETE attachment
  FROM dbo.bod_cod_deviation_attachments AS attachment
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = attachment.report_id;

  DELETE review
  FROM dbo.bod_cod_deviation_reviews AS review
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = review.report_id;

  DELETE measurement
  FROM dbo.bod_cod_deviation_measurements AS measurement
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = measurement.report_id;

  DELETE report
  FROM dbo.bod_cod_deviation_reports AS report
  INNER JOIN #TargetBodCodReportIds AS target ON target.id = report.id;

  -- KWP child tables use ON DELETE CASCADE from kwp_form_submissions.
  DELETE submission
  FROM dbo.kwp_form_submissions AS submission
  INNER JOIN #TargetKwpSubmissionIds AS target ON target.id = submission.id;

  DELETE channel
  FROM dbo.device_measurement_channels AS channel
  INNER JOIN #TargetDeviceConfigIds AS target ON target.id = channel.config_id;

  DELETE config_row
  FROM dbo.device_connection_configs AS config_row
  INNER JOIN #TargetDeviceConfigIds AS target ON target.id = config_row.id;

  DELETE connected_point
  FROM dbo.cems_wpms_connected_measurement_points AS connected_point
  INNER JOIN #TargetConnectedPointIds AS target ON target.id = connected_point.id;

  DELETE snapshot_row
  FROM dbo.cems_wpms_request_factory_snapshots AS snapshot_row
  INNER JOIN #TargetConnectionRequestIds AS target ON target.id = snapshot_row.request_id;

  DELETE history
  FROM dbo.cems_wpms_request_status_history AS history
  INNER JOIN #TargetConnectionRequestIds AS target ON target.id = history.request_id;

  DELETE measurement_point
  FROM dbo.cems_wpms_measurement_points AS measurement_point
  INNER JOIN #TargetMeasurementPointIds AS target ON target.id = measurement_point.id;

  DELETE request_row
  FROM dbo.cems_wpms_connection_requests AS request_row
  INNER JOIN #TargetConnectionRequestIds AS target ON target.id = request_row.id;

  IF EXISTS (
      SELECT 1
      FROM dbo.cems_wpms_connection_requests AS request_row
      INNER JOIN #TargetConnectionRequestIds AS target ON target.id = request_row.id
    )
    OR EXISTS (
      SELECT 1
      FROM dbo.kwp_form_submissions AS submission
      INNER JOIN #TargetKwpSubmissionIds AS target ON target.id = submission.id
    )
    OR EXISTS (
      SELECT 1
      FROM dbo.bod_cod_deviation_reports AS report
      INNER JOIN #TargetBodCodReportIds AS target ON target.id = report.id
    )
  BEGIN
    THROW 51004, 'Cleanup verification failed; the transaction will be rolled back.', 1;
  END;

  COMMIT TRANSACTION;

  SELECT
    N'COMMITTED' AS cleanup_status,
    entity_name,
    candidate_count AS planned_rows_deleted
  FROM #CandidateCounts
  ORDER BY sort_order;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0
  BEGIN
    ROLLBACK TRANSACTION;
  END;

  THROW;
END CATCH;
