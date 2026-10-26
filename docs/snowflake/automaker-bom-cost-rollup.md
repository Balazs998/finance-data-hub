---
date: 2026-10-25
home_tag: Automaker series
title: "BOM cost rollup and PPV in Snowflake"
description: "Explode a multi-level BOM with a recursive CTE, roll up standard cost per vehicle, and split price and usage variance for fictional FDH Motors."
social_image: automaker-bom-cost-rollup.png
---

# BOM cost rollup in Snowflake: standard cost per vehicle, price and usage variance

<p class="post-meta">Snowflake · Intermediate · ~30 min · Automaker series</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>The Snowflake SQL in this post has not been run on a live account. Every check number was recomputed from the sample CSVs with the same logic as the SQL, and matches the sample data dictionary.</p>
</aside>

"What does an M-B cost us in parts, at standard?" The answer sits in a bill of materials three levels (depth 0–2) deep: the vehicle is made of assemblies, the assemblies are made of parts, and each part has a standard cost that changes by period. In many teams the rollup lives in an ERP report nobody can open up, and purchase price variance arrives as one number at month-end with no breakdown.

This post explodes the BOM with a recursive CTE, rolls standard cost up to the vehicle, and splits the difference between standard and actual into a price part and a usage part, per part. The example uses Snowflake, but recursive CTEs are standard SQL, so any database that supports `WITH RECURSIVE` can rebuild it.

## What you'll build

This pack creates **four views and no tables**:

- `V_BOM_EXPLODED`: every part in each vehicle, per period, with extended quantity and depth (the vehicle is depth 0 and has no row of its own, assemblies are 1, parts are 2)
- `V_STD_COST_ROLLUP`: standard cost per vehicle by model and period
- `V_PPV`: purchase price variance by part, plant and period
- `V_USAGE_VAR`: usage variance by plant, part and period

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="BOM cost rollup">
  <a href="../bom-tree.svg"><img src="../bom-tree.svg" alt="Bill of materials for model M-B: the vehicle is built from four assemblies (A-BODY-B, A-PT-B, A-INT-B and the shared A-ELEC), which together hold 14 part lines. The standard cost is 11,707.40 per vehicle in 2026-03. From 2026-04-01 the powertrain swaps P-CELL-01 ×110 for P-CELL-02 ×96, which brings M-B to 11,323.40." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) to create views in `FDH_DEMO.MOTORS`. This pack adds no grants. `JEDOX_ETL_ROLE` is not touched.
    - Product version: any current Snowflake account (`WITH RECURSIVE`, `IFF`, `COUNT_IF`, `GROUP BY ROLLUP`; docs-based, not run on a live account)
    - Previous posts: [Cost per vehicle](automaker-cost-per-vehicle.md) (the same plants and production) and [Month-end snapshots](month-end-snapshots.md) (to freeze standard cost per period)
    - Sample data: `dim_part.csv`, `bom.csv`, `std_cost.csv`, `part_purchase.csv` and `fact_production.csv`, loaded by `load_motors.sql`

## Step 1: Explode the BOM

`BOM` stores one parent → child line with `qty_per`, plus `valid_from` and `valid_to`. The demo has two vehicles (M-A, M-B), 7 assemblies and 18 parts. Some are shared: assembly `A-ELEC` sits in both models, and so do parts like `P-GLASS` and `P-PAINT`.

The recursive CTE starts at each vehicle and walks down, multiplying quantities as it goes:

```sql
CREATE OR REPLACE VIEW V_BOM_EXPLODED AS
WITH RECURSIVE per AS (
 SELECT DISTINCT period, TO_DATE(period || '-01') AS period_start FROM STD_COST
), walk (model, period, period_start, parent_part, part, ext_qty, depth, path) AS (
 SELECT b.parent_part, p.period, p.period_start, b.parent_part, b.child_part, b.qty_per, 1,
 b.parent_part || '>' || b.child_part
 FROM BOM b JOIN DIM_PART v ON v.part = b.parent_part AND v.part_type = 'VEH'
 CROSS JOIN per p
 WHERE b.valid_from <= p.period_start AND (b.valid_to IS NULL OR b.valid_to >= p.period_start)
 UNION ALL
 SELECT w.model, w.period, w.period_start, b.parent_part, b.child_part, w.ext_qty * b.qty_per, w.depth + 1,
 w.path || '>' || b.child_part
 FROM walk w JOIN BOM b ON b.parent_part = w.part
 WHERE b.valid_from <= w.period_start AND (b.valid_to IS NULL OR b.valid_to >= w.period_start)
 AND w.depth < 10
)
SELECT w.model, w.period, w.part, d.part_type, w.depth, w.ext_qty, w.path
FROM walk w JOIN DIM_PART d ON d.part = w.part;
```

