-- Three-day mock parameter values for SQL Server / SSMS
-- Inserts sample rows into parameter_ingest.ingest.S0001_data_* tables.
-- Safe to re-run: rows are inserted only when station_id + cdate + ctime is missing.

USE [parameter_ingest];
GO

IF OBJECT_ID(N'ingest.S0001_data_real', N'U') IS NULL THROW 50000, 'Missing table ingest.S0001_data_real', 1;
IF OBJECT_ID(N'ingest.S0001_data_1m', N'U') IS NULL THROW 50000, 'Missing table ingest.S0001_data_1m', 1;
IF OBJECT_ID(N'ingest.S0001_data_5m', N'U') IS NULL THROW 50000, 'Missing table ingest.S0001_data_5m', 1;
IF OBJECT_ID(N'ingest.S0001_data_60m', N'U') IS NULL THROW 50000, 'Missing table ingest.S0001_data_60m', 1;
IF OBJECT_ID(N'ingest.S0001_data_1day', N'U') IS NULL THROW 50000, 'Missing table ingest.S0001_data_1day', 1;
IF OBJECT_ID(N'ingest.S0001_data_test', N'U') IS NULL THROW 50000, 'Missing table ingest.S0001_data_test', 1;

DECLARE @stationId NVARCHAR(50) = N'S0001';
DECLARE @startDate DATE = '2026-06-04';
DECLARE @dayCount INT = 3;

DROP TABLE IF EXISTS #mock_values;

DECLARE @days TABLE (
    day_index INT NOT NULL PRIMARY KEY,
    sample_date DATE NOT NULL
);

DECLARE @samples TABLE (
    sample_no INT NOT NULL PRIMARY KEY
);

DECLARE @intervals TABLE (
    interval_code VARCHAR(8) NOT NULL PRIMARY KEY,
    table_name SYSNAME NOT NULL,
    base_time TIME(0) NOT NULL,
    step_minutes INT NOT NULL,
    samples_per_day INT NOT NULL
);

DECLARE @dayIndex INT = 0;
WHILE @dayIndex < @dayCount
BEGIN
    INSERT INTO @days (day_index, sample_date)
    VALUES (@dayIndex, DATEADD(DAY, @dayIndex, @startDate));

    SET @dayIndex += 1;
END

INSERT INTO @samples (sample_no)
VALUES (1), (2), (3), (4), (5);

INSERT INTO @intervals (interval_code, table_name, base_time, step_minutes, samples_per_day)
VALUES
    ('real', 'S0001_data_real', '09:00:00', 1, 5),
    ('1m', 'S0001_data_1m', '09:00:00', 1, 5),
    ('5m', 'S0001_data_5m', '09:00:00', 5, 5),
    ('60m', 'S0001_data_60m', '06:00:00', 60, 5),
    ('1day', 'S0001_data_1day', '00:00:00', 1440, 1),
    ('test', 'S0001_data_test', '10:00:00', 1, 5);

