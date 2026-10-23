-- FDH_DEMO fictional sample only.
-- Compare to what we sent for 2026-03, run ME_CLOSE_2026_03_R1.
-- Run after: 01 DDL, then 03 snapshot, then 02 late seed, then 04 view.
--
-- Expected after the late-posting seed:
-- reported_total = 1,466,143.86
-- current_total = 1,468,643.86
-- SUM(diff) = 2,500.00
-- one cell with diff <> 0: CC2000 / 500000 / Material Cost / +2500.00

USE SCHEMA FDH_DEMO.SAMPLE;

-- Pack totals
SELECT
    SUM(reported_amount) AS reported_total,
    SUM(current_amount) AS current_total,
    SUM(diff) AS diff_total,
    COUNT_IF(diff <> 0) AS cells_changed
FROM V_SNAPSHOT_VS_CURRENT
WHERE snapshot_period = '2026-03'
  AND run_id = 'ME_CLOSE_2026_03_R1'
  AND period = '2026-03'
  AND version = 'Actual';

-- Cells that moved after we sent the pack
SELECT
    cost_center,
    account,
    period,
    reported_amount,
    current_amount,
    diff
FROM V_SNAPSHOT_VS_CURRENT
WHERE snapshot_period = '2026-03'
  AND run_id = 'ME_CLOSE_2026_03_R1'
  AND period = '2026-03'
  AND version = 'Actual'
  AND diff <> 0
ORDER BY cost_center, account;
-- Expect one row: CC2000, 500000, 2026-03, 0.00, 2500.00, 2500.00
