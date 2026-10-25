-- FDH Motors 13-week cash pack (fictional FDH_DEMO data only)
-- Step 1: cash tables in FDH_DEMO.MOTORS. Same DDL as load_motors.sql in the MOTORS sample pack.
-- Skip this file if you already ran load_motors.sql (it creates and loads these tables).
-- Role: SYSADMIN (owner). This pack adds no grants.
USE ROLE SYSADMIN;
-- CREATE OR REPLACE drops and recreates these four demo tables; run only in FDH_DEMO.MOTORS.
CREATE SCHEMA IF NOT EXISTS FDH_DEMO.MOTORS;
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE TABLE CASH_OPENING (as_of_date DATE, balance NUMBER(18,2));
CREATE OR REPLACE TABLE CASH_FLOW (flow_id VARCHAR(8), flow_type VARCHAR(16), category VARCHAR(32), counterparty VARCHAR(64), invoice_due_date DATE, expected_cash_date DATE, actual_cash_date DATE, version VARCHAR(8), amount NUMBER(18,2));
CREATE OR REPLACE TABLE CASH_SCENARIO (scenario VARCHAR(8), receipt_mult NUMBER(5,2), disburse_mult NUMBER(5,2));
CREATE OR REPLACE TABLE LIQUIDITY_FLOOR (floor_amount NUMBER(18,2));

-- Load: the four cash CSVs are already loaded by load_motors.sql (sample pack), which creates
-- MOTORS_STAGE and the CSV_HDR file format. This pack creates no stage or file format of its own.
-- Optional reload only (after running the DDL above), from the same stage and format:
-- COPY INTO CASH_OPENING FROM @MOTORS_STAGE/cash_opening.csv.gz FILE_FORMAT = (FORMAT_NAME = CSV_HDR);
-- COPY INTO CASH_FLOW FROM @MOTORS_STAGE/cash_flow.csv.gz FILE_FORMAT = (FORMAT_NAME = CSV_HDR);
-- COPY INTO CASH_SCENARIO FROM @MOTORS_STAGE/cash_scenario.csv.gz FILE_FORMAT = (FORMAT_NAME = CSV_HDR);
-- COPY INTO LIQUIDITY_FLOOR FROM @MOTORS_STAGE/liquidity_floor.csv.gz FILE_FORMAT = (FORMAT_NAME = CSV_HDR);

-- Expect: CASH_OPENING 1, CASH_FLOW 158 (146 FORECAST, 12 ACTUAL), CASH_SCENARIO 3, LIQUIDITY_FLOOR 1
SELECT version, COUNT(*) AS row_count FROM CASH_FLOW GROUP BY version ORDER BY version;