Three details matter:

- **Validity is checked at every level** against the first day of the period: a line counts if `valid_from` ≤ the 1st and `valid_to` is NULL or ≥ the 1st (`valid_to` is inclusive). A change dated mid-month therefore takes effect the following month. In the demo, `A-PT-B` uses `P-CELL-01` ×110 until 2026-03-31 and `P-CELL-02` ×96 from 2026-04-01, so March and April explode differently.
- **The depth guard** (`w.depth < 10`) stops the walk if the BOM ever contains a cycle, such as a part that is (by mistake) its own grandparent. Without it, a cycle makes the query run until it hits the statement timeout (`STATEMENT_TIMEOUT_IN_SECONDS`) or you cancel it. If check (a) returns any rows, look for a cycle ([recursive CTEs](https://docs.snowflake.com/en/user-guide/queries-cte)). The demo BOM is three levels (depth 0–2): the vehicle is depth 0 and has no row of its own, an assembly is 1 and a part is 2, so it never gets close. It has no cycle; the guard is there for your real data.
- **`path`** records the route (`M-B>A-PT-B>P-CELL-01`). When the guard fires, the path shows you the loop.

## Step 2: Roll up standard cost

Only purchased parts (`part_type = 'PART'`) carry a standard cost. Assemblies are just containers, so costing them too would count everything twice.

```sql
CREATE OR REPLACE VIEW V_STD_COST_ROLLUP AS
SELECT e.model, e.period,
 COUNT(*) AS costed_lines,
 COUNT(*) - COUNT(s.std_cost) AS missing_std_parts,
 IFF(COUNT(*) = COUNT(s.std_cost), SUM(e.ext_qty * s.std_cost), NULL) AS std_cost_per_vehicle
FROM V_BOM_EXPLODED e
LEFT JOIN STD_COST s ON s.part = e.part AND s.period = e.period
WHERE e.part_type = 'PART'
GROUP BY e.model, e.period;
```

**NULL handling:** if any part has no standard cost for the period, the left join gives a NULL `std_cost`, `SUM` would quietly skip it, and the vehicle would look cheaper than it is. The `IFF` returns NULL instead, and `missing_std_parts` says how many parts are missing. In the demo, `P-TRIM-B` has no standard for 2026-05, so M-B 2026-05 is NULL.

Results for 2026-03: M-A **8,310.10**, M-B **11,707.40**. In 2026-04, M-B drops to **11,323.40** because of the cell change. The view stays unrounded; round only when you report.

## Step 3: Purchase price variance

PPV is (actual unit price − standard cost) × quantity bought, per part, plant and period. Positive means you paid more than standard.

```sql
CREATE OR REPLACE VIEW V_PPV AS
SELECT p.part, p.plant, p.period, p.qty, p.unit_price, s.std_cost,
 s.std_cost IS NOT NULL AS has_std,
 (p.unit_price - s.std_cost) * p.qty AS ppv
FROM PART_PURCHASE p
LEFT JOIN STD_COST s ON s.part = p.part AND s.period = p.period;
```

A purchase with no standard keeps a NULL `ppv` and `has_std = FALSE`, so it shows up in check d) rather than vanishing from the total. In the demo every purchase has a standard.

PPV for 2026-03 is **46,159.51**, and **42,000.00** of it is one part: `P-ECU-01`, bought at a 30% price spike. Across all six purchase periods (2025-10 to 2026-03) PPV is 81,940.27.

## Step 4: Usage variance

Usage variance is (actual quantity − standard quantity for the units built) × standard cost. Standard quantity is actual units produced from `FACT_PRODUCTION` times the exploded quantity per vehicle.

The demo has no consumption table, so purchased quantity stands in for actual usage. That's a simplification: buying ahead, stock changes and timing differences all show up as usage variance here. With goods-issue or backflush data, use that instead. M-C has no BOM in the demo, so its production adds no standard quantity.

```sql
CREATE OR REPLACE VIEW V_USAGE_VAR AS
WITH std_qty AS (
 SELECT f.plant, e.part, f.period, SUM(f.units_produced * e.ext_qty) AS std_qty
 FROM FACT_PRODUCTION f
 JOIN V_BOM_EXPLODED e ON e.model = f.model AND e.period = f.period AND e.part_type = 'PART'
 WHERE f.version = 'Actual'
 GROUP BY f.plant, e.part, f.period
), act AS (
 SELECT plant, part, period, SUM(qty) AS actual_qty FROM PART_PURCHASE GROUP BY plant, part, period
), j AS (
 SELECT COALESCE(a.plant, s.plant) AS plant, COALESCE(a.part, s.part) AS part, COALESCE(a.period, s.period) AS period,
 COALESCE(a.actual_qty, 0) AS actual_qty, COALESCE(s.std_qty, 0) AS std_qty
 FROM act a FULL OUTER JOIN std_qty s ON s.plant = a.plant AND s.part = a.part AND s.period = a.period
)
SELECT j.plant, j.part, j.period, j.actual_qty, j.std_qty, c.std_cost,
 (j.actual_qty - j.std_qty) * c.std_cost AS usage_var
FROM j
LEFT JOIN STD_COST c ON c.part = j.part AND c.period = j.period
WHERE j.period IN (SELECT DISTINCT period FROM PART_PURCHASE);
```

**NULL handling:** the full outer join keeps parts that were bought but not needed, and parts needed but not bought, with 0 on the missing side. Only months with purchase data are compared; later months would otherwise show all standard quantity as unused. Usage variance is NULL only when the part has no standard cost.

In the demo, exactly one row is non-zero: P300 bought 124.20 `P-PANEL-B` door panel sets in 2026-03 (the sample data records a fractional quantity) against a standard quantity of 115 sets for the 115 M-B vehicles it built, at a standard cost of 420.00 per set, giving **3,864.00** of over-consumption (8.0%).

## Check the result

Run `05_checks.sql`. You should see:

The letters match the comments in `05_checks.sql`.

| Check | Expected |
|---|---|
| a) Rows at the depth limit | **0** |
| b) Parts missing a standard cost | **1**: P-TRIM-B, 2026-05 |
| c) Std cost per vehicle, 2026-03 | M-A **8,310.10**, M-B 11,707.40 |
| c) M-B, 2026-04 | 11,323.40 (cell change) |
| c) M-B, 2026-05 | NULL (missing P-TRIM-B standard) |
| d) PPV 2026-03 | **46,159.51** |
| d) PPV 2025-10 to 2026-03 | 81,940.27 |
| e) Biggest PPV part, 2026-03 | P-ECU-01, 42,000.00 |
| f) Usage variance | 1 row: P300 / P-PANEL-B / 2026-03, **3,864.00** |

