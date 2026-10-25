---
title: "Prove every hop: control totals from ERP to Snowflake to Jedox, with a load log and an evidence table"
description: "Record row counts, control totals and a fingerprint at each hop of an ERP -> Snowflake -> Jedox load, compare the hops automatically, and keep an append-only evidence table you can export, for the fictional FDH Motors on FDH_DEMO.MOTORS."
social_image: automaker-erp-control-totals.png
---

# Prove every hop: control totals from ERP to Snowflake to Jedox

<p class="post-meta">Snowflake + Jedox · Intermediate · ~35 min · Automaker series</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>The Snowflake SQL in this post has not been run on a live account. Every check number was recomputed from the sample CSVs with the same logic as the SQL. The Jedox step follows the Jedox docs and has not been run on a live Jedox install; the Jedox figure (58 cells) comes from a simulated run, not a live Jedox read-back. This is a SOX-style evidence pattern, not an audit certification or a compliance claim.</p>
</aside>

Actuals travel from the ERP into Snowflake and on into the Jedox planning model. Every month someone is asked the same question: can you show that all of it arrived? The usual answer is a few screenshots and a spreadsheet with totals typed in by hand, rebuilt each time.

This post makes each hop record its own row count and control total in a load log, compares the hops automatically, and writes one evidence row per run: which control, which role, when, the result, and where the proof is. The example uses Snowflake and Jedox, but the pattern works with any loader that can write one row to a log table.

## What you'll build

This pack creates **one table and four views**:

- `ERP_GL_LANDING` (table, new): the raw file, every column as text, including the trailer
- `V_ERP_GL_LANDED`, `V_ERP_GL_TRAILER`, `V_ERP_GL_CELLS`: typed lines, the trailer, and the cells Jedox reads
- `V_CONTROL_RECON`: each hop compared with the one before it, per run

It writes to `LOAD_LOG` and `CONTROL_EVIDENCE` (both already in the sample pack) with INSERT only. It never updates or deletes, and it adds no grants.

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="ERP control totals">
  <a href="../control-totals.svg"><img src="../control-totals.svg" alt="Control totals at every hop for FDH Motors 2026-03: the ERP file trailer says 284 lines and 1,466,143.86. Snowflake lands 284 lines with the same total (ERP_GL_LANDING, V_ERP_GL_LANDED), aggregates them to 58 cells (V_ERP_GL_CELLS), and Jedox reports 58 cells. A check on each hop compares rows and totals, and all pass. Every hop writes to LOAD_LOG, and V_CONTROL_RECON appends one row per run to CONTROL_EVIDENCE: R1 PASS, R2 FAIL, because one line was dropped (−6,035.36), so the Jedox load is blocked and step 3 shows MISSING_HOP; R3 DUPLICATE." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) in `FDH_DEMO.MOTORS` for the walkthrough. This pack adds no grants. `JEDOX_ETL_ROLE` stays views-only. In production, the roles that write the log and the evidence should be INSERT-only; your security owner decides those grants.
    - Product version: any current Snowflake account (docs-based, not run). For the Jedox hop, the load from the Snowflake to Jedox post (not run).
    - Previous posts: [Snowflake to Jedox](../jedox/snowflake-to-jedox.md) (the load) and [Email only when a Jedox load fails](../jedox/failure-alerts.md) (why the job writes its own row count)
    - Sample data: `erp_gl_extract_2026-03.csv` (clean), `erp_gl_extract_2026-03_dropped.csv` (one line missing), plus `load_motors.sql`

## Step 1: Start from a file with a trailer

The fictional ERP extract has one row per journal line and ends with a trailer: what the ERP says it sent.

```text
doc_id,line_no,company_code,posting_date,period,cost_center,account,amount,currency
FDH1-202603-CC1000-400000,1,FDH1,2026-03-02,2026-03,CC1000,400000,6373.72,EUR
...
TRAILER,284,1466143.86,,,,,,
```

For 2026-03 that's 284 lines and 1,466,143.86. The same period in `ERP_GL_EXTRACT` is 284 lines and 1,466,143.86, and it aggregates to the 58 cells of `FACT_ACTUALS` for 2026-03 with 0 cell differences (check a). The second file is identical except one line is missing, while its trailer still says 284 / 1,466,143.86.

## Step 2: Land the file as text

