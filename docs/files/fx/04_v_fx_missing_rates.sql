-- FDH_DEMO fictional sample only.
-- Actual periods that have no month-end USD to EUR rate.
-- After 03_seed_fx_rates.sql this returns one row: 2026-05.
-- No grant. JEDOX_ETL_ROLE stays views-only and is not granted this view here.

USE SCHEMA FDH_DEMO.SAMPLE;

CREATE OR REPLACE VIEW V_FX_MISSING_RATES AS
SELECT
    a.period,
    COUNT(*) AS actual_rows,
    SUM(a.amount) AS amount_eur
FROM FACT_ACTUALS a
WHERE a.version = 'Actual'
  AND NOT EXISTS (
      SELECT 1
      FROM FX_RATE_PERIOD p
      WHERE p.period = a.period
        AND p.from_ccy = 'USD'
        AND p.to_ccy = 'EUR'
        AND p.rate_type = 'month_end'
  )
GROUP BY a.period
ORDER BY a.period;

SELECT COUNT(*) AS gap_count
FROM V_FX_MISSING_RATES;
-- Expect 1.

SELECT period
FROM V_FX_MISSING_RATES
ORDER BY period;
-- Expect one row: 2026-05.
