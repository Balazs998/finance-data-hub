-- FDH_DEMO fictional sample only. Unload the export and a control file to the internal SAMPLE_STAGE.
-- Uses the existing internal stage. No external stage, no storage integration, no grants.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

SET run_id = 'PLAN_EXPORT_2026_03_R1';

-- Data file: Actual 2026-03 plus full Budget, fixed two decimals.
-- ORDER BY in the unload subquery with SINGLE = TRUE is the usual pattern for one ordered file; not a guarantee.
COPY INTO @SAMPLE_STAGE/plan_export/plan_load_2026_03.csv
FROM (
 SELECT cost_center, account, period, version, TO_VARCHAR(amount, 'FM9999999990.00') AS amount
 FROM V_PLAN_EXPORT_LONG
 WHERE (version = 'Actual' AND period = '2026-03') OR version = 'Budget'
 ORDER BY version, period, cost_center, account
)
FILE_FORMAT = (TYPE = CSV COMPRESSION = NONE FIELD_OPTIONALLY_ENCLOSED_BY = '"')
HEADER = TRUE
SINGLE = TRUE
OVERWRITE = TRUE;

-- Control file: one row per version with row count, sum and run_id.
COPY INTO @SAMPLE_STAGE/plan_export/plan_load_2026_03_control.csv
FROM (
 SELECT $run_id AS run_id, version, COUNT(*) AS row_count, TO_VARCHAR(SUM(amount), 'FM9999999990.00') AS amount_sum
 FROM V_PLAN_EXPORT_LONG
 WHERE (version = 'Actual' AND period = '2026-03') OR version = 'Budget'
 GROUP BY version
 ORDER BY version
)
FILE_FORMAT = (TYPE = CSV COMPRESSION = NONE FIELD_OPTIONALLY_ENCLOSED_BY = '"')
HEADER = TRUE
SINGLE = TRUE
OVERWRITE = TRUE;
-- Expect control rows: Actual 58 / 1466143.86 and Budget 696 / 17253220.89

LIST @SAMPLE_STAGE/plan_export/;
