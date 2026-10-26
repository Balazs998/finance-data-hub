-- Check the result: checks. Expected values are in README.md. Read-only.
USE SCHEMA FDH_DEMO.MOTORS;

-- a) Close: late and blocked (expect late 3: CT10, CT12, CT21; blocked 1: CT19)
SELECT COUNT_IF(completed_late) AS late, LISTAGG(IFF(completed_late, task_id, NULL), ', ') WITHIN GROUP (ORDER BY task_id) AS late_tasks,
 COUNT_IF(status = 'BLOCKED') AS blocked
FROM V_CLOSE_TASK WHERE period = '2026-03';

-- b) Close by day (expect WD7 2026-04-09: 24 of 25 done, 96.00%, CT19 still open)
SELECT workday, close_day, due_by_day, done_by_day, overdue_open, ROUND(pct_complete * 100, 2) AS pct_complete
FROM V_CLOSE_STATUS WHERE period = '2026-03' ORDER BY workday;

-- c) Flag counts (expect ZSCORE 3, IQR 33, WEEKEND 1, ROUND_AMOUNT 1, NEGATIVE_EXPENSE 1; 35 distinct lines)
SELECT reason, COUNT(*) AS n FROM V_JE_FLAGS GROUP BY reason ORDER BY reason;
SELECT COUNT(*) AS lines_flagged FROM (SELECT DISTINCT doc_id, line_no FROM V_JE_FLAGS);

-- d) Seeded lines: which method caught which
WITH s AS (
 SELECT column1 AS seed, column2 AS doc_id, column3 AS line_no FROM VALUES
 ('S1 10x amount', 'FDH1-202602-CC3010-620000', 1), ('S2 round amount', 'FDH1-202603-CC1010-400000', 1),
 ('S3 weekend', 'FDH1-202603-CC3000-630000', 1), ('S4 wrong sign', 'FDH1-202601-CC5000-500000', 1),
 ('S5 subtle', 'FDH1-202511-CC3010-620000', 1), ('Seasonal (legit)', 'FDH1-202512-CC6000-600000', 1)
)
SELECT s.seed, LISTAGG(f.reason, ', ') WITHIN GROUP (ORDER BY f.reason) AS caught_by
FROM s LEFT JOIN V_JE_FLAGS f ON f.doc_id = s.doc_id AND f.line_no = s.line_no
GROUP BY s.seed ORDER BY s.seed;

-- e) Lines with an account missing from DIM_ACCOUNT (expect 0)
SELECT COUNT(*) AS unknown_account FROM ERP_GL_EXTRACT x LEFT JOIN FDH_DEMO.SAMPLE.DIM_ACCOUNT a ON a.account = x.account
WHERE a.account IS NULL;

-- f) Gate (expect 1)
SELECT IFF(COUNT(*) > 0, 1, 0) AS send_alert FROM V_JE_FLAGS;
