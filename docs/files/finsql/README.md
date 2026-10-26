# finsql: Finance SQL patterns on Snowflake (FDH_DEMO)

Fictional sample data only (FDH_DEMO.SAMPLE). Not run on a live Snowflake account.

| File | What it does |
|---|---|
| 01_v_fin_avb_cell.sql | V_FIN_AVB_CELL: actual vs budget per cell, FULL OUTER JOIN, 701 rows |
| 02_v_fin_avb_ptd_ytd.sql | V_FIN_AVB_PTD_YTD: month, fiscal QTD and YTD (FY starts October) |
| 03_snapshot_vs_current_vs_budget.sql | Reported snapshot vs current vs budget, reuses FACT_ACTUALS_SNAPSHOT |
| 04_forecast_pattern.sql | Forecast pattern, waiting for sample FACT_FORECAST data |
| 05_checks.sql | Tie-outs; every diff 0.00 |

Run order: 01, 02, then the month-end snapshots pack (01, 03, optional 02), then 03 and 05 here.
Creates two views, no tables, no grants.
