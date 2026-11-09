-- Finance Data Hub: find service users that still sign in with a password
-- Placeholder names only. Run as a role that can see all users (SECURITYADMIN).
USE ROLE SECURITYADMIN;

SHOW USERS;

SELECT "name", "type", "has_password", "has_rsa_public_key", "last_success_login"
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))
-- In LIKE a bare _ matches any single character, so it is escaped to match a real underscore.
WHERE "type" = 'LEGACY_SERVICE' OR (TO_BOOLEAN("has_password") AND "name" LIKE '%\\_SVC' ESCAPE '\\')
ORDER BY "last_success_login" DESC;
