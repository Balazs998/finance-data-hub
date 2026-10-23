---
title: "What number did we report? Permanent month-end snapshots vs Time Travel"
description: "Freeze a month of FDH_DEMO actuals into a snapshot table, seed a late posting, and compare reported vs current so you can answer audit questions after Time Travel has moved on."
social_image: month-end-snapshots.png
---

# What number did we report? Permanent month-end snapshots vs Time Travel

<p class="post-meta">Snowflake</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>Time Travel retention by edition, zero-copy clones, and Backups with retention lock follow the Snowflake docs linked in the steps. We have not run those product features on a live account. Check numbers below were verified from the pristine sample CSV and the warehouse-only late-post seed.</p>
</aside>

A partner asks what March number you sent last Friday. You open Snowflake, sum March again, and the total has moved: a late posting landed after the pack went out. Time Travel can rewind a table for a while, but it is not a permanent audit freeze, and a `CREATE OR REPLACE` (or other recreate) starts a new object without the old history. This post builds a permanent snapshot of what you reported, then a compare query against what the warehouse holds now.

This note is not [Month-end actuals](month-end-actuals.md). That page shapes a general-ledger journal into a P&L extract. This one freezes a month of made-up `FDH_DEMO` actuals after the pack has already gone out.

## What you'll build

