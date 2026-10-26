-- FDH_DEMO fictional sample only.
-- Reuses FACT_ACTUALS_SNAPSHOT from the month-end snapshots post (run ME_CLOSE_2026_03_R1).
-- Run that post's 01 and 03 scripts first, and 02 if you want to see the late posting.
-- Reported (snapshot) vs current actuals vs budget, per cell, for 2026-03.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

WITH rep AS (
 SELECT cost_center, account, period, SUM(amount) AS reported_amt
 FROM FACT_ACTUALS_SNAPSHOT
 WHERE snapshot_period = '2026-03'
 AND run_id = 'ME_CLOSE_2026_03_R1'
 AND sent_flag = TRUE
 GROUP BY cost_center, account, period
),
cur AS (
 SELECT cost_center, account, period, actual_amt AS current_amt, budget_amt
 FROM V_FIN_AVB_CELL
 WHERE period = '2026-03'
)
SELECT
 COALESCE(r.cost_center, c.cost_center) AS cost_center,
 COALESCE(r.account, c.account) AS account,
 r.reported_amt,
 c.current_amt,
 c.budget_amt,
 COALESCE(c.current_amt, 0) - COALESCE(r.reported_amt, 0) AS moved_since_report,
 COALESCE(r.reported_amt, 0) - COALESCE(c.budget_amt, 0) AS reported_vs_budget
FROM rep r
FULL OUTER JOIN cur c
 ON r.cost_center = c.cost_center
 AND r.account = c.account
 AND r.period = c.period
WHERE r.reported_amt IS DISTINCT FROM c.current_amt
ORDER BY 1, 2;
-- Before the late posting: 0 rows. Budget-only CC3000 / 610000 has NULL on both sides, and
-- IS DISTINCT FROM treats NULL vs NULL as not distinct, so it is not reported as moved.
-- After 02_seed_late_posting.sql: 1 row, CC2000 / 500000: reported NULL, current 2500.00,
-- budget NULL (unbudgeted), moved_since_report 2500.00.

SELECT
 (SELECT SUM(amount) FROM FACT_ACTUALS_SNAPSHOT WHERE snapshot_period = '2026-03' AND run_id = 'ME_CLOSE_2026_03_R1' AND sent_flag = TRUE) AS reported_total,
 (SELECT SUM(actual_amt) FROM V_FIN_AVB_CELL WHERE period = '2026-03') AS current_total,
 (SELECT SUM(budget_amt) FROM V_FIN_AVB_CELL WHERE period = '2026-03') AS budget_total;
-- Expect 1466143.86 / 1466143.86 (1468643.86 after the late posting) / 1430954.37
