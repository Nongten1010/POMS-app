-- Mock hourly data for SQL Server / SSMS.
-- Requirement:
-- - P0001 and S0001 have rows from 2026-06-01 through 2026-06-10.
-- - Every day has 24 hourly rows: 00:00:00 through 23:00:00.
-- - Existing rows in that date range are deleted first.

USE [parameter_ingest];
GO

SET NOCOUNT ON;

IF OBJECT_ID(N'ingest.P0001_data_real', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_real] FROM [ingest].[S0001_data_real];
IF OBJECT_ID(N'ingest.P0001_data_1m', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_1m] FROM [ingest].[S0001_data_1m];
IF OBJECT_ID(N'ingest.P0001_data_5m', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_5m] FROM [ingest].[S0001_data_5m];
IF OBJECT_ID(N'ingest.P0001_data_60m', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_60m] FROM [ingest].[S0001_data_60m];
IF OBJECT_ID(N'ingest.P0001_data_1day', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_1day] FROM [ingest].[S0001_data_1day];
IF OBJECT_ID(N'ingest.P0001_data_test', N'U') IS NULL SELECT TOP 0 * INTO [ingest].[P0001_data_test] FROM [ingest].[S0001_data_test];

DELETE FROM [ingest].[P0001_data_real] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_1m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_5m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_60m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_1day] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[P0001_data_test] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';

DELETE FROM [ingest].[S0001_data_real] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_1m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_5m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_1day] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
DELETE FROM [ingest].[S0001_data_test] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
GO

IF OBJECT_ID('tempdb..#mock_dates') IS NOT NULL DROP TABLE #mock_dates;
IF OBJECT_ID('tempdb..#mock_hours') IS NOT NULL DROP TABLE #mock_hours;

CREATE TABLE #mock_dates ([cdate] DATE NOT NULL);
CREATE TABLE #mock_hours ([hour_no] INT NOT NULL, [ctime] TIME(0) NOT NULL);

INSERT INTO #mock_dates ([cdate]) VALUES
('2026-06-01'), ('2026-06-02'), ('2026-06-03'), ('2026-06-04'), ('2026-06-05'),
('2026-06-06'), ('2026-06-07'), ('2026-06-08'), ('2026-06-09'), ('2026-06-10');

INSERT INTO #mock_hours ([hour_no], [ctime]) VALUES
(0, '00:00:00'), (1, '01:00:00'), (2, '02:00:00'), (3, '03:00:00'),
(4, '04:00:00'), (5, '05:00:00'), (6, '06:00:00'), (7, '07:00:00'),
(8, '08:00:00'), (9, '09:00:00'), (10, '10:00:00'), (11, '11:00:00'),
(12, '12:00:00'), (13, '13:00:00'), (14, '14:00:00'), (15, '15:00:00'),
(16, '16:00:00'), (17, '17:00:00'), (18, '18:00:00'), (19, '19:00:00'),
(20, '20:00:00'), (21, '21:00:00'), (22, '22:00:00'), (23, '23:00:00');
GO

