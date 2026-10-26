---
date: 2026-10-23
title: "Snowflake FX rate lock for month-end close"
description: "Catch missing FX rates, convert with ASOF JOIN or month-end rates, and freeze a locked snapshot so a late restatement cannot move the sent total."
social_image: fx-rate-lock.png
---

# FX conversion that survives close: rate choice, missing rates, and a period lock

<p class="post-meta">Snowflake</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>ASOF JOIN null-padding and non-deterministic ties follow the Snowflake docs linked in the steps. We have not run ASOF on a live account. Check numbers below were derived from the unmodified sample CSV and the fictional FX seed (per-cell <code>ROUND</code> then <code>SUM</code>). Every total was recomputed from the sample CSVs.</p>
</aside>

Month-end packs in multi-currency companies fail in two quiet ways. A missing FX rate turns a join into NULL and the USD total looks fine until someone notices a whole entity vanished. Or the rate gets restated after close and every historical pack silently moves. This post builds rate tables with a missing-rate check, an ASOF JOIN path for "latest available," and a locked converted snapshot so the number you sent stays the number you sent.

The lock is the same idea as [What number did we report? Permanent month-end snapshots vs Time Travel](month-end-snapshots.md). Time Travel is not a permanent audit freeze. This page freezes the converted USD total the same way.

## What you'll build

