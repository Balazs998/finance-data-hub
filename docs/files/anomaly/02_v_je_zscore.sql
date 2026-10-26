-- Step 2: V_JE_STATS and V_JE_ZSCORE. Creates two VIEWS only. Reads ERP_GL_EXTRACT (load_motors.sql), read-only.
-- Group = account x cost center over all history (2025-10..2026-03). STDDEV is the sample standard deviation.
-- Thresholds are parameters in the p CTE, not truths. The line itself is part of its group's statistics.
-- NULL handling: a group with 1 line (STDDEV NULL) or identical amounts (STDDEV 0) gets z = NULL and flag FALSE.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_JE_STATS AS
SELECT account, cost_center, COUNT(*) AS n,
 AVG(amount) AS mean_amount, STDDEV(amount) AS sd_amount,
 PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY amount) AS q1,
 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY amount) AS median_amount,
 PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY amount) AS q3
FROM ERP_GL_EXTRACT
GROUP BY account, cost_center;

CREATE OR REPLACE VIEW V_JE_ZSCORE AS
WITH p AS (SELECT 3 AS z_limit)
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount,
 s.n, s.mean_amount, s.sd_amount,
 IFF(s.sd_amount IS NULL OR s.sd_amount = 0, NULL, (e.amount - s.mean_amount) / s.sd_amount) AS z,
 COALESCE(ABS(IFF(s.sd_amount IS NULL OR s.sd_amount = 0, NULL, (e.amount - s.mean_amount) / s.sd_amount)) > p.z_limit, FALSE) AS flag
FROM ERP_GL_EXTRACT e
JOIN V_JE_STATS s ON s.account = e.account AND s.cost_center = e.cost_center
CROSS JOIN p;
