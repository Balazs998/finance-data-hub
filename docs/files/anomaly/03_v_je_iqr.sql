-- Step 3: V_JE_IQR. Creates one VIEW only. Flags lines outside Q1 - k x IQR or Q3 + k x IQR of their group (k = 1.5).
-- PERCENTILE_CONT interpolates linearly between the two nearest values. Thresholds are parameters in the p CTE.
-- NULL handling: amount is never NULL in the demo; if it were, the comparisons give NULL and COALESCE makes flag FALSE.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_JE_IQR AS
WITH p AS (SELECT 1.5 AS k)
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount,
 s.n, s.q1, s.q3, s.q3 - s.q1 AS iqr,
 s.q1 - p.k * (s.q3 - s.q1) AS lower_fence, s.q3 + p.k * (s.q3 - s.q1) AS upper_fence,
 COALESCE(e.amount < s.q1 - p.k * (s.q3 - s.q1) OR e.amount > s.q3 + p.k * (s.q3 - s.q1), FALSE) AS flag
FROM ERP_GL_EXTRACT e
JOIN V_JE_STATS s ON s.account = e.account AND s.cost_center = e.cost_center
CROSS JOIN p;
