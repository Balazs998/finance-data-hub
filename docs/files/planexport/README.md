# planexport: Snowflake to planning-tool flat load file (FDH_DEMO)

Fictional sample data only (FDH_DEMO.SAMPLE). Not run on a live Snowflake account.

| File | What it does |
|---|---|
| 01_v_plan_export_long.sql | V_PLAN_EXPORT_LONG: one row per cell, long format, orphan check |
| 02_copy_into_export.sql | COPY INTO the internal SAMPLE_STAGE: data file plus control file |
| 03_reimport_and_recon.sql | Loads the file back into PLAN_EXPORT_REIMPORT; V_PLAN_EXPORT_RECON, every diff 0.00 |
| 04_broken_file_demo.sql | Drops one row to show a non-zero diff (-37289.23, -1 row) |
| 05_wide_variant.sql | Optional wide layout, 12 Budget months as columns (aliased m2025_10–m2026_09), 58 rows |

Run order: 01, 02, 03, then optionally 04 (re-run 03 afterwards) and 05.
Creates two views and one scratch table. Reuses the internal SAMPLE_STAGE. No external stage, no grants.
