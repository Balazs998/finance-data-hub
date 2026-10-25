-- FDH_DEMO fictional sample only.
-- Latest prior daily USD to EUR rate when the posting date has no exact row.
-- Filter the currency pair in the subquery. ASOF ON / USING cannot take literals.
-- Run after 01_fx_rate_daily_ddl.sql and 03_seed_fx_rates.sql.
--
-- Expected on the seed (ROUND(amount_eur / rate, 2), rate 0.900000):
-- 2026-03-16 exact -> 2026-03-16, amount_usd 1111.11
-- 2026-03-17 holiday -> 2026-03-16, amount_usd 1111.11
-- 2026-03-18 exact -> 2026-03-18, amount_usd 1111.11
-- 2025-09-01 before any seeded rate -> rate_date_used NULL, amount_usd NULL
--
-- Docs: no match NULL-pads the right side. Duplicate rate_date ties are non-deterministic.
-- https://docs.snowflake.com/en/sql-reference/constructs/asof-join

USE SCHEMA FDH_DEMO.SAMPLE;

WITH postings AS (
    SELECT DATE '2026-03-16' AS posting_date, 1000.00 AS amount_eur
    UNION ALL
    SELECT DATE '2026-03-17', 1000.00
    UNION ALL
    SELECT DATE '2026-03-18', 1000.00
    UNION ALL
    SELECT DATE '2025-09-01', 1000.00
),
usd_rates AS (
    SELECT rate_date, rate
    FROM FX_RATE_DAILY
    WHERE from_ccy = 'USD'
      AND to_ccy = 'EUR'
)
SELECT
    p.posting_date,
    p.amount_eur,
    r.rate_date AS rate_date_used,
    r.rate AS eur_per_usd,
    CASE
        WHEN r.rate IS NULL THEN NULL
        ELSE ROUND(p.amount_eur / r.rate, 2)
    END AS amount_usd
FROM postings p
ASOF JOIN usd_rates r
    MATCH_CONDITION (p.posting_date >= r.rate_date)
ORDER BY p.posting_date;
