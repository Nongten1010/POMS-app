-- Simple June 2026 mock NOx values for SQL Server / SSMS.
-- Requirement:
-- - P0001 has mock rows from 2026-06-01 through 2026-06-10.
-- - S0001 has mock rows from 2026-06-01 through 2026-06-10.

USE [parameter_ingest];
GO

IF OBJECT_ID(N'ingest.P0001_data_real', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_real] FROM [ingest].[S0001_data_real];
IF OBJECT_ID(N'ingest.P0001_data_1m', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_1m] FROM [ingest].[S0001_data_1m];
IF OBJECT_ID(N'ingest.P0001_data_5m', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_5m] FROM [ingest].[S0001_data_5m];
IF OBJECT_ID(N'ingest.P0001_data_60m', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_60m] FROM [ingest].[S0001_data_60m];
IF OBJECT_ID(N'ingest.P0001_data_1day', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_1day] FROM [ingest].[S0001_data_1day];
IF OBJECT_ID(N'ingest.P0001_data_test', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_test] FROM [ingest].[S0001_data_test];

DELETE FROM [ingest].[S0001_data_real] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_1m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_5m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_1day] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_test] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

DELETE FROM [ingest].[P0001_data_real] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_1m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_5m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_60m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_1day] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_test] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

INSERT INTO [ingest].[P0001_data_real] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'P0001', N'42', N'mg/L', N'Normal', '2026-06-01', '09:00:00', '2026-06-01', '09:00:00'),
(N'P0001', N'48', N'mg/L', N'Warning', '2026-06-02', '09:00:00', '2026-06-02', '09:00:00'),
(N'P0001', N'65', N'mg/L', N'Exceeded', '2026-06-03', '09:00:00', '2026-06-03', '09:00:00'),
(N'P0001', N'0', N'mg/L', N'Insufficient', '2026-06-04', '09:00:00', '2026-06-04', '09:00:00'),
(N'P0001', N'0', N'mg/L', N'No Data', '2026-06-05', '09:00:00', '2026-06-05', '09:00:00'),
(N'P0001', N'44', N'mg/L', N'Calibration', '2026-06-06', '09:00:00', '2026-06-06', '09:00:00'),
(N'P0001', N'50', N'mg/L', N'Maintenance', '2026-06-07', '09:00:00', '2026-06-07', '09:00:00'),
(N'P0001', N'57', N'mg/L', N'Defective', '2026-06-08', '09:00:00', '2026-06-08', '09:00:00'),
(N'P0001', N'46', N'mg/L', N'Normal', '2026-06-09', '09:00:00', '2026-06-09', '09:00:00'),
(N'P0001', N'53', N'mg/L', N'Test', '2026-06-10', '09:00:00', '2026-06-10', '09:00:00');

INSERT INTO [ingest].[P0001_data_1m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'P0001', N'43', N'mg/L', N'Normal', '2026-06-01', '09:01:00', '2026-06-01', '09:01:00'),
(N'P0001', N'49', N'mg/L', N'Warning', '2026-06-02', '09:01:00', '2026-06-02', '09:01:00'),
(N'P0001', N'66', N'mg/L', N'Exceeded', '2026-06-03', '09:01:00', '2026-06-03', '09:01:00'),
(N'P0001', N'0', N'mg/L', N'Insufficient', '2026-06-04', '09:01:00', '2026-06-04', '09:01:00'),
(N'P0001', N'0', N'mg/L', N'No Data', '2026-06-05', '09:01:00', '2026-06-05', '09:01:00'),
(N'P0001', N'45', N'mg/L', N'Calibration', '2026-06-06', '09:01:00', '2026-06-06', '09:01:00'),
(N'P0001', N'51', N'mg/L', N'Maintenance', '2026-06-07', '09:01:00', '2026-06-07', '09:01:00'),
(N'P0001', N'58', N'mg/L', N'Defective', '2026-06-08', '09:01:00', '2026-06-08', '09:01:00'),
(N'P0001', N'47', N'mg/L', N'Normal', '2026-06-09', '09:01:00', '2026-06-09', '09:01:00'),
(N'P0001', N'54', N'mg/L', N'Test', '2026-06-10', '09:01:00', '2026-06-10', '09:01:00');

