-- Step 4: checks. Expected values are in README.md. Round only here, after summing.
USE SCHEMA FDH_DEMO.MOTORS;

-- a) Depth guard: rows that hit the limit (expect 0). Any row here means a cycle or a BOM deeper than 10.
SELECT COUNT(*) AS rows_at_limit FROM V_BOM_EXPLODED WHERE depth >= 10;

-- b) Missing std cost: parts used in a BOM with no std cost for the period (expect 1: P-TRIM-B, 2026-05)
SELECT DISTINCT e.part, e.period
FROM V_BOM_EXPLODED e LEFT JOIN STD_COST s ON s.part = e.part AND s.period = e.period
WHERE e.part_type = 'PART' AND s.std_cost IS NULL;

-- c) Rolled std cost per vehicle (expect M-A 2026-03 8,310.10; M-B 2026-03 11,707.40; M-B 2026-04 11,323.40; M-B 2026-05 NULL)
SELECT model, period, missing_std_parts, ROUND(std_cost_per_vehicle, 2) AS std_cpv
FROM V_STD_COST_ROLLUP WHERE period IN ('2026-03', '2026-04', '2026-05') ORDER BY model, period;

-- d) PPV by period (expect 2026-03 46,159.51; all periods 81,940.27; purchases without std 0)
SELECT period, ROUND(SUM(ppv), 2) AS ppv, COUNT_IF(NOT has_std) AS no_std
FROM V_PPV GROUP BY ROLLUP (period) ORDER BY period NULLS LAST;
-- ROLLUP adds a grand-total row (period NULL), listed last

-- e) Biggest PPV part, 2026-03 (expect P-ECU-01 42,000.00)
SELECT part, ROUND(SUM(ppv), 2) AS ppv FROM V_PPV WHERE period = '2026-03' GROUP BY part ORDER BY SUM(ppv) DESC LIMIT 3;

-- f) Usage variance, non-zero rows (expect 1: P300 / P-PANEL-B / 2026-03, 124.20 vs 115 x 420.00 = 3,864.00)
SELECT plant, part, period, actual_qty, std_qty, std_cost, ROUND(usage_var, 2) AS usage_var
FROM V_USAGE_VAR WHERE actual_qty IS DISTINCT FROM std_qty ORDER BY ABS(usage_var) DESC;
