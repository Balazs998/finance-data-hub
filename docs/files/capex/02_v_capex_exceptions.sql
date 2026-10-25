-- Step 2: V_CAPEX_EXCEPTIONS. One row per project and reason. Empty result = nothing to alert.
-- Tolerance 5% lives in one place (the t CTE). Views only, no grants.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_CAPEX_EXCEPTIONS AS
WITH t AS (SELECT 0.05 AS tolerance)
SELECT s.project_id, 'OVER_BUDGET' AS reason, s.owner_role,
 s.committed_open + s.actual - s.budget_amount AS amount_over_budget
FROM V_CAPEX_STATUS s CROSS JOIN t
WHERE s.committed_open + s.actual > s.budget_amount * (1 + t.tolerance)
UNION ALL
SELECT s.project_id, 'UNAPPROVED_SPEND', s.owner_role, NULL
FROM V_CAPEX_STATUS s
WHERE s.approval_status IS DISTINCT FROM 'APPROVED' AND s.committed_open + s.actual > 0
UNION ALL
SELECT s.project_id, 'SOD_FLAG', s.owner_role, NULL
FROM V_CAPEX_STATUS s
WHERE s.approved_by_role = s.owner_role;
