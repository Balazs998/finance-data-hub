-- FDH_DEMO fictional sample only. Load the file back and reconcile it against the source.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE OR REPLACE TABLE PLAN_EXPORT_REIMPORT (
 cost_center VARCHAR(16),
 account VARCHAR(16),
 period VARCHAR(7),
 version VARCHAR(16),
 amount NUMBER(18,2)
);

COPY INTO PLAN_EXPORT_REIMPORT
FROM @SAMPLE_STAGE/plan_export/plan_load_2026_03.csv
FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"');

CREATE OR REPLACE VIEW V_PLAN_EXPORT_RECON AS
WITH src AS (
 SELECT 'Actual' AS version, COUNT(*) AS src_rows, SUM(amount) AS src_sum
 FROM FACT_ACTUALS WHERE version = 'Actual' AND period = '2026-03'
 UNION ALL
 SELECT 'Budget', COUNT(*), SUM(amount)
 FROM FACT_BUDGET WHERE version = 'Budget'
),
exp AS (
 SELECT version, COUNT(*) AS exp_rows, SUM(amount) AS exp_sum
 FROM V_PLAN_EXPORT_LONG
 WHERE (version = 'Actual' AND period = '2026-03') OR version = 'Budget'
 GROUP BY version
),
fil AS (
 SELECT version, COUNT(*) AS file_rows, SUM(amount) AS file_sum
 FROM PLAN_EXPORT_REIMPORT
 GROUP BY version
)
SELECT
 s.version,
 s.src_rows, e.exp_rows, f.file_rows,
 s.src_sum, e.exp_sum, f.file_sum,
 ROUND(e.exp_sum - s.src_sum, 2) AS export_vs_source_diff,
 ROUND(COALESCE(f.file_sum, 0) - e.exp_sum, 2) AS file_vs_export_diff,
 COALESCE(f.file_rows, 0) - e.exp_rows AS file_vs_export_row_diff
FROM src s
LEFT JOIN exp e ON e.version = s.version
LEFT JOIN fil f ON f.version = s.version;

SELECT * FROM V_PLAN_EXPORT_RECON ORDER BY version;
-- Expect Actual 58 / 58 / 58, 1466143.86, every diff 0.00 and 0 rows
-- Expect Budget 696 / 696 / 696, 17253220.89, every diff 0.00 and 0 rows
-- src_rows equals exp_rows here because the sample has one posting per cell.
