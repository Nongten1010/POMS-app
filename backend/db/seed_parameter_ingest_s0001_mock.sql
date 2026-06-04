-- Mock parameter values for SQL Server / SSMS
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

DECLARE @mock TABLE (
    interval_code VARCHAR(8) NOT NULL,
    sample_date DATE NOT NULL,
    sample_time TIME(0) NOT NULL,
    sample_no INT NOT NULL
);

INSERT INTO @mock (interval_code, sample_date, sample_time, sample_no)
VALUES
    ('real', '2026-06-04', '09:00:00', 1),
    ('real', '2026-06-04', '09:01:00', 2),
    ('real', '2026-06-04', '09:02:00', 3),
    ('real', '2026-06-04', '09:03:00', 4),
    ('real', '2026-06-04', '09:04:00', 5),
    ('1m', '2026-06-04', '09:00:00', 1),
    ('1m', '2026-06-04', '09:01:00', 2),
    ('1m', '2026-06-04', '09:02:00', 3),
    ('1m', '2026-06-04', '09:03:00', 4),
    ('1m', '2026-06-04', '09:04:00', 5),
    ('5m', '2026-06-04', '09:00:00', 1),
    ('5m', '2026-06-04', '09:05:00', 2),
    ('5m', '2026-06-04', '09:10:00', 3),
    ('5m', '2026-06-04', '09:15:00', 4),
    ('5m', '2026-06-04', '09:20:00', 5),
    ('60m', '2026-06-04', '06:00:00', 1),
    ('60m', '2026-06-04', '07:00:00', 2),
    ('60m', '2026-06-04', '08:00:00', 3),
    ('60m', '2026-06-04', '09:00:00', 4),
    ('60m', '2026-06-04', '10:00:00', 5),
    ('1day', '2026-06-01', '00:00:00', 1),
    ('1day', '2026-06-02', '00:00:00', 2),
    ('1day', '2026-06-03', '00:00:00', 3),
    ('1day', '2026-06-04', '00:00:00', 4),
    ('1day', '2026-06-05', '00:00:00', 5),
    ('test', '2026-06-04', '10:00:00', 1),
    ('test', '2026-06-04', '10:01:00', 2),
    ('test', '2026-06-04', '10:02:00', 3),
    ('test', '2026-06-04', '10:03:00', 4),
    ('test', '2026-06-04', '10:04:00', 5);

DECLARE @mock_values TABLE (
    interval_code VARCHAR(8) NOT NULL,
    station_id NVARCHAR(50) NOT NULL,
    co2_value NVARCHAR(10) NULL,
    co2_units NVARCHAR(20) NULL,
    co2_status NVARCHAR(20) NULL,
    co_value NVARCHAR(10) NULL,
    co_units NVARCHAR(20) NULL,
    co_status NVARCHAR(20) NULL,
    flow_value NVARCHAR(10) NULL,
    flow_units NVARCHAR(20) NULL,
    flow_status NVARCHAR(20) NULL,
    nox_value NVARCHAR(10) NULL,
    nox_units NVARCHAR(20) NULL,
    nox_status NVARCHAR(20) NULL,
    o2_value NVARCHAR(10) NULL,
    o2_units NVARCHAR(20) NULL,
    o2_status NVARCHAR(20) NULL,
    opacity_value NVARCHAR(10) NULL,
    opacity_units NVARCHAR(20) NULL,
    opacity_status NVARCHAR(20) NULL,
    particulate_value NVARCHAR(10) NULL,
    particulate_units NVARCHAR(20) NULL,
    particulate_status NVARCHAR(20) NULL,
    so2_value NVARCHAR(10) NULL,
    so2_units NVARCHAR(20) NULL,
    so2_status NVARCHAR(20) NULL,
    temp_value NVARCHAR(10) NULL,
    temp_units NVARCHAR(20) NULL,
    temp_status NVARCHAR(20) NULL,
    bod_value NVARCHAR(10) NULL,
    bod_units NVARCHAR(20) NULL,
    bod_status NVARCHAR(20) NULL,
    cod_value NVARCHAR(10) NULL,
    cod_units NVARCHAR(20) NULL,
    cod_status NVARCHAR(20) NULL,
    ph_value NVARCHAR(10) NULL,
    ph_units NVARCHAR(20) NULL,
    ph_status NVARCHAR(20) NULL,
    tss_value NVARCHAR(10) NULL,
    tss_units NVARCHAR(20) NULL,
    tss_status NVARCHAR(20) NULL,
    turb_value NVARCHAR(10) NULL,
    turb_units NVARCHAR(20) NULL,
    turb_status NVARCHAR(20) NULL,
    cdate DATE NOT NULL,
    ctime TIME(0) NOT NULL,
    udate DATE NOT NULL,
    utime TIME(0) NOT NULL
);

