-- Step 2: V_STD_COST_ROLLUP. Standard cost per vehicle = sum of (extended qty x std cost) over purchased parts.
-- Creates a view only. Assemblies carry no std cost of their own; only part_type = 'PART' is costed.
-- NULL handling: if any part has no STD_COST row for the period, std_cost_per_vehicle is NULL (not a too-low number),
-- and missing_std_parts says how many parts are missing. Unrounded; round only in the checks.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_STD_COST_ROLLUP AS
SELECT e.model, e.period,
 COUNT(*) AS costed_lines,
 COUNT(*) - COUNT(s.std_cost) AS missing_std_parts,
 IFF(COUNT(*) = COUNT(s.std_cost), SUM(e.ext_qty * s.std_cost), NULL) AS std_cost_per_vehicle
FROM V_BOM_EXPLODED e
LEFT JOIN STD_COST s ON s.part = e.part AND s.period = e.period
WHERE e.part_type = 'PART'
GROUP BY e.model, e.period;
