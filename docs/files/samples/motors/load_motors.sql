-- FDH Motors (fictional) demo pack -> FDH_DEMO.MOTORS. Synthetic data from gen_motors.py (fixed seeds), EUR.
-- New schema only; FDH_DEMO.SAMPLE is not touched. Owner SYSADMIN. No grants here: Security Guard decides any
-- (JEDOX_ETL_ROLE stays views-only; CONTROL_EVIDENCE INSERT-only role belongs to the A5 post).
USE ROLE SYSADMIN;
CREATE DATABASE IF NOT EXISTS FDH_DEMO;
CREATE SCHEMA IF NOT EXISTS FDH_DEMO.MOTORS;
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE TABLE DIM_PLANT (plant VARCHAR(8), plant_name VARCHAR(64), region VARCHAR(64));
CREATE OR REPLACE TABLE DIM_MODEL (model VARCHAR(8), model_name VARCHAR(64), lifecycle_status VARCHAR(16), launch_period VARCHAR(7), end_period VARCHAR(7));
CREATE OR REPLACE TABLE DIM_MARKET (market VARCHAR(8), market_name VARCHAR(64), region VARCHAR(64));
CREATE OR REPLACE TABLE MAP_COST_CENTER_PLANT (cost_center VARCHAR(16), plant VARCHAR(8), alloc_pct NUMBER(5,4));
CREATE OR REPLACE TABLE FACT_PRODUCTION (plant VARCHAR(8), model VARCHAR(8), period VARCHAR(7), version VARCHAR(16), units_produced NUMBER(10,0));
CREATE OR REPLACE TABLE FACT_VEHICLE_SALES (model VARCHAR(8), market VARCHAR(8), period VARCHAR(7), version VARCHAR(16), units_sold NUMBER(10,0), net_revenue NUMBER(18,2));
CREATE OR REPLACE TABLE DIM_PART (part VARCHAR(16), part_name VARCHAR(64), part_type VARCHAR(8), uom VARCHAR(4));
CREATE OR REPLACE TABLE BOM (parent_part VARCHAR(16), child_part VARCHAR(16), qty_per NUMBER(18,4), valid_from DATE, valid_to DATE);
CREATE OR REPLACE TABLE STD_COST (part VARCHAR(16), period VARCHAR(7), std_cost NUMBER(18,4));
CREATE OR REPLACE TABLE PART_PURCHASE (part VARCHAR(16), plant VARCHAR(8), period VARCHAR(7), qty NUMBER(18,2), unit_price NUMBER(18,4));
CREATE OR REPLACE TABLE CAPEX_PROJECT (project_id VARCHAR(8), project_name VARCHAR(64), plant VARCHAR(8), owner_role VARCHAR(32), budget_amount NUMBER(18,2), approval_status VARCHAR(16), approved_by_role VARCHAR(32), approved_at TIMESTAMP_NTZ, closed BOOLEAN, closed_period VARCHAR(7));
CREATE OR REPLACE TABLE CAPEX_COMMIT (po_id VARCHAR(8), project_id VARCHAR(8), period VARCHAR(7), amount NUMBER(18,2), status VARCHAR(8));
CREATE OR REPLACE TABLE CAPEX_ACTUAL (invoice_id VARCHAR(8), project_id VARCHAR(8), period VARCHAR(7), amount NUMBER(18,2));
CREATE OR REPLACE TABLE MOTORS_RECIPIENTS (role VARCHAR(32), email VARCHAR(128), display_name VARCHAR(64));
CREATE OR REPLACE TABLE CASH_OPENING (as_of_date DATE, balance NUMBER(18,2));
CREATE OR REPLACE TABLE CASH_FLOW (flow_id VARCHAR(8), flow_type VARCHAR(16), category VARCHAR(32), counterparty VARCHAR(64), invoice_due_date DATE, expected_cash_date DATE, actual_cash_date DATE, version VARCHAR(8), amount NUMBER(18,2));
CREATE OR REPLACE TABLE CASH_SCENARIO (scenario VARCHAR(8), receipt_mult NUMBER(5,2), disburse_mult NUMBER(5,2));
CREATE OR REPLACE TABLE LIQUIDITY_FLOOR (floor_amount NUMBER(18,2));
CREATE OR REPLACE TABLE ERP_GL_EXTRACT (doc_id VARCHAR(32), line_no NUMBER(4,0), company_code VARCHAR(8), posting_date DATE, period VARCHAR(7), cost_center VARCHAR(16), account VARCHAR(16), amount NUMBER(18,2), currency VARCHAR(3));
CREATE OR REPLACE TABLE CLOSE_TASK (task_id VARCHAR(8), period VARCHAR(7), task_name VARCHAR(64), owner_role VARCHAR(32), due_workday NUMBER(2,0), due_date DATE, status VARCHAR(8), completed_at TIMESTAMP_NTZ);

