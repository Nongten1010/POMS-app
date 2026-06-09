-- Simple May 2026 mock NOx values for SQL Server / SSMS.
-- Refreshes S0001 rows from 2026-05-01 through 2026-05-10.

USE [parameter_ingest];
GO

DELETE FROM [ingest].[S0001_data_real] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';
DELETE FROM [ingest].[S0001_data_1m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';
DELETE FROM [ingest].[S0001_data_5m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';
DELETE FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';
DELETE FROM [ingest].[S0001_data_1day] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';
DELETE FROM [ingest].[S0001_data_test] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';

INSERT INTO [ingest].[S0001_data_real] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'S0001', N'52', N'ppm', N'Normal', '2026-05-01', '09:00:00', '2026-05-01', '09:00:00'),
(N'S0001', N'61', N'ppm', N'Warning', '2026-05-02', '09:00:00', '2026-05-02', '09:00:00'),
(N'S0001', N'78', N'ppm', N'Exceeded', '2026-05-03', '09:00:00', '2026-05-03', '09:00:00'),
(N'S0001', N'0', N'ppm', N'Insufficient', '2026-05-04', '09:00:00', '2026-05-04', '09:00:00'),
(N'S0001', N'0', N'ppm', N'No Data', '2026-05-05', '09:00:00', '2026-05-05', '09:00:00'),
(N'S0001', N'56', N'ppm', N'Calibration', '2026-05-06', '09:00:00', '2026-05-06', '09:00:00'),
(N'S0001', N'63', N'ppm', N'Maintenance', '2026-05-07', '09:00:00', '2026-05-07', '09:00:00'),
(N'S0001', N'70', N'ppm', N'Defective', '2026-05-08', '09:00:00', '2026-05-08', '09:00:00'),
(N'S0001', N'58', N'ppm', N'Normal', '2026-05-09', '09:00:00', '2026-05-09', '09:00:00'),
(N'S0001', N'66', N'ppm', N'Test', '2026-05-10', '09:00:00', '2026-05-10', '09:00:00');

INSERT INTO [ingest].[S0001_data_1m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'S0001', N'53', N'ppm', N'Normal', '2026-05-01', '09:01:00', '2026-05-01', '09:01:00'),
(N'S0001', N'62', N'ppm', N'Warning', '2026-05-02', '09:01:00', '2026-05-02', '09:01:00'),
(N'S0001', N'79', N'ppm', N'Exceeded', '2026-05-03', '09:01:00', '2026-05-03', '09:01:00'),
(N'S0001', N'0', N'ppm', N'Insufficient', '2026-05-04', '09:01:00', '2026-05-04', '09:01:00'),
(N'S0001', N'0', N'ppm', N'No Data', '2026-05-05', '09:01:00', '2026-05-05', '09:01:00'),
(N'S0001', N'57', N'ppm', N'Calibration', '2026-05-06', '09:01:00', '2026-05-06', '09:01:00'),
(N'S0001', N'64', N'ppm', N'Maintenance', '2026-05-07', '09:01:00', '2026-05-07', '09:01:00'),
(N'S0001', N'71', N'ppm', N'Defective', '2026-05-08', '09:01:00', '2026-05-08', '09:01:00'),
(N'S0001', N'59', N'ppm', N'Normal', '2026-05-09', '09:01:00', '2026-05-09', '09:01:00'),
(N'S0001', N'67', N'ppm', N'Test', '2026-05-10', '09:01:00', '2026-05-10', '09:01:00');

INSERT INTO [ingest].[S0001_data_5m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'S0001', N'54', N'ppm', N'Normal', '2026-05-01', '09:05:00', '2026-05-01', '09:05:00'),
(N'S0001', N'63', N'ppm', N'Warning', '2026-05-02', '09:05:00', '2026-05-02', '09:05:00'),
(N'S0001', N'80', N'ppm', N'Exceeded', '2026-05-03', '09:05:00', '2026-05-03', '09:05:00'),
(N'S0001', N'0', N'ppm', N'Insufficient', '2026-05-04', '09:05:00', '2026-05-04', '09:05:00'),
(N'S0001', N'0', N'ppm', N'No Data', '2026-05-05', '09:05:00', '2026-05-05', '09:05:00'),
(N'S0001', N'58', N'ppm', N'Calibration', '2026-05-06', '09:05:00', '2026-05-06', '09:05:00'),
(N'S0001', N'65', N'ppm', N'Maintenance', '2026-05-07', '09:05:00', '2026-05-07', '09:05:00'),
(N'S0001', N'72', N'ppm', N'Defective', '2026-05-08', '09:05:00', '2026-05-08', '09:05:00'),
(N'S0001', N'60', N'ppm', N'Normal', '2026-05-09', '09:05:00', '2026-05-09', '09:05:00'),
(N'S0001', N'68', N'ppm', N'Test', '2026-05-10', '09:05:00', '2026-05-10', '09:05:00');

INSERT INTO [ingest].[S0001_data_60m] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'S0001', N'55', N'ppm', N'Normal', '2026-05-01', '06:00:00', '2026-05-01', '06:00:00'),
(N'S0001', N'64', N'ppm', N'Warning', '2026-05-02', '06:00:00', '2026-05-02', '06:00:00'),
(N'S0001', N'81', N'ppm', N'Exceeded', '2026-05-03', '06:00:00', '2026-05-03', '06:00:00'),
(N'S0001', N'0', N'ppm', N'Insufficient', '2026-05-04', '06:00:00', '2026-05-04', '06:00:00'),
(N'S0001', N'0', N'ppm', N'No Data', '2026-05-05', '06:00:00', '2026-05-05', '06:00:00'),
(N'S0001', N'59', N'ppm', N'Calibration', '2026-05-06', '06:00:00', '2026-05-06', '06:00:00'),
(N'S0001', N'66', N'ppm', N'Maintenance', '2026-05-07', '06:00:00', '2026-05-07', '06:00:00'),
(N'S0001', N'73', N'ppm', N'Defective', '2026-05-08', '06:00:00', '2026-05-08', '06:00:00'),
(N'S0001', N'61', N'ppm', N'Normal', '2026-05-09', '06:00:00', '2026-05-09', '06:00:00'),
(N'S0001', N'69', N'ppm', N'Test', '2026-05-10', '06:00:00', '2026-05-10', '06:00:00');

