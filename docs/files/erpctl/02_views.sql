-- Step 2: typed views over the landing table. VIEWS ONLY. Create these before running step 3.
-- NULL handling: TRY_TO_* returns NULL for text that is not a number or date instead of failing; check b) counts those rows.
USE SCHEMA FDH_DEMO.MOTORS;

-- Body lines, typed like ERP_GL_EXTRACT. The trailer row is left out.
CREATE OR REPLACE VIEW V_ERP_GL_LANDED AS
SELECT file_name, file_row, file_content_key, loaded_at,
 c1 AS doc_id, TRY_TO_NUMBER(c2) AS line_no, c3 AS company_code, TRY_TO_DATE(c4) AS posting_date,
 c5 AS period, c6 AS cost_center, c7 AS account, TRY_TO_DECIMAL(c8, 18, 2) AS amount, c9 AS currency
FROM ERP_GL_LANDING
WHERE c1 IS DISTINCT FROM 'TRAILER';

-- The trailer of each file: the rows and control total the ERP says it sent.
CREATE OR REPLACE VIEW V_ERP_GL_TRAILER AS
SELECT file_name, loaded_at, TRY_TO_NUMBER(c2) AS trailer_rows, TRY_TO_DECIMAL(c3, 18, 2) AS trailer_total
FROM ERP_GL_LANDING
WHERE c1 = 'TRAILER';

-- What the Jedox load reads, per file: one row per cost center, account and period (the FACT_ACTUALS shape).
CREATE OR REPLACE VIEW V_ERP_GL_CELLS AS
SELECT file_name, cost_center, account, period, SUM(amount) AS amount
FROM V_ERP_GL_LANDED
GROUP BY file_name, cost_center, account, period;
