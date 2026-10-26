-- Step 1: V_BOM_EXPLODED. Recursive walk from each vehicle down to its parts, per period.
-- Creates a view only (no tables, no grants). Tables come from load_motors.sql (MOTORS_STAGE / CSV_HDR).
-- NULL handling: valid_to NULL means "still valid". A BOM line counts in a period if it is valid on the 1st of that month.
-- Depth guard: the walk stops at depth 10. The demo BOM is three levels (depth 0-2): vehicle 0 (no row of its own), assembly 1, part 2, so it never gets close.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_BOM_EXPLODED AS
WITH RECURSIVE per AS (
 SELECT DISTINCT period, TO_DATE(period || '-01') AS period_start FROM STD_COST
), walk (model, period, period_start, parent_part, part, ext_qty, depth, path) AS (
 SELECT b.parent_part, p.period, p.period_start, b.parent_part, b.child_part, b.qty_per, 1,
 b.parent_part || '>' || b.child_part
 FROM BOM b JOIN DIM_PART v ON v.part = b.parent_part AND v.part_type = 'VEH'
 CROSS JOIN per p
 WHERE b.valid_from <= p.period_start AND (b.valid_to IS NULL OR b.valid_to >= p.period_start)
 UNION ALL
 SELECT w.model, w.period, w.period_start, b.parent_part, b.child_part, w.ext_qty * b.qty_per, w.depth + 1,
 w.path || '>' || b.child_part
 FROM walk w JOIN BOM b ON b.parent_part = w.part
 WHERE b.valid_from <= w.period_start AND (b.valid_to IS NULL OR b.valid_to >= w.period_start)
 AND w.depth < 10
)
SELECT w.model, w.period, w.part, d.part_type, w.depth, w.ext_qty, w.path
FROM walk w JOIN DIM_PART d ON d.part = w.part;
