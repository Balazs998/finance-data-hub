-- Step 3a: V_PPV. Purchase price variance = (actual unit price - std cost) x qty purchased, per part, plant, period.
-- Creates a view only. Positive = paid more than standard.
-- NULL handling: a purchase with no std cost for its period keeps ppv NULL and has_std = FALSE, so it shows up
-- instead of disappearing. Unrounded; round only totals.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_PPV AS
SELECT p.part, p.plant, p.period, p.qty, p.unit_price, s.std_cost,
 s.std_cost IS NOT NULL AS has_std,
 (p.unit_price - s.std_cost) * p.qty AS ppv
FROM PART_PURCHASE p
LEFT JOIN STD_COST s ON s.part = p.part AND s.period = p.period;
