-- Provision only the dedicated synthetic-data test database.
-- Run on the POMS SQL Server after explicit approval. Default is preview only.
-- Never run this through application migrations or the production deploy workflow.
USE [master];
SET NOCOUNT ON;

DECLARE @PomsCreateApproved BIT = 0;
DECLARE @PomsTestDatabase SYSNAME = N'poms_factory_profile_test';

IF @@TRANCOUNT <> 0
    THROW 51200, N'Test database provisioning must run outside a transaction.', 1;
IF ISNULL(HAS_PERMS_BY_NAME(NULL, NULL, N'CREATE ANY DATABASE'), 0) <> 1
    THROW 51201, N'CREATE ANY DATABASE permission is required.', 1;
IF DB_ID(@PomsTestDatabase) IS NOT NULL
    THROW 51202, N'Test database already exists. Inspect it; never replace or reset it automatically.', 1;
IF DB_ID(N'poms') IS NULL
    THROW 51203, N'Expected POMS source database is not visible on this instance.', 1;
IF CONVERT(NVARCHAR(128), DATABASEPROPERTYEX(N'poms', 'Collation')) <> N'SQL_Latin1_General_CP1_CI_AS'
    THROW 51204, N'Source collation differs from the reviewed plan.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'poms' AND compatibility_level = 170)
    THROW 51205, N'Source compatibility differs from the reviewed plan.', 1;
IF EXISTS (SELECT 1 FROM model.sys.objects WHERE is_ms_shipped = 0)
    THROW 51206, N'Model contains custom objects. Inspect before creating a synthetic-only database.', 1;
IF EXISTS (SELECT 1 FROM sys.master_files WHERE database_id = DB_ID(N'model') AND type = 0 AND size > 4096)
    THROW 51207, N'Model data file exceeds the planned 32 MB initial size.', 1;

DECLARE @PomsDataPath NVARCHAR(4000) = CONVERT(NVARCHAR(4000), SERVERPROPERTY('InstanceDefaultDataPath'));
DECLARE @PomsLogPath NVARCHAR(4000) = CONVERT(NVARCHAR(4000), SERVERPROPERTY('InstanceDefaultLogPath'));
IF NULLIF(@PomsDataPath, N'') IS NULL OR NULLIF(@PomsLogPath, N'') IS NULL
    THROW 51208, N'SQL Server default file paths are unavailable.', 1;
IF RIGHT(@PomsDataPath, 1) NOT IN (N'/', N'\')
    SET @PomsDataPath += N'\';
IF RIGHT(@PomsLogPath, 1) NOT IN (N'/', N'\')
    SET @PomsLogPath += N'\';

DECLARE @PomsCreateSql NVARCHAR(MAX) =
    N'CREATE DATABASE [poms_factory_profile_test] ON PRIMARY
      (NAME = N''poms_factory_profile_test_data'',
       FILENAME = N''' + REPLACE(@PomsDataPath + N'poms_factory_profile_test.mdf', N'''', N'''''') + N''',
       SIZE = 32 MB, MAXSIZE = 512 MB, FILEGROWTH = 32 MB)
      LOG ON
      (NAME = N''poms_factory_profile_test_log'',
       FILENAME = N''' + REPLACE(@PomsLogPath + N'poms_factory_profile_test.ldf', N'''', N'''''') + N''',
       SIZE = 16 MB, MAXSIZE = 256 MB, FILEGROWTH = 16 MB)
      COLLATE SQL_Latin1_General_CP1_CI_AS;';

IF @PomsCreateApproved = 0
BEGIN
    SELECT @PomsTestDatabase AS targetDatabase, CAST(0 AS BIT) AS created,
           48 AS initialFilesMb, 768 AS maximumFilesMb,
           N'Preview only; explicit approval required before changing the flag.' AS status;
    RETURN;
END;

EXEC sys.sp_executesql @PomsCreateSql;
-- If any subsequent statement fails, retain the new database for inspection.
-- No automatic DROP, forced disconnection, or retry of uncertain writes.
ALTER DATABASE [poms_factory_profile_test] SET COMPATIBILITY_LEVEL = 170;
ALTER DATABASE [poms_factory_profile_test] SET RECOVERY SIMPLE;
ALTER DATABASE [poms_factory_profile_test] SET AUTO_CLOSE OFF;
ALTER DATABASE [poms_factory_profile_test] SET AUTO_SHRINK OFF;
ALTER DATABASE [poms_factory_profile_test] SET ALLOW_SNAPSHOT_ISOLATION OFF;
ALTER DATABASE [poms_factory_profile_test] SET READ_COMMITTED_SNAPSHOT OFF;
ALTER DATABASE [poms_factory_profile_test] SET TRUSTWORTHY OFF;
ALTER DATABASE [poms_factory_profile_test] SET DB_CHAINING OFF;
EXEC [poms_factory_profile_test].sys.sp_addextendedproperty
    @name = N'PomsTestPurpose', @value = N'factory-profile-integration-synthetic-only';

SELECT name, collation_name, compatibility_level, recovery_model_desc
FROM sys.databases WHERE name = @PomsTestDatabase;
