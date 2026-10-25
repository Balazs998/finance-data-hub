-- FDH_DEMO fictional sample only.
-- Lock the 2026-03 month-end USD to EUR rate, then freeze converted cells.
-- Run this BEFORE 07_restate_after_lock_demo.sql.
-- The seed rate is still 0.900000 when this script runs.
--
-- Convert with ROUND(amount / rate, 2) per cell, then SUM.
-- Do not use ROUND(SUM(amount) / rate, 2). On this sample that is 0.01 higher.
--
-- Expected for 2026-03 Actual / FX_CLOSE_2026_03_R1:
-- 58 rows
-- SUM(amount_eur) = 1,466,143.86
-- SUM(amount_usd) = 1,629,048.72
-- rate_used = 0.900000

USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE TABLE IF NOT EXISTS FACT_ACTUALS_FX_SNAPSHOT (
    cost_center VARCHAR(16),
    account VARCHAR(16),
    period VARCHAR(7),
    version VARCHAR(16),
    amount_eur NUMBER(18, 2),
    amount_usd NUMBER(18, 2),
    rate_used NUMBER(18, 6),
    rate_type VARCHAR(16),
    snapshot_period VARCHAR(7),
    run_id VARCHAR(32),
    snapshot_at TIMESTAMP_NTZ,
    sent_flag BOOLEAN
);

-- Idempotent for this demo run_id.
DELETE FROM FACT_ACTUALS_FX_SNAPSHOT
WHERE snapshot_period = '2026-03'
  AND run_id = 'FX_CLOSE_2026_03_R1';

UPDATE FX_RATE_PERIOD
SET locked = TRUE
WHERE period = '2026-03'
  AND from_ccy = 'USD'
  AND to_ccy = 'EUR'
  AND rate_type = 'month_end';

INSERT INTO FACT_ACTUALS_FX_SNAPSHOT (
    cost_center,
    account,
    period,
    version,
    amount_eur,
    amount_usd,
    rate_used,
    rate_type,
    snapshot_period,
    run_id,
    snapshot_at,
    sent_flag
)
SELECT
    a.cost_center,
    a.account,
    a.period,
    a.version,
    a.amount,
    ROUND(a.amount / p.rate, 2),
    p.rate,
    p.rate_type,
    '2026-03',
    'FX_CLOSE_2026_03_R1',
    CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,
    TRUE
FROM FACT_ACTUALS a
JOIN FX_RATE_PERIOD p
    ON p.period = a.period
   AND p.from_ccy = 'USD'
   AND p.to_ccy = 'EUR'
   AND p.rate_type = 'month_end'
WHERE a.period = '2026-03'
  AND a.version = 'Actual'
  AND p.locked = TRUE;

SELECT COUNT(*) AS snapshot_rows,
       SUM(amount_eur) AS snapshot_eur,
       SUM(amount_usd) AS snapshot_usd,
       MAX(rate_used) AS rate_used
FROM FACT_ACTUALS_FX_SNAPSHOT
WHERE run_id = 'FX_CLOSE_2026_03_R1'
  AND sent_flag = TRUE;
-- Expect: 58, 1466143.86, 1629048.72, 0.900000

-- Do not grant JEDOX_ETL_ROLE on FACT_ACTUALS_FX_SNAPSHOT.
-- That role stays views-only. This walkthrough adds no grants.
