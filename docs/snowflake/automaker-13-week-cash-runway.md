---
title: "A 13-week cash forecast with scenarios, a liquidity floor and an honest runway number"
description: "Build a direct-method 13-week cash forecast for the fictional FDH Motors on FDH_DEMO.MOTORS: date cash by when it lands, run base/down/up scenarios from one table, flag the first week below the floor, and check week 1 against actuals."
social_image: automaker-13-week-cash-runway.png
---

# A 13-week cash forecast with scenarios, a liquidity floor and an honest runway number

<p class="post-meta">Snowflake · Intermediate · ~25 min · Automaker series</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>The Snowflake SQL in this post has not been run on a live account. Every check number was recomputed from the sample CSVs with the same logic as the SQL, and matches the sample data dictionary. The SQL was checked against the Snowflake docs and the recomputed numbers.</p>
</aside>

In a lot of finance teams the 13-week cash forecast is a spreadsheet that gets rebuilt every Monday. Weeks run across as columns, the scenarios are copies of copies, and nobody is quite sure whether the "down case" tab picked up last week's changes. Then someone asks the question that matters, "how many weeks until we're below our minimum cash?", and the answer takes an afternoon.

This post builds the same forecast as a handful of tables and views. Flows are stored one per row, scenarios are three rows in a table, and runway comes from one view with a definition you can read. The example uses Snowflake, but nothing here is Snowflake-only. Any database, or even Power Query, can rebuild it.

## What you'll build

