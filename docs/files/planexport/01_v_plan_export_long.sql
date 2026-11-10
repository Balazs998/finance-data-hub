-- FDH_DEMO fictional sample only. One row per cell, long format, for a planning-tool flat file.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE OR REPLACE VIEW V_PLAN_EXPORT_LONG AS
WITH cells AS (
 SELECT cost_center, account, period, version, SUM(amount) AS amount
 FROM FACT_ACTUALS
 WHERE version = 'Actual'
 GROUP BY cost_center, account, period, version
 UNION ALL
 SELECT cost_center, account, period, version, SUM(amount) AS amount
 FROM FACT_BUDGET
 WHERE version = 'Budget'
 GROUP BY cost_center, account, period, version
)
SELECT
 c.cost_center,
 c.account,
 c.period,
 c.version,
 ROUND(c.amount, 2) AS amount,
 IFF(cc.cost_center IS NULL OR ac.account IS NULL, 'ORPHAN', 'OK') AS dim_status
FROM cells c
LEFT JOIN DIM_COST_CENTER cc ON cc.cost_center = c.cost_center
LEFT JOIN DIM_ACCOUNT ac ON ac.account = c.account;

-- Orphan check: must return 0 before you export.
SELECT COUNT(*) AS orphan_cells FROM V_PLAN_EXPORT_LONG WHERE dim_status = 'ORPHAN';
-- Expect 0
