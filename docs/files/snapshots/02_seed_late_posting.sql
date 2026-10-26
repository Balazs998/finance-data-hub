-- FDH_DEMO fictional sample only.
-- RUN AFTER 03_take_snapshot.sql for period 2026-03.
-- Do not run this against the shared unmodified fact_actuals.csv used by other posts.
-- This script only INSERTS into the warehouse table FACT_ACTUALS so current differs from reported.
--
-- Expected totals for 2026-03 version Actual:
-- reported_total (snapshot) = 1,466,143.86 (58 rows, from fact_actuals.csv)
-- late_amount = 2,500.00 (this INSERT)
-- current_total after seed = 1,468,643.86 (59 rows)
-- V_SNAPSHOT_VS_CURRENT SUM(diff) = 2,500.00

USE SCHEMA FDH_DEMO.SAMPLE;

-- Guard: refuse if no snapshot exists for 2026-03 yet.
SELECT COUNT(*) AS snapshot_rows_for_2026_03
FROM FACT_ACTUALS_SNAPSHOT
WHERE snapshot_period = '2026-03'
  AND version = 'Actual';
-- Expect 58. If 0, stop and run 03_take_snapshot.sql first.

INSERT INTO FACT_ACTUALS (cost_center, account, period, version, amount)
SELECT 'CC2000', '500000', '2026-03', 'Actual', 2500.00
WHERE NOT EXISTS (
    SELECT 1
    FROM FACT_ACTUALS
    WHERE cost_center = 'CC2000'
      AND account = '500000'
      AND period = '2026-03'
      AND version = 'Actual'
      AND amount = 2500.00
);

-- Sanity check (current side only):
SELECT COUNT(*) AS current_rows,
       SUM(amount) AS current_total
FROM FACT_ACTUALS
WHERE period = '2026-03'
  AND version = 'Actual';
-- Expect: 59 rows, 1468643.86
