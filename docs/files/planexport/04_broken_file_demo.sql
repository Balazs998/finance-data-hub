-- FDH_DEMO fictional sample only. Simulate a file that lost one row in transit.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

DELETE FROM PLAN_EXPORT_REIMPORT
WHERE cost_center = 'CC1000' AND account = '400000' AND period = '2026-03' AND version = 'Actual';

SELECT version, file_rows, file_sum, file_vs_export_diff, file_vs_export_row_diff
FROM V_PLAN_EXPORT_RECON
ORDER BY version;
-- Expect Actual 57 / 1428854.63 / -37289.23 / -1; Budget unchanged with 0.00
-- Re-run 03_reimport_and_recon.sql to restore the clean state.
