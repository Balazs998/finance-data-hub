-- FDH_DEMO fictional sample only.
-- Rates are fictional, not market rates. Daily rows are labeled FDH_FICTIONAL.
-- EUR per 1 unit of from_ccy: USD to EUR 0.900000, EUR to EUR 1.000000.
-- Period rates cover every Actual period except 2026-05 (the seeded gap).
-- month_end and average both store that same fictional rate in this demo.
-- Daily rates are weekdays from 2025-10-01 through 2026-08-31,
-- skipping the fictional holiday 2026-03-17.
-- locked stays FALSE until 06_period_lock_and_snapshot.sql.
--
-- Idempotent: these demo tables are reloaded in full.

USE SCHEMA FDH_DEMO.SAMPLE;

DELETE FROM FX_RATE_DAILY;
DELETE FROM FX_RATE_PERIOD;

INSERT INTO FX_RATE_PERIOD (
    period,
    from_ccy,
    to_ccy,
    rate_type,
    rate,
    locked
)
SELECT
    p.period,
    pairs.from_ccy,
    pairs.to_ccy,
    types.rate_type,
    pairs.rate,
    FALSE
FROM (
    SELECT '2025-10' AS period
    UNION ALL SELECT '2025-11'
    UNION ALL SELECT '2025-12'
    UNION ALL SELECT '2026-01'
    UNION ALL SELECT '2026-02'
    UNION ALL SELECT '2026-03'
    UNION ALL SELECT '2026-04'
    UNION ALL SELECT '2026-06'
    UNION ALL SELECT '2026-07'
    UNION ALL SELECT '2026-08'
) AS p
CROSS JOIN (
    SELECT 'USD' AS from_ccy, 'EUR' AS to_ccy, 0.900000 AS rate
    UNION ALL
    SELECT 'EUR', 'EUR', 1.000000
) AS pairs
CROSS JOIN (
    SELECT 'month_end' AS rate_type
    UNION ALL
    SELECT 'average'
) AS types;

INSERT INTO FX_RATE_DAILY (
    rate_date,
    from_ccy,
    to_ccy,
    rate,
    source
)
SELECT
    spine.rate_date,
    'USD',
    'EUR',
    0.900000,
    'FDH_FICTIONAL'
FROM (
    SELECT DATEADD('day', ROW_NUMBER() OVER (ORDER BY SEQ4()) - 1, DATE '2025-10-01') AS rate_date
    FROM TABLE(GENERATOR(ROWCOUNT => 335))
) AS spine
WHERE spine.rate_date <= DATE '2026-08-31'
  AND DAYOFWEEKISO(spine.rate_date) BETWEEN 1 AND 5
  AND spine.rate_date <> DATE '2026-03-17';

-- Gap check. Same filters as V_FX_MISSING_RATES. Expect 1 period: 2026-05.
SELECT
    a.period,
    COUNT(*) AS actual_rows,
    SUM(a.amount) AS amount_eur
FROM FACT_ACTUALS AS a
WHERE a.version = 'Actual'
  AND NOT EXISTS (
      SELECT 1
      FROM FX_RATE_PERIOD AS p
      WHERE p.period = a.period
        AND p.from_ccy = 'USD'
        AND p.to_ccy = 'EUR'
        AND p.rate_type = 'month_end'
  )
GROUP BY a.period
ORDER BY a.period;