INSERT INTO [ingest].[P0001_data_5m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'P0001', N'44', N'mg/L', N'Normal', '2026-06-01', '09:05:00', '2026-06-01', '09:05:00'),
(N'P0001', N'50', N'mg/L', N'Warning', '2026-06-02', '09:05:00', '2026-06-02', '09:05:00'),
(N'P0001', N'67', N'mg/L', N'Exceeded', '2026-06-03', '09:05:00', '2026-06-03', '09:05:00'),
(N'P0001', N'0', N'mg/L', N'Insufficient', '2026-06-04', '09:05:00', '2026-06-04', '09:05:00'),
(N'P0001', N'0', N'mg/L', N'No Data', '2026-06-05', '09:05:00', '2026-06-05', '09:05:00'),
(N'P0001', N'46', N'mg/L', N'Calibration', '2026-06-06', '09:05:00', '2026-06-06', '09:05:00'),
(N'P0001', N'52', N'mg/L', N'Maintenance', '2026-06-07', '09:05:00', '2026-06-07', '09:05:00'),
(N'P0001', N'59', N'mg/L', N'Defective', '2026-06-08', '09:05:00', '2026-06-08', '09:05:00'),
(N'P0001', N'48', N'mg/L', N'Normal', '2026-06-09', '09:05:00', '2026-06-09', '09:05:00'),
(N'P0001', N'55', N'mg/L', N'Test', '2026-06-10', '09:05:00', '2026-06-10', '09:05:00');

INSERT INTO [ingest].[P0001_data_60m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'P0001', N'45', N'mg/L', N'Normal', '2026-06-01', '06:00:00', '2026-06-01', '06:00:00'),
(N'P0001', N'51', N'mg/L', N'Warning', '2026-06-02', '06:00:00', '2026-06-02', '06:00:00'),
(N'P0001', N'68', N'mg/L', N'Exceeded', '2026-06-03', '06:00:00', '2026-06-03', '06:00:00'),
(N'P0001', N'0', N'mg/L', N'Insufficient', '2026-06-04', '06:00:00', '2026-06-04', '06:00:00'),
(N'P0001', N'0', N'mg/L', N'No Data', '2026-06-05', '06:00:00', '2026-06-05', '06:00:00'),
(N'P0001', N'47', N'mg/L', N'Calibration', '2026-06-06', '06:00:00', '2026-06-06', '06:00:00'),
(N'P0001', N'53', N'mg/L', N'Maintenance', '2026-06-07', '06:00:00', '2026-06-07', '06:00:00'),
(N'P0001', N'60', N'mg/L', N'Defective', '2026-06-08', '06:00:00', '2026-06-08', '06:00:00'),
(N'P0001', N'49', N'mg/L', N'Normal', '2026-06-09', '06:00:00', '2026-06-09', '06:00:00'),
(N'P0001', N'56', N'mg/L', N'Test', '2026-06-10', '06:00:00', '2026-06-10', '06:00:00');

INSERT INTO [ingest].[P0001_data_1day] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'P0001', N'42', N'mg/L', N'Normal', '2026-06-01', '00:00:00', '2026-06-01', '00:00:00'),
(N'P0001', N'48', N'mg/L', N'Warning', '2026-06-02', '00:00:00', '2026-06-02', '00:00:00'),
(N'P0001', N'65', N'mg/L', N'Exceeded', '2026-06-03', '00:00:00', '2026-06-03', '00:00:00'),
(N'P0001', N'0', N'mg/L', N'Insufficient', '2026-06-04', '00:00:00', '2026-06-04', '00:00:00'),
(N'P0001', N'0', N'mg/L', N'No Data', '2026-06-05', '00:00:00', '2026-06-05', '00:00:00'),
(N'P0001', N'44', N'mg/L', N'Calibration', '2026-06-06', '00:00:00', '2026-06-06', '00:00:00'),
(N'P0001', N'50', N'mg/L', N'Maintenance', '2026-06-07', '00:00:00', '2026-06-07', '00:00:00'),
(N'P0001', N'57', N'mg/L', N'Defective', '2026-06-08', '00:00:00', '2026-06-08', '00:00:00'),
(N'P0001', N'46', N'mg/L', N'Normal', '2026-06-09', '00:00:00', '2026-06-09', '00:00:00'),
(N'P0001', N'53', N'mg/L', N'Test', '2026-06-10', '00:00:00', '2026-06-10', '00:00:00');

