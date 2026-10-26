-- FDH_DEMO fictional sample only. New view.
-- One row per cost_center x account x period with actual and budget side by side.
-- Each side is summed to one row per cell first, then FULL OUTER JOINed.
-- Expected: 701 rows (605 both, 5 actual only, 91 budget only).
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

-- Replaces any existing view named V_FIN_AVB_CELL in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_FIN_AVB_CELL AS
WITH act AS (
 SELECT cost_center, account, period, SUM(amount) AS actual_amt
 FROM FACT_ACTUALS
 WHERE version = 'Actual'
 GROUP BY cost_center, account, period
),
bud AS (
 SELECT cost_center, account, period, SUM(amount) AS budget_amt
 FROM FACT_BUDGET
 WHERE version = 'Budget'
 GROUP BY cost_center, account, period
)
SELECT
 COALESCE(a.cost_center, b.cost_center) AS cost_center,
 COALESCE(a.account, b.account) AS account,
 COALESCE(a.period, b.period) AS period,
 a.actual_amt,
 b.budget_amt,
 COALESCE(a.actual_amt, 0) - COALESCE(b.budget_amt, 0) AS variance_amt,
 CASE
 WHEN a.actual_amt IS NULL THEN 'BUDGET_ONLY'
 WHEN b.budget_amt IS NULL THEN 'ACTUAL_ONLY'
 ELSE 'BOTH'
 END AS match_status
FROM act a
FULL OUTER JOIN bud b
 ON a.cost_center = b.cost_center
 AND a.account = b.account
 AND a.period = b.period;

SELECT match_status, COUNT(*) AS cells
FROM V_FIN_AVB_CELL
GROUP BY match_status
ORDER BY match_status;
-- Expect ACTUAL_ONLY 5, BOTH 605, BUDGET_ONLY 91