- A snapshot table, `FACT_ACTUALS_SNAPSHOT`, keyed by period and run
- A one-shot freeze script for March 2026 (`ME_CLOSE_2026_03_R1`)
- A late-posting seed so current actuals diverge from the sent pack on purpose
- A view `V_SNAPSHOT_VS_CURRENT` and a "compare to what we sent" check query

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="Month-end snapshot timeline">
  <a href="../month-end-snapshots-timeline.svg"><img src="../month-end-snapshots-timeline.svg" alt="Timeline: period close, report sent from snapshot run ME_CLOSE_2026_03_R1 (58 rows, 1,466,143.86), a late posting of 2,500.00 into current actuals, then compare snapshot versus current (diff 2,500.00)." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) for create, freeze, and late-post seed in `FDH_DEMO.SAMPLE`. Leave `JEDOX_ETL_ROLE` unchanged. That role stays views-only. This tutorial needs no grants on `FACT_ACTUALS_SNAPSHOT` or `V_SNAPSHOT_VS_CURRENT`.
    - Product version: any current Snowflake account that can run the SQL below. Time Travel defaults and Backups availability vary by edition. The limits in the steps follow the Snowflake docs linked there.
    - Previous post: [Plan vs actuals](plan-vs-actuals.md) (optional; reuses the same `FACT_ACTUALS`)
    - Sample data: pristine `fact_actuals.csv` (610 rows) plus the [Downloads](#downloads) SQL pack

## The sample scenario

The made-up sample database `FDH_DEMO` holds `FACT_ACTUALS`: 610 rows of version `Actual` from 2025-10 through 2026-08. In Snowflake the column is `COST_CENTER`; in prose we say cost center. Periods are `YYYY-MM` text.

We freeze **2026-03** only. On the pristine CSV that slice is already verified:

| Slice | Rows | Total |
|---|---:|---:|
| `Actual`, `2026-03` | 58 | 1,466,143.86 |

After the freeze we insert one late Material Cost posting (`CC2000` / `500000` / `2,500.00`) into **warehouse** `FACT_ACTUALS` only. The shared CSV stays at 610 rows so other posts keep their check totals.

| File | What's in it |
|---|---|
| `01_fact_actuals_snapshot_ddl.sql` | Create `FACT_ACTUALS_SNAPSHOT` |
| `03_take_snapshot.sql` | Freeze 2026-03 / `ME_CLOSE_2026_03_R1` |
| `02_seed_late_posting.sql` | One late Actual row (run **after** the snapshot) |
| `04_v_snapshot_vs_current.sql` | Compare view |
| `05_compare_query.sql` | Pack totals + cells that moved |

## 1. Why Time Travel isn't enough

Time Travel lets you query a table as of a past timestamp or before a drop. Time Travel defaults to **1 day** on every edition. On Standard you can set retention to **0 or 1** day. On Enterprise (and higher), permanent databases, schemas, and tables can go up to **90 days**; transient and temporary objects stay at **0 or 1**. See [Understanding & using Time Travel](https://docs.snowflake.com/en/user-guide/data-time-travel). That window is for recovery, not for "what did we send in March two years ago."

Three limits matter for month-end packs:

1. **The clock runs out.** After retention, the historical version is gone.
2. **DDL can break the chain.** `CREATE OR REPLACE` or recreating a table makes a **new** object. `SELECT … AT` on that name does not see the old table's history. You can still `UNDROP` the prior version within retention if you rename the current object first.
3. **Storage is not free.** Longer retention keeps more history. A deliberate snapshot of one closed period is usually smaller and clearer than keeping every change forever.

So: use Time Travel when you need to undo a mistake this week. Use a snapshot table when you need a permanent answer to "what number did we report?"

## 2. A snapshot table keyed by period and run

Copy the grain of `FACT_ACTUALS` and add four metadata columns:

- `snapshot_period` — the month you froze (`YYYY-MM`)
- `run_id` — which close run produced this pack (so two March runs can coexist)
- `snapshot_at` — when the freeze ran
- `sent_flag` — `TRUE` for the pack you actually sent

```sql title="01_fact_actuals_snapshot_ddl.sql"
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE TABLE IF NOT EXISTS FACT_ACTUALS_SNAPSHOT (
    cost_center VARCHAR(16),
    account VARCHAR(16),
    period VARCHAR(7),
    version VARCHAR(16),
    amount NUMBER(18, 2),
    snapshot_period VARCHAR(7),
    run_id VARCHAR(32),
    snapshot_at TIMESTAMP_NTZ,
    sent_flag BOOLEAN
);
```

!!! warning "Don't overwrite FACT_ACTUALS"
    The snapshot is a second table. Current actuals keep changing; the sent pack must not.

## 3. Freeze the period (then, only then, seed a late post)

Run the freeze while March still matches the pack you sent:

```sql title="03_take_snapshot.sql"
USE SCHEMA FDH_DEMO.SAMPLE;

DELETE FROM FACT_ACTUALS_SNAPSHOT
WHERE snapshot_period = '2026-03'
  AND run_id = 'ME_CLOSE_2026_03_R1';

INSERT INTO FACT_ACTUALS_SNAPSHOT (
    cost_center, account, period, version, amount,
    snapshot_period, run_id, snapshot_at, sent_flag
)
SELECT
    cost_center, account, period, version, amount,
    '2026-03',
    'ME_CLOSE_2026_03_R1',
    CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,
    TRUE
FROM FACT_ACTUALS
WHERE period = '2026-03'
  AND version = 'Actual';
```

You should see **58** snapshot rows totaling **1,466,143.86**.

Two runs for the same period are normal: keep `ME_CLOSE_2026_03_R1` when you send a corrected `R2`. The compare query always names the `run_id` you sent.

Now simulate the late posting that arrives after the mail went out. This script touches only the warehouse table, never the shared CSV:

```sql title="02_seed_late_posting.sql"
INSERT INTO FACT_ACTUALS (cost_center, account, period, version, amount)
SELECT 'CC2000', '500000', '2026-03', 'Actual', 2500.00
WHERE NOT EXISTS (
    SELECT 1 FROM FACT_ACTUALS
    WHERE cost_center = 'CC2000'
      AND account = '500000'
      AND period = '2026-03'
      AND version = 'Actual'
      AND amount = 2500.00
);
```

Expected after the seed (computed from the pristine CSV plus the scripted late amount):

| Side | Rows | Total |
|---|---:|---:|
| Reported (snapshot R1) | 58 | 1,466,143.86 |
| Current (`FACT_ACTUALS`) | 59 | 1,468,643.86 |
| Diff | — | 2,500.00 |

!!! warning "Snapshot before seed"
    If you seed first, the freeze captures the late row and the compare shows no diff. Order is the lesson.

## 4. Zero-copy clones and Backups (options, not tested steps)

A snapshot table is the pattern this post builds end to end. Snowflake also documents other ways to keep a point-in-time copy:

- **Zero-copy clone** of a table or schema at freeze time — cheap to create, still a live object you must protect from later DDL and from dropping.
- **Backups** are available on **all** editions. **Retention lock** (and legal holds) require **Business Critical or higher**. Do not assume every account can lock backups. See [Backups](https://docs.snowflake.com/en/user-guide/backups).

Treat both as options with docs-based caveats. This tutorial's checkable path is `FACT_ACTUALS_SNAPSHOT` plus the compare view, which works on the fictional `FDH_DEMO` data without those features.

## 5. Compare to what we sent

Create the view, then run the check for the run you marked `sent_flag = TRUE`:

```sql title="04_v_snapshot_vs_current.sql"
-- See Downloads for the full CREATE VIEW.
-- Grain: cost_center, account, period, version per snapshot_period + run_id
-- Columns: reported_amount, current_amount, diff
```

```sql title="05_compare_query.sql"
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
```

The cells-that-moved query should return one row: cost center `CC2000`, account `500000` (Material Cost), reported `0.00`, current `2,500.00`, diff `2,500.00`.

## 6. Storage and retention housekeeping

Keep snapshots boring and small:

- Freeze **closed periods only**, not the whole fact table every night.
- Keep one `sent_flag = TRUE` run per period you published; archive or delete abandoned dry runs.
- Drop or archive snapshot runs older than your audit policy once a colder archive holds them.
- Do not lengthen Time Travel on the hot fact table just to answer "what did we send?" That is what the snapshot table is for.

## Check the result

!!! success "Expected after snapshot + late seed: reported 1,466,143.86; current 1,468,643.86; diff 2,500.00"
    ```sql
    SELECT SUM(reported_amount) AS reported_total,
           SUM(current_amount) AS current_total,
           SUM(diff) AS diff_total
    FROM V_SNAPSHOT_VS_CURRENT
    WHERE snapshot_period = '2026-03'
      AND run_id = 'ME_CLOSE_2026_03_R1'
      AND period = '2026-03'
      AND version = 'Actual';
    ```
    Rerun once more: the numbers must not change. The values above are computed from the pristine CSV total plus the scripted 2,500.00 late amount.

## If it doesn't match

- **Diff is 0 after the seed:** the late row was frozen into the snapshot. Re-load pristine `FACT_ACTUALS` (610 rows), run `03` before `02`.
- **Snapshot has 0 rows:** the `WHERE period = '2026-03' AND version = 'Actual'` filter missed. Confirm `FACT_ACTUALS` still has the March slice (58 rows, 1,466,143.86).
- **Many cells_changed, huge diff:** you compared the wrong `run_id`, or `FACT_ACTUALS` was reloaded from a different file. Name the run you sent.
- **Current-only late cell missing from the view:** recreate `V_SNAPSHOT_VS_CURRENT` from `04_v_snapshot_vs_current.sql` (it attaches current rows by `snapshot_period`, not by an inner join alone).
- **Time Travel `AT` query fails after a recreate:** expected. The new object has no prior history; use the snapshot table for audit answers.

## Wrap-up

Freeze what you sent under a period and a run id. Leave current actuals free to receive late postings. Answer audit questions from the snapshot, not from today's sum. Time Travel remains a recovery tool; it is not a permanent month-end archive.

**Next:** [Plan vs actuals](plan-vs-actuals.md) uses the same `FACT_ACTUALS`. [Month-end actuals](month-end-actuals.md) is a different job: a GL extract, not a freeze of the number you already sent.

## Downloads

All files use synthetic sample data and placeholder names. The late-posting script is separate on purpose so other tutorials keep the pristine 610-row `fact_actuals.csv`.

[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]
[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]
[[download:snapshots/01_fact_actuals_snapshot_ddl.sql|Download 01_fact_actuals_snapshot_ddl.sql]]
[[download:snapshots/02_seed_late_posting.sql|Download 02_seed_late_posting.sql]]
[[download:snapshots/03_take_snapshot.sql|Download 03_take_snapshot.sql]]
[[download:snapshots/04_v_snapshot_vs_current.sql|Download 04_v_snapshot_vs_current.sql]]
[[download:snapshots/05_compare_query.sql|Download 05_compare_query.sql]]
[[download:snapshots/README.md|Download README.md]]