-- A5 run tables: empty on purpose; rows come from demo runs (clean, dropped-row, duplicate-hash, Jedox warning).
CREATE OR REPLACE TABLE LOAD_LOG (run_id VARCHAR(32), hop VARCHAR(16), period VARCHAR(7), rows NUMBER(10,0), control_total NUMBER(18,2), hash VARCHAR(64), status VARCHAR(16), run_at TIMESTAMP_NTZ, run_by_role VARCHAR(32));
CREATE OR REPLACE TABLE CONTROL_EVIDENCE (control_id VARCHAR(16), period VARCHAR(7), run_id VARCHAR(32), performed_by_role VARCHAR(32), performed_at TIMESTAMP_NTZ, result VARCHAR(16), evidence_ref VARCHAR(256));

CREATE OR REPLACE FILE FORMAT CSV_HDR TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"' EMPTY_FIELD_AS_NULL = TRUE;
CREATE OR REPLACE STAGE MOTORS_STAGE FILE_FORMAT = CSV_HDR;

-- From SnowSQL / Snowflake CLI in this folder:
-- PUT file://*.csv @MOTORS_STAGE AUTO_COMPRESS=TRUE;
-- erp_gl_extract_2026-03*.csv carry a TRAILER row for the A5 control demo; load those in the post, not here.

COPY INTO DIM_PLANT FROM @MOTORS_STAGE/dim_plant.csv.gz;
COPY INTO DIM_MODEL FROM @MOTORS_STAGE/dim_model.csv.gz;
COPY INTO DIM_MARKET FROM @MOTORS_STAGE/dim_market.csv.gz;
COPY INTO MAP_COST_CENTER_PLANT FROM @MOTORS_STAGE/map_cost_center_plant.csv.gz;
COPY INTO FACT_PRODUCTION FROM @MOTORS_STAGE/fact_production.csv.gz;
COPY INTO FACT_VEHICLE_SALES FROM @MOTORS_STAGE/fact_vehicle_sales.csv.gz;
COPY INTO DIM_PART FROM @MOTORS_STAGE/dim_part.csv.gz;
COPY INTO BOM FROM @MOTORS_STAGE/bom.csv.gz;
COPY INTO STD_COST FROM @MOTORS_STAGE/std_cost.csv.gz;
COPY INTO PART_PURCHASE FROM @MOTORS_STAGE/part_purchase.csv.gz;
COPY INTO CAPEX_PROJECT FROM @MOTORS_STAGE/capex_project.csv.gz;
COPY INTO CAPEX_COMMIT FROM @MOTORS_STAGE/capex_commit.csv.gz;
COPY INTO CAPEX_ACTUAL FROM @MOTORS_STAGE/capex_actual.csv.gz;
COPY INTO MOTORS_RECIPIENTS FROM @MOTORS_STAGE/motors_recipients.csv.gz;
COPY INTO CASH_OPENING FROM @MOTORS_STAGE/cash_opening.csv.gz;
COPY INTO CASH_FLOW FROM @MOTORS_STAGE/cash_flow.csv.gz;
COPY INTO CASH_SCENARIO FROM @MOTORS_STAGE/cash_scenario.csv.gz;
COPY INTO LIQUIDITY_FLOOR FROM @MOTORS_STAGE/liquidity_floor.csv.gz;
COPY INTO ERP_GL_EXTRACT FROM @MOTORS_STAGE/erp_gl_extract.csv.gz;
COPY INTO CLOSE_TASK FROM @MOTORS_STAGE/close_task.csv.gz;