INSERT INTO @mock_values (
    interval_code,
    station_id,
    co2_value,
    co2_units,
    co2_status,
    co_value,
    co_units,
    co_status,
    flow_value,
    flow_units,
    flow_status,
    nox_value,
    nox_units,
    nox_status,
    o2_value,
    o2_units,
    o2_status,
    opacity_value,
    opacity_units,
    opacity_status,
    particulate_value,
    particulate_units,
    particulate_status,
    so2_value,
    so2_units,
    so2_status,
    temp_value,
    temp_units,
    temp_status,
    bod_value,
    bod_units,
    bod_status,
    cod_value,
    cod_units,
    cod_status,
    ph_value,
    ph_units,
    ph_status,
    tss_value,
    tss_units,
    tss_status,
    turb_value,
    turb_units,
    turb_status,
    cdate,
    ctime,
    udate,
    utime
)
SELECT
    interval_code,
    N'S0001',
    CONVERT(NVARCHAR(10), 420 + (sample_no * 3)),
    N'ppm',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(1.1 + (sample_no * 0.1) AS DECIMAL(10, 1))),
    N'ppm',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), 1200 + (sample_no * 25)),
    N'm3/hr',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), 55 + (sample_no * 2)),
    N'ppm',
    CASE WHEN sample_no >= 5 THEN N'Warning' WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(20.8 - (sample_no * 0.1) AS DECIMAL(10, 1))),
    N'%',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), 5 + sample_no),
    N'%',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(18.5 + (sample_no * 0.7) AS DECIMAL(10, 1))),
    N'mg/m3',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), 28 + sample_no),
    N'ppm',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(34.0 + (sample_no * 0.4) AS DECIMAL(10, 1))),
    N'C',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(12.0 + (sample_no * 0.5) AS DECIMAL(10, 1))),
    N'mg/L',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), 65 + (sample_no * 3)),
    N'mg/L',
    CASE WHEN sample_no >= 5 THEN N'Warning' WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(7.0 + (sample_no * 0.1) AS DECIMAL(10, 1))),
    N'pH',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), 22 + (sample_no * 2)),
    N'mg/L',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    CONVERT(NVARCHAR(10), CAST(8.0 + (sample_no * 0.4) AS DECIMAL(10, 1))),
    N'NTU',
    CASE WHEN interval_code = 'test' THEN N'Test' ELSE N'Normal' END,
    sample_date,
    sample_time,
    sample_date,
    sample_time
FROM @mock;

INSERT INTO [ingest].[S0001_data_real] (
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
)
SELECT
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
FROM @mock_values AS m
WHERE m.interval_code = 'real'
  AND NOT EXISTS (
      SELECT 1
      FROM [ingest].[S0001_data_real] AS t
      WHERE t.[station_id] = m.[station_id] AND t.[cdate] = m.[cdate] AND t.[ctime] = m.[ctime]
  );

INSERT INTO [ingest].[S0001_data_1m] (
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
)
SELECT
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
FROM @mock_values AS m
WHERE m.interval_code = '1m'
  AND NOT EXISTS (
      SELECT 1
      FROM [ingest].[S0001_data_1m] AS t
      WHERE t.[station_id] = m.[station_id] AND t.[cdate] = m.[cdate] AND t.[ctime] = m.[ctime]
  );

INSERT INTO [ingest].[S0001_data_5m] (
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
)
SELECT
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
FROM @mock_values AS m
WHERE m.interval_code = '5m'
  AND NOT EXISTS (
      SELECT 1
      FROM [ingest].[S0001_data_5m] AS t
      WHERE t.[station_id] = m.[station_id] AND t.[cdate] = m.[cdate] AND t.[ctime] = m.[ctime]
  );

INSERT INTO [ingest].[S0001_data_60m] (
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
)
SELECT
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
FROM @mock_values AS m
WHERE m.interval_code = '60m'
  AND NOT EXISTS (
      SELECT 1
      FROM [ingest].[S0001_data_60m] AS t
      WHERE t.[station_id] = m.[station_id] AND t.[cdate] = m.[cdate] AND t.[ctime] = m.[ctime]
  );

INSERT INTO [ingest].[S0001_data_1day] (
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
)
SELECT
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
FROM @mock_values AS m
WHERE m.interval_code = '1day'
  AND NOT EXISTS (
      SELECT 1
      FROM [ingest].[S0001_data_1day] AS t
      WHERE t.[station_id] = m.[station_id] AND t.[cdate] = m.[cdate] AND t.[ctime] = m.[ctime]
  );

INSERT INTO [ingest].[S0001_data_test] (
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
)
SELECT
    [station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status],
    [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status],
    [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status],
    [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status],
    [temp_value], [temp_units], [temp_status], [bod_value], [bod_units], [bod_status],
    [cod_value], [cod_units], [cod_status], [ph_value], [ph_units], [ph_status],
    [tss_value], [tss_units], [tss_status], [turb_value], [turb_units], [turb_status],
    [cdate], [ctime], [udate], [utime]
FROM @mock_values AS m
WHERE m.interval_code = 'test'
  AND NOT EXISTS (
      SELECT 1
      FROM [ingest].[S0001_data_test] AS t
      WHERE t.[station_id] = m.[station_id] AND t.[cdate] = m.[cdate] AND t.[ctime] = m.[ctime]
  );

SELECT 'S0001_data_real' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_real]
UNION ALL SELECT 'S0001_data_1m', COUNT(*) FROM [ingest].[S0001_data_1m]
UNION ALL SELECT 'S0001_data_5m', COUNT(*) FROM [ingest].[S0001_data_5m]
UNION ALL SELECT 'S0001_data_60m', COUNT(*) FROM [ingest].[S0001_data_60m]
UNION ALL SELECT 'S0001_data_1day', COUNT(*) FROM [ingest].[S0001_data_1day]
UNION ALL SELECT 'S0001_data_test', COUNT(*) FROM [ingest].[S0001_data_test];
GO
