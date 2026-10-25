-- Step 4: V_JE_RULES. Creates one VIEW only. Three plain rules, one row per line that breaks a rule:
-- WEEKEND (posted on Sat or Sun, DAYOFWEEKISO 6 or 7), ROUND_AMOUNT (|amount| >= 10,000 and a multiple of 1,000),
-- NEGATIVE_EXPENSE (amount < 0 on an EXPENSE account, from FDH_DEMO.SAMPLE.DIM_ACCOUNT).
-- NULL handling: a line whose account is missing from DIM_ACCOUNT has account_type NULL and cannot hit NEGATIVE_EXPENSE;
-- check e) in 06 counts such lines (expect 0).
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_JE_RULES AS
WITH p AS (SELECT 10000 AS round_min, 1000 AS round_step),
e AS (
 SELECT x.doc_id, x.line_no, x.posting_date, x.period, x.cost_center, x.account, x.amount, a.account_type
 FROM ERP_GL_EXTRACT x LEFT JOIN FDH_DEMO.SAMPLE.DIM_ACCOUNT a ON a.account = x.account
)
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount, 'WEEKEND' AS rule
FROM e WHERE DAYOFWEEKISO(e.posting_date) IN (6, 7)
UNION ALL
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount, 'ROUND_AMOUNT'
FROM e CROSS JOIN p WHERE ABS(e.amount) >= p.round_min AND MOD(e.amount, p.round_step) = 0
UNION ALL
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount, 'NEGATIVE_EXPENSE'
FROM e WHERE e.account_type = 'EXPENSE' AND e.amount < 0;
