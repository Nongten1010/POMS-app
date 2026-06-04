-- Run this in the main POMS database, not in parameter_ingest.
-- It links operator_demo to station S0001 through a CONNECTED CEMS request
-- and measurement point, so /parameter-values can authorize the station.

SET NOCOUNT ON;

DECLARE @operatorExternalId VARCHAR(32) = '3191000135709';
DECLARE @factoryFid VARCHAR(20) = '10190003325500';
DECLARE @requestNo VARCHAR(32) = 'CEMS-DEMO-S0001';
DECLARE @stationId VARCHAR(64) = 'S0001';

DECLARE @userId BIGINT;
DECLARE @factoryName NVARCHAR(500);
DECLARE @factoryRegistrationNo NVARCHAR(64);
DECLARE @contactName NVARCHAR(255);
DECLARE @contactPhone VARCHAR(64);
DECLARE @contactEmail VARCHAR(255);
DECLARE @requestId BIGINT;

SELECT TOP 1
  @userId = id,
  @contactName = CONCAT(first_name, N' ', last_name),
  @contactPhone = COALESCE(phone, '0999454594'),
  @contactEmail = email
FROM users
WHERE identity_provider = 'mock'
  AND external_id = @operatorExternalId
  AND deleted_at IS NULL;

IF @userId IS NULL
  THROW 51000, 'operator_demo user was not found. Run backend seeds first.', 1;

SELECT TOP 1
  @factoryName = name,
  @factoryRegistrationNo = code
FROM factories
WHERE fid = @factoryFid
  AND deleted_at IS NULL;

IF @factoryName IS NULL
  THROW 51001, 'operator_demo factory 10190003325500 was not found. Run backend seeds first.', 1;

SELECT TOP 1 @requestId = id
FROM cems_wpms_connection_requests
WHERE request_no = @requestNo
  AND deleted_at IS NULL;

IF @requestId IS NULL
BEGIN
  INSERT INTO cems_wpms_connection_requests (
    request_no,
    request_type,
    factory_id,
    factory_name,
    factory_registration_no,
    system_type,
    status,
    contact_name,
    contact_phone,
    contact_email,
    remarks,
    confirmed_at,
    verified_at,
    created_by,
    updated_by
  )
  VALUES (
    @requestNo,
    'NEW_CONNECTION',
    @factoryFid,
    @factoryName,
    @factoryRegistrationNo,
    'CEMS',
    'CONNECTED',
    COALESCE(NULLIF(@contactName, N' '), 'operator_demo'),
    @contactPhone,
    @contactEmail,
    'Demo station access for parameter values API',
    SYSDATETIME(),
    SYSDATETIME(),
    @userId,
    @userId
  );

  SET @requestId = CONVERT(BIGINT, SCOPE_IDENTITY());
END
ELSE
BEGIN
  UPDATE cems_wpms_connection_requests
  SET
    request_type = 'NEW_CONNECTION',
    factory_id = @factoryFid,
    factory_name = @factoryName,
    factory_registration_no = @factoryRegistrationNo,
    system_type = 'CEMS',
    status = 'CONNECTED',
    contact_name = COALESCE(NULLIF(@contactName, N' '), 'operator_demo'),
    contact_phone = @contactPhone,
    contact_email = @contactEmail,
    remarks = 'Demo station access for parameter values API',
    confirmed_at = COALESCE(confirmed_at, SYSDATETIME()),
    verified_at = COALESCE(verified_at, SYSDATETIME()),
    updated_by = @userId,
    updated_at = SYSDATETIME()
  WHERE id = @requestId;
END;

IF EXISTS (
  SELECT 1
  FROM cems_wpms_measurement_points
  WHERE request_id = @requestId
    AND point_code = @stationId
    AND deleted_at IS NULL
)
BEGIN
  UPDATE cems_wpms_measurement_points
  SET
    point_name = @stationId,
    point_type = 'STACK',
    parameters_json = '["co2","co","nox","o2","so2","temp"]',
    description = 'Demo stack station for parameter ingestion demo',
    updated_by = @userId,
    updated_at = SYSDATETIME()
  WHERE request_id = @requestId
    AND point_code = @stationId
    AND deleted_at IS NULL;
END
ELSE
BEGIN
  INSERT INTO cems_wpms_measurement_points (
    request_id,
    point_name,
    point_code,
    point_type,
    parameters_json,
    description,
    created_by,
    updated_by
  )
  VALUES (
    @requestId,
    @stationId,
    @stationId,
    'STACK',
    '["co2","co","nox","o2","so2","temp"]',
    'Demo stack station for parameter ingestion demo',
    @userId,
    @userId
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM cems_wpms_request_status_history
  WHERE request_id = @requestId
    AND status = 'CONNECTED'
)
BEGIN
  INSERT INTO cems_wpms_request_status_history (
    request_id,
    status,
    note,
    changed_by
  )
  VALUES (
    @requestId,
    'CONNECTED',
    'Demo station access for parameter values API',
    @userId
  );
END;

SELECT
  @requestNo AS request_no,
  @factoryFid AS factory_id,
  @stationId AS station_id,
  @userId AS operator_user_id;
