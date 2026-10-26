-- Step 1: V_CAPEX_STATUS. One row per project: budget, committed (OPEN POs only), actual (invoices), remaining, % used.
-- Views only. Tables come from load_motors.sql (MOTORS_STAGE / CSV_HDR). No grants in this pack.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_CAPEX_STATUS AS
WITH c AS (
 SELECT project_id, SUM(amount) AS committed_open
 FROM CAPEX_COMMIT WHERE status = 'OPEN' GROUP BY project_id
), a AS (
 SELECT project_id, SUM(amount) AS actual, MAX(period) AS last_invoice_period
 FROM CAPEX_ACTUAL GROUP BY project_id
), l AS (
 -- invoices booked after the project was closed
 SELECT x.project_id, COUNT(*) AS late_invoices
 FROM CAPEX_ACTUAL x JOIN CAPEX_PROJECT p ON p.project_id = x.project_id
 WHERE p.closed AND x.period > p.closed_period GROUP BY x.project_id
)
SELECT p.project_id, p.project_name, p.plant, p.owner_role, p.approval_status, p.approved_by_role,
 p.closed, p.closed_period, p.budget_amount,
 COALESCE(c.committed_open, 0) AS committed_open,
 COALESCE(a.actual, 0) AS actual,
 p.budget_amount - COALESCE(c.committed_open, 0) - COALESCE(a.actual, 0) AS remaining,
 IFF(p.budget_amount = 0, NULL, (COALESCE(c.committed_open, 0) + COALESCE(a.actual, 0)) / p.budget_amount) AS pct_used,
 a.last_invoice_period,
 COALESCE(l.late_invoices, 0) AS late_invoices
FROM CAPEX_PROJECT p
LEFT JOIN c ON c.project_id = p.project_id
LEFT JOIN a ON a.project_id = p.project_id
LEFT JOIN l ON l.project_id = p.project_id;
