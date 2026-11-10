---
title: "A planning-tool load file from Snowflake that ties before you send it"
description: "Export actuals and budget from Snowflake as one generic long-format CSV, add a control file, load the file back and reconcile it to 0.00, all on the fictional FDH_DEMO sample."
date: 2026-11-04
social_image: planning-tool-load-file.png
---

# A planning-tool load file from Snowflake that ties before you send it

<p class="post-meta">Snowflake · Intermediate · ~25 min</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>View, COPY INTO and file-format behaviour follows the Snowflake docs linked in the steps. Every check number was recomputed from the sample CSVs with the same logic as the SQL. The planning-tool import side is described from public vendor docs only.</p>
</aside>

Many finance teams send actuals to a planning tool as a flat file, and only find out the file didn't tie when planners say the numbers look wrong. This post builds one generic export from Snowflake with a control file and a reconciliation that must return 0.00 before the file leaves your hands. It uses the fictional FDH_DEMO sample: 10 cost centers, 8 accounts, Budget 2025-10 to 2026-09, Actual 2025-10 to 2026-08.

## What you'll build

- `V_PLAN_EXPORT_LONG`: one row per cell (cost center, account, period, version, amount), with an orphan check
- A CSV data file and a control file in the internal `SAMPLE_STAGE`
- `V_PLAN_EXPORT_RECON`: source vs export vs reloaded file, rows and sums, every diff 0.00
- A broken-file demo that shows what a dropped row looks like

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 1000px" tabindex="0" aria-label="Planning-tool load file pipeline">
  <a href="../plan-export-pipeline.svg"><img src="../plan-export-pipeline.svg" alt="Fictional FDH_DEMO data. FACT_ACTUALS and FACT_BUDGET are summed to one row per cell in V_PLAN_EXPORT_LONG, with an orphan check of 0. COPY INTO writes a CSV of 754 rows and a control file to the internal SAMPLE_STAGE. The data file goes to a planning-tool flat-file import. In parallel the file is reloaded, and V_PLAN_EXPORT_RECON compares source, export and file: Actual 2026-03 is 58 rows and 1,466,143.86, Budget is 696 cells and 17,253,220.89, and every diff is 0.00." width="1240" height="520"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or a lab admin role) in `FDH_DEMO.SAMPLE`. The pack creates two views and one scratch table, and no grants. Leave `ETL_LOADER_ROLE` unchanged.
    - Product version: any current Snowflake account.
    - Previous posts: [Finance SQL patterns on Snowflake](finance-sql-snowflake.md) (same sample, same totals).
    - Sample data: pristine [`fact_actuals.csv`](../files/samples/fact_actuals.csv) (610 rows), [`fact_budget.csv`](../files/samples/fact_budget.csv) (696 rows), [`dim_cost_center.csv`](../files/samples/dim_cost_center.csv), [`dim_account.csv`](../files/samples/dim_account.csv), and the [Downloads](#downloads) pack.

## 1. One row per cell, long format

Planning tools that take flat files generally want one row per intersection. Sum each fact to one row per cell, stack Actual and Budget with `UNION ALL`, and flag any code that isn't in the dimension tables. A [LEFT JOIN](https://docs.snowflake.com/en/sql-reference/constructs/join) keeps the cell even when the code is missing, so the orphan shows up instead of disappearing.

```sql title="01_v_plan_export_long.sql (core)"
SELECT
 c.cost_center,
 c.account,
 c.period,
 c.version,
 ROUND(c.amount, 2) AS amount,
 IFF(cc.cost_center IS NULL OR ac.account IS NULL, 'ORPHAN', 'OK') AS dim_status
FROM cells c
LEFT JOIN DIM_COST_CENTER cc ON cc.cost_center = c.cost_center
LEFT JOIN DIM_ACCOUNT ac ON ac.account = c.account;
```

The orphan check must return **0**. On the sample it does: every cost center and account in both facts exists in the dimensions.

## 2. Unload the data file and a control file

[COPY INTO &lt;location&gt;](https://docs.snowflake.com/en/sql-reference/sql/copy-into-location) writes query results to a stage. `HEADER = TRUE` adds column names, `SINGLE = TRUE` writes one file instead of several, and `COMPRESSION = NONE` keeps it a plain `.csv`. `ORDER BY` inside the unload subquery with `SINGLE = TRUE` is the usual pattern for one ordered file; the docs do not guarantee that order is kept. For bigger single files, set `MAX_FILE_SIZE` (default 16 MB, up to 5 GB); see the same [COPY INTO &lt;location&gt;](https://docs.snowflake.com/en/sql-reference/sql/copy-into-location) page. `TO_VARCHAR(amount, 'FM9999999990.00')` fixes two decimals, so `1200` doesn't arrive as `1200` in one row and `1200.00` in the next.

```sql title="02_copy_into_export.sql (data file)"
COPY INTO @SAMPLE_STAGE/plan_export/plan_load_2026_03.csv
FROM (
 SELECT cost_center, account, period, version, TO_VARCHAR(amount, 'FM9999999990.00') AS amount
 FROM V_PLAN_EXPORT_LONG
 WHERE (version = 'Actual' AND period = '2026-03') OR version = 'Budget'
 ORDER BY version, period, cost_center, account
)
FILE_FORMAT = (TYPE = CSV COMPRESSION = NONE FIELD_OPTIONALLY_ENCLOSED_BY = '"')
HEADER = TRUE
SINGLE = TRUE
OVERWRITE = TRUE;
```

The control file is a second, tiny unload: one row per version with `run_id`, row count and sum. Whoever imports the file can check it against the control file without opening Snowflake.

| version | row_count | amount_sum |
|---|---|---|
| Actual | 58 | 1,466,143.86 |
| Budget | 696 | 17,253,220.89 |

The data file holds **754** rows in total. `SAMPLE_STAGE` is an internal stage, so there are no cloud credentials or storage integrations to manage.

## 3. Load it back and reconcile

A query that says "the view has 58 rows" doesn't prove the file does. Load the file back into a scratch table with [COPY INTO &lt;table&gt;](https://docs.snowflake.com/en/sql-reference/sql/copy-into-table) and compare three layers per version: source facts, export view and reloaded file.

```sql title="03_reimport_and_recon.sql (diff columns)"
ROUND(e.exp_sum - s.src_sum, 2) AS export_vs_source_diff,
ROUND(COALESCE(f.file_sum, 0) - e.exp_sum, 2) AS file_vs_export_diff,
COALESCE(f.file_rows, 0) - e.exp_rows AS file_vs_export_row_diff
```

`COALESCE` matters: if a whole version went missing from the file, the diff shows the full amount instead of NULL.

## 4. What a broken file looks like

`04_broken_file_demo.sql` deletes one reloaded row (CC1000 / 400000 / 2026-03, 37,289.23) to imitate a row lost in transit. The recon then shows Actual **57** rows, file sum **1,428,854.63**, diff **−37,289.23** and row diff **−1**. Budget stays at 0.00. Re-run step 3 to get back to the clean state.

## Planning-tool import

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>Anaplan and Pigment each document importing flat (CSV) files: <a href="https://help.anaplan.com/set-up-a-data-import-into-modules-8d55fc47-e743-4630-b619-2481fa8645ae">Anaplan docs</a>, <a href="https://kb.pigment.com/docs/import-manually-lists">Pigment docs</a>. This post makes no claims about their APIs, connectors, field names or limits. Map the five columns to your model in the tool itself, and keep the control file next to the data file.</p>
</aside>

## Optional: wide layout

Some import templates want months as columns. `05_wide_variant.sql` pivots Budget into 12 period columns aliased as `m2025_10` through `m2026_09` so the names come out unquoted: **58** rows, one per cost center and account combination in the budget.

## Check the result

!!! success "Expected: Actual 58 / 1,466,143.86, Budget 696 / 17,253,220.89, every diff 0.00"
    ```sql
    -- 03_reimport_and_recon.sql
    -- Actual: 58 / 58 / 58 rows, 1466143.86, diffs 0.00, row diff 0
    -- Budget: 696 / 696 / 696 rows, 17253220.89, diffs 0.00, row diff 0
    ```
    Orphan check 0. Control file matches the recon rows.

## If it doesn't match

- **Orphan count above 0:** a new code reached the facts before the dimension. Add it to the dimension or map it before you export.
- **File rows lower than export rows:** the file was cut, or the reload skipped rows. Check `SKIP_HEADER = 1` is set only once and look at the COPY result for errors.
- **Several files instead of one:** `SINGLE = TRUE` is missing.
- **File sum off by a few cents:** amounts were written without fixed decimals or rounded twice. Round once in the view and format with `TO_VARCHAR`.
- **A whole version is missing:** the `WHERE` in step 2 lost its parentheses, so the `OR` applied to the wrong condition.
- **Diffs show NULL:** the `COALESCE` around the file side was dropped.

## Wrap-up

- Export one row per cell, with an orphan check first.
- Ship a control file next to the data file.
- Load the file back and reconcile it; 0.00 before it leaves Snowflake.
- Keep vendor claims to what their public docs say.

## Downloads

All files use fictional sample data and placeholder names.

[[download:planexport/01_v_plan_export_long.sql|Download 01_v_plan_export_long.sql]]
[[download:planexport/02_copy_into_export.sql|Download 02_copy_into_export.sql]]
[[download:planexport/03_reimport_and_recon.sql|Download 03_reimport_and_recon.sql]]
[[download:planexport/04_broken_file_demo.sql|Download 04_broken_file_demo.sql]]
[[download:planexport/05_wide_variant.sql|Download 05_wide_variant.sql]]
[[download:planexport/README.md|Download README.md]]
