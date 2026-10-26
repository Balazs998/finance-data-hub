---
title: "Finance SQL patterns on Snowflake: actual vs budget, period-to-date, year-to-date and reported numbers"
description: "Build an actual vs budget cell view with a FULL OUTER JOIN, add month, quarter-to-date and fiscal year-to-date with window functions, and compare against a frozen month-end snapshot, all on the fictional FDH_DEMO sample."
date: 2026-10-26
social_image: finance-sql-snowflake.png
---

# Finance SQL patterns on Snowflake

<p class="post-meta">Snowflake · Intermediate · ~25 min</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>Join, window-function and NULL-comparison behaviour follows the Snowflake docs linked in the steps. Every check number was recomputed from the sample CSVs with the same logic as the SQL.</p>
</aside>

Most finance SQL comes down to three questions: how did we do against plan, how are we doing so far this year, and has the number we reported moved since we sent it. This post builds each one on the fictional FDH_DEMO sample: 10 cost centers, 8 accounts, Budget 2025-10 to 2026-09, Actual 2025-10 to 2026-08.

## What you'll build

- `V_FIN_AVB_CELL`: actual vs budget per cost center, account and period
- `V_FIN_AVB_PTD_YTD`: month, fiscal quarter-to-date and fiscal year-to-date by account type
- A reported vs current vs budget query that reuses the month-end snapshot table
- Tie-out checks that must all return 0.00

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or a lab admin role) in `FDH_DEMO.SAMPLE`. The pack creates two views and no grants. Leave `JEDOX_ETL_ROLE` unchanged.
    - Product version: any current Snowflake account.
    - Previous posts: [Plan vs. actuals in Snowflake SQL, without losing rows](plan-vs-actuals.md) and [Permanent month-end snapshots vs Time Travel](month-end-snapshots.md) (step 4 reuses its `FACT_ACTUALS_SNAPSHOT`).
    - Sample data: pristine [`fact_actuals.csv`](../files/samples/fact_actuals.csv) (610 rows), [`fact_budget.csv`](../files/samples/fact_budget.csv) (696 rows), [`dim_account.csv`](../files/samples/dim_account.csv), and the [Downloads](#downloads) pack.

## 1. Actual vs budget per cell

Sum each side to one row per cell, then join with a `FULL OUTER JOIN` so cells that exist on only one side survive. A [FULL OUTER JOIN](https://docs.snowflake.com/en/sql-reference/constructs/join) returns all rows from both tables and fills the missing side with NULL.

```sql title="01_v_fin_avb_cell.sql (core)"
CREATE OR REPLACE VIEW V_FIN_AVB_CELL AS
WITH act AS (
 SELECT cost_center, account, period, SUM(amount) AS actual_amt
 FROM FACT_ACTUALS
 WHERE version = 'Actual'
 GROUP BY cost_center, account, period
),
bud AS (
 SELECT cost_center, account, period, SUM(amount) AS budget_amt
 FROM FACT_BUDGET
 WHERE version = 'Budget'
 GROUP BY cost_center, account, period
)
SELECT
 COALESCE(a.cost_center, b.cost_center) AS cost_center,
 COALESCE(a.account, b.account) AS account,
 COALESCE(a.period, b.period) AS period,
 a.actual_amt,
 b.budget_amt,
 COALESCE(a.actual_amt, 0) - COALESCE(b.budget_amt, 0) AS variance_amt,
 CASE
 WHEN a.actual_amt IS NULL THEN 'BUDGET_ONLY'
 WHEN b.budget_amt IS NULL THEN 'ACTUAL_ONLY'
 ELSE 'BOTH'
 END AS match_status
FROM act a
FULL OUTER JOIN bud b
 ON a.cost_center = b.cost_center
 AND a.account = b.account
 AND a.period = b.period;
```

You should get **701** cells: **605** BOTH, **5** ACTUAL_ONLY and **91** BUDGET_ONLY. The same split appears in the plan-vs-actuals post.

Variance here is actual minus budget on the stored sign. Expense amounts are positive in the sample, so a positive expense variance means overspend. Say which convention you use on the report.

## 2. Period-to-date, quarter-to-date and year-to-date

The sample is monthly, so period-to-date is simply the month. Quarter- and year-to-date are running sums with a window that resets at each fiscal quarter or year. The fiscal year starts in October (FY2026 = 2025-10 to 2026-09), matching the sample period dimension. [SUM as a window function](https://docs.snowflake.com/en/sql-reference/functions/sum) with `ORDER BY` and `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` gives the running total.

```sql title="02_v_fin_avb_ptd_ytd.sql (window part)"
SUM(actual_mtd) OVER (PARTITION BY account_type, fiscal_year ORDER BY period ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS actual_ytd,
SUM(budget_mtd) OVER (PARTITION BY account_type, fiscal_year ORDER BY period ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS budget_ytd
```

Running sums only work if every month has a row. Budget-only cells keep the months with no actuals in the series, which is why step 2 reads from `V_FIN_AVB_CELL` and not from `FACT_ACTUALS`.

For 2026-03 (fiscal Q2, Jan to Mar):

| Account type | Actual month | Budget month | Actual QTD | Budget QTD | Actual YTD | Budget YTD |
|---|---|---|---|---|---|---|
| REVENUE | 229,693.47 | 223,769.38 | 707,191.67 | 664,914.70 | 1,368,888.45 | 1,310,649.16 |
| EXPENSE | 1,236,450.39 | 1,207,184.99 | 3,467,414.55 | 3,587,063.92 | 6,823,277.07 | 7,070,654.85 |

Month variance is REVENUE +5,924.09 and EXPENSE +29,265.40. Year-to-date variance is REVENUE +58,239.29 and EXPENSE −247,377.78.

## 3. Actual vs budget vs forecast

The same pattern takes a third side: sum the forecast to one row per cell and `FULL OUTER JOIN` it on the `COALESCE` of the keys from step 1. The FDH_DEMO sample has no forecast fact yet, so `04_forecast_pattern.sql` shows the pattern as comments and this post prints no forecast numbers.

## 4. Reported vs current vs budget

The month-end snapshots post froze 2026-03 into `FACT_ACTUALS_SNAPSHOT` (run `ME_CLOSE_2026_03_R1`, 58 rows, 1,466,143.86) and then seeded a late 2,500.00 posting on CC2000 / 500000. Here we line the snapshot up against current actuals and budget, and keep only cells where reported and current differ.

Both amounts can be NULL: a budget-only cell has no reported and no current actual. `<>` returns NULL when either side is NULL, so it would silently drop a newly posted cell. [IS DISTINCT FROM](https://docs.snowflake.com/en/sql-reference/functions/is-distinct-from) treats two NULLs as equal and a NULL vs a value as different.

```sql title="03_snapshot_vs_current_vs_budget.sql (filter)"
WHERE r.reported_amt IS DISTINCT FROM c.current_amt
```

Before the late posting this returns **0** rows. The one 2026-03 budget-only cell (CC3000 / 610000) is NULL on both sides and is correctly left out. The snapshots post's view shows this as 0 because it COALESCEs; here we keep the NULL on purpose. After the late posting it returns **1** row: CC2000 / 500000, reported NULL, current 2,500.00, budget NULL. That's an unbudgeted posting that arrived after the pack was sent.

## Check the result

!!! success "Expected: 701 cells; every tie-out diff 0.00"
    ```sql
    -- 05_checks.sql
    -- actual: 15446573.09 / 15446573.09 / diff 0.00
    -- budget: 17253220.89 / 17253220.89 / diff 0.00
    -- 2026-03 YTD actual 8192165.52, ytd_diff 0.00
    ```
    And 2026-03 totals: reported 1,466,143.86, current 1,466,143.86 (1,468,643.86 after the late posting), budget 1,430,954.37.

## If it doesn't match

- **Fewer than 701 cells:** a `LEFT JOIN` or inner join slipped in, or a `WHERE` on one side's column after the join turned it into an inner join. Filter inside the CTEs.
- **Totals too high:** you joined the facts at posting level before summing. Sum each side first.
- **YTD restarts in January:** the fiscal year expression is missing. FY starts in October here.
- **QTD or YTD jumps:** a month is missing for that account type. Read from `V_FIN_AVB_CELL` so budget-only months stay in.
- **Step 4 shows the budget-only cell:** you wrote `r.reported_amt IS NULL OR c.current_amt IS NULL` instead of `IS DISTINCT FROM`.
- **Step 4 shows nothing after the late posting:** you compared with `<>`, which returns NULL against the missing snapshot row.
- **Snapshot total isn't 1,466,143.86:** the snapshot was taken after the late posting, or from a different run_id. Re-run the snapshots pack's 03 script.

## Wrap-up

- Sum each side, then `FULL OUTER JOIN`; never lose a one-sided cell.
- Running windows give QTD and YTD; reset them at fiscal boundaries.
- Compare nullable amounts with `IS DISTINCT FROM`.
- Keep the number you sent in a snapshot and compare against it.

**Next:** [Power BI on Snowflake views](../power-bi/power-bi-snowflake-views.md) loads the same actuals and budget into a star schema with a check that ties to 0.00.

## Downloads

All files use fictional sample data and placeholder names.

[[download:finsql/01_v_fin_avb_cell.sql|Download 01_v_fin_avb_cell.sql]]
[[download:finsql/02_v_fin_avb_ptd_ytd.sql|Download 02_v_fin_avb_ptd_ytd.sql]]
[[download:finsql/03_snapshot_vs_current_vs_budget.sql|Download 03_snapshot_vs_current_vs_budget.sql]]
[[download:finsql/04_forecast_pattern.sql|Download 04_forecast_pattern.sql]]
[[download:finsql/05_checks.sql|Download 05_checks.sql]]
[[download:finsql/README.md|Download README.md]]