INSERT INTO [ingest].[S0001_data_1day] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'S0001', N'52', N'ppm', N'Normal', '2026-05-01', '00:00:00', '2026-05-01', '00:00:00'),
(N'S0001', N'61', N'ppm', N'Warning', '2026-05-02', '00:00:00', '2026-05-02', '00:00:00'),
(N'S0001', N'78', N'ppm', N'Exceeded', '2026-05-03', '00:00:00', '2026-05-03', '00:00:00'),
(N'S0001', N'0', N'ppm', N'Insufficient', '2026-05-04', '00:00:00', '2026-05-04', '00:00:00'),
(N'S0001', N'0', N'ppm', N'No Data', '2026-05-05', '00:00:00', '2026-05-05', '00:00:00'),
(N'S0001', N'56', N'ppm', N'Calibration', '2026-05-06', '00:00:00', '2026-05-06', '00:00:00'),
(N'S0001', N'63', N'ppm', N'Maintenance', '2026-05-07', '00:00:00', '2026-05-07', '00:00:00'),
(N'S0001', N'70', N'ppm', N'Defective', '2026-05-08', '00:00:00', '2026-05-08', '00:00:00'),
(N'S0001', N'58', N'ppm', N'Normal', '2026-05-09', '00:00:00', '2026-05-09', '00:00:00'),
(N'S0001', N'66', N'ppm', N'Test', '2026-05-10', '00:00:00', '2026-05-10', '00:00:00');

INSERT INTO [ingest].[S0001_data_test] ([station_id], [nox_value], [nox_units], [nox_status], [cdate], [ctime], [udate], [utime]) VALUES
(N'S0001', N'56', N'ppm', N'Normal', '2026-05-01', '10:00:00', '2026-05-01', '10:00:00'),
(N'S0001', N'65', N'ppm', N'Warning', '2026-05-02', '10:00:00', '2026-05-02', '10:00:00'),
(N'S0001', N'82', N'ppm', N'Exceeded', '2026-05-03', '10:00:00', '2026-05-03', '10:00:00'),
(N'S0001', N'0', N'ppm', N'Insufficient', '2026-05-04', '10:00:00', '2026-05-04', '10:00:00'),
(N'S0001', N'0', N'ppm', N'No Data', '2026-05-05', '10:00:00', '2026-05-05', '10:00:00'),
(N'S0001', N'60', N'ppm', N'Calibration', '2026-05-06', '10:00:00', '2026-05-06', '10:00:00'),
(N'S0001', N'67', N'ppm', N'Maintenance', '2026-05-07', '10:00:00', '2026-05-07', '10:00:00'),
(N'S0001', N'74', N'ppm', N'Defective', '2026-05-08', '10:00:00', '2026-05-08', '10:00:00'),
(N'S0001', N'62', N'ppm', N'Normal', '2026-05-09', '10:00:00', '2026-05-09', '10:00:00'),
(N'S0001', N'70', N'ppm', N'Test', '2026-05-10', '10:00:00', '2026-05-10', '10:00:00');

SELECT 'S0001_data_real' AS table_name, COUNT(*) AS row_count FROM [ingest].[S0001_data_real] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10'
UNION ALL SELECT 'S0001_data_1m', COUNT(*) FROM [ingest].[S0001_data_1m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10'
UNION ALL SELECT 'S0001_data_5m', COUNT(*) FROM [ingest].[S0001_data_5m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10'
UNION ALL SELECT 'S0001_data_60m', COUNT(*) FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10'
UNION ALL SELECT 'S0001_data_1day', COUNT(*) FROM [ingest].[S0001_data_1day] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10'
UNION ALL SELECT 'S0001_data_test', COUNT(*) FROM [ingest].[S0001_data_test] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-05-01' AND [cdate] <= '2026-05-10';
GO
