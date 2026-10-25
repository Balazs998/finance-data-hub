-- FDH_DEMO fictional sample only.
-- FX_RATE_PERIOD: one row per period, currency pair, and rate_type.
-- locked = TRUE marks the rate frozen for a sent pack.
-- from_ccy / to_ccy / rate means EUR per 1 unit of from_ccy.

USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE TABLE IF NOT EXISTS FX_RATE_PERIOD (
    period VARCHAR(7),
    from_ccy VARCHAR(3),
    to_ccy VARCHAR(3),
    rate_type VARCHAR(16),
    rate NUMBER(18, 6),
    locked BOOLEAN
);

-- Do not grant JEDOX_ETL_ROLE on FX_RATE_PERIOD.
-- That role stays views-only. This walkthrough adds no grants.
