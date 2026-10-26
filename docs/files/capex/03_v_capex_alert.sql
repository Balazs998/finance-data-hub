-- Owners without a MOTORS_RECIPIENTS row get no mail; the committee row is always sent.
-- Step 3: V_CAPEX_ALERT. Who gets mailed, and about what. Read-only; it sends nothing.
-- Owners get their own projects; CAPEX_COMMITTEE gets every exception. All addresses are @example.com.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_CAPEX_ALERT AS
SELECT r.email, r.display_name, e.project_id, e.reason, e.amount_over_budget
FROM V_CAPEX_EXCEPTIONS e JOIN MOTORS_RECIPIENTS r ON r.role = e.owner_role
UNION ALL
SELECT r.email, r.display_name, e.project_id, e.reason, e.amount_over_budget
FROM V_CAPEX_EXCEPTIONS e JOIN MOTORS_RECIPIENTS r ON r.role = 'CAPEX_COMMITTEE';

-- What the scheduler runs. One number decides: 0 = stop, no mail; above 0 = send.
-- SELECT COUNT(*) AS exception_count FROM V_CAPEX_EXCEPTIONS;
