# Snapshots SQL pack (FDH_DEMO fictional)

All objects and amounts here are made-up sample data for the Finance Data Hub tutorial on permanent month-end snapshots vs Time Travel. Nothing comes from a real company or a live Snowflake account.

**Run order**

1. Load the unmodified `fact_actuals.csv` (610 rows) with `load_snowflake.sql` from the samples folder if you have not already.
2. `01_fact_actuals_snapshot_ddl.sql` — create `FACT_ACTUALS_SNAPSHOT`.
3. `03_take_snapshot.sql` — freeze 2026-03 / `ME_CLOSE_2026_03_R1` (58 rows, 1,466,143.86).
4. `02_seed_late_posting.sql` — insert one late Actual row for 2026-03 (+2,500.00). Run only after the snapshot. Do not bake this into the shared CSV; other posts need the unmodified 610-row file.
5. `04_v_snapshot_vs_current.sql` — create the compare view.
6. `05_compare_query.sql` — check reported vs current (expect diff 2,500.00).

Run these scripts as `SYSADMIN`. Do not grant `JEDOX_ETL_ROLE` on `FACT_ACTUALS_SNAPSHOT` or `V_SNAPSHOT_VS_CURRENT`. That role stays views-only, and this pack adds no grants.
