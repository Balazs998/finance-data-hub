-- Finance Data Hub: check how JEDOX_SVC signed in over the last 7 days
-- Run as a role that can monitor JEDOX_SVC, for example SECURITYADMIN.
-- FIRST_AUTHENTICATION_FACTOR should show a key-pair value on successful rows
-- (commonly RSA_KEYPAIR in practice; confirm against your own output).
USE ROLE SECURITYADMIN;

SELECT event_timestamp, user_name, first_authentication_factor, is_success, error_message
FROM TABLE(FDH_DEMO.INFORMATION_SCHEMA.LOGIN_HISTORY_BY_USER(USER_NAME => 'JEDOX_SVC', RESULT_LIMIT => 100))
ORDER BY event_timestamp DESC;
