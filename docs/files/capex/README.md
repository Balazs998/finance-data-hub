# Capex tracking SQL pack (FDH_DEMO fictional)

All data is made up. "FDH Motors", its plants (P100-P300), projects (PRJ01-PRJ12), roles and amounts are placeholders from the Finance Data Hub sample pack, not a real company. Emails are @example.com only. Currency EUR.

**Schema:** `FDH_DEMO.MOTORS`. Tables CAPEX_PROJECT, CAPEX_COMMIT, CAPEX_ACTUAL and MOTORS_RECIPIENTS come from `load_motors.sql` (MOTORS_STAGE / CSV_HDR). This pack creates **views only** and adds **no grants**. `JEDOX_ETL_ROLE` is not touched. The views read data and send nothing.

**Not run on a live account.** The SQL follows the Snowflake docs. The expected numbers below were recomputed from the CSVs in Python (Decimal) and match the sample pack's data dictionary.

## Run order

1. Load the sample pack (`load_motors.sql`).
2. `01_v_capex_status.sql` - `V_CAPEX_STATUS`: budget, committed (open POs), actual, remaining, % used, approval, late invoices.
3. `02_v_capex_exceptions.sql` - `V_CAPEX_EXCEPTIONS`: OVER_BUDGET, UNAPPROVED_SPEND, SOD_FLAG.
4. `03_v_capex_alert.sql` - `V_CAPEX_ALERT`: one row per recipient and exception.
5. `04_checks.sql` - the checks below.

## Rules

- Committed = OPEN POs only. A CLOSED PO has been invoiced, so it is already in actual.
- OVER_BUDGET: committed + actual > budget x 1.05 (tolerance 5%).
- UNAPPROVED_SPEND: approval_status is not APPROVED and committed + actual > 0.
- SOD_FLAG: approved_by_role = owner_role.

## Expected results

| Check | Expected |
|---|---|
| Totals | budget 7,400,000.00, committed 1,202,500.00, actual 5,320,500.00, remaining 877,000.00 |
| Reconciliation diffs | 0.00 budget, committed, actual |
| OVER_BUDGET | 2: PRJ03 (112.00%, actual alone), PRJ05 (actual 80.00%, 110.00% with commitments) |
| UNAPPROVED_SPEND | 1: PRJ09 (PENDING, 45,000.00 actual) |
| SOD_FLAG | 1: PRJ10 (IT_PROJECTS_LEAD approved its own project) |
| Within tolerance | PRJ07 at 103.00% with open POs (85.00% invoiced), no alert |
| Late invoice | PRJ11 closed 2026-05, INV0051 in 2026-07 (late_invoices 1) |
| Alert rows | 8 (4 owners + 4 committee) |
