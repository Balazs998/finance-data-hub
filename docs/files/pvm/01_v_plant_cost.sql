-- Step 1: cost center cost -> plant. FDH_DEMO fictional data only.
-- Expense accounts of FDH_DEMO.SAMPLE FACT_ACTUALS / FACT_BUDGET, split to plants by MAP_COST_CENTER_PLANT.alloc_pct.
-- Owner SYSADMIN. This pack adds no grants. JEDOX_ETL_ROLE stays views-only and is not touched here.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_PLANT_COST AS
WITH gl AS (
 SELECT cost_center, account, period, version, amount FROM FDH_DEMO.SAMPLE.FACT_ACTUALS
 UNION ALL
 SELECT cost_center, account, period, version, amount FROM FDH_DEMO.SAMPLE.FACT_BUDGET
)
SELECT m.plant, gl.period, gl.version, SUM(gl.amount * m.alloc_pct) AS plant_cost
FROM gl
JOIN FDH_DEMO.SAMPLE.DIM_ACCOUNT a ON a.account = gl.account AND a.account_type = 'EXPENSE'
JOIN MAP_COST_CENTER_PLANT m ON m.cost_center = gl.cost_center
GROUP BY m.plant, gl.period, gl.version;
-- Allocation leaks nothing when every cost center's alloc_pct sums to 1.00 (check b in 06_checks.sql).
