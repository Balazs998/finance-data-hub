-- Step 6: checks. Expected values are in README.md. Round only here, after summing.
USE SCHEMA FDH_DEMO.MOTORS;

-- a) Cost per vehicle, M-A at P200, 2026-03 (expect Actual 1,914.16, Budget 1,959.33)
SELECT version, units_produced, plant_cost, ROUND(cost_per_vehicle, 2) AS cpv
FROM V_COST_PER_VEHICLE WHERE plant = 'P200' AND model = 'M-A' AND period = '2026-03' ORDER BY version;

-- b) Allocation leaks nothing: plant cost total = expense total, per period and version (expect 0 rows)
WITH e AS (
 SELECT f.period, f.version, SUM(f.amount) AS expense FROM (
 SELECT account, period, version, amount FROM FDH_DEMO.SAMPLE.FACT_ACTUALS
 UNION ALL SELECT account, period, version, amount FROM FDH_DEMO.SAMPLE.FACT_BUDGET) f
 JOIN FDH_DEMO.SAMPLE.DIM_ACCOUNT a ON a.account = f.account AND a.account_type = 'EXPENSE'
 GROUP BY f.period, f.version
), p AS (SELECT period, version, SUM(plant_cost) AS plant_cost FROM V_PLANT_COST GROUP BY period, version)
SELECT e.period, e.version, e.expense, p.plant_cost FROM e LEFT JOIN p ON p.period = e.period AND p.version = e.version
WHERE ROUND(e.expense, 2) <> ROUND(COALESCE(p.plant_cost, 0), 2);

-- c) Zero-unit edge case: P300 / M-A / 2026-03 / Actual has 0 units, 0 cost, NULL cpv, and P300 M-B carries all (2,832.70)
SELECT plant, model, version, units_produced, allocated_cost, ROUND(cost_per_vehicle, 2) AS cpv
FROM V_COST_PER_VEHICLE WHERE plant = 'P300' AND period = '2026-03' AND version = 'Actual';

-- d) PVM 2026-03 totals and the check row (expect Price -5,336.52, Volume -18,242.22, Mix 96,130.22,
-- New 88,800.00, Lost -235,664.00, total -74,312.52, check 0.00)
SELECT ROUND(SUM(price_effect), 2) AS price, ROUND(SUM(volume_effect), 2) AS volume, ROUND(SUM(mix_effect), 2) AS mix,
 ROUND(SUM(new_effect), 2) AS new, ROUND(SUM(lost_effect), 2) AS lost,
 ROUND(SUM(price_effect + volume_effect + mix_effect + new_effect + lost_effect), 2) AS total_effects,
 ROUND(SUM(revenue_delta), 2) AS actual_minus_budget,
 ROUND(SUM(price_effect + volume_effect + mix_effect + new_effect + lost_effect - revenue_delta), 2) AS check_row,
 MAX(q0t) AS q0t, MAX(q1t) AS q1t
FROM V_PVM_VARIANCE WHERE period = '2026-03';

-- e) Check row for every compared period (expect 0.00 on every row)
SELECT period, ROUND(SUM(price_effect + volume_effect + mix_effect + new_lost_effect - revenue_delta), 2) AS check_row
FROM V_PVM_VARIANCE GROUP BY period ORDER BY period;

-- f) Per-unit view, 2026-03
SELECT model, version, units_produced, units_sold, ROUND(cost_per_vehicle, 2) AS cpv,
 ROUND(net_price_per_vehicle, 2) AS net_price, ROUND(contribution_per_vehicle, 2) AS contribution
FROM V_UNIT_ECONOMICS WHERE period = '2026-03' ORDER BY model, version;
