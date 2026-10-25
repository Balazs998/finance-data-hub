# FDH Motors demo pack (fictional) -> FDH_DEMO.MOTORS

"FDH Motors", its plants, models, markets, parts, suppliers, customers, projects and roles are invented placeholders. No real automaker, brand, plant, supplier or person. Emails are @example.com only.
`gen_motors.py` (fixed seeds, Decimal, 2 dp, EUR) regenerates every CSV identically. It reads `../fact_actuals.csv` and `../fact_budget.csv` read-only.
`load_motors.sql` creates the new schema FDH_DEMO.MOTORS (owner SYSADMIN, no grants) and loads the CSVs. The FDH_DEMO.SAMPLE files one folder up are unchanged.
`erp_gl_extract.csv` sums exactly to FACT_ACTUALS per period, cost center and account for 2025-10..2026-03. `erp_gl_extract_2026-03.csv` has a TRAILER row (rows, control total); the `_dropped` variant is missing one row but keeps the same trailer.
Seeded cases and check figures for the cash forecast are in the 13-week cash runway note. The other tables in this folder are fictional FDH_DEMO.MOTORS sample data for later notes in the same series.
