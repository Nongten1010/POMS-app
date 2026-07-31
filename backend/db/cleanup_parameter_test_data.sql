/*
  Parameter database test-data cleanup (SQL Server)

  Default behavior is a dry run with an empty deletion scope. Only explicitly
  reviewed station/table/date combinations can be selected. Known seed windows
  that may be copied into the scope after verification are:
    - S0001 and P0001, 2026-05-01 through 2026-05-10
    - S0001 and P0001, 2026-06-01 through 2026-06-10

  To execute:
    1. Set @ExpectedDatabase to the exact Parameter database name.
    2. Set @SchemaName if the ingest schema has a different name.
    3. Add only verified scope rows to #TargetDateWindows and
       #TargetParameterTables.
    4. Review every dry-run count.
    5. Take a recoverable database backup.
    6. Set @ExpectedTotalRowsToDelete to the reviewed total, then set
       @ParameterScopeConfirmed = 1, @BackupConfirmed = 1, and @Execute = 1.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ExpectedDatabase SYSNAME = N'CHANGE_ME';
DECLARE @SchemaName SYSNAME = N'ingest';
DECLARE @Execute BIT = 0;
DECLARE @BackupConfirmed BIT = 0;
DECLARE @ParameterScopeConfirmed BIT = 0;
DECLARE @ExpectedTotalRowsToDelete BIGINT = NULL;

IF @ExpectedDatabase = N'CHANGE_ME' OR LTRIM(RTRIM(@ExpectedDatabase)) = N''
BEGIN
  THROW 51100, 'Set @ExpectedDatabase to the exact Parameter database name before running.', 1;
END;

IF DB_NAME() <> @ExpectedDatabase
BEGIN
  DECLARE @WrongDatabaseMessage NVARCHAR(2048) =
    CONCAT(N'Wrong database. Expected ', @ExpectedDatabase, N' but connected to ', DB_NAME(), N'.');
  THROW 51101, @WrongDatabaseMessage, 1;
END;

IF SCHEMA_ID(@SchemaName) IS NULL
BEGIN
  DECLARE @MissingSchemaMessage NVARCHAR(2048) =
    CONCAT(N'Missing Parameter schema: ', @SchemaName, N'.');
  THROW 51102, @MissingSchemaMessage, 1;
END;

-- Reset session-local objects so this file can be rerun in the same query tab.
DROP TABLE IF EXISTS #CandidateCounts;
DROP TABLE IF EXISTS #TargetParameterTables;
DROP TABLE IF EXISTS #TargetDateWindows;

CREATE TABLE #TargetDateWindows (
  station_id NVARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  PRIMARY KEY (station_id, start_date, end_date),
  CHECK (start_date <= end_date)
);

-- The scope is intentionally empty. Copy only verified test-only windows here;
-- never use an open-ended date range.
-- INSERT INTO #TargetDateWindows (station_id, start_date, end_date)
-- VALUES
--   (N'S0001', '2026-05-01', '2026-05-10'),
--   (N'S0001', '2026-06-01', '2026-06-10'),
--   (N'P0001', '2026-05-01', '2026-05-10'),
--   (N'P0001', '2026-06-01', '2026-06-10');

CREATE TABLE #TargetParameterTables (
  station_id NVARCHAR(64) NOT NULL,
  table_name SYSNAME NOT NULL,
  PRIMARY KEY (station_id, table_name)
);

-- The table allow-list is also intentionally empty. Add only tables whose
-- station/date buckets have been reviewed and contain test data exclusively.
-- INSERT INTO #TargetParameterTables (station_id, table_name)
-- VALUES
--   (N'S0001', N'S0001_data_real'),
--   (N'S0001', N'S0001_data_1m'),
--   (N'S0001', N'S0001_data_5m'),
--   (N'S0001', N'S0001_data_60m'),
--   (N'S0001', N'S0001_data_1day'),
--   (N'S0001', N'S0001_data_test'),
--   (N'P0001', N'P0001_data_real'),
--   (N'P0001', N'P0001_data_1m'),
--   (N'P0001', N'P0001_data_5m'),
--   (N'P0001', N'P0001_data_60m'),
--   (N'P0001', N'P0001_data_1day'),
--   (N'P0001', N'P0001_data_test');

CREATE TABLE #CandidateCounts (
  station_id NVARCHAR(64) NOT NULL,
  table_name SYSNAME NOT NULL,
  table_exists BIT NOT NULL,
  candidate_count BIGINT NOT NULL,
  deleted_count BIGINT NULL,
  PRIMARY KEY (station_id, table_name)
);

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @StationId NVARCHAR(64);
  DECLARE @TableName SYSNAME;
  DECLARE @ObjectName NVARCHAR(517);
  DECLARE @QualifiedTable NVARCHAR(517);
  DECLARE @Sql NVARCHAR(MAX);
  DECLARE @CandidateCount BIGINT;

  DECLARE candidate_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT station_id, table_name
    FROM #TargetParameterTables
    ORDER BY station_id, table_name;

  OPEN candidate_cursor;
  FETCH NEXT FROM candidate_cursor INTO @StationId, @TableName;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @ObjectName = @SchemaName + N'.' + @TableName;
    SET @QualifiedTable = QUOTENAME(@SchemaName) + N'.' + QUOTENAME(@TableName);

    IF OBJECT_ID(@ObjectName, N'U') IS NULL
    BEGIN
      INSERT INTO #CandidateCounts (
        station_id,
        table_name,
        table_exists,
        candidate_count,
        deleted_count
      )
      VALUES (@StationId, @TableName, 0, 0, NULL);
    END
    ELSE
    BEGIN
      SET @CandidateCount = 0;
      SET @Sql = N'
        SELECT @RowCount = COUNT_BIG(*)
        FROM ' + @QualifiedTable + N' AS parameter_row
        WHERE parameter_row.station_id = @TargetStationId
          AND EXISTS (
            SELECT 1
            FROM #TargetDateWindows AS date_window
            WHERE date_window.station_id = @TargetStationId
              AND parameter_row.cdate >= date_window.start_date
              AND parameter_row.cdate < DATEADD(DAY, 1, date_window.end_date)
          );';

      EXEC sys.sp_executesql
        @Sql,
        N'@TargetStationId NVARCHAR(64), @RowCount BIGINT OUTPUT',
        @TargetStationId = @StationId,
        @RowCount = @CandidateCount OUTPUT;

      INSERT INTO #CandidateCounts (
        station_id,
        table_name,
        table_exists,
        candidate_count,
        deleted_count
      )
      VALUES (@StationId, @TableName, 1, @CandidateCount, NULL);
    END;

    FETCH NEXT FROM candidate_cursor INTO @StationId, @TableName;
  END;

  CLOSE candidate_cursor;
  DEALLOCATE candidate_cursor;

  SELECT
    @SchemaName AS schema_name,
    station_id,
    table_name,
    table_exists,
    candidate_count
  FROM #CandidateCounts
  ORDER BY station_id, table_name;

  SELECT station_id, start_date, end_date
  FROM #TargetDateWindows
  ORDER BY station_id, start_date;

  IF @Execute = 0
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT
      N'DRY_RUN_ROLLED_BACK' AS cleanup_status,
      N'No rows were deleted. Review the table and date-window result sets first.' AS message;
    RETURN;
  END;

  IF @BackupConfirmed <> 1
  BEGIN
    THROW 51103, 'Execution requires @BackupConfirmed = 1 after a recoverable backup is complete.', 1;
  END;

  IF @ParameterScopeConfirmed <> 1
  BEGIN
    THROW 51105, 'Execution requires @ParameterScopeConfirmed = 1 after reviewing every station, table, and date window.', 1;
  END;

  DECLARE @CandidateTotal BIGINT;

  SELECT @CandidateTotal = COALESCE(SUM(candidate_count), 0)
  FROM #CandidateCounts;

  IF @ExpectedTotalRowsToDelete IS NULL
    OR @ExpectedTotalRowsToDelete <= 0
    OR @CandidateTotal <> @ExpectedTotalRowsToDelete
  BEGIN
    THROW 51106, 'Execution requires @ExpectedTotalRowsToDelete to match the reviewed dry-run total exactly.', 1;
  END;

  DECLARE @DeletedCount BIGINT;

  DECLARE delete_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT station_id, table_name
    FROM #CandidateCounts
    WHERE table_exists = 1
    ORDER BY station_id, table_name;

  OPEN delete_cursor;
  FETCH NEXT FROM delete_cursor INTO @StationId, @TableName;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @QualifiedTable = QUOTENAME(@SchemaName) + N'.' + QUOTENAME(@TableName);
    SET @DeletedCount = 0;
    SET @Sql = N'
      DELETE parameter_row
      FROM ' + @QualifiedTable + N' AS parameter_row
      WHERE parameter_row.station_id = @TargetStationId
        AND EXISTS (
          SELECT 1
          FROM #TargetDateWindows AS date_window
          WHERE date_window.station_id = @TargetStationId
            AND parameter_row.cdate >= date_window.start_date
            AND parameter_row.cdate < DATEADD(DAY, 1, date_window.end_date)
        );
      SET @RowCount = @@ROWCOUNT;';

    EXEC sys.sp_executesql
      @Sql,
      N'@TargetStationId NVARCHAR(64), @RowCount BIGINT OUTPUT',
      @TargetStationId = @StationId,
      @RowCount = @DeletedCount OUTPUT;

    UPDATE #CandidateCounts
    SET deleted_count = @DeletedCount
    WHERE station_id = @StationId
      AND table_name = @TableName;

    FETCH NEXT FROM delete_cursor INTO @StationId, @TableName;
  END;

  CLOSE delete_cursor;
  DEALLOCATE delete_cursor;

  IF EXISTS (
    SELECT 1
    FROM #CandidateCounts
    WHERE table_exists = 1
      AND deleted_count <> candidate_count
  )
  BEGIN
    THROW 51104, 'Cleanup verification failed; deleted counts differ from dry-run counts.', 1;
  END;

  COMMIT TRANSACTION;

  SELECT
    N'COMMITTED' AS cleanup_status,
    @SchemaName AS schema_name,
    station_id,
    table_name,
    candidate_count,
    deleted_count
  FROM #CandidateCounts
  ORDER BY station_id, table_name;
END TRY
BEGIN CATCH
  IF CURSOR_STATUS('local', 'candidate_cursor') >= 0
  BEGIN
    CLOSE candidate_cursor;
  END;

  IF CURSOR_STATUS('local', 'candidate_cursor') >= -1
  BEGIN
    DEALLOCATE candidate_cursor;
  END;

  IF CURSOR_STATUS('local', 'delete_cursor') >= 0
  BEGIN
    CLOSE delete_cursor;
  END;

  IF CURSOR_STATUS('local', 'delete_cursor') >= -1
  BEGIN
    DEALLOCATE delete_cursor;
  END;

  IF XACT_STATE() <> 0
  BEGIN
    ROLLBACK TRANSACTION;
  END;

  THROW;
END CATCH;
