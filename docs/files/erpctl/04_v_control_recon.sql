-- Step 5: V_CONTROL_RECON. Each hop compared with the hop before it, per run. VIEW ONLY.
-- Order: file -> snowflake -> snowflake_cells -> jedox. Row counts are compared only where the grain is the same
-- (file vs snowflake = lines; snowflake_cells vs jedox = cells). Control totals are compared at every step.
-- NULL handling: a missing hop (no LOAD_LOG row yet) gives NULL prev values and result MISSING_HOP, never a silent PASS.
-- A duplicate run (hop snowflake = DUPLICATE) shows DUPLICATE on every step and needs no Jedox row.
-- Order matters: the MISMATCH branches come before the WARNING branch, so a warning only passes (PASS_WARNING)
-- when count and total both match. A Jedox run with status 30 or higher writes no jedox row, so it shows MISSING_HOP (FAIL).
-- IS DISTINCT FROM is used so a NULL on either side counts as a difference.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_CONTROL_RECON AS
WITH steps AS (
 SELECT column1 AS step_no, column2 AS hop, column3 AS prev_hop, column4 AS compare_rows
 FROM VALUES (1, 'snowflake', 'file', TRUE), (2, 'snowflake_cells', 'snowflake', FALSE), (3, 'jedox', 'snowflake_cells', TRUE)
), runs AS (
 SELECT run_id, period, MAX(IFF(hop = 'snowflake' AND status = 'DUPLICATE', 1, 0)) AS is_dup
 FROM LOAD_LOG GROUP BY run_id, period
)
SELECT r.run_id, r.period, s.step_no, s.prev_hop, s.hop,
 p.rows AS prev_rows, c.rows AS hop_rows, p.control_total AS prev_total, c.control_total AS hop_total,
 c.control_total - p.control_total AS total_diff, c.status AS hop_status,
 CASE
 WHEN r.is_dup = 1 THEN 'DUPLICATE'
 WHEN p.run_id IS NULL OR c.run_id IS NULL THEN 'MISSING_HOP'
 WHEN c.control_total IS DISTINCT FROM p.control_total THEN 'MISMATCH'
 WHEN s.compare_rows AND c.rows IS DISTINCT FROM p.rows THEN 'MISMATCH'
 WHEN c.status = 'WARNING' THEN 'PASS_WARNING'
 ELSE 'PASS'
 END AS result
FROM runs r CROSS JOIN steps s
LEFT JOIN LOAD_LOG p ON p.run_id = r.run_id AND p.hop = s.prev_hop
LEFT JOIN LOAD_LOG c ON c.run_id = r.run_id AND c.hop = s.hop;
