-- Step 4: checks. Expected values are in README.md.
USE SCHEMA FDH_DEMO.MOTORS;

-- a) Exceptions by reason (expect OVER_BUDGET 2, UNAPPROVED_SPEND 1, SOD_FLAG 1)
SELECT reason, COUNT(*) AS n, LISTAGG(project_id, ', ') WITHIN GROUP (ORDER BY project_id) AS projects
FROM V_CAPEX_EXCEPTIONS GROUP BY reason ORDER BY reason;

-- b) Status totals reconcile to the tables (expect diff 0.00 on all three)
SELECT
 (SELECT SUM(budget_amount) FROM V_CAPEX_STATUS) - (SELECT SUM(budget_amount) FROM CAPEX_PROJECT) AS budget_diff,
 (SELECT SUM(committed_open) FROM V_CAPEX_STATUS) - (SELECT SUM(amount) FROM CAPEX_COMMIT WHERE status = 'OPEN') AS committed_diff,
 (SELECT SUM(actual) FROM V_CAPEX_STATUS) - (SELECT SUM(amount) FROM CAPEX_ACTUAL) AS actual_diff;

-- c) Totals (expect budget 7,400,000.00, committed 1,202,500.00, actual 5,320,500.00, remaining 877,000.00)
SELECT SUM(budget_amount) AS budget, SUM(committed_open) AS committed, SUM(actual) AS actual, SUM(remaining) AS remaining
FROM V_CAPEX_STATUS;

-- d) Edge cases: PRJ05 only over with commitments, PRJ07 within tolerance (no alert), PRJ11 late invoice
SELECT project_id, budget_amount, committed_open, actual, ROUND(pct_used * 100, 2) AS pct_used, late_invoices
FROM V_CAPEX_STATUS WHERE project_id IN ('PRJ03', 'PRJ05', 'PRJ07', 'PRJ09', 'PRJ10', 'PRJ11') ORDER BY project_id;

-- e) Alert rows (expect 8: 4 to owners, 4 to the committee)
SELECT COUNT(*) AS alert_rows FROM V_CAPEX_ALERT;
