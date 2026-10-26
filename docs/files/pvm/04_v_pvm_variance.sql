-- Step 4: price / volume / mix, Actual vs Budget, at model x market grain. Snowflake computes it, Jedox only stores it.
-- 0 = Budget, 1 = Actual. Continuing row = model x market present in both versions for the period.
-- Qt = total units of continuing rows. mix = row units / Qt. P = net revenue / units.
-- Price = (P1 - P0) x Q1 = r1 - r0 x q1 / q0
-- Volume = (Q1t - Q0t) x mix0 x P0 = (Q1t - Q0t) x r0 / Q0t
-- Mix = (mix1 - mix0) x Q1t x P0 = r0 x q1 / q0 - r0 x Q1t / Q0t
-- New = Actual revenue of rows with no Budget. Lost = minus Budget revenue of rows with no Actual. Both excluded from Qt.
-- Price + Volume + Mix + New + Lost = Actual revenue - Budget revenue, exactly. Mix is computed, never a plug.
-- Each effect uses one division, so there is no rounded unit price inside. Round only when you display totals.
-- Only periods with at least one Actual row are compared; load a month's actuals completely before reading it.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_PVM_VARIANCE AS
WITH b AS (
 SELECT model, market, period, units_sold AS q0, net_revenue AS r0 FROM FACT_VEHICLE_SALES WHERE version = 'Budget'
), a AS (
 SELECT model, market, period, units_sold AS q1, net_revenue AS r1 FROM FACT_VEHICLE_SALES WHERE version = 'Actual'
), j AS (
 SELECT COALESCE(a.model, b.model) AS model, COALESCE(a.market, b.market) AS market, COALESCE(a.period, b.period) AS period,
 b.q0, b.r0, a.q1, a.r1
 FROM a FULL OUTER JOIN b ON b.model = a.model AND b.market = a.market AND b.period = a.period
 WHERE COALESCE(a.period, b.period) IN (SELECT DISTINCT period FROM a)
), t AS (
 SELECT period, SUM(q0) AS q0t, SUM(q1) AS q1t FROM j WHERE q0 IS NOT NULL AND q1 IS NOT NULL GROUP BY period
)
SELECT j.model, j.market, j.period,
 CASE WHEN j.q0 IS NULL THEN 'NEW' WHEN j.q1 IS NULL THEN 'LOST' ELSE 'CONTINUING' END AS row_type,
 j.q0, j.q1, j.r0, j.r1, t.q0t, t.q1t,
 IFF(j.q0 IS NOT NULL AND j.q1 IS NOT NULL, j.r1 - j.r0 * j.q1 / j.q0, 0) AS price_effect,
 IFF(j.q0 IS NOT NULL AND j.q1 IS NOT NULL, (t.q1t - t.q0t) * j.r0 / t.q0t, 0) AS volume_effect,
 IFF(j.q0 IS NOT NULL AND j.q1 IS NOT NULL, j.r0 * j.q1 / j.q0 - j.r0 * t.q1t / t.q0t, 0) AS mix_effect,
 IFF(j.q0 IS NULL, j.r1, 0) AS new_effect,
 IFF(j.q1 IS NULL, -j.r0, 0) AS lost_effect,
 IFF(j.q0 IS NULL, j.r1, 0) + IFF(j.q1 IS NULL, -j.r0, 0) AS new_lost_effect,
 COALESCE(j.r1, 0) - COALESCE(j.r0, 0) AS revenue_delta
FROM j
JOIN t ON t.period = j.period;
-- Unit-cost changes are not in here. They live in V_COST_PER_VEHICLE, never folded into Price.