## If it doesn't match

- **The query runs for ages or errors on recursion.** The BOM has a cycle, or the depth guard is missing. Keep `w.depth < 10` and look at `path` for the loop.
- **Standard cost is roughly double.** You costed assemblies as well as parts. Filter `part_type = 'PART'`.
- **M-B 2026-03 and 2026-04 are the same.** Validity is only checked at the top level, or not at all. Check it in both halves of the CTE.
- **Both cells show up in March.** `valid_to` is compared against the end of the month. Use the first day of the period.
- **M-B 2026-05 shows a number instead of NULL.** `SUM` skipped the missing standard. Use the `COUNT(*) = COUNT(s.std_cost)` test.
- **PPV for all periods reads 81,940.28.** You rounded each row first. Keep the view unrounded and round only the totals.
- **P200 shows standard quantity for its M-C production.** M-C has no BOM in the demo, so the 18 M-C vehicles P200 built in 2026-03 should add no standard quantity for any part. You gave M-C a BOM it doesn't have, or joined production to parts without going through the BOM.
- **Usage variance rows disappear.** You used an inner join between purchases and standard quantity. Use the full outer join.

## Wrap-up

- A recursive CTE plus a depth guard turns a BOM into a flat list you can cost.
- Check BOM validity at every level, on one agreed date per period.
- Return NULL when a standard is missing, never a quietly lower number.
- Price and usage variance answer different questions: who paid too much, and who used too much.

**Next in the automaker series:** [ERP-to-warehouse load controls](automaker-erp-control-totals.md).

## Downloads

All files use made-up sample data and placeholder names. FDH Motors is not a real company.

[[download:samples/motors/dim_part.csv|Download dim_part.csv]]
[[download:samples/motors/bom.csv|Download bom.csv]]
[[download:samples/motors/std_cost.csv|Download std_cost.csv]]
[[download:samples/motors/part_purchase.csv|Download part_purchase.csv]]
[[download:samples/motors/fact_production.csv|Download fact_production.csv]]
[[download:samples/motors/load_motors.sql|Download load_motors.sql]]
[[download:bom/01_v_bom_exploded.sql|Download 01_v_bom_exploded.sql]]
[[download:bom/02_v_std_cost_rollup.sql|Download 02_v_std_cost_rollup.sql]]
[[download:bom/03_v_ppv.sql|Download 03_v_ppv.sql]]
[[download:bom/04_v_usage_var.sql|Download 04_v_usage_var.sql]]
[[download:bom/05_checks.sql|Download 05_checks.sql]]
[[download:bom/README.md|Download README.md]]
