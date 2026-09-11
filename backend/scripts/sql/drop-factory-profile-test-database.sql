-- Delete only the dedicated synthetic database after a verified successful run.
-- Fill the two identifiers from the verification report. Default remains preview.
USE [master];
SET NOCOUNT ON;

DECLARE @PomsDropApproved BIT = 0;
DECLARE @PomsExpectedDatabaseGuid UNIQUEIDENTIFIER = NULL;
DECLARE @PomsExpectedPassedRun NVARCHAR(36) = NULL;
DECLARE @PomsDatabaseId INT = DB_ID(N'poms_factory_profile_test');

IF @@TRANCOUNT <> 0
    THROW 51210, N'Test cleanup must run outside a transaction.', 1;
IF @PomsDatabaseId IS NULL
BEGIN
    SELECT N'poms_factory_profile_test' AS databaseName, N'already absent' AS status;
    RETURN;
END;
IF @PomsExpectedDatabaseGuid IS NULL OR @PomsExpectedPassedRun IS NULL
    THROW 51211, N'Test database identity and passed verification run are required.', 1;
IF NOT EXISTS (
    SELECT 1 FROM sys.database_recovery_status
    WHERE database_id = @PomsDatabaseId AND database_guid = @PomsExpectedDatabaseGuid
)
    THROW 51212, N'Database identity differs from the successful test run. Cleanup refused.', 1;
IF NOT EXISTS (
    SELECT 1 FROM sys.databases WHERE database_id = @PomsDatabaseId AND state_desc = N'ONLINE'
)
    THROW 51213, N'Test database is not ONLINE. Inspect before cleanup.', 1;

DECLARE @PomsPurpose NVARCHAR(128);
DECLARE @PomsPassedRun NVARCHAR(36);
EXEC sys.sp_executesql
    N'SELECT @purpose = CONVERT(NVARCHAR(128), value)
      FROM [poms_factory_profile_test].sys.extended_properties
      WHERE class = 0 AND name = N''PomsTestPurpose'';
      SELECT @passedRun = CONVERT(NVARCHAR(36), value)
      FROM [poms_factory_profile_test].sys.extended_properties
      WHERE class = 0 AND name = N''PomsTestPassedRun'';',
    N'@purpose NVARCHAR(128) OUTPUT, @passedRun NVARCHAR(36) OUTPUT',
    @purpose = @PomsPurpose OUTPUT, @passedRun = @PomsPassedRun OUTPUT;
IF @PomsPurpose IS NULL OR @PomsPurpose <> N'factory-profile-integration-synthetic-only'
    THROW 51214, N'Test-purpose marker is missing or different. Cleanup refused.', 1;
IF @PomsPassedRun IS NULL OR @PomsPassedRun <> @PomsExpectedPassedRun
    THROW 51215, N'Successful verification marker differs. Cleanup refused.', 1;
IF EXISTS (
    SELECT 1 FROM sys.dm_exec_sessions
    WHERE is_user_process = 1 AND database_id = @PomsDatabaseId
)
    THROW 51216, N'Test database still has user sessions. Close only the owned test connections first.', 1;

IF @PomsDropApproved = 0
BEGIN
    SELECT N'poms_factory_profile_test' AS databaseName, CAST(0 AS BIT) AS dropped,
           N'Cleanup checks passed; preview only.' AS status;
    RETURN;
END;

-- No forced disconnects, production database references, or automatic retries.
DROP DATABASE [poms_factory_profile_test];
IF DB_ID(N'poms_factory_profile_test') IS NOT NULL
    THROW 51217, N'Test database still exists after cleanup. Inspect before retry.', 1;
SELECT N'poms_factory_profile_test' AS databaseName, CAST(1 AS BIT) AS dropped,
       DB_ID(N'poms_factory_profile_test') AS remainingDatabaseId,
       (SELECT COUNT(*) FROM sys.master_files WHERE database_id = @PomsDatabaseId) AS remainingFileRegistrations;
