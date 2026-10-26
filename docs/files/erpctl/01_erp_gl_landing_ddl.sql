-- Step 1: ERP_GL_LANDING. New demo table in FDH_DEMO.MOTORS.
-- Creates one TABLE (IF NOT EXISTS, never replaced: it is the raw, append-only landing area). Runs only in FDH_DEMO.MOTORS.
-- Every file column lands as text, so the TRAILER row loads too. COPY transformations do not support WHERE,
-- so the trailer is split off in the views (step 2), not in the COPY.
-- One file = one load: COPY skips a file it already loaded (load metadata), so do not use FORCE = TRUE here.
-- Reuses MOTORS_STAGE / CSV_HDR from load_motors.sql. No new stage, no new file format, no grants.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE TABLE IF NOT EXISTS ERP_GL_LANDING (file_name VARCHAR(256), file_row NUMBER(10,0), file_content_key VARCHAR(128), c1 VARCHAR(64), c2 VARCHAR(64), c3 VARCHAR(64), c4 VARCHAR(64), c5 VARCHAR(64), c6 VARCHAR(64), c7 VARCHAR(64), c8 VARCHAR(64), c9 VARCHAR(64), loaded_at TIMESTAMP_LTZ);

-- From SnowSQL / Snowflake CLI in the motors folder (the 2026-03 files are not loaded by load_motors.sql):
-- PUT file://erp_gl_extract_2026-03.csv @MOTORS_STAGE AUTO_COMPRESS=TRUE;
-- PUT file://erp_gl_extract_2026-03_dropped.csv @MOTORS_STAGE AUTO_COMPRESS=TRUE;