INSERT INTO [ingest].[P0001_data_real] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'P0001', 400 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 10 + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 900 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 20 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 5 + h.[hour_no], N'%', N'Normal', 1 + h.[hour_no], N'%', N'Normal', 40 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 30 + h.[hour_no], N'mg/L', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[P0001_data_1m] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'P0001', 410 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 11 + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 910 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 21 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 6 + h.[hour_no], N'%', N'Normal', 2 + h.[hour_no], N'%', N'Normal', 41 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 31 + h.[hour_no], N'mg/L', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[P0001_data_5m] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'P0001', 420 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 12 + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 920 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 22 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 7 + h.[hour_no], N'%', N'Normal', 3 + h.[hour_no], N'%', N'Normal', 42 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 32 + h.[hour_no], N'mg/L', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[P0001_data_60m] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'P0001', 430 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 13 + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 930 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 23 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 8 + h.[hour_no], N'%', N'Normal', 4 + h.[hour_no], N'%', N'Normal', 43 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 33 + h.[hour_no], N'mg/L', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[P0001_data_1day] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'P0001', 440 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 14 + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 940 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 24 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 9 + h.[hour_no], N'%', N'Normal', 5 + h.[hour_no], N'%', N'Normal', 44 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 34 + h.[hour_no], N'mg/L', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[P0001_data_test] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'P0001', 450 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 15 + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 950 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 25 + DAY(d.[cdate]) + h.[hour_no], N'mg/L', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 10 + h.[hour_no], N'%', N'Normal', 6 + h.[hour_no], N'%', N'Normal', 45 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 35 + h.[hour_no], N'mg/L', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[S0001_data_real] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', 500 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 16 + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 1000 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 26 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 11 + h.[hour_no], N'%', N'Normal', 7 + h.[hour_no], N'%', N'Normal', 46 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 36 + h.[hour_no], N'ppm', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[S0001_data_1m] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', 510 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 17 + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 1010 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 27 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 12 + h.[hour_no], N'%', N'Normal', 8 + h.[hour_no], N'%', N'Normal', 47 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 37 + h.[hour_no], N'ppm', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[S0001_data_5m] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', 520 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 18 + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 1020 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 28 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 13 + h.[hour_no], N'%', N'Normal', 9 + h.[hour_no], N'%', N'Normal', 48 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 38 + h.[hour_no], N'ppm', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[S0001_data_60m] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', 530 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 19 + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 1030 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 29 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 14 + h.[hour_no], N'%', N'Normal', 10 + h.[hour_no], N'%', N'Normal', 49 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 39 + h.[hour_no], N'ppm', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[S0001_data_1day] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', 540 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 20 + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 1040 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 30 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 15 + h.[hour_no], N'%', N'Normal', 11 + h.[hour_no], N'%', N'Normal', 50 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 40 + h.[hour_no], N'ppm', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;

INSERT INTO [ingest].[S0001_data_test] ([station_id], [co2_value], [co2_units], [co2_status], [co_value], [co_units], [co_status], [flow_value], [flow_units], [flow_status], [nox_value], [nox_units], [nox_status], [o2_value], [o2_units], [o2_status], [opacity_value], [opacity_units], [opacity_status], [particulate_value], [particulate_units], [particulate_status], [so2_value], [so2_units], [so2_status], [cdate], [ctime], [udate], [utime])
SELECT N'S0001', 550 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (3, 8, 15), N'Warning', N'Normal'), 21 + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (4, 9), N'Warning', N'Normal'), 1050 + (h.[hour_no] * 10), N'm3/hr', IIF(h.[hour_no] = 5, N'Alarm', N'Normal'), 31 + DAY(d.[cdate]) + h.[hour_no], N'ppm', IIF(h.[hour_no] IN (2, 7), N'Warning', IIF(h.[hour_no] = 10, N'Alarm', N'Normal')), 16 + h.[hour_no], N'%', N'Normal', 12 + h.[hour_no], N'%', N'Normal', 51 + h.[hour_no], N'mg/m3', IIF(h.[hour_no] = 8, N'Warning', N'Normal'), 41 + h.[hour_no], N'ppm', IIF(h.[hour_no] = 9, N'Warning', N'Normal'), d.[cdate], h.[ctime], d.[cdate], h.[ctime] FROM #mock_dates d CROSS JOIN #mock_hours h;
GO

SELECT N'P0001_data_60m' AS [table_name], COUNT(*) AS [row_count] FROM [ingest].[P0001_data_60m] WHERE [station_id] = N'P0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT N'S0001_data_60m' AS [table_name], COUNT(*) AS [row_count] FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10';
SELECT [cdate], COUNT(*) AS [hour_count] FROM [ingest].[S0001_data_60m] WHERE [station_id] = N'S0001' AND [cdate] >= '2026-06-01' AND [cdate] <= '2026-06-10' GROUP BY [cdate] ORDER BY [cdate];

