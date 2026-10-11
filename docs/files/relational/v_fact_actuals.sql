-- Setup: JEDOX_ETL_ROLE reads views only, so give it a plain pass-through view of FACT_ACTUALS
-- Placeholder names, synthetic sample data. Run once before the extracts.
USE ROLE SYSADMIN;
-- Demo uses SYSADMIN. In a real setup, use a dedicated setup role with only the rights this script needs.
CREATE OR REPLACE VIEW FDH_DEMO.SAMPLE.V_FACT_ACTUALS AS SELECT COST_CENTER, ACCOUNT, PERIOD, VERSION, AMOUNT FROM FDH_DEMO.SAMPLE.FACT_ACTUALS;
GRANT SELECT ON VIEW FDH_DEMO.SAMPLE.V_FACT_ACTUALS TO ROLE JEDOX_ETL_ROLE;

-- Undo:
-- REVOKE SELECT ON VIEW FDH_DEMO.SAMPLE.V_FACT_ACTUALS FROM ROLE JEDOX_ETL_ROLE;
