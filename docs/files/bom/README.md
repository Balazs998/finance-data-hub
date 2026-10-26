# BOM cost rollup and variance SQL pack (FDH_DEMO fictional)

All data is made up. "FDH Motors", its plants (P100-P300), models (M-A, M-B), parts and amounts are placeholders from the Finance Data Hub sample pack, not a real company. Currency EUR.

**Schema:** `FDH_DEMO.MOTORS`. Tables DIM_PART, BOM, STD_COST, PART_PURCHASE and FACT_PRODUCTION come from `load_motors.sql` (MOTORS_STAGE / CSV_HDR). This pack creates **views only**: no tables, no stages, **no grants**. `JEDOX_ETL_ROLE` is not touched.

**Not run on a live account.** The SQL follows the Snowflake docs. The expected numbers below were recomputed from the CSVs in Python (Decimal) and match the sample pack's data dictionary.

## Run order

1. Load the sample pack (`load_motors.sql`).
2. `01_v_bom_exploded.sql` - `V_BOM_EXPLODED`: recursive explosion per model and period, depth guard 10.
3. `02_v_std_cost_rollup.sql` - `V_STD_COST_ROLLUP`: std cost per vehicle; NULL if any part lacks a std cost.
4. `03_v_ppv.sql` - `V_PPV`: (actual price - std) x qty purchased.
5. `04_v_usage_var.sql` - `V_USAGE_VAR`: (actual qty - std qty for units built) x std. Purchases stand in for usage.
6. `05_checks.sql` - the checks below.

## NULL handling

- `BOM.valid_to` NULL = still valid. A line is valid in a period if it is valid on the 1st of the month.
- Missing std cost: the rollup returns NULL for that model and period (never a silently lower number). PPV and usage variance return NULL for that row.
- Usage: a part bought but not needed, or needed but not bought, counts as 0 on the missing side.
- Comparisons on nullable columns use `IS DISTINCT FROM`.

## Expected results

| Check | Expected |
|---|---|
| a) Rows at depth limit | 0 |
| b) Missing std cost | 1: P-TRIM-B, 2026-05 (M-B 2026-05 rollup is NULL) |
| c) Std cost per vehicle | M-A 2026-03 8,310.10; M-B 2026-03 11,707.40; M-B 2026-04 11,323.40 (P-CELL-01 x110 replaced by P-CELL-02 x96 from 2026-04-01) |
| d) PPV 2026-03 | 46,159.51 |
| d) PPV, all periods 2025-10..2026-03 | 81,940.27 |
| e) Biggest PPV part, 2026-03 | P-ECU-01 42,000.00 |
| f) Usage variance | 1 non-zero row: P300 / P-PANEL-B / 2026-03, 124.20 bought vs 115 std, x 420.00 = 3,864.00 |
