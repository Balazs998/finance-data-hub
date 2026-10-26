-- The alert contains journal amounts. Give the sending job a role that can only SELECT V_JE_FLAGS and V_JE_ALERT, not ERP_GL_EXTRACT, and send it only to internal finance recipients. Keep real addresses in your own MOTORS_RECIPIENTS table, never in a file you publish.
-- Step 5: V_JE_FLAGS (one row per line and reason) and V_JE_ALERT (who is told). Creates two VIEWS only. Sends nothing.
-- The alert goes to the owner of close task "Journal anomaly review" (GL_ACCOUNTANT in CLOSE_TASK).
-- MOTORS_RECIPIENTS has GL_ACCOUNTANT (gl.accountant@example.com); V_JE_ALERT returns 35 rows in the demo.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_JE_FLAGS AS
SELECT doc_id, line_no, posting_date, period, cost_center, account, amount, 'ZSCORE' AS reason, z AS score FROM V_JE_ZSCORE WHERE flag
UNION ALL
SELECT doc_id, line_no, posting_date, period, cost_center, account, amount, 'IQR', NULL FROM V_JE_IQR WHERE flag
UNION ALL
SELECT doc_id, line_no, posting_date, period, cost_center, account, amount, rule, NULL FROM V_JE_RULES;

CREATE OR REPLACE VIEW V_JE_ALERT AS
SELECT r.email, r.display_name, f.doc_id, f.line_no, f.period, f.cost_center, f.account, f.amount,
 LISTAGG(f.reason, ', ') WITHIN GROUP (ORDER BY f.reason) AS reasons
FROM V_JE_FLAGS f
JOIN MOTORS_RECIPIENTS r ON r.role = (SELECT MIN(owner_role) FROM CLOSE_TASK WHERE task_name = 'Journal anomaly review')
GROUP BY r.email, r.display_name, f.doc_id, f.line_no, f.period, f.cost_center, f.account, f.amount;

-- Gate, run by the scheduler before mailing: 1 = send V_JE_ALERT, 0 = send nothing.
SELECT IFF(COUNT(*) > 0, 1, 0) AS send_alert FROM V_JE_FLAGS;
