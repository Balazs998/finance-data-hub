# Close tracker and journal anomaly flags SQL pack (FDH_DEMO fictional)

All data is made up. "FDH Motors", its roles, cost centers, accounts and amounts are placeholders from the Finance Data Hub sample pack, not a real company or ERP. Emails are @example.com only. Currency EUR.

These are simple statistics and rules that pick journal lines for a person to review. They are not AI, they don't detect fraud, and they make no accuracy claim. No external service is called.

**Schema:** `FDH_DEMO.MOTORS`, reading CLOSE_TASK, ERP_GL_EXTRACT and MOTORS_RECIPIENTS (load_motors.sql) and `FDH_DEMO.SAMPLE.DIM_ACCOUNT`.

**What this pack creates:** **eight views** and nothing else: `V_CLOSE_TASK`, `V_CLOSE_STATUS`, `V_JE_STATS`, `V_JE_ZSCORE`, `V_JE_IQR`, `V_JE_RULES`, `V_JE_FLAGS`, `V_JE_ALERT`. No tables, no stages, no roles, **no grants**. Every query only reads journals. `JEDOX_ETL_ROLE` is not touched.

**Not run on a live account.** The SQL follows the Snowflake docs. The expected numbers below were recomputed from the CSVs in Python and match the sample pack's data dictionary.

## Run order

1. Load the sample pack (`load_motors.sql`, and `load_snowflake.sql` for DIM_ACCOUNT).
2. `01_v_close_status.sql` - Step 1: close tracker by day.
3. `02_v_je_zscore.sql` - Step 2: group statistics and z-score flags (|z| > 3).
4. `03_v_je_iqr.sql` - Step 3: IQR flags (outside Q1 - 1.5 x IQR / Q3 + 1.5 x IQR).
5. `04_v_je_rules.sql` - Step 4: weekend, round-amount and negative-expense rules.
6. `05_v_je_flags_alert.sql` - Step 5: all flags, recipients, and the send/no-send gate.
7. `06_checks.sql` - "Check the result": the checks below.

## Parameters

z limit 3, IQR k 1.5, round amount >= 10,000 and a multiple of 1,000. Each sits in a `p` CTE at the top of its view. They are starting points, not truths.

## NULL handling

- `completed_at` NULL = not done: never counts as done, counts as overdue once past due.
- A group with one line or identical amounts has STDDEV NULL or 0: z is NULL and the flag is FALSE.
- An account missing from DIM_ACCOUNT can't hit NEGATIVE_EXPENSE; check e) counts those lines (expect 0).

## Expected results

| Check | Expected |
|---|---|
| Journal lines | 1,602 (2025-10..2026-03), 60 account x cost center groups (4 to 51 lines each) |
| Late tasks | 3: CT10, CT12, CT21 |
| Blocked | 1: CT19 Tax provision |
| Close by day | WD1 4/25 done (16.00%), WD3 12/25 (48.00%), WD7 2026-04-09 24/25 (96.00%), CT19 open |
| ZSCORE | 3 lines: S1 (z 6.95), S4 (z -5.06), seasonal (z 4.86) |
| IQR | 33 lines: S1, S4, S5, seasonal + 29 others (5 of them in the S4 cell's group) |
| WEEKEND / ROUND_AMOUNT / NEGATIVE_EXPENSE | 1 each: S3 / S2 / S4 |
| Distinct lines flagged by any method | 35 |
| Missed by z-score | S2, S3, S5 |
| Unknown accounts | 0 |
| Gate | 1 (there are flags) |
| Alert rows | 35 (one per flagged line, to gl.accountant@example.com) |

The alert contains journal amounts. Give the sending job a role that can only SELECT `V_JE_FLAGS` and `V_JE_ALERT`, not `ERP_GL_EXTRACT`, and send it only to internal finance recipients. Keep real addresses in your own `MOTORS_RECIPIENTS` table, never in a file you publish.
