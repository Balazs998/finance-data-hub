# ERP -> Snowflake -> Jedox control totals pack (FDH_DEMO fictional)

All data is made up. "FDH Motors", company code FDH1, cost centers, accounts and amounts are placeholders from the Finance Data Hub sample pack, not a real company or ERP. Currency EUR.

This is a SOX-style evidence pattern: it records what was checked, by which role, when, and with what result. It is not an audit certification and makes no compliance claim.

**Schema:** `FDH_DEMO.MOTORS`. Reuses MOTORS_STAGE / CSV_HDR, LOAD_LOG and CONTROL_EVIDENCE from `load_motors.sql`.

**What this pack creates:** one **table**, `ERP_GL_LANDING` (CREATE TABLE IF NOT EXISTS, raw text landing, in DATA-DICTIONARY.md), and four **views** (`V_ERP_GL_LANDED`, `V_ERP_GL_TRAILER`, `V_ERP_GL_CELLS`, `V_CONTROL_RECON`). It writes with INSERT (and COPY into the landing table) only; it never updates or deletes. **No grants, no roles, no new stage.** `JEDOX_ETL_ROLE` stays views-only. The Jedox write-back runs as a separate role with INSERT on `MOTORS.LOAD_LOG` plus USAGE on the database, schema and warehouse. Nothing else: no SELECT, UPDATE, DELETE or ownership. Use a separate role, never `JEDOX_ETL_ROLE`. The role that writes LOAD_LOG and CONTROL_EVIDENCE has INSERT and SELECT only, plus the same USAGE grants. The table owner (`SYSADMIN` in this walkthrough) can still update or delete rows, so the demo shows the pattern but doesn't enforce append-only. In production, the writing role must not own these tables.

**Not run on a live account.** The SQL follows the Snowflake docs. The expected numbers below were recomputed from the CSVs in Python (Decimal). The Jedox hop is described from the Jedox posts on this site and has not been run.

## Run order

1. Load the sample pack (`load_motors.sql`), then PUT the two 2026-03 files (commands in file 01).
2. `01_erp_gl_landing_ddl.sql` - landing table.
3. `02_views.sql` - typed lines, trailer, cells.
4. `03_load_and_log.sql` - per run: COPY the file, then log hops `file`, `snowflake`, `snowflake_cells`.
5. `04_v_control_recon.sql` - recon view (create once; it reads LOAD_LOG).
6. `05_jedox_hop.sql` - only after step 1 = PASS: the Jedox job loads the cells, reads them back, and writes hop `jedox` (template).
7. `06_control_evidence.sql` - one evidence row per run.
8. `07_checks.sql` - the checks below.

For R2 and R3, set the new run_id and file name and repeat steps 4, 6 (only if the gate returns 1), 7 and 8. Create the views (steps 3 and 5) once.

## NULL handling

- TRY_TO_NUMBER / TRY_TO_DATE / TRY_TO_DECIMAL return NULL for bad text; check b) counts those lines.
- No trailer in a run: hop `file` has NULL rows and total and status TRAILER_MISSING; the recon then shows MISMATCH.
- A hop with no LOAD_LOG row: MISSING_HOP, never PASS. Comparisons use IS DISTINCT FROM.
- Log times are stored as session-local wall-clock time (TIMESTAMP_NTZ).

## Expected results

| Check | Expected |
|---|---|
| ERP_GL_EXTRACT 2026-03 | 284 lines, 1,466,143.86 |
| FACT_ACTUALS 2026-03 (Actual) | 58 cells, 1,466,143.86; 0 cell differences against ERP_GL_EXTRACT |
| R1 clean (erp_gl_extract_2026-03.csv) | trailer 284 / 1,466,143.86; landed 284 / 1,466,143.86; 58 cells; Jedox 58 / 1,466,143.86; 3 x PASS, diff 0.00 |
| R2 dropped (erp_gl_extract_2026-03_dropped.csv) | trailer 284 / 1,466,143.86; landed 283 / 1,460,108.50; diff -6,035.36; exactly 1 MISMATCH (step 1); step 2 PASS; no Jedox load (step 3 MISSING_HOP); evidence FAIL |
| Dropped line | FDH1-202603-CC4000-600000 / 1, 6,035.36 (cell CC4000 / 600000 reads 17,455.20 instead of 23,490.56) |
| R3 duplicate (clean file again) | 0 lines land; DUPLICATE on all 3 steps; no Jedox load |
| Jedox finished with warnings (status 20) | step 3 PASS_WARNING only if count and total match, otherwise MISMATCH; evidence PASS_WARNING or FAIL |
| Jedox status 30, 40, 50, 55, 60 or 70 | no jedox row; step 3 MISSING_HOP; evidence FAIL |
| Evidence | one CONTROL_EVIDENCE row per run: R1 PASS, R2 FAIL, R3 DUPLICATE |
