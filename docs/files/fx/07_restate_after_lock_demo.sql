-- FDH_DEMO fictional sample only.
-- RUN AFTER 06_period_lock_and_snapshot.sql.
-- Change the live 2026-03 month-end rate on purpose.
-- The sent snapshot must stay on the rate it stored.
--
-- Live recompute at 0.910000, per-cell ROUND then SUM: USD 1,611,147.13
-- Snapshot FX_CLOSE_2026_03_R1 stays: USD 1,629,048.72 at rate_used 0.900000

USE SCHEMA FDH_DEMO.SAMPLE;

UPDATE FX_RATE_PERIOD
SET rate = 0.910000
WHERE period = '2026-03'
  AND from_ccy = 'USD'
  AND to_ccy = 'EUR'
  AND rate_type = 'month_end';

-- What a fresh convert would say now.
SELECT SUM(ROUND(a.amount / p.rate, 2)) AS live_usd
FROM FACT_ACTUALS a
JOIN FX_RATE_PERIOD p
    ON p.period = a.period
   AND p.from_ccy = 'USD'
   AND p.to_ccy = 'EUR'
   AND p.rate_type = 'month_end'
WHERE a.period = '2026-03'
  AND a.version = 'Actual';
-- Expect 1611147.13

-- What was sent. This must not move.
SELECT SUM(amount_usd) AS snapshot_usd,
       MAX(rate_used) AS rate_used,
       COUNT(*) AS snapshot_rows
FROM FACT_ACTUALS_FX_SNAPSHOT
WHERE run_id = 'FX_CLOSE_2026_03_R1'
  AND sent_flag = TRUE;
-- Expect 1629048.72, 0.900000, 58
