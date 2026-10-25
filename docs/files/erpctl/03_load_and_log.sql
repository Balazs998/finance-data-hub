-- Step 3: load one file and log the file and Snowflake hops. Run once per file, with its own run_id.
-- Writes: INSERT into ERP_GL_LANDING (via COPY) and LOAD_LOG only. Never UPDATE or DELETE.
-- Demo runs: R1 = erp_gl_extract_2026-03.csv.gz (clean), R2 = erp_gl_extract_2026-03_dropped.csv.gz (one line dropped),
-- R3 = erp_gl_extract_2026-03.csv.gz again (duplicate: COPY skips it, 0 lines land, status DUPLICATE).
-- Per run, change run_id, file_name and the FILES list together.
-- Log times are stored as session-local wall-clock time (TIMESTAMP_NTZ).
USE SCHEMA FDH_DEMO.MOTORS;
SET run_id = 'R1';
SET file_name = 'erp_gl_extract_2026-03.csv.gz';
SET run_start = CURRENT_TIMESTAMP();

COPY INTO ERP_GL_LANDING (file_name, file_row, file_content_key, c1, c2, c3, c4, c5, c6, c7, c8, c9, loaded_at)
FROM (
 SELECT METADATA$FILENAME, METADATA$FILE_ROW_NUMBER, METADATA$FILE_CONTENT_KEY,
 t.$1, t.$2, t.$3, t.$4, t.$5, t.$6, t.$7, t.$8, t.$9, METADATA$START_SCAN_TIME
 FROM @MOTORS_STAGE t
)
-- FILES needs a literal; session variables don't work here. To parameterise, build the COPY string and run it with EXECUTE IMMEDIATE.
-- Only accept file names that match a pattern such as ^erp_gl_extract_[0-9]{4}-[0-9]{2}[a-z_]*\.csv\.gz$ before you build the string.
FILES = ('erp_gl_extract_2026-03.csv.gz');

-- Hop 1, file: what the trailer says. NULL rows and total (and TRAILER_MISSING) if no trailer landed in this run.
INSERT INTO LOAD_LOG (run_id, hop, period, rows, control_total, hash, status, run_at, run_by_role)
SELECT $run_id, 'file', '2026-03', MAX(trailer_rows), MAX(trailer_total), NULL,
 IFF(COUNT(*) = 1, 'TRAILER_OK', 'TRAILER_MISSING'), CURRENT_TIMESTAMP(), CURRENT_ROLE()
FROM V_ERP_GL_TRAILER WHERE file_name = $file_name AND loaded_at >= $run_start;

-- Hop 2, Snowflake: what actually landed in this run, plus an order-independent fingerprint of the lines.
-- DUPLICATE if nothing landed (COPY skipped a file it had loaded) or an earlier LOADED run has the same fingerprint.
INSERT INTO LOAD_LOG (run_id, hop, period, rows, control_total, hash, status, run_at, run_by_role)
WITH b AS (
 SELECT COUNT(*) AS n, SUM(amount) AS total, HASH_AGG(doc_id, line_no, posting_date, period, cost_center, account, amount, currency) AS h
 FROM V_ERP_GL_LANDED WHERE file_name = $file_name AND loaded_at >= $run_start
)
SELECT $run_id, 'snowflake', '2026-03', b.n, COALESCE(b.total, 0), TO_VARCHAR(b.h),
 IFF(b.n = 0 OR EXISTS (SELECT 1 FROM LOAD_LOG l WHERE l.hop = 'snowflake' AND l.status = 'LOADED' AND l.hash = TO_VARCHAR(b.h)), 'DUPLICATE', 'LOADED'),
 CURRENT_TIMESTAMP(), CURRENT_ROLE()
FROM b;

-- Hop 2b, Snowflake output: the cells (cost_center x account x period) from the lines that landed in this run.
-- Start the Jedox load only when hop snowflake = LOADED AND V_CONTROL_RECON step 1 = PASS for this run_id.
INSERT INTO LOAD_LOG (run_id, hop, period, rows, control_total, hash, status, run_at, run_by_role)
WITH c AS (
 SELECT cost_center, account, period, SUM(amount) AS amount
 FROM V_ERP_GL_LANDED WHERE file_name = $file_name AND loaded_at >= $run_start
 GROUP BY cost_center, account, period
)
SELECT $run_id, 'snowflake_cells', '2026-03', COUNT(*), COALESCE(SUM(amount), 0), NULL, 'READY', CURRENT_TIMESTAMP(), CURRENT_ROLE()
FROM c;

-- Gate: 1 = start the Jedox load, 0 = stop.
-- step 1 = PASS implies hop snowflake = LOADED (a DUPLICATE run shows DUPLICATE on step 1)
SELECT COALESCE(MAX(IFF(result = 'PASS', 1, 0)), 0) AS start_jedox
FROM V_CONTROL_RECON
WHERE run_id = $run_id AND step_no = 1;
