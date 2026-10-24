# FX rate SQL pack (FDH_DEMO fictional)

All objects and amounts here are made-up sample data for the Finance Data Hub tutorial on FX conversion with a rate lock and a period lock. Rates are fictional, not market rates. Nothing comes from a real company or a live Snowflake account.

**Run order**

1. Load the pristine `fact_actuals.csv` (610 rows) with `load_snowflake.sql` from the samples folder if you have not already.
2. `01_fx_rate_daily_ddl.sql` — create `FX_RATE_DAILY`.
3. `02_fx_rate_period_ddl.sql` — create `FX_RATE_PERIOD`.
4. `03_seed_fx_rates.sql` — fictional daily and period rates. Omits period `2026-05`. The gap check returns 1.
5. `04_v_fx_missing_rates.sql` — create `V_FX_MISSING_RATES`. Expect one row, period `2026-05`.
6. `05_asof_join_convert.sql` — ASOF examples. Holiday `2026-03-17` uses `2026-03-16`. `2025-09-01` is NULL. Each 1000.00 EUR demo amount converts to 1111.11 USD.
7. `06_period_lock_and_snapshot.sql` — lock 2026-03 month-end and freeze `FACT_ACTUALS_FX_SNAPSHOT` / `FX_CLOSE_2026_03_R1` (58 rows, EUR 1,466,143.86, USD 1,629,048.72 at 0.900000). Run this before step 8.
8. `07_restate_after_lock_demo.sql` — set the live 2026-03 month-end rate to 0.910000. The snapshot stays USD 1,629,048.72. A live recompute is USD 1,611,147.13.

Run these scripts as `SYSADMIN`. Do not grant `JEDOX_ETL_ROLE` on the FX tables, `V_FX_MISSING_RATES`, or `FACT_ACTUALS_FX_SNAPSHOT`. That role stays views-only, and this pack adds no grants.
