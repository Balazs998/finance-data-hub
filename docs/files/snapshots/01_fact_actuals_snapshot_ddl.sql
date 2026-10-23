-- FDH_DEMO fictional sample only.
-- FACT_ACTUALS_SNAPSHOT: permanent copy of FACT_ACTUALS keyed by period and run.
-- Does not replace FACT_ACTUALS. Other posts keep using the pristine 610-row CSV.

USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE TABLE IF NOT EXISTS FACT_ACTUALS_SNAPSHOT (
    cost_center VARCHAR(16),
    account VARCHAR(16),
    period VARCHAR(7),
    version VARCHAR(16),
    amount NUMBER(18, 2),
    snapshot_period VARCHAR(7),
    run_id VARCHAR(32),
    snapshot_at TIMESTAMP_NTZ,
    sent_flag BOOLEAN
);

-- Optional uniqueness: one row per cell per run.
-- ALTER TABLE FACT_ACTUALS_SNAPSHOT ADD CONSTRAINT uq_fact_actuals_snapshot UNIQUE (snapshot_period, run_id, cost_center, account, period, version);

-- Do not grant JEDOX_ETL_ROLE on FACT_ACTUALS_SNAPSHOT.
-- That role stays views-only. This walkthrough adds no grants on the snapshot table or on V_SNAPSHOT_VS_CURRENT.
-- Run the DDL, freeze, late seed, and compare as SYSADMIN.
