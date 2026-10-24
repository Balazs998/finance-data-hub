-- FDH_DEMO fictional sample only.
-- FX_RATE_DAILY: one row per rate date, currency pair, and rate.
-- from_ccy / to_ccy / rate means EUR per 1 unit of from_ccy.
-- Does not replace FACT_ACTUALS. Other posts keep using the pristine 610-row CSV.

USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE TABLE IF NOT EXISTS FX_RATE_DAILY (
    rate_date DATE,
    from_ccy VARCHAR(3),
    to_ccy VARCHAR(3),
    rate NUMBER(18, 6),
    source VARCHAR(32)
);

-- Do not grant JEDOX_ETL_ROLE on FX_RATE_DAILY.
-- That role stays views-only. This walkthrough adds no grants.
-- Run the DDL, seed, lock, and snapshot as SYSADMIN.
