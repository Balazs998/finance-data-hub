-- Step 2: plant cost -> plant x model by UNITS PRODUCED (never units sold), then cost per vehicle.
-- allocated_cost = plant_cost x model units / plant units. cost_per_vehicle = allocated_cost / model units.
-- A model with 0 units gets 0 cost (the other models carry it) and a NULL cost per vehicle, never a divide-by-zero.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_COST_PER_VEHICLE AS
WITH p AS (
 SELECT plant, model, period, version, units_produced,
 SUM(units_produced) OVER (PARTITION BY plant, period, version) AS plant_units
 FROM FACT_PRODUCTION
)
SELECT p.plant, p.model, p.period, p.version, p.units_produced, p.plant_units, c.plant_cost,
 IFF(p.plant_units = 0, 0, c.plant_cost * p.units_produced / p.plant_units) AS allocated_cost,
 IFF(p.units_produced = 0, NULL, c.plant_cost / p.plant_units) AS cost_per_vehicle
FROM p
JOIN V_PLANT_COST c ON c.plant = p.plant AND c.period = p.period AND c.version = p.version;
-- Note: allocated_cost / units_produced simplifies to plant_cost / plant_units, so every model in one
-- plant-month gets the same cost per vehicle. That is the honest result of a pure units allocation.
