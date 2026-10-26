-- Step 3: per-unit view at model level (all plants, all markets).
-- Cost per vehicle = SUM(allocated cost) / SUM(units produced). Net price = SUM(net revenue) / SUM(units sold).
-- Ratios are recomputed from totals, never averaged or summed.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_UNIT_ECONOMICS AS
WITH c AS (
 SELECT model, period, version, SUM(allocated_cost) AS cost, SUM(units_produced) AS units_produced
 FROM V_COST_PER_VEHICLE GROUP BY model, period, version
), s AS (
 SELECT model, period, version, SUM(net_revenue) AS net_revenue, SUM(units_sold) AS units_sold
 FROM FACT_VEHICLE_SALES GROUP BY model, period, version
)
SELECT COALESCE(c.model, s.model) AS model, COALESCE(c.period, s.period) AS period, COALESCE(c.version, s.version) AS version,
 c.units_produced, c.cost, s.units_sold, s.net_revenue,
 c.cost / NULLIF(c.units_produced, 0) AS cost_per_vehicle,
 s.net_revenue / NULLIF(s.units_sold, 0) AS net_price_per_vehicle,
 s.net_revenue / NULLIF(s.units_sold, 0) - c.cost / NULLIF(c.units_produced, 0) AS contribution_per_vehicle
FROM c
FULL OUTER JOIN s ON s.model = c.model AND s.period = c.period AND s.version = c.version;
-- Contribution per vehicle mixes a sold-unit price with a produced-unit cost on purpose: cost follows the factory,
-- price follows the customer. If units sold and produced differ a lot, read the gap as inventory, not margin.
