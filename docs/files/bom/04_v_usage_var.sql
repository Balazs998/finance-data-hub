-- Step 3b: V_USAGE_VAR. Usage variance = (actual qty - std qty for units built) x std cost, per plant, part, period.
-- Creates a view only. The demo has no consumption table, so PART_PURCHASE qty stands in for actual usage.
-- Std qty = Actual units_produced (FACT_PRODUCTION) x extended qty from V_BOM_EXPLODED. M-C has no BOM, so it adds no std qty.
-- NULL handling: FULL OUTER JOIN, missing side = 0 qty. Usage variance is NULL when the part has no std cost.
-- Only periods that have purchases are compared. Unrounded; round only totals.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_USAGE_VAR AS
WITH std_qty AS (
 SELECT f.plant, e.part, f.period, SUM(f.units_produced * e.ext_qty) AS std_qty
 FROM FACT_PRODUCTION f
 JOIN V_BOM_EXPLODED e ON e.model = f.model AND e.period = f.period AND e.part_type = 'PART'
 WHERE f.version = 'Actual'
 GROUP BY f.plant, e.part, f.period
), act AS (
 SELECT plant, part, period, SUM(qty) AS actual_qty FROM PART_PURCHASE GROUP BY plant, part, period
), j AS (
 SELECT COALESCE(a.plant, s.plant) AS plant, COALESCE(a.part, s.part) AS part, COALESCE(a.period, s.period) AS period,
 COALESCE(a.actual_qty, 0) AS actual_qty, COALESCE(s.std_qty, 0) AS std_qty
 FROM act a FULL OUTER JOIN std_qty s ON s.plant = a.plant AND s.part = a.part AND s.period = a.period
)
SELECT j.plant, j.part, j.period, j.actual_qty, j.std_qty, c.std_cost,
 (j.actual_qty - j.std_qty) * c.std_cost AS usage_var
FROM j
LEFT JOIN STD_COST c ON c.part = j.part AND c.period = j.period
WHERE j.period IN (SELECT DISTINCT period FROM PART_PURCHASE);
