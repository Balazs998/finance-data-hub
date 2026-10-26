---
title: "Power BI on Snowflake views: a star schema, Import vs DirectQuery, and a check that ties to 0.00"
description: "Build a small star schema as FDH_DEMO Snowflake views, load it into Power BI with Power Query, choose Import or DirectQuery on purpose, and add a check visual that proves the report matches Snowflake to the cent."
date: 2026-10-26
social_image: power-bi-snowflake-views.png
---

# Power BI on Snowflake views

<p class="post-meta">Power BI · Snowflake · Beginner to intermediate · ~25 min</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>Power BI and Power Query steps follow the Microsoft Learn pages linked in each step, and the Snowflake SQL follows the Snowflake docs. No .pbix is shipped; the queries and measures are text files you paste in. Every check number was recomputed from the sample CSVs. Power BI steps are based on official docs, not tested on a live install.</p>
</aside>

A Power BI report that doesn't match the warehouse loses the room in one meeting. The usual causes are logic copied into the report, a join built in Power Query that duplicates rows, or a total that quietly drops a filter. This post keeps the logic in Snowflake views, loads a clean star schema, and adds a check visual that shows 0.00 when the report and Snowflake agree.

## What you'll build

- Five Snowflake views: one fact, three dimensions and one check table
- Five Power Query M queries, one per view
- Three DAX measures and a check visual with a 0.00 row per version and on the total

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or a lab admin role) in `FDH_DEMO.SAMPLE` to create the views, and a lab Snowflake login Power BI can use. Give that login a read-only role. Enter the login in Power BI's credential prompt, never in the M query. Don't point this at a production account. The pack adds no grants.
    - Product version: Power BI Desktop (current release) with the built-in Snowflake connector, and any current Snowflake account.
    - Previous posts: [Excel as a thin front end](../vba/excel-thin-front-end.md) (same idea: logic in views, the front end only reads) and [Plan vs. actuals in Snowflake SQL](../snowflake/plan-vs-actuals.md).
    - Sample data: pristine [`fact_actuals.csv`](../files/samples/fact_actuals.csv) (610 rows), [`fact_budget.csv`](../files/samples/fact_budget.csv) (696 rows), `dim_cost_center.csv`, `dim_account.csv`, and the [Downloads](#downloads) pack.

## 1. Design the star in Snowflake

Microsoft recommends a [star schema](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema) for Power BI models: fact tables hold the numbers, dimension tables hold what you filter and group by, and relationships run one-to-many from dimension to fact. We build that shape as views so the report never joins anything itself.

| View | Grain | Rows |
|---|---|---|
| `V_PBI_FACT_FIN` | posting row, Actual and Budget stacked with `UNION ALL` | 1,306 (610 + 696) |
| `V_PBI_DIM_COST_CENTER` | cost center, with its group | 10 |
| `V_PBI_DIM_ACCOUNT` | account, with its type | 8 |
| `V_PBI_DIM_PERIOD` | month, with start date and fiscal year (October start) | 12 |
| `V_PBI_CHECK_TOTALS` | version: row count and Snowflake total | 2 |

```sql title="01_pbi_views.sql (fact)"
CREATE OR REPLACE VIEW V_PBI_FACT_FIN AS
SELECT cost_center, account, period, version, amount
FROM FACT_ACTUALS
WHERE version = 'Actual'
UNION ALL
SELECT cost_center, account, period, version, amount
FROM FACT_BUDGET
WHERE version = 'Budget';
```

Stacking the versions (instead of joining them) means no row can be lost or doubled. Budget-only and actual-only cells both stay, and variance becomes a measure. The script ends with an orphan check: every fact key must exist in its dimension, so expect 0 / 0 / 0.

## 2. Import or DirectQuery

Choose the [storage mode](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-storage-mode) on purpose:

- **Import** copies the data into the model. Visuals are fast and need no warehouse query, but they only show data as of the last refresh.
- **DirectQuery** leaves the data in Snowflake and sends queries when visuals render. Microsoft lists limits in [DirectQuery in Power BI](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-directquery-about), including a default one-million-row limit on intermediate results (Premium and Fabric capacity admins can set a different limit) and caches that can show prior results until you refresh.

For a monthly finance pack on a few thousand rows, Import is the simple default. DirectQuery makes sense when the data is too big to import or must be current at view time. With DirectQuery, every visual interaction runs warehouse queries, so check your warehouse's auto-suspend and size first. The [Snowflake connector page](https://learn.microsoft.com/en-us/power-query/connectors/snowflake) lists both Import and DirectQuery as supported.

## 3. Load the views with Power Query

In Power BI Desktop, use **Get data > Snowflake**, or paste each M query from the pack into a blank query in the Advanced Editor. Replace the placeholders with your lab account and warehouse. The connector's entry point is `Snowflake.Databases`, as documented on the [Snowflake connector page](https://learn.microsoft.com/en-us/power-query/connectors/snowflake).

```m title="q_FACT_FIN.m.txt"
let
 Source = Snowflake.Databases("<your_account>.snowflakecomputing.com", "<YOUR_WH>"),
 Db = Source{[Name = "FDH_DEMO", Kind = "Database"]}[Data],
 Sch = Db{[Name = "SAMPLE", Kind = "Schema"]}[Data],
 V = Sch{[Name = "V_PBI_FACT_FIN", Kind = "View"]}[Data],
 Typed = Table.TransformColumnTypes(V, {{"AMOUNT", Currency.Type}, {"PERIOD", type text}, {"VERSION", type text}, {"COST_CENTER", type text}, {"ACCOUNT", type text}})
in
 Typed
```

Keep the steps this short. Navigation and type changes are the kind of step that can be pushed back to the source; [query folding](https://learn.microsoft.com/en-us/power-query/query-folding-basics) explains why steps that fold run in Snowflake instead of on your machine. Do any merging or grouping in the views, not in Power Query.

Snowflake stores unquoted identifiers in upper case ([identifier requirements](https://docs.snowflake.com/en/sql-reference/identifiers-syntax)), so columns arrive as `AMOUNT`, `PERIOD` and so on.

## 4. Relationships

In model view, create single-direction one-to-many relationships:

- `V_PBI_DIM_COST_CENTER[COST_CENTER]` → `V_PBI_FACT_FIN[COST_CENTER]`
- `V_PBI_DIM_ACCOUNT[ACCOUNT]` → `V_PBI_FACT_FIN[ACCOUNT]`
- `V_PBI_DIM_PERIOD[PERIOD]` → `V_PBI_FACT_FIN[PERIOD]`
- `V_PBI_CHECK_TOTALS[VERSION]` → `V_PBI_FACT_FIN[VERSION]`

Single direction from dimension to fact is the star-schema default in the [star schema guidance](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema).

![Power BI star schema: the FACT_FIN table (from V_PBI_FACT_FIN, with COST_CENTER, ACCOUNT, PERIOD, VERSION and AMOUNT) sits in the centre. Many-to-one links join it to DIM_COST_CENTER, DIM_ACCOUNT and DIM_PERIOD on their key columns. A separate CHECK_TOTALS table (VERSION, ROW_COUNT, SF_TOTAL) is related on VERSION with a dashed link.](star-schema.png)

Hide the fact key columns (`COST_CENTER`, `ACCOUNT`, `PERIOD`) and the fact `VERSION` in report view, so report builders slice by the dimension and check-table columns instead.

## 5. The check visual

Add the measures from `measures.dax.txt`:

```dax title="measures.dax.txt"
Amount PBI = SUM ( V_PBI_FACT_FIN[AMOUNT] )
Total SF = SUM ( V_PBI_CHECK_TOTALS[SF_TOTAL] )
Check Diff = ROUND ( [Amount PBI] - [Total SF], 2 )
Actual = CALCULATE ( [Amount PBI], V_PBI_FACT_FIN[VERSION] = "Actual" )
Budget = CALCULATE ( [Amount PBI], V_PBI_FACT_FIN[VERSION] = "Budget" )
Variance = [Actual] - [Budget]
```

On its own, `Amount PBI` adds Actual and Budget together, so use `Actual`, `Budget` and `Variance` in report visuals.

Put a table visual on a hidden "Checks" page (or the report footer) with `V_PBI_CHECK_TOTALS[VERSION]` on rows and the three measures as values. `Total SF` is calculated in Snowflake, and `Amount PBI` is calculated by Power BI from the loaded rows, so a dropped or doubled row shows up as a non-zero diff. Only the difference is rounded. `Total SF` responds only to VERSION, so the Checks page must have no slicers or filters, and must be left out of slicer sync; otherwise `Check Diff` turns non-zero for no real reason.

## Check the result

!!! success "Expected: Check Diff 0.00 on every row and the total"
    | VERSION | Amount PBI | Total SF | Check Diff |
    |---|---|---|---|
    | Actual | 15,446,573.09 | 15,446,573.09 | 0.00 |
    | Budget | 17,253,220.89 | 17,253,220.89 | 0.00 |
    | Total | 32,699,793.98 | 32,699,793.98 | 0.00 |

    Spot check: filter period 2026-03 and group by `COST_CENTER_GROUP`. Actual: G&A 372,231.91, IT 164,632.93, Marketing 138,957.21, R&D 311,298.62, Sales 479,023.19 (sum 1,466,143.86). Budget for the same month is 1,430,954.37.

## If it doesn't match

- **Check Diff non-zero on one version:** the fact query is filtered (a Power Query step, a report filter or a stale Import refresh). Refresh and remove filters from the Checks page.
- **Check Diff equals a whole version:** the `VERSION` relationship is missing or points the wrong way.
- **Amounts double:** a merge was added in Power Query, or a dimension view has duplicate keys. Run the orphan and row-count checks in `01_pbi_views.sql`.
- **Blank group in the spot check:** a fact row has a cost center missing from the dimension. The orphan check should show it.
- **2026-09 shows budget only:** expected. The sample's actuals stop at 2026-08.
- **DirectQuery error about one million rows:** a visual asks for posting-level detail. Aggregate in the view or use Import (see step 2).
- **Numbers lag Snowflake:** Import shows the last refresh. Refresh the model.

## Wrap-up

- Shape the star in Snowflake views; let Power BI only read.
- Stack versions with `UNION ALL` and compute variance as a measure.
- Pick Import or DirectQuery for a reason you can state.
- Keep a check visual that must say 0.00 before anyone reads the report.

**Next:** [Finance SQL patterns on Snowflake](../snowflake/finance-sql-snowflake.md) builds actual vs budget, quarter-to-date and year-to-date on the same sample.

## Downloads

All files use fictional sample data and placeholder names. No .pbix is included.

[[download:pbi1/01_pbi_views.sql|Download 01_pbi_views.sql]]
[[download:pbi1/q_FACT_FIN.m.txt|Download q_FACT_FIN.m.txt]]
[[download:pbi1/q_DIM_COST_CENTER.m.txt|Download q_DIM_COST_CENTER.m.txt]]
[[download:pbi1/q_DIM_ACCOUNT.m.txt|Download q_DIM_ACCOUNT.m.txt]]
[[download:pbi1/q_DIM_PERIOD.m.txt|Download q_DIM_PERIOD.m.txt]]
[[download:pbi1/q_CHECK_TOTALS.m.txt|Download q_CHECK_TOTALS.m.txt]]
[[download:pbi1/measures.dax.txt|Download measures.dax.txt]]
[[download:pbi1/README.md|Download README.md]]