INSERT INTO [ingest].[P0001_data_test] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'P0001', N'46', N'mg/L', N'Normal', '2026-06-01', '10:00:00', '2026-06-01', '10:00:00'),
(N'P0001', N'52', N'mg/L', N'Warning', '2026-06-02', '10:00:00', '2026-06-02', '10:00:00'),
(N'P0001', N'69', N'mg/L', N'Exceeded', '2026-06-03', '10:00:00', '2026-06-03', '10:00:00'),
(N'P0001', N'0', N'mg/L', N'Insufficient', '2026-06-04', '10:00:00', '2026-06-04', '10:00:00'),
(N'P0001', N'0', N'mg/L', N'No Data', '2026-06-05', '10:00:00', '2026-06-05', '10:00:00'),
(N'P0001', N'48', N'mg/L', N'Calibration', '2026-06-06', '10:00:00', '2026-06-06', '10:00:00'),
(N'P0001', N'54', N'mg/L', N'Maintenance', '2026-06-07', '10:00:00', '2026-06-07', '10:00:00'),
(N'P0001', N'61', N'mg/L', N'Defective', '2026-06-08', '10:00:00', '2026-06-08', '10:00:00'),
(N'P0001', N'50', N'mg/L', N'Normal', '2026-06-09', '10:00:00', '2026-06-09', '10:00:00'),
(N'P0001', N'57', N'mg/L', N'Test', '2026-06-10', '10:00:00', '2026-06-10', '10:00:00');

INSERT INTO [ingest].[S0001_data_real] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', [nox_value], N'ppm', [nox_status], [cdate], [ctime], [udate], [utime]
FROM [ingest].[P0001_data_real]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

