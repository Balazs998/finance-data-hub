-- FDH_DEMO fictional sample only.
-- Freeze one period and run into FACT_ACTUALS_SNAPSHOT.
-- Run this BEFORE 02_seed_late_posting.sql.
--
-- Defaults for the demo walkthrough:
-- snapshot_period = '2026-03'
-- run_id = 'ME_CLOSE_2026_03_R1'
-- sent_flag = TRUE (this is the pack we sent)
--
-- Expected for 2026-03 Actual from fact_actuals.csv:
-- 58 rows, SUM(amount) = 1,466,143.86

USE SCHEMA FDH_DEMO.SAMPLE;

-- Idempotent for this demo run_id: drop prior rows for the same period and run, then insert.
DELETE FROM FACT_ACTUALS_SNAPSHOT
WHERE snapshot_period = '2026-03'
  AND run_id = 'ME_CLOSE_2026_03_R1';

INSERT INTO FACT_ACTUALS_SNAPSHOT (
    cost_center,
    account,
    period,
    version,
    amount,
    snapshot_period,
    run_id,
    snapshot_at,
    sent_flag
)
SELECT
    cost_center,
    account,
    period,
    version,
    amount,
    '2026-03' AS snapshot_period,
    'ME_CLOSE_2026_03_R1' AS run_id,
    CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS snapshot_at,
    TRUE AS sent_flag
FROM FACT_ACTUALS
WHERE period = '2026-03'
  AND version = 'Actual';

SELECT COUNT(*) AS snapshot_rows,
       SUM(amount) AS snapshot_total,
       MAX(run_id) AS run_id
FROM FACT_ACTUALS_SNAPSHOT
WHERE snapshot_period = '2026-03'
  AND run_id = 'ME_CLOSE_2026_03_R1';
-- Expect: 58 rows, 1466143.86, ME_CLOSE_2026_03_R1

-- Second run same period (rerun story): change run_id to ME_CLOSE_2026_03_R2
-- and leave R1 in place. V_SNAPSHOT_VS_CURRENT filters on the run you sent.