SELECT
    i.interval_code,
    @stationId AS station_id,
    CONVERT(NVARCHAR(10), 420 + (d.day_index * 8) + (s.sample_no * 3)) AS co2_value,
    N'ppm' AS co2_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS co2_status,
    CONVERT(NVARCHAR(10), CAST(1.1 + (d.day_index * 0.2) + (s.sample_no * 0.1) AS DECIMAL(10, 1))) AS co_value,
    N'ppm' AS co_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS co_status,
    CONVERT(NVARCHAR(10), 1200 + (d.day_index * 40) + (s.sample_no * 25)) AS flow_value,
    N'm3/hr' AS flow_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS flow_status,
    CONVERT(NVARCHAR(10), 55 + (d.day_index * 3) + (s.sample_no * 2)) AS nox_value,
    N'ppm' AS nox_units,
    CASE WHEN s.sample_no >= 5 THEN N'Warning' WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS nox_status,
    CONVERT(NVARCHAR(10), CAST(20.8 - (s.sample_no * 0.1) AS DECIMAL(10, 1))) AS o2_value,
    N'%' AS o2_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS o2_status,
    CONVERT(NVARCHAR(10), 5 + d.day_index + s.sample_no) AS opacity_value,
    N'%' AS opacity_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS opacity_status,
    CONVERT(NVARCHAR(10), CAST(18.5 + (d.day_index * 0.5) + (s.sample_no * 0.7) AS DECIMAL(10, 1))) AS particulate_value,
    N'mg/m3' AS particulate_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS particulate_status,
    CONVERT(NVARCHAR(10), 28 + d.day_index + s.sample_no) AS so2_value,
    N'ppm' AS so2_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS so2_status,
    CONVERT(NVARCHAR(10), CAST(34.0 + (d.day_index * 0.3) + (s.sample_no * 0.4) AS DECIMAL(10, 1))) AS temp_value,
    N'C' AS temp_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS temp_status,
    CONVERT(NVARCHAR(10), CAST(12.0 + (d.day_index * 0.4) + (s.sample_no * 0.5) AS DECIMAL(10, 1))) AS bod_value,
    N'mg/L' AS bod_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS bod_status,
    CONVERT(NVARCHAR(10), 65 + (d.day_index * 4) + (s.sample_no * 3)) AS cod_value,
    N'mg/L' AS cod_units,
    CASE WHEN s.sample_no >= 5 THEN N'Warning' WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS cod_status,
    CONVERT(NVARCHAR(10), CAST(7.0 + (s.sample_no * 0.1) AS DECIMAL(10, 1))) AS ph_value,
    N'pH' AS ph_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS ph_status,
    CONVERT(NVARCHAR(10), 22 + d.day_index + (s.sample_no * 2)) AS tss_value,
    N'mg/L' AS tss_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS tss_status,
    CONVERT(NVARCHAR(10), CAST(8.0 + (d.day_index * 0.3) + (s.sample_no * 0.4) AS DECIMAL(10, 1))) AS turb_value,
    N'NTU' AS turb_units,
    CASE WHEN i.interval_code = 'test' THEN N'Test' ELSE N'Normal' END AS turb_status,
    d.sample_date AS cdate,
    CONVERT(TIME(0), DATEADD(MINUTE, (s.sample_no - 1) * i.step_minutes, CAST(i.base_time AS DATETIME2))) AS ctime,
    d.sample_date AS udate,
    CONVERT(TIME(0), DATEADD(MINUTE, (s.sample_no - 1) * i.step_minutes, CAST(i.base_time AS DATETIME2))) AS utime
INTO #mock_values
FROM @intervals AS i
CROSS JOIN @days AS d
JOIN @samples AS s ON s.sample_no <= i.samples_per_day;

DECLARE @columns NVARCHAR(MAX) = N'
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]';

DECLARE @intervalCode VARCHAR(8);
DECLARE @tableName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

DECLARE interval_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT interval_code, table_name
    FROM @intervals
    ORDER BY interval_code;

OPEN interval_cursor;
FETCH NEXT FROM interval_cursor INTO @intervalCode, @tableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'
        INSERT INTO [ingest].' + QUOTENAME(@tableName) + N' (' + @columns + N')
        SELECT ' + @columns + N'
        FROM #mock_values AS m
        WHERE m.[interval_code] = @intervalCode
          AND NOT EXISTS (
              SELECT 1
              FROM [ingest].' + QUOTENAME(@tableName) + N' AS t
              WHERE t.[station_id] = m.[station_id]
                AND t.[cdate] = m.[cdate]
                AND t.[ctime] = m.[ctime]
          );';

    EXEC sys.sp_executesql @sql, N'@intervalCode VARCHAR(8)', @intervalCode = @intervalCode;
    FETCH NEXT FROM interval_cursor INTO @intervalCode, @tableName;
END

CLOSE interval_cursor;
DEALLOCATE interval_cursor;

SELECT 'S0001_data_real' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_real]
UNION ALL SELECT 'S0001_data_1m', COUNT(*) FROM [ingest].[S0001_data_1m]
UNION ALL SELECT 'S0001_data_5m', COUNT(*) FROM [ingest].[S0001_data_5m]
UNION ALL SELECT 'S0001_data_60m', COUNT(*) FROM [ingest].[S0001_data_60m]
UNION ALL SELECT 'S0001_data_1day', COUNT(*) FROM [ingest].[S0001_data_1day]
UNION ALL SELECT 'S0001_data_test', COUNT(*) FROM [ingest].[S0001_data_test];
GO
