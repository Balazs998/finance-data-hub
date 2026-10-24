---
title: "ASOF JOIN for the latest FX rate you actually have"
description: "A short free pattern: use Snowflake ASOF JOIN to pick the prior daily FX rate when a posting date has no exact match, with the official null-pad and tie caveats."
---

# ASOF JOIN for the latest FX rate you actually have

<p class="post-meta">Snowflake</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>ASOF JOIN behavior follows the Snowflake docs linked below. We have not run these steps on a live account. Demo rates are fictional (USD 0.9000 EUR per 1 USD), not market rates.</p>
</aside>

Journals do not only post on rate-feed days. Weekends, holidays, and late rate loads leave holes. An inner join to the rate table drops those rows or blanks the converted amount. [ASOF JOIN](https://docs.snowflake.com/en/sql-reference/constructs/asof-join) keeps every posting and attaches the closest prior rate.

This teaser is the free pattern only. Missing-month alerts and a locked converted snapshot after close live in the [full FX rate-lock post](fx-rate-lock.md).

## What you'll build

- One ASOF query over fictional `FX_RATE_DAILY`
- A holiday fallback (prior business day) and a null-pad example (no rate at all)

## Before you start

!!! info "You'll need"
    - Role: `SYSADMIN` on `FDH_DEMO.SAMPLE`
    - Tables from the FX pack: run `01_fx_rate_daily_ddl.sql` and `03_seed_fx_rates.sql` (see [Downloads](fx-rate-lock.md#downloads) on the full post)
    - Product: ASOF JOIN per current Snowflake docs (not live-tested here)

## The sample slice

`FX_RATE_DAILY` holds fictional USD→EUR rates at **0.900000** on business days. The seed skips weekends and a fictional holiday **2026-03-17**, so that date has no exact row. Convert with `ROUND(amount_eur / rate, 2)` (EUR per 1 USD, same convention as the site FX_RATE cube).

## The pattern

Filter the currency pair in a subquery. ASOF `ON` / `USING` is for equality between left and right columns — not for literals like `from_ccy = 'USD'`.

```sql title="05_asof_join_convert.sql (excerpt)"
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
```

## What you should see

| posting_date | rate_date_used | amount_usd |
|---|---|---:|
| 2026-03-16 | 2026-03-16 | 1111.11 |
| 2026-03-17 | 2026-03-16 (holiday fallback) | 1111.11 |
| 2026-03-18 | 2026-03-18 | 1111.11 |
| 2025-09-01 | NULL | NULL |

The last row is the alert case: ASOF cannot invent a rate that never existed. Wire that into a missing-rate check before the pack goes out (full post).

!!! warning "Docs caveats"
    No match → right-side columns are **NULL-padded** (like a left outer join). Identical timestamps on the right → Snowflake returns **one** tying row **non-deterministically**. Do not seed duplicate `rate_date` ties if you need stable totals. See [ASOF JOIN](https://docs.snowflake.com/en/sql-reference/constructs/asof-join).

## When not to use ASOF alone

Once a period is closed, every cell in the sent pack should use the **same** locked month-end (or average) rate — not whichever prior day ASOF happened to find. That lock-and-snapshot path is the rest of the [FX rate-lock tutorial](fx-rate-lock.md), including `V_FX_MISSING_RATES` and a restatement proof.

## Wrap-up

- ASOF fills calendar gaps; it does not replace a missing-month alert.
- Filter the rate pair in a subquery; keep `MATCH_CONDITION` for time.
- Read the null-pad and tie caveats before you trust a total.

## Downloads

Use the same `fx/` SQL pack as the [full tutorial](fx-rate-lock.md#downloads) (`01_fx_rate_daily_ddl.sql`, `03_seed_fx_rates.sql`, and `05_asof_join_convert.sql` are enough for this teaser).