The trailer doesn't fit the journal-line columns, and a COPY with a SELECT can't filter rows: WHERE is not supported in COPY transformations ([Transform data during a load](https://docs.snowflake.com/en/user-guide/data-load-transform)). So everything lands as text in `ERP_GL_LANDING`, and the views split the trailer from the lines.

```sql
CREATE TABLE IF NOT EXISTS ERP_GL_LANDING (file_name VARCHAR(256), file_row NUMBER(10,0), file_content_key VARCHAR(128), c1 VARCHAR(64), c2 VARCHAR(64), c3 VARCHAR(64), c4 VARCHAR(64), c5 VARCHAR(64), c6 VARCHAR(64), c7 VARCHAR(64), c8 VARCHAR(64), c9 VARCHAR(64), loaded_at TIMESTAMP_LTZ);
```

`02_views.sql` types the lines with `TRY_TO_NUMBER`, `TRY_TO_DATE` and `TRY_TO_DECIMAL`, which return NULL instead of failing on bad text ([TRY_TO_DECIMAL](https://docs.snowflake.com/en/sql-reference/functions/try_to_decimal)). Check b) counts lines that didn't parse, so a NULL never hides quietly.

## Step 3: Load and log the first two hops

`03_load_and_log.sql` runs once per file. The COPY stores the file name, row number and checksum of each row from Snowflake's metadata columns ([Query metadata for staged files](https://docs.snowflake.com/en/user-guide/querying-metadata)):

```sql
COPY INTO ERP_GL_LANDING (file_name, file_row, file_content_key, c1, c2, c3, c4, c5, c6, c7, c8, c9, loaded_at)
FROM (
 SELECT METADATA$FILENAME, METADATA$FILE_ROW_NUMBER, METADATA$FILE_CONTENT_KEY,
 t.$1, t.$2, t.$3, t.$4, t.$5, t.$6, t.$7, t.$8, t.$9, METADATA$START_SCAN_TIME
 FROM @MOTORS_STAGE t
)
-- FILES needs a literal; session variables don't work here. To parameterise, build the COPY string and run it with EXECUTE IMMEDIATE.
-- Only accept file names that match a pattern such as ^erp_gl_extract_[0-9]{4}-[0-9]{2}[a-z_]*\.csv\.gz$ before you build the string.
FILES = ('erp_gl_extract_2026-03.csv.gz');
```

Then it writes three rows to `LOAD_LOG`:

- **file**: the trailer's row count and total
- **snowflake**: lines that actually landed in this run, their total, and a `HASH_AGG` fingerprint
- **snowflake_cells**: the cost center × account × period cells that Jedox will read (58 for 2026-03)

`HASH_AGG` gives the same value whatever the row order, and duplicate rows change it ([HASH_AGG](https://docs.snowflake.com/en/sql-reference/functions/hash_agg)). It isn't a cryptographic hash. It's a 64-bit change detector, so a collision is very unlikely but possible. A genuinely identical re-extract under a new file name is also logged DUPLICATE on purpose, so check it and rerun it under a new run_id if it's legitimate.

**Duplicates.** Snowflake keeps load metadata per table and by default skips a file it has already loaded; that metadata expires after 64 days, and `FORCE = TRUE` reloads anyway ([Loading data](https://docs.snowflake.com/en/user-guide/data-load-considerations-load)). So don't use `FORCE` here. If nothing lands, or the fingerprint matches an earlier LOADED run (the same lines under a new file name), the snowflake hop is logged as DUPLICATE and the Jedox load doesn't start ([COPY INTO <table>](https://docs.snowflake.com/en/sql-reference/sql/copy-into-table)).

Load metadata belongs to the table. Recreating `ERP_GL_LANDING` erases it, which is why the DDL uses IF NOT EXISTS.

The run variables use `SET` ([session variables](https://docs.snowflake.com/en/sql-reference/session-variables)), and `run_by_role` is `CURRENT_ROLE()` ([CURRENT_ROLE](https://docs.snowflake.com/en/sql-reference/functions/current_role)). Log times are stored as session-local wall-clock time (TIMESTAMP_NTZ).

## Step 4: The Jedox hop writes its own row

```sql
-- Gate: 1 = start the Jedox load, 0 = stop.
-- step 1 = PASS implies hop snowflake = LOADED (a DUPLICATE run shows DUPLICATE on step 1)
SELECT COALESCE(MAX(IFF(result = 'PASS', 1, 0)), 0) AS start_jedox
FROM V_CONTROL_RECON
WHERE run_id = $run_id AND step_no = 1;
```

The gate comes first: start the Jedox load only when hop `snowflake` = LOADED and `V_CONTROL_RECON` step 1 = PASS for this run_id. (`V_CONTROL_RECON` is created in Step 5; run file 04 before this.) A file that doesn't match its trailer never reaches the planning model.

The Jedox load reads `V_ERP_GL_CELLS` for the file (`file_name = $file_name`), as in the [Snowflake to Jedox](../jedox/snowflake-to-jedox.md) post. Jedox's Integrator State gives a status but no row count (see the [failure-alerts post](../jedox/failure-alerts.md)). After the Cube Load, the job reads back the slice it loaded with a Cube Extract (base elements only), counts the cells and sums them with a TableAggregation Transform, and inserts one `jedox` row into LOAD_LOG with a Relational Load in insert mode ([Cube Extract](https://knowledgebase.jedox.com/integration/extracts/cube-extract.htm), [TableAggregation Transform](https://knowledgebase.jedox.com/integration/transforms/tableaggregation-transform.htm), [Relational Load](https://knowledgebase.jedox.com/integration/loads/relational-load.htm)). Never use mode update (it deletes the table's rows first) or create (it drops the table).

The control totals decide the result, not the status code ([Integrator job status codes](https://knowledgebase.jedox.com/jedox/maintenance/scheduler-integrator-jobs.htm)):

- **Status 10 or 20:** read back and write the row as LOADED (10) or WARNING (20). If the count and the total both match, the result is PASS (10) or PASS_WARNING (20); otherwise it's MISMATCH.
- **Status 30, 40, 50, 55, 60 or 70:** write no `jedox` row, so the recon shows MISSING_HOP (= FAIL).

The reason: a Cube Load skips cells with missing elements and only logs a warning ([Cube Load](https://knowledgebase.jedox.com/integration/loads/cube-load.htm)), so a status 20 run can be short of cells and still look fine.

A Relational Load can't run `CURRENT_TIMESTAMP()` or `CURRENT_ROLE()`, so the job supplies `run_at` and `run_by_role` itself.

The read-back uses Empty cells = excludeEmpty. The cube doesn't store zero values (the Jedox default), so a cell that loads as 0.00 is deleted, not stored, and the read-back would count one cell fewer than `V_ERP_GL_CELLS`. 2026-03 has no zero cells (58 of 58 non-zero). ([Zero values](https://knowledgebase.jedox.com/jedox/in-memory-db/zero-values.htm))

`05_jedox_hop.sql` is only a template for that row. Which role inserts it is a security decision: `JEDOX_ETL_ROLE` stays views-only, so it should be a separate write role with INSERT on `MOTORS.LOAD_LOG` plus USAGE on the database, schema and warehouse. Nothing else: no SELECT, UPDATE, DELETE or ownership. Use a separate role, never `JEDOX_ETL_ROLE`. This pack grants nothing and creates no role.

## Step 5: Compare the hops

`V_CONTROL_RECON` compares each hop with the one before it. Control totals are compared at every step. Row counts are compared only where the grain matches: file vs snowflake (lines) and cells vs Jedox (cells).

```sql
CREATE OR REPLACE VIEW V_CONTROL_RECON AS
WITH steps AS (
 SELECT column1 AS step_no, column2 AS hop, column3 AS prev_hop, column4 AS compare_rows
 FROM VALUES (1, 'snowflake', 'file', TRUE), (2, 'snowflake_cells', 'snowflake', FALSE), (3, 'jedox', 'snowflake_cells', TRUE)
), runs AS (
 SELECT run_id, period, MAX(IFF(hop = 'snowflake' AND status = 'DUPLICATE', 1, 0)) AS is_dup
 FROM LOAD_LOG GROUP BY run_id, period
)
SELECT r.run_id, r.period, s.step_no, s.prev_hop, s.hop,
 p.rows AS prev_rows, c.rows AS hop_rows, p.control_total AS prev_total, c.control_total AS hop_total,
 c.control_total - p.control_total AS total_diff, c.status AS hop_status,
 CASE
 WHEN r.is_dup = 1 THEN 'DUPLICATE'
 WHEN p.run_id IS NULL OR c.run_id IS NULL THEN 'MISSING_HOP'
 WHEN c.control_total IS DISTINCT FROM p.control_total THEN 'MISMATCH'
 WHEN s.compare_rows AND c.rows IS DISTINCT FROM p.rows THEN 'MISMATCH'
 WHEN c.status = 'WARNING' THEN 'PASS_WARNING'
 ELSE 'PASS'
 END AS result
FROM runs r CROSS JOIN steps s
LEFT JOIN LOAD_LOG p ON p.run_id = r.run_id AND p.hop = s.prev_hop
LEFT JOIN LOAD_LOG c ON c.run_id = r.run_id AND c.hop = s.hop;
```

**Order matters:** the two MISMATCH branches come before the WARNING branch, so a Jedox warning only becomes PASS_WARNING when the count and the total both match.

**NULL handling:** a hop with no log row yet gives MISSING_HOP, never PASS. `IS DISTINCT FROM` treats a NULL on either side as a difference, so a missing trailer can't pass as equal.

| Run | Step 1 file → snowflake | Step 2 snowflake → cells | Step 3 cells → Jedox |
|---|---|---|---|
| R1 clean | 284 = 284, 1,466,143.86, diff 0.00, PASS | 1,466,143.86, PASS | 58 = 58, diff 0.00, PASS |
| R2 dropped line | 284 vs 283, 1,466,143.86 vs 1,460,108.50, diff −6,035.36, **MISMATCH** | 1,460,108.50, PASS | no Jedox load, MISSING_HOP |
| R3 same file again | DUPLICATE | DUPLICATE | DUPLICATE |

R2 has exactly one mismatch, at the first hop, which is where the line went missing: `FDH1-202603-CC4000-600000` line 1, 6,035.36. Because step 1 failed, the gate keeps the incomplete file out of Jedox, so step 3 shows MISSING_HOP and the evidence row is FAIL. Without the trailer check, Jedox would have matched Snowflake exactly and the gap would never show. That's why you compare against the trailer, not only Snowflake against Jedox.

## Step 6: Write the evidence

`06_control_evidence.sql` appends one row per run to `CONTROL_EVIDENCE`: control id, period, run, the role that ran it, when, the result (PASS, FAIL, DUPLICATE or PASS_WARNING) and a pointer to the recon rows. Export it at period end with your usual report export.

Append-only is enforced by privileges: the role that writes LOAD_LOG and CONTROL_EVIDENCE has INSERT and SELECT only, plus the same USAGE grants (database, schema and warehouse), never UPDATE or DELETE. The table owner (`SYSADMIN` in this walkthrough) can still update or delete rows, so the demo shows the pattern but doesn't enforce append-only. In production, the writing role must not own these tables. That's a grant your security owner makes; this pack doesn't.

## Check the result

Run `07_checks.sql`. You should see:

| Check | Expected |
|---|---|
| ERP_GL_EXTRACT 2026-03 | 284 lines, **1,466,143.86** |
| FACT_ACTUALS 2026-03 | 58 cells, 1,466,143.86, 0 cell differences |
| Unparsed lines | 0 |
| R1 clean | 3 × PASS, diff 0.00 |
| R2 dropped line | exactly **1** MISMATCH (step 1, −6,035.36); step 2 PASS; no Jedox load (step 3 MISSING_HOP); evidence FAIL |
| R3 duplicate | DUPLICATE on all 3 steps |
| Evidence | R1 PASS, R2 FAIL, R3 DUPLICATE |

## If it doesn't match

- **The trailer shows up as a journal line, or SUM fails.** You loaded the file straight into typed columns. Land it as text and split the trailer in the views.
- **R3 loads 284 lines again.** `FORCE = TRUE` is set, or the table was recreated. Remove `FORCE`, and keep the landing table.
- **Every run says MISSING_HOP at step 3.** The Jedox job hasn't written its row yet, the gate stopped it, or Jedox ended with status 30 or higher. That's correct until a good run writes it.
- **A Jedox warning run shows MISMATCH.** The Cube Load skipped cells (for example, a cost center missing in the Jedox dimension) or a cell loaded as 0.00 (not stored, so not read back). Fix the dimension, then reload.
- **R2 passes.** You compared Snowflake with Jedox only. Compare the trailer with what landed.
- **Step 2 shows a row-count MISMATCH.** You compared lines with cells. Step 2 compares totals only.
- **Check a) shows cell differences.** The extract and FACT_ACTUALS are out of step. Fix the source before trusting any recon.
- **The fingerprints differ for the same lines.** The column list or order in `HASH_AGG` changed between runs; the column order changes the result ([HASH_AGG](https://docs.snowflake.com/en/sql-reference/functions/hash_agg)).

## Wrap-up

- Each hop writes its own count and total. Nobody types numbers in.
- Compare every hop with the one before it, starting from what the source says it sent.
- A missing hop or a NULL is a failure, never a pass.
- Evidence is append-only rows, enforced by privileges, and exported as is. Call it SOX-style evidence, not compliance.

## Downloads

All files use made-up sample data and placeholder names. FDH Motors is not a real company.

[[download:erpctl/01_erp_gl_landing_ddl.sql|Download 01_erp_gl_landing_ddl.sql]]
[[download:erpctl/02_views.sql|Download 02_views.sql]]
[[download:erpctl/03_load_and_log.sql|Download 03_load_and_log.sql]]
[[download:erpctl/04_v_control_recon.sql|Download 04_v_control_recon.sql]]
[[download:erpctl/05_jedox_hop.sql|Download 05_jedox_hop.sql]]
[[download:erpctl/06_control_evidence.sql|Download 06_control_evidence.sql]]
[[download:erpctl/07_checks.sql|Download 07_checks.sql]]
[[download:erpctl/README.md|Download README.md]]
