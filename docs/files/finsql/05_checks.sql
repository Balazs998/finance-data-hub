-- FDH_DEMO fictional sample only. Tie-out checks. Every diff must be 0.00.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

SELECT 'actual' AS side,
 (SELECT SUM(amount) FROM FACT_ACTUALS WHERE version = 'Actual') AS fact_total,
 (SELECT SUM(actual_amt) FROM V_FIN_AVB_CELL) AS view_total,
 ROUND(fact_total - view_total, 2) AS diff
UNION ALL
SELECT 'budget',
 (SELECT SUM(amount) FROM FACT_BUDGET WHERE version = 'Budget'),
 (SELECT SUM(budget_amt) FROM V_FIN_AVB_CELL),
 ROUND((SELECT SUM(amount) FROM FACT_BUDGET WHERE version = 'Budget') - (SELECT SUM(budget_amt) FROM V_FIN_AVB_CELL), 2);
-- Expect actual 15446573.09 / 15446573.09 / 0.00 and budget 17253220.89 / 17253220.89 / 0.00

SELECT ROUND(SUM(actual_ytd) - (SELECT SUM(amount) FROM FACT_ACTUALS WHERE version = 'Actual' AND period BETWEEN '2025-10' AND '2026-03'), 2) AS ytd_diff
FROM V_FIN_AVB_PTD_YTD
WHERE period = '2026-03';
-- Expect 0.00 (YTD actual 8192165.52)