- A long-format `CASH_FLOW` table: one row per receipt or payment, dated by when the cash actually lands
- `V_CASH_FLOW_WEEK`, which works out the week from the cash date, never from the invoice due date
- `V_CASH_13W`: weekly receipts, disbursements and closing balance for base, down and up scenarios
- `V_CASH_RUNWAY` and `V_CASH_FLOOR_ALERT`: the first week below the liquidity floor, and runway in weeks
- `V_CASH_WEEK1_AVF`: week 1 actual vs forecast by category, with a flag for anything worth explaining
- `V_CASH_RECEIPT_SLIP`: receipts that land later than they fall due

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="13-week cash runway chart">
  <a href="../cash-runway-13w.svg"><img src="../cash-runway-13w.svg" alt="Weekly closing cash for FDH Motors over 13 weeks: the base case ends at 3,221,589.35, the up case at 4,741,467.15, and the down case falls below the 1,500,000 liquidity floor in week 8 at 1,228,558.33, giving a runway of 7 weeks." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) to create tables and views in `FDH_DEMO.MOTORS`. This pack adds no grants. `JEDOX_ETL_ROLE` stays views-only and is not touched here.
    - Product version: any current Snowflake account. The SQL uses window functions, `GENERATOR` and `MAX_BY` (docs-based, not run on a live account).
    - Previous post: [What number did we report? Permanent month-end snapshots vs Time Travel](month-end-snapshots.md) (handy for freezing each week's forecast)
    - Sample data: the FDH Motors cash files (`cash_opening.csv`, `cash_flow.csv`, `cash_scenario.csv`, `liquidity_floor.csv`) plus the [Downloads](#downloads) SQL pack

## The sample scenario

FDH Motors is a made-up vehicle maker. Its cash team forecasts 13 weeks from an as-of date of **Monday 2026-09-07**, so week 1 runs 09-07 to 09-13. Opening cash is **4,000,000.00 EUR** and the board's minimum cash, the liquidity floor, is **1,500,000.00**.

`CASH_FLOW` has **158** rows: **146** forecast lines and **12** actuals for week 1. Receipts come from dealers (customers) plus some other income. Disbursements cover suppliers, capex projects, IT services, payroll, rent and tax. Over the 13 weeks the forecast receipts total **13,604,777.09** and disbursements **14,383,187.74**. FDH Motors burns cash in this window, which is exactly when a runway number earns its keep.

Four things are seeded on purpose, so you can see each rule bite:

1. **A late receipt.** CF0006, 180,000.00 from dealer CUST-04, was due on **2026-09-01**, before the as-of date. The team expects the cash on **2026-09-09**, and it hadn't arrived by the end of week 1.
2. **A refund.** CF0064 is a receipt of **-45,000.00** on 2026-10-14 (week 6), money going back to dealer CUST-02.
3. **A payroll plus tax week.** Week 8 (2026-10-26 to 11-01) carries a tax payment CF0086 of **2,310,000.00** on 10-28 and payroll CF0092 of **610,000.00** on 10-30.
4. **Week-1 actuals** next to the forecast, so the forecast can be checked against reality.

## 1. Use the direct method, and keep the indirect one as a control

A 13-week forecast is built with the **direct method**: list the cash you expect to receive and pay, on the dates it moves. That's what treasury can act on next Tuesday. The **indirect method** starts from profit and adjusts for working capital. It's the right lens for the monthly view, but too coarse for weeks.

Practitioner guides tend to agree on this split: direct for the weekly forecast, with a monthly cross-check against the indirect view as a control. We don't build that tie-out here. Just know that if the two drift apart month after month, your receipt timing is usually the reason.

## 2. Store flows long, pivot only at the end

Each flow is a row: `flow_id`, `flow_type` (RECEIPT or DISBURSEMENT), `category`, `counterparty`, `invoice_due_date`, `expected_cash_date`, `actual_cash_date`, `version` (FORECAST or ACTUAL) and `amount`. Amounts are positive and the direction comes from `flow_type`. The one exception is the refund, a negative receipt, because that's what it is.

There's no week column. The week is worked out in a view, so moving a flow to another week means changing one date, not cutting and pasting across columns. Weeks become columns only in the final output, if your report wants them. File `01_cash_tables_ddl_load.sql` creates and loads the four tables. If you already ran the sample pack's `load_motors.sql`, skip it: the cash CSVs are already loaded by it. The file creates no stage of its own; its optional reload uses the sample pack's `@MOTORS_STAGE` and `CSV_HDR` file format.

## 3. Date receipts by when the cash lands

This is the step most hand-built forecasts get wrong. One practical guide we read calls due-date timing the single most common error (that's their claim, but it matches what finance forums say too). A customer invoice due on the 1st is not cash on the 1st. It's cash when the customer pays.

So the week comes from the **cash date**:

```sql
COALESCE(f.actual_cash_date, f.expected_cash_date) AS cash_date,
FLOOR(DATEDIFF('day', o.as_of_date, COALESCE(f.actual_cash_date, f.expected_cash_date)) / 7) + 1 AS week_no
```

If the cash has landed, use the actual date. If not, use the date you expect it. `invoice_due_date` stays in the table for analysis, but it never decides the week. `02_v_cash_flow_week.sql` wraps this in `V_CASH_FLOW_WEEK` and adds a signed amount (receipts plus, payments minus) and a `due_week_no` for comparison.

Look at CF0006. Its due date falls before week 1 even starts, so a due-date forecast would have counted that 180,000.00 as already in the bank, or dropped it altogether. Bucketed by expected cash date it sits in **week 1**, where it belongs. `V_CASH_RECEIPT_SLIP` (file 06) lists every receipt whose cash week is later than its due week. On this data it returns **exactly one row: CF0006**.

## 4. Scenarios are rows, not copied sheets

`CASH_SCENARIO` holds three rows:

| scenario | receipt_mult | disburse_mult |
|---|---|---|
| base | 1.00 | 1.00 |
| down | 0.90 | 1.05 |
| up | 1.08 | 0.97 |

`V_CASH_13W` (file 03) cross-joins the forecast flows with the scenarios, multiplies receipts and disbursements, sums by week, and runs a closing balance:

```sql
o.balance + SUM(g.receipts - g.disbursements) OVER (PARTITION BY g.scenario ORDER BY g.week_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS closing_balance
```

Two details matter. First, a 13-row week grid is joined in, so a week with no flows still shows up with its balance carried forward. Second, the running sum stays unrounded and you round only for display. Round each week and the pennies drift.

In the down case the refund shrinks by 10% too, from -45,000.00 to -40,500.00. That makes the downside 4,500.00 more optimistic than it should be, because less money goes back out. It's a simplification worth knowing about.

Want a fourth scenario, say "dealer strike"? Insert a row. Every view picks it up.

## 5. Define runway, then compute it

"Runway" gets used loosely, so here's the definition this post uses:

- A **breach** is a week whose closing balance is **strictly below** the liquidity floor.
- **First breach week** is the first week that closes below the floor.
- **Runway (weeks)** is the number of full weeks that close at or above the floor before the first breach, so **first breach week minus 1**.
- If no week in the horizon breaches, runway is **">13"**. We can't see past week 13, so we don't pretend to.

Note that runway here is measured against the floor, not against zero. Hitting the floor isn't running out of cash. It's the point where the board's minimum-cash rule says act. `V_CASH_RUNWAY` (file 04) returns one row per scenario. `V_CASH_FLOOR_ALERT` lists every week below the floor, not just the first, because a balance can dip, recover and dip again. In the down case it does exactly that, so read the whole list. `V_CASH_FLOOR_ALERT` returns 5 rows for down: week 8 closes at 1,228,558.33, week 9 at 1,344,072.25, week 10 at 1,335,115.64 and week 11 at 1,466,540.06. Week 12 recovers above the floor to 1,674,052.48, then week 13 drops back to 1,141,952.25. The first breach is still week 8, so the runway is 7 weeks.

## 6. Check week 1 against what actually happened

A forecast you never check just gets more confident, not more accurate. Once week 1 has closed, compare it by category. `V_CASH_WEEK1_AVF` (file 05) sums FORECAST and ACTUAL rows bucketed into week 1 and flags any category whose variance is more than 5% of forecast. The 5% is a rule of thumb from one practitioner guide, not a standard, so set your own.

On FDH Motors, five categories come back OK and one says EXPLAIN: **receipts_customers**, forecast **1,218,939.83**, actual **1,028,482.79**, variance **-190,457.04**. Most of that is CF0006, the late 180,000.00 receipt, plus small noise. That's the conversation the weekly check should start: chase the dealer, then move the expected date in the forecast.

Supplier payments came in **22,649.02** over forecast. One supplier was paid 12% more than planned, but the category stays inside 5%, so it's OK. The flag works at category level by design. If you need line-level flags, group by `flow_id` instead.

## Check the result

Run `07_checks.sql`. You should see:

| Check | Expected |
|---|---|
| CASH_FLOW rows | 158 (146 FORECAST, 12 ACTUAL) |
| Base week-13 closing (`V_CASH_13W`) | **3,221,589.35** |
| Independent check: 4,000,000.00 + 13,604,777.09 − 14,383,187.74 | **3,221,589.35** |
| Base | runway **>13**, lowest close 2,561,358.22 in week 8 |
| Down | first breach **week 8**, runway **7**, week-8 close **1,228,558.33**, lowest close 1,141,952.25 in week 13 |
| Up | runway **>13**, lowest close 3,529,153.86 in week 8, week-13 close 4,741,467.15 |
| Week 8 payroll + tax | CF0086 2,310,000.00 and CF0092 610,000.00 |
| CF0006 | due 2026-09-01, cash week 1, only receipt-slip row |
| Refund | CF0064, -45,000.00, week 6, only negative row |
| Week-1 AvF | 1 EXPLAIN (receipts_customers, -190,457.04) |

Only the down case breaches, and it breaches in the payroll plus tax week. Base and up both dip lowest in that week too, but they stay above the floor. So if FDH Motors wants to protect the down case, week 8 is where to look: move the tax date if that's allowed, line up a credit facility, or chase receipts in weeks 6 and 7.

## If it doesn't match

- **Everything is shifted by a week.** Check the week formula. Week 1 has to be days 0 to 6 after the as-of date. `DATEDIFF('day', ...) / 7` returns a decimal in Snowflake, so keep the `FLOOR`. Other databases may truncate integer division for you, which gives the same result here only because cash dates are never before the as-of date.
- **CF0006 shows up before week 1.** Something is bucketing by `invoice_due_date`. Only `COALESCE(actual_cash_date, expected_cash_date)` should decide the week.
- **Base week 13 is off, or week 1 looks too big.** Make sure `V_CASH_13W` filters `version = 'FORECAST'`. Mixing in the 12 ACTUAL rows double-counts week 1.
- **Pennies are off.** You rounded each week before the running sum. Round only in the final select.
- **Runway reads 8 instead of 7.** You returned the breach week instead of the weeks before it. Runway is `first_breach_week - 1`.
- **Down shows no breach.** Check the multipliers are applied the right way round: receipts × `receipt_mult`, disbursements × `disburse_mult`, with disbursements subtracted.
- **Row counts differ.** Reload from the sample pack. If they still differ, the data has changed since this post was written, so check the data dictionary before you trust any number here.

## Wrap-up

- Store cash flows long and work out the week from the cash date, not the due date.
- Keep scenarios as rows in a table, so adding one is an insert.
- Write runway down as a rule (first week below the floor, minus 1) and compute it in one view.
- Check week 1 every week and explain any big variance before you roll forward.
- Freeze each Monday's forecast with the [month-end snapshot](month-end-snapshots.md) pattern, so you can see how accurate you were.

**Next in the automaker series:** cost per vehicle and price/volume/mix on the same FDH Motors data.

## Downloads

All files use made-up sample data and placeholder names. FDH Motors is not a real company.

### Files this post uses

[[download:samples/motors/cash_opening.csv|Download cash_opening.csv]]
[[download:samples/motors/cash_flow.csv|Download cash_flow.csv]]
[[download:samples/motors/cash_scenario.csv|Download cash_scenario.csv]]
[[download:samples/motors/liquidity_floor.csv|Download liquidity_floor.csv]]
[[download:samples/motors/load_motors.sql|Download load_motors.sql]]
[[download:samples/motors/gen_motors.py|Download gen_motors.py]]
[[download:samples/motors/README.md|Download README.md (sample pack)]]
[[download:cash13/01_cash_tables_ddl_load.sql|Download 01_cash_tables_ddl_load.sql]]
[[download:cash13/02_v_cash_flow_week.sql|Download 02_v_cash_flow_week.sql]]
[[download:cash13/03_v_cash_13w.sql|Download 03_v_cash_13w.sql]]
[[download:cash13/04_v_cash_runway.sql|Download 04_v_cash_runway.sql]]
[[download:cash13/05_v_cash_week1_avf.sql|Download 05_v_cash_week1_avf.sql]]
[[download:cash13/06_v_receipt_slip.sql|Download 06_v_receipt_slip.sql]]
[[download:cash13/07_checks.sql|Download 07_checks.sql]]
[[download:cash13/README.md|Download README.md (SQL pack)]]

### Rest of the FDH Motors pack

[[download:samples/motors/bom.csv|Download bom.csv]]
[[download:samples/motors/capex_actual.csv|Download capex_actual.csv]]
[[download:samples/motors/capex_commit.csv|Download capex_commit.csv]]
[[download:samples/motors/capex_project.csv|Download capex_project.csv]]
[[download:samples/motors/close_task.csv|Download close_task.csv]]
[[download:samples/motors/dim_market.csv|Download dim_market.csv]]
[[download:samples/motors/dim_model.csv|Download dim_model.csv]]
[[download:samples/motors/dim_part.csv|Download dim_part.csv]]
[[download:samples/motors/dim_plant.csv|Download dim_plant.csv]]
[[download:samples/motors/erp_gl_extract.csv|Download erp_gl_extract.csv]]
[[download:samples/motors/erp_gl_extract_2026-03.csv|Download erp_gl_extract_2026-03.csv]]
[[download:samples/motors/erp_gl_extract_2026-03_dropped.csv|Download erp_gl_extract_2026-03_dropped.csv]]
[[download:samples/motors/fact_production.csv|Download fact_production.csv]]
[[download:samples/motors/fact_vehicle_sales.csv|Download fact_vehicle_sales.csv]]
[[download:samples/motors/map_cost_center_plant.csv|Download map_cost_center_plant.csv]]
[[download:samples/motors/motors_recipients.csv|Download motors_recipients.csv]]
[[download:samples/motors/part_purchase.csv|Download part_purchase.csv]]
[[download:samples/motors/std_cost.csv|Download std_cost.csv]]
