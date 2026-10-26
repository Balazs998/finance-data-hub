# 13-week cash forecast and runway SQL pack (FDH_DEMO fictional)

All data is made up. "FDH Motors", its customers (CUST-xx), suppliers (SUPP-xx), projects (PRJxx) and amounts are placeholders from the Finance Data Hub sample pack, not a real company. Currency EUR.

**Schema:** `FDH_DEMO.MOTORS`. Role for the walkthrough: `SYSADMIN` (owner). This pack adds **no grants**. `JEDOX_ETL_ROLE` stays views-only and gets nothing here; any later view grant needs an admin's review.

**Not run on a live account.** The SQL follows the Snowflake docs; the expected numbers below were recomputed from the CSVs with the same logic (Python, Decimal) and match the sample pack's data dictionary.

## Run order

1. `01_cash_tables_ddl_load.sql` - create `CASH_OPENING`, `CASH_FLOW`, `CASH_SCENARIO`, `LIQUIDITY_FLOOR` (skip if you ran `load_motors.sql`; the cash CSVs are already loaded by it). No stage or file format of its own: an optional reload COPYs from `@MOTORS_STAGE` with `FILE_FORMAT = (FORMAT_NAME = CSV_HDR)`. Expect 158 CASH_FLOW rows (146 FORECAST, 12 ACTUAL).
2. `02_v_cash_flow_week.sql` - `V_CASH_FLOW_WEEK`: week from `COALESCE(actual_cash_date, expected_cash_date)`, never the due date.
3. `03_v_cash_13w.sql` - `V_CASH_13W`: weekly receipts, disbursements and closing balance per scenario.
4. `04_v_cash_runway.sql` - `V_CASH_RUNWAY` (one row per scenario) and `V_CASH_FLOOR_ALERT` (every week below the floor).
5. `05_v_cash_week1_avf.sql` - `V_CASH_WEEK1_AVF`: week-1 actual vs forecast by category.
6. `06_v_receipt_slip.sql` - `V_CASH_RECEIPT_SLIP`: receipts that land in a later week than they fall due.
7. `07_checks.sql` - the checks below.

## Definitions

- Week 1 = as-of date 2026-09-07 (Monday) to 2026-09-13. Week n = days 7(n-1) to 7n-1 after as-of.
- Breach = a week's closing balance strictly below the floor (1,500,000.00).
- Runway (weeks) = number of full weeks that close at or above the floor before the first breach = first_breach_week - 1. `>13` = no breach inside the 13-week horizon.

## Expected results

| Check | Expected |
|---|---|
| Opening cash (2026-09-07) | 4,000,000.00 |
| FORECAST receipts / disbursements, weeks 1-13 | 13,604,777.09 / 14,383,187.74 |
| Base week-13 closing (= 4,000,000.00 + 13,604,777.09 - 14,383,187.74) | 3,221,589.35 |
| Base | no breach, runway `>13`, min 2,561,358.22 in week 8 |
| Down (receipts x 0.90, disbursements x 1.05) | first breach week 8, runway 7, week 8 = 1,228,558.33, week 13 = 1,141,952.25 |
| Up (receipts x 1.08, disbursements x 0.97) | no breach, runway `>13`, min 3,529,153.86 in week 8, week 13 = 4,741,467.15 |
| Week 8 spike | tax CF0086 2,310,000.00 (2026-10-28) + payroll CF0092 610,000.00 (2026-10-30) |
| Late receipt CF0006 | due 2026-09-01, expected 2026-09-09 (week 1), no actual yet; the only receipt-slip row |
| Refund CF0064 | -45,000.00 receipt on 2026-10-14 (week 6), only negative row |
| Week-1 AvF | receipts_customers 1,218,939.83 vs 1,028,482.79, variance -190,457.04 EXPLAIN; all other categories OK (1 EXPLAIN flag) |

Week-1 AvF, all rows:

| category | forecast_wk1 | actual_wk1 | variance | flag |
|---|---|---|---|---|
| capex | 80,624.80 | 80,511.93 | -112.87 | OK |
| it_services | 22,171.85 | 22,371.40 | 199.55 | OK |
| payments_suppliers | 694,004.25 | 716,653.27 | 22,649.02 | OK |
| receipts_customers | 1,218,939.83 | 1,028,482.79 | -190,457.04 | EXPLAIN |
| rent | 85,000.00 | 85,102.00 | 102.00 | OK |
| tax | 95,000.00 | 96,643.50 | 1,643.50 | OK |

Running sums stay unrounded; values are rounded to 2 dp only for display.
