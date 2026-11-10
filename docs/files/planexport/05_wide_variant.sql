-- FDH_DEMO fictional sample only. Optional wide layout: one row per cost center and account, 12 Budget months as columns.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

SELECT *
FROM (
 SELECT cost_center, account, period, amount
 FROM V_PLAN_EXPORT_LONG
 WHERE version = 'Budget'
)
PIVOT (SUM(amount) FOR period IN ('2025-10' AS m2025_10, '2025-11' AS m2025_11, '2025-12' AS m2025_12, '2026-01' AS m2026_01, '2026-02' AS m2026_02, '2026-03' AS m2026_03, '2026-04' AS m2026_04, '2026-05' AS m2026_05, '2026-06' AS m2026_06, '2026-07' AS m2026_07, '2026-08' AS m2026_08, '2026-09' AS m2026_09))
ORDER BY cost_center, account;
-- Expect 58 rows (computed from the sample CSVs; confirm on a demo run)
