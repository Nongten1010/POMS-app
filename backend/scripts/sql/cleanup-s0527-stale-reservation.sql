-- Exact one-off repair approved for request 10037 / retired point 10041.
-- Run on W25-SVR1 / poms. First run with @apply = 0; use 1 to apply.
-- No request, current point, connected data or status history is deleted.
IF @@TRANCOUNT <> 0
BEGIN
  RAISERROR('Run this repair outside an existing transaction.', 16, 1);
  RETURN;
END;
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 10000;

DECLARE @apply bit = 0;
DECLARE @requestId bigint = 10037;
DECLARE @oldPointId bigint = 10041;
DECLARE @currentPointId bigint = 10067;
DECLARE @registryId bigint = 17;
DECLARE @code varchar(64) = 'S0527';
DECLARE @matches int;
DECLARE @originalTrigger nvarchar(max);
DECLARE @restoreTrigger nvarchar(max);
DECLARE @restoreBatch nvarchar(max);
DECLARE @triggerKeyword int;
DECLARE @usesAnsiNulls bit;
DECLARE @usesQuotedIdentifier bit;

IF DB_NAME() <> N'poms' OR CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) <> N'W25-SVR1'
  THROW 51125, 'Expected W25-SVR1 / poms; no data was changed.', 1;

BEGIN TRY
  BEGIN TRANSACTION;

  SELECT @matches = COUNT(*)
  FROM dbo.cems_wpms_connection_requests WITH (UPDLOCK, HOLDLOCK)
  WHERE id = @requestId AND deleted_at IS NULL AND system_type = 'CEMS'
    AND status IN ('PENDING_DESIGN_REVIEW', 'REVISED_PENDING_DESIGN_REVIEW', 'WAITING_FACTORY_REVISION');
  IF @matches <> 1
    THROW 51125, 'Request identity or editable status has changed.', 1;

  SELECT @matches = COUNT(*)
  FROM dbo.cems_wpms_measurement_points WITH (UPDLOCK, HOLDLOCK)
  WHERE id = @currentPointId AND request_id = @requestId AND deleted_at IS NULL
    AND NULLIF(LTRIM(RTRIM(point_code)), '') IS NULL
    AND point_code_assignment_mode IS NULL;
  IF @matches <> 1
    THROW 51125, 'Replacement point 10067 is no longer active and unassigned.', 1;

  -- Serialize this short repair with registry writers before altering its trigger.
  SELECT @matches = COUNT(*)
  FROM dbo.cems_wpms_point_code_registry WITH (TABLOCKX, HOLDLOCK)
  WHERE id = @registryId AND normalized_point_code = @code
    AND source_request_id = @requestId AND source_measurement_point_id = @oldPointId
    AND assignment_mode = 'OFFICER_DIRECT';
  IF @matches <> 1
    THROW 51125, 'Reservation 17 no longer has the expected owner; repair stopped.', 1;

  SELECT @matches = COUNT(*)
  FROM dbo.cems_wpms_measurement_points WITH (UPDLOCK, HOLDLOCK)
  WHERE id = @oldPointId AND request_id = @requestId AND deleted_at IS NOT NULL
    AND UPPER(LTRIM(RTRIM(point_code))) = @code
    AND point_code_assignment_mode = 'OFFICER_DIRECT';
  IF @matches <> 1
    THROW 51125, 'Old point 10041 is not the expected retired S0527 source.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.cems_wpms_connected_measurement_points WITH (UPDLOCK, HOLDLOCK)
    WHERE source_measurement_point_id = @oldPointId
      OR UPPER(LTRIM(RTRIM(point_code))) = @code
      OR (deleted_at IS NULL AND UPPER(LTRIM(RTRIM(point_name))) = @code)
  )
    THROW 51125, 'A connected point still references this source or code.', 1;
  IF EXISTS (
    SELECT 1 FROM dbo.cems_wpms_measurement_points WITH (UPDLOCK, HOLDLOCK)
    WHERE id <> @oldPointId AND deleted_at IS NULL
      AND UPPER(LTRIM(RTRIM(point_code))) = @code
  )
    THROW 51125, 'Another active request point uses S0527.', 1;
  IF EXISTS (
    SELECT 1 FROM dbo.device_connection_configs WITH (UPDLOCK, HOLDLOCK)
    WHERE request_id IS NULL AND deleted_at IS NULL
      AND UPPER(LTRIM(RTRIM(station_id))) = @code
  )
    THROW 51125, 'A live device configuration still uses S0527.', 1;

  SELECT @originalTrigger = module.definition,
    @usesAnsiNulls = module.uses_ansi_nulls,
    @usesQuotedIdentifier = module.uses_quoted_identifier
  FROM sys.triggers AS trigger_row
  INNER JOIN sys.sql_modules AS module ON module.object_id = trigger_row.object_id
  WHERE trigger_row.object_id = OBJECT_ID(N'dbo.trg_cems_wpms_point_code_registry_immutable')
    AND trigger_row.parent_id = OBJECT_ID(N'dbo.cems_wpms_point_code_registry')
    AND trigger_row.is_disabled = 0 AND trigger_row.is_instead_of_trigger = 1;
  SET @triggerKeyword = CHARINDEX(N'TRIGGER', UPPER(@originalTrigger));
  IF @originalTrigger IS NULL OR @triggerKeyword NOT BETWEEN 1 AND 40
    THROW 51125, 'Cannot safely preserve the existing registry trigger.', 1;
  SET @restoreTrigger = N'ALTER ' + SUBSTRING(@originalTrigger, @triggerKeyword, LEN(@originalTrigger));

  IF @apply = 0
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT 'READY - no changes made' AS result, @requestId AS request_id,
      @oldPointId AS point_to_delete, @registryId AS reservation_to_delete,
      @currentPointId AS point_to_keep, @code AS code_to_release;
    RETURN;
  END;

  -- The exclusive table lock and transactional DDL isolate this exact exception.
  -- Restore the original trigger before commit; a failure rolls back data and DDL.
  EXEC(N'ALTER TRIGGER dbo.trg_cems_wpms_point_code_registry_immutable
    ON dbo.cems_wpms_point_code_registry INSTEAD OF UPDATE, DELETE AS
    BEGIN
      SET NOCOUNT ON;
      IF EXISTS (SELECT 1 FROM inserted)
        THROW 51095, ''Point-code registry updates remain forbidden.'', 1;
      IF (SELECT COUNT(*) FROM deleted) <> 1 OR EXISTS (
        SELECT 1 FROM deleted WHERE id <> 17 OR normalized_point_code <> ''S0527''
          OR source_request_id IS NULL OR source_request_id <> 10037
          OR source_measurement_point_id IS NULL OR source_measurement_point_id <> 10041
          OR assignment_mode <> ''OFFICER_DIRECT''
      )
        THROW 51095, ''Only the approved stale S0527 reservation can be removed.'', 1;
      DELETE registry FROM dbo.cems_wpms_point_code_registry AS registry
      INNER JOIN deleted AS candidate ON candidate.id = registry.id;
    END;');

  DELETE FROM dbo.cems_wpms_point_code_registry
  WHERE id = @registryId AND normalized_point_code = @code
    AND source_request_id = @requestId AND source_measurement_point_id = @oldPointId;
  IF EXISTS (SELECT 1 FROM dbo.cems_wpms_point_code_registry WHERE id = @registryId)
    THROW 51125, 'The stale reservation was not removed.', 1;

  DELETE FROM dbo.cems_wpms_measurement_points
  WHERE id = @oldPointId AND request_id = @requestId AND deleted_at IS NOT NULL;
  IF @@ROWCOUNT <> 1
    THROW 51125, 'Expected exactly one obsolete point to be deleted.', 1;

  -- Preserve captured module SET options as well as the original trigger body.
  SET @restoreBatch = N'SET ANSI_NULLS ' + CASE WHEN @usesAnsiNulls = 1 THEN N'ON' ELSE N'OFF' END
    + N'; SET QUOTED_IDENTIFIER ' + CASE WHEN @usesQuotedIdentifier = 1 THEN N'ON' ELSE N'OFF' END
    + N'; EXEC sys.sp_executesql @definition;';
  EXEC sys.sp_executesql @restoreBatch, N'@definition nvarchar(max)', @definition = @restoreTrigger;
  IF OBJECT_DEFINITION(OBJECT_ID(N'dbo.trg_cems_wpms_point_code_registry_immutable')) <> @restoreTrigger
    THROW 51125, 'Registry trigger restoration could not be verified.', 1;
  IF NOT EXISTS (
    SELECT 1 FROM sys.sql_modules
    WHERE object_id = OBJECT_ID(N'dbo.trg_cems_wpms_point_code_registry_immutable')
      AND uses_ansi_nulls = @usesAnsiNulls AND uses_quoted_identifier = @usesQuotedIdentifier
  )
    THROW 51125, 'Registry trigger SET options were not restored.', 1;
  IF EXISTS (SELECT 1 FROM dbo.cems_wpms_point_code_registry WHERE normalized_point_code = @code)
    OR EXISTS (SELECT 1 FROM dbo.cems_wpms_measurement_points WHERE id = @oldPointId)
    THROW 51125, 'Post-repair verification failed.', 1;

  COMMIT TRANSACTION;
  SELECT 'APPLIED - old point and reservation deleted; original trigger restored' AS result,
    @requestId AS request_id, @currentPointId AS preserved_point_id, @code AS released_code;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