- Tables `FX_RATE_DAILY` and `FX_RATE_PERIOD` (fictional rates aligned with the site FX_RATE cube)
- View `V_FX_MISSING_RATES` that returns exactly the seeded gap
- An ASOF JOIN convert query (with docs caveats) and a month-end exact path
- A locked `FACT_ACTUALS_FX_SNAPSHOT` for 2026-03, plus a restatement demo that proves the pack does not move

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="FX rate lookup flow">
  <a href="../fx-rate-lookup-diagram.svg"><img src="../fx-rate-lookup-diagram.svg" alt="Flow: try exact month-end rate for the period; if the calendar day has no rate, ASOF JOIN takes the latest prior daily rate; if no rate exists at all, V_FX_MISSING_RATES raises a gap alert before the pack goes out." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) for create, seed, lock, and snapshot in `FDH_DEMO.SAMPLE`. Leave `JEDOX_ETL_ROLE` unchanged — that role stays views-only. This tutorial needs no grants on the new FX tables or snapshot.
    - Product version: any current Snowflake account that can run the SQL below. ASOF JOIN follows the docs linked in step 5 (docs-based; not run on a live account here).
    - Previous post: [What number did we report? Permanent month-end snapshots vs Time Travel](month-end-snapshots.md) (lock/snapshot pattern this post reuses)
    - Sample data: unmodified `fact_actuals.csv` (610 rows) plus the [Downloads](#downloads) FX SQL pack

## The sample scenario

Treat `FACT_ACTUALS` amounts as **EUR**. We convert them to **USD** for a fictional reporting pack. Rates are **fictional**, not market rates, and match the dictionary FX_RATE cube example: EUR **1.0000**, USD **0.9000** (EUR per 1 USD). Convert with `amount_usd = ROUND(amount_eur / rate, 2)` per cell.

In Snowflake the column is `COST_CENTER`; in prose we say cost center. Periods are `YYYY-MM` text. The management-report sample uses a different entity/code scheme (E100/E210); this post stays on FDH_DEMO cost centers and does not mix those codes.

We freeze **2026-03** Actual (unmodified CSV: **58** rows / **1,466,143.86** EUR). The seed omits period rates for **2026-05** so the missing-rate view has exactly **one** gap. After lock we restate the live 2026-03 month-end rate from 0.9000 to 0.9100; the snapshot must stay put.

| File | What's in it |
|---|---|
| `01_fx_rate_daily_ddl.sql` | Create `FX_RATE_DAILY` |
| `02_fx_rate_period_ddl.sql` | Create `FX_RATE_PERIOD` (`locked` flag) |
| `03_seed_fx_rates.sql` | Fictional daily + period rates; omit 2026-05 |
| `04_v_fx_missing_rates.sql` | Gap view |
| `05_asof_join_convert.sql` | ASOF path + docs caveats |
| `06_period_lock_and_snapshot.sql` | Lock + `FACT_ACTUALS_FX_SNAPSHOT` |
| `07_restate_after_lock_demo.sql` | Change rate after lock; prove pack unchanged |

## 1. Rate choice is a finance decision

Month-end, average, and daily rates answer different questions. Controllers pick the policy; Snowflake stores whatever they chose. This pack models both `month_end` and `average` on `FX_RATE_PERIOD`, and calendar days on `FX_RATE_DAILY` for lookups between closes. We do **not** tell you which rate type is "correct" — only how to apply one consistently and freeze it after close.

Validity windows (valid_from / valid_to) are a common warehouse pattern for slowly changing rates. Here the daily table is one row per rate date, and ASOF JOIN supplies the "latest on or before" window without an extra valid_to column.

## 2. Daily and period rate tables

```sql title="01_fx_rate_daily_ddl.sql"
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE TABLE IF NOT EXISTS FX_RATE_DAILY (
    rate_date DATE,
    from_ccy VARCHAR(3),
    to_ccy VARCHAR(3),
    rate NUMBER(18, 6),
    source VARCHAR(32)
);
```

```sql title="02_fx_rate_period_ddl.sql"
CREATE TABLE IF NOT EXISTS FX_RATE_PERIOD (
    period VARCHAR(7),
    from_ccy VARCHAR(3),
    to_ccy VARCHAR(3),
    rate_type VARCHAR(16),
    rate NUMBER(18, 6),
    locked BOOLEAN
);
```

Convention in this demo: `from_ccy` / `to_ccy` / `rate` means **EUR per 1 unit of `from_ccy`** (USD → EUR at 0.9000). That matches the Jedox FX_RATE cube values in the data dictionary. Label every seed row `FDH_FICTIONAL` in `source` so nobody mistakes it for a market feed.

!!! warning "Don't grant the ETL role tables"
    `JEDOX_ETL_ROLE` reads views only. This pack adds no grants. Run this walkthrough as `SYSADMIN`.

## 3. Seed rates — and one deliberate gap

Run `03_seed_fx_rates.sql`. It loads fictional EUR/USD rates for Actual periods **except 2026-05**, skips weekends and a fictional holiday (**2026-03-17**) on the daily table, and leaves every `locked` flag `FALSE` until the freeze step.

After seed, the gap check in the script should return **1**.

## 4. Catch missing rates before the pack

```sql title="04_v_fx_missing_rates.sql"
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
```

You should see **one** row: period `2026-05`. Fix the feed (or block the pack) before anyone converts that month.

## 5. ASOF JOIN for "latest available"

When a journal date has no exact daily rate (weekend, holiday, late load), [ASOF JOIN](https://docs.snowflake.com/en/sql-reference/constructs/asof-join) picks the closest prior rate. Filter the currency pair in a subquery first — ASOF `ON`/`USING` must be equality between left and right columns, not literals.

```sql title="05_asof_join_convert.sql"
WITH postings AS (
    SELECT DATE '2026-03-17' AS posting_date, 1000.00 AS amount_eur
    -- … more demo dates in the download
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

On the seeded data, `2026-03-17` (holiday) should fall back to `2026-03-16`. A posting before any seeded rate (`2025-09-01`) should null-pad. The four demo dates, including `1000.00` → `1111.11`, are in the download and in [ASOF JOIN for the latest FX rate you actually have](asof-join.md).

!!! warning "Two ASOF traps from the docs"
    No match → right-side columns are **NULL-padded** (like a left outer join). Identical timestamps on the right → Snowflake returns **one** tying row **non-deterministically**. Do not seed duplicate `rate_date` ties if you need stable totals. See [ASOF JOIN](https://docs.snowflake.com/en/sql-reference/constructs/asof-join).

For a **closed** period, prefer the exact `FX_RATE_PERIOD` month-end (or average) rate — not ASOF — so every cell in the pack uses the same locked rate.

## 6. Lock the period and freeze a converted snapshot

Same idea as [month-end snapshots](month-end-snapshots.md): Time Travel is not a permanent audit freeze. Set `locked = TRUE` on the period rate, then copy converted cells into `FACT_ACTUALS_FX_SNAPSHOT`. The download creates that table and replaces any earlier rows for `FX_CLOSE_2026_03_R1` before the insert, so a rerun does not double the total.

```sql title="06_period_lock_and_snapshot.sql"
UPDATE FX_RATE_PERIOD
SET locked = TRUE
WHERE period = '2026-03'
  AND from_ccy = 'USD'
  AND to_ccy = 'EUR'
  AND rate_type = 'month_end';

INSERT INTO FACT_ACTUALS_FX_SNAPSHOT (
    cost_center, account, period, version,
    amount_eur, amount_usd, rate_used, rate_type,
    snapshot_period, run_id, snapshot_at, sent_flag
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
```

You should see **58** snapshot rows, EUR **1,466,143.86**, USD **1,629,048.72** (sum of per-cell `ROUND`; do not use `ROUND(SUM(amount)/rate, 2)` — it differs by 0.01 on this sample).

## 7. Restate a rate after lock — pack must not move

```sql title="07_restate_after_lock_demo.sql"
UPDATE FX_RATE_PERIOD
SET rate = 0.910000
WHERE period = '2026-03'
  AND from_ccy = 'USD'
  AND to_ccy = 'EUR'
  AND rate_type = 'month_end';
```

Live recompute at 0.9100 would give USD **1,611,147.13**. The sent snapshot must still total **1,629,048.72** at rate_used **0.900000**. Production systems often block `UPDATE` when `locked = TRUE`; this demo allows the change on purpose so the snapshot proof is visible.

## Check the result

!!! success "Expected: 1 gap; locked USD 1,629,048.72 unchanged after restatement"
    ```sql
    SELECT COUNT(*) AS gap_count FROM V_FX_MISSING_RATES;
    -- expect 1 (period 2026-05)

    SELECT SUM(amount_usd) AS snapshot_usd
    FROM FACT_ACTUALS_FX_SNAPSHOT
    WHERE run_id = 'FX_CLOSE_2026_03_R1' AND sent_flag = TRUE;
    -- expect 1629048.72 after 06 and still after 07
    ```
    Rerun the snapshot sum after the restatement script: the number must not change.

## If it doesn't match

- **Gap count is 0:** seed still has 2026-05 period rates, or you filtered the wrong `rate_type`. Re-run `03_seed_fx_rates.sql` and query the view again.
- **Gap count &gt; 1:** Actuals include a period the seed never covered, or `rate_type` / currency filters differ from the view. Align filters with `month_end` + `USD`→`EUR`.
- **Snapshot USD is 1,629,048.73:** you used `ROUND(SUM(amount)/rate, 2)` instead of summing per-cell `ROUND`. Use the INSERT in `06_period_lock_and_snapshot.sql`.
- **ASOF returns NULL on 2026-03-17:** daily seed missing March business days, or the subquery filter dropped `USD`/`EUR`. Re-seed `03_seed_fx_rates.sql`.
- **ASOF error on ON clause:** literals in `ON` are invalid for ASOF. Filter the pair in a subquery, as in `05_asof_join_convert.sql`.
- **Jedox feed fails later:** do not grant `JEDOX_ETL_ROLE` SELECT on the FX tables. This pack adds no grants.

## Optional: feed the Jedox FX_RATE cube

The site's Jedox model already has cube **FX_RATE** (dimensions Currency, Period, Measure; fictional EUR 1.0000 / USD 0.9000). A natural next step is an Integrator extract from a Snowflake view of `FX_RATE_PERIOD` filtered to `rate_type = 'month_end'` (unlocked or locked as your process defines) into that cube. Map Snowflake pairs into existing dims — do **not** invent From/To dimensions: USD→EUR **0.9000** → Currency=`USD` / Measure=`Rate`; EUR→EUR **1.0000** → Currency=`EUR` / Measure=`Rate`. Keep Period and Currency elements aligned with the data dictionary. This note does not ship those Integrator steps.

## Wrap-up

- Pick a rate type on purpose, store it, and document it on the pack.
- Fail closed on missing rates (`V_FX_MISSING_RATES`) before anyone converts.
- Use ASOF for calendar gaps; use locked period rates for the number you send.
- Freeze converted cells the same way you freeze [month-end snapshots](month-end-snapshots.md) — so a late restatement cannot rewrite history.

**Next:** [ASOF JOIN for the latest FX rate you actually have](asof-join.md) is the short pattern for a posting date with no exact daily rate. The pack above stays the rebuildable how-to.

## Downloads

All files use synthetic sample data and placeholder names. Rates are fictional, not market rates.

[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]
[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]
[[download:fx/01_fx_rate_daily_ddl.sql|Download 01_fx_rate_daily_ddl.sql]]
[[download:fx/02_fx_rate_period_ddl.sql|Download 02_fx_rate_period_ddl.sql]]
[[download:fx/03_seed_fx_rates.sql|Download 03_seed_fx_rates.sql]]
[[download:fx/04_v_fx_missing_rates.sql|Download 04_v_fx_missing_rates.sql]]
[[download:fx/05_asof_join_convert.sql|Download 05_asof_join_convert.sql]]
[[download:fx/06_period_lock_and_snapshot.sql|Download 06_period_lock_and_snapshot.sql]]
[[download:fx/07_restate_after_lock_demo.sql|Download 07_restate_after_lock_demo.sql]]
[[download:fx/README.md|Download README.md]]