INSERT INTO [ingest].[S0001_data_1m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', [nox_value], N'ppm', [nox_status], [cdate], [ctime], [udate], [utime]
FROM [ingest].[P0001_data_1m]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

INSERT INTO [ingest].[S0001_data_5m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', [nox_value], N'ppm', [nox_status], [cdate], [ctime], [udate], [utime]
FROM [ingest].[P0001_data_5m]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

INSERT INTO [ingest].[S0001_data_60m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', [nox_value], N'ppm', [nox_status], [cdate], [ctime], [udate], [utime]
FROM [ingest].[P0001_data_60m]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

INSERT INTO [ingest].[S0001_data_1day] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', [nox_value], N'ppm', [nox_status], [cdate], [ctime], [udate], [utime]
FROM [ingest].[P0001_data_1day]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

INSERT INTO [ingest].[S0001_data_test] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', [nox_value], N'ppm', [nox_status], [cdate], [ctime], [udate], [utime]
FROM [ingest].[P0001_data_test]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

UPDATE [ingest].[S0001_data_real]
SET
    [co2_value] = CONVERT(NVARCHAR(10), 410 + DAY([cdate])), [co2_units] = N'ppm', [co2_status] = [nox_status],
    [co_value] = CONVERT(NVARCHAR(10), CAST(1.0 + (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [co_units] = N'ppm', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 1200 + (DAY([cdate]) * 25)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [o2_value] = CONVERT(NVARCHAR(10), CAST(21.0 - (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [o2_units] = N'%', [o2_status] = [nox_status],
    [opacity_value] = CONVERT(NVARCHAR(10), 4 + DAY([cdate])), [opacity_units] = N'%', [opacity_status] = [nox_status],
    [particulate_value] = CONVERT(NVARCHAR(10), CAST(16.0 + (DAY([cdate]) * 0.7) AS DECIMAL(10, 1))), [particulate_units] = N'mg/m3', [particulate_status] = [nox_status],
    [so2_value] = CONVERT(NVARCHAR(10), 20 + DAY([cdate])), [so2_units] = N'ppm', [so2_status] = [nox_status],
    [temp_value] = CONVERT(NVARCHAR(10), CAST(32.0 + (DAY([cdate]) * 0.2) AS DECIMAL(10, 1))), [temp_units] = N'C', [temp_status] = [nox_status],
    [bod_value] = CONVERT(NVARCHAR(10), CAST(8.0 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 45 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.8 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 15 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(5.0 + (DAY([cdate]) * 0.5) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[S0001_data_1m]
SET
    [co2_value] = CONVERT(NVARCHAR(10), 411 + DAY([cdate])), [co2_units] = N'ppm', [co2_status] = [nox_status],
    [co_value] = CONVERT(NVARCHAR(10), CAST(1.1 + (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [co_units] = N'ppm', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 1210 + (DAY([cdate]) * 25)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [o2_value] = CONVERT(NVARCHAR(10), CAST(20.9 - (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [o2_units] = N'%', [o2_status] = [nox_status],
    [opacity_value] = CONVERT(NVARCHAR(10), 5 + DAY([cdate])), [opacity_units] = N'%', [opacity_status] = [nox_status],
    [particulate_value] = CONVERT(NVARCHAR(10), CAST(17.0 + (DAY([cdate]) * 0.7) AS DECIMAL(10, 1))), [particulate_units] = N'mg/m3', [particulate_status] = [nox_status],
    [so2_value] = CONVERT(NVARCHAR(10), 21 + DAY([cdate])), [so2_units] = N'ppm', [so2_status] = [nox_status],
    [temp_value] = CONVERT(NVARCHAR(10), CAST(32.5 + (DAY([cdate]) * 0.2) AS DECIMAL(10, 1))), [temp_units] = N'C', [temp_status] = [nox_status],
    [bod_value] = CONVERT(NVARCHAR(10), CAST(8.5 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 47 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.8 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 16 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(5.5 + (DAY([cdate]) * 0.5) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[S0001_data_5m]
SET
    [co2_value] = CONVERT(NVARCHAR(10), 412 + DAY([cdate])), [co2_units] = N'ppm', [co2_status] = [nox_status],
    [co_value] = CONVERT(NVARCHAR(10), CAST(1.2 + (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [co_units] = N'ppm', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 1220 + (DAY([cdate]) * 25)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [o2_value] = CONVERT(NVARCHAR(10), CAST(20.8 - (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [o2_units] = N'%', [o2_status] = [nox_status],
    [opacity_value] = CONVERT(NVARCHAR(10), 6 + DAY([cdate])), [opacity_units] = N'%', [opacity_status] = [nox_status],
    [particulate_value] = CONVERT(NVARCHAR(10), CAST(18.0 + (DAY([cdate]) * 0.7) AS DECIMAL(10, 1))), [particulate_units] = N'mg/m3', [particulate_status] = [nox_status],
    [so2_value] = CONVERT(NVARCHAR(10), 22 + DAY([cdate])), [so2_units] = N'ppm', [so2_status] = [nox_status],
    [temp_value] = CONVERT(NVARCHAR(10), CAST(33.0 + (DAY([cdate]) * 0.2) AS DECIMAL(10, 1))), [temp_units] = N'C', [temp_status] = [nox_status],
    [bod_value] = CONVERT(NVARCHAR(10), CAST(9.0 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 49 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.9 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 17 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(6.0 + (DAY([cdate]) * 0.5) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[S0001_data_60m]
SET
    [co2_value] = CONVERT(NVARCHAR(10), 413 + DAY([cdate])), [co2_units] = N'ppm', [co2_status] = [nox_status],
    [co_value] = CONVERT(NVARCHAR(10), CAST(1.3 + (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [co_units] = N'ppm', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 1230 + (DAY([cdate]) * 25)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [o2_value] = CONVERT(NVARCHAR(10), CAST(20.7 - (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [o2_units] = N'%', [o2_status] = [nox_status],
    [opacity_value] = CONVERT(NVARCHAR(10), 7 + DAY([cdate])), [opacity_units] = N'%', [opacity_status] = [nox_status],
    [particulate_value] = CONVERT(NVARCHAR(10), CAST(19.0 + (DAY([cdate]) * 0.7) AS DECIMAL(10, 1))), [particulate_units] = N'mg/m3', [particulate_status] = [nox_status],
    [so2_value] = CONVERT(NVARCHAR(10), 23 + DAY([cdate])), [so2_units] = N'ppm', [so2_status] = [nox_status],
    [temp_value] = CONVERT(NVARCHAR(10), CAST(33.5 + (DAY([cdate]) * 0.2) AS DECIMAL(10, 1))), [temp_units] = N'C', [temp_status] = [nox_status],
    [bod_value] = CONVERT(NVARCHAR(10), CAST(9.5 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 51 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.9 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 18 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(6.5 + (DAY([cdate]) * 0.5) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[S0001_data_1day]
SET
    [co2_value] = CONVERT(NVARCHAR(10), 414 + DAY([cdate])), [co2_units] = N'ppm', [co2_status] = [nox_status],
    [co_value] = CONVERT(NVARCHAR(10), CAST(1.4 + (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [co_units] = N'ppm', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 1240 + (DAY([cdate]) * 25)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [o2_value] = CONVERT(NVARCHAR(10), CAST(20.6 - (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [o2_units] = N'%', [o2_status] = [nox_status],
    [opacity_value] = CONVERT(NVARCHAR(10), 8 + DAY([cdate])), [opacity_units] = N'%', [opacity_status] = [nox_status],
    [particulate_value] = CONVERT(NVARCHAR(10), CAST(20.0 + (DAY([cdate]) * 0.7) AS DECIMAL(10, 1))), [particulate_units] = N'mg/m3', [particulate_status] = [nox_status],
    [so2_value] = CONVERT(NVARCHAR(10), 24 + DAY([cdate])), [so2_units] = N'ppm', [so2_status] = [nox_status],
    [temp_value] = CONVERT(NVARCHAR(10), CAST(34.0 + (DAY([cdate]) * 0.2) AS DECIMAL(10, 1))), [temp_units] = N'C', [temp_status] = [nox_status],
    [bod_value] = CONVERT(NVARCHAR(10), CAST(10.0 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 53 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(7.0 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 19 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(7.0 + (DAY([cdate]) * 0.5) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[S0001_data_test]
SET
    [co2_value] = CONVERT(NVARCHAR(10), 415 + DAY([cdate])), [co2_units] = N'ppm', [co2_status] = [nox_status],
    [co_value] = CONVERT(NVARCHAR(10), CAST(1.5 + (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [co_units] = N'ppm', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 1250 + (DAY([cdate]) * 25)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [o2_value] = CONVERT(NVARCHAR(10), CAST(20.5 - (DAY([cdate]) * 0.1) AS DECIMAL(10, 1))), [o2_units] = N'%', [o2_status] = [nox_status],
    [opacity_value] = CONVERT(NVARCHAR(10), 9 + DAY([cdate])), [opacity_units] = N'%', [opacity_status] = [nox_status],
    [particulate_value] = CONVERT(NVARCHAR(10), CAST(21.0 + (DAY([cdate]) * 0.7) AS DECIMAL(10, 1))), [particulate_units] = N'mg/m3', [particulate_status] = [nox_status],
    [so2_value] = CONVERT(NVARCHAR(10), 25 + DAY([cdate])), [so2_units] = N'ppm', [so2_status] = [nox_status],
    [temp_value] = CONVERT(NVARCHAR(10), CAST(34.5 + (DAY([cdate]) * 0.2) AS DECIMAL(10, 1))), [temp_units] = N'C', [temp_status] = [nox_status],
    [bod_value] = CONVERT(NVARCHAR(10), CAST(10.5 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 55 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(7.0 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 20 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(7.5 + (DAY([cdate]) * 0.5) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[P0001_data_real]
SET [co2_value] = [nox_value], [co2_units] = N'mg/L', [co2_status] = [nox_status],
    [co_value] = [nox_value], [co_units] = N'mg/L', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 900 + (DAY([cdate]) * 18)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [bod_value] = [nox_value], [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 40 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.8 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 14 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(4.5 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[P0001_data_1m]
SET [co2_value] = [nox_value], [co2_units] = N'mg/L', [co2_status] = [nox_status],
    [co_value] = [nox_value], [co_units] = N'mg/L', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 910 + (DAY([cdate]) * 18)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [bod_value] = [nox_value], [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 42 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.8 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 15 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(5.0 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[P0001_data_5m]
SET [co2_value] = [nox_value], [co2_units] = N'mg/L', [co2_status] = [nox_status],
    [co_value] = [nox_value], [co_units] = N'mg/L', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 920 + (DAY([cdate]) * 18)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [bod_value] = [nox_value], [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 44 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.9 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 16 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(5.5 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[P0001_data_60m]
SET [co2_value] = [nox_value], [co2_units] = N'mg/L', [co2_status] = [nox_status],
    [co_value] = [nox_value], [co_units] = N'mg/L', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 930 + (DAY([cdate]) * 18)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [bod_value] = [nox_value], [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 46 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(6.9 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 17 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(6.0 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[P0001_data_1day]
SET [co2_value] = [nox_value], [co2_units] = N'mg/L', [co2_status] = [nox_status],
    [co_value] = [nox_value], [co_units] = N'mg/L', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 940 + (DAY([cdate]) * 18)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [bod_value] = [nox_value], [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 48 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(7.0 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 18 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(6.5 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

UPDATE [ingest].[P0001_data_test]
SET [co2_value] = [nox_value], [co2_units] = N'mg/L', [co2_status] = [nox_status],
    [co_value] = [nox_value], [co_units] = N'mg/L', [co_status] = [nox_status],
    [flow_value] = CONVERT(NVARCHAR(10), 950 + (DAY([cdate]) * 18)), [flow_units] = N'm3/hr', [flow_status] = [nox_status],
    [bod_value] = [nox_value], [bod_units] = N'mg/L', [bod_status] = [nox_status],
    [cod_value] = CONVERT(NVARCHAR(10), 50 + (DAY([cdate]) * 2)), [cod_units] = N'mg/L', [cod_status] = [nox_status],
    [ph_value] = CONVERT(NVARCHAR(10), CAST(7.0 + (DAY([cdate]) * 0.03) AS DECIMAL(10, 1))), [ph_units] = N'pH', [ph_status] = [nox_status],
    [tss_value] = CONVERT(NVARCHAR(10), 19 + (DAY([cdate]) * 2)), [tss_units] = N'mg/L', [tss_status] = [nox_status],
    [turb_value] = CONVERT(NVARCHAR(10), CAST(7.0 + (DAY([cdate]) * 0.4) AS DECIMAL(10, 1))), [turb_units] = N'NTU', [turb_status] = [nox_status]
WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

SELECT 'S0001_data_real' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_real] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'S0001_data_1m' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_1m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'S0001_data_5m' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_5m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'S0001_data_60m' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'S0001_data_1day' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_1day] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'S0001_data_test' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_test] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'P0001_data_real' AS table_name, COUNT(*) AS row_count FROM [ingest].[P0001_data_real] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'P0001_data_1m' AS table_name, COUNT(*) AS row_count FROM [ingest].[P0001_data_1m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'P0001_data_5m' AS table_name, COUNT(*) AS row_count FROM [ingest].[P0001_data_5m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'P0001_data_60m' AS table_name, COUNT(*) AS row_count FROM [ingest].[P0001_data_60m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'P0001_data_1day' AS table_name, COUNT(*) AS row_count FROM [ingest].[P0001_data_1day] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT 'P0001_data_test' AS table_name, COUNT(*) AS row_count FROM [ingest].[P0001_data_test] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO
