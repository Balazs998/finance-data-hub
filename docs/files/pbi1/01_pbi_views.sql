-- FDH_DEMO fictional sample only. New views.
-- Star schema for Power BI: one fact view, three dimension views, one check view.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

-- Replaces any existing view with this name in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_PBI_FACT_FIN AS
SELECT cost_center, account, period, version, amount
FROM FACT_ACTUALS
WHERE version = 'Actual'
UNION ALL
SELECT cost_center, account, period, version, amount
FROM FACT_BUDGET
WHERE version = 'Budget';
-- Expect 1306 rows (610 Actual + 696 Budget)

-- Replaces any existing view with this name in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_PBI_DIM_COST_CENTER AS
SELECT cost_center, cost_center_name, parent AS cost_center_group
FROM DIM_COST_CENTER;
-- Expect 10 rows

-- Replaces any existing view with this name in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_PBI_DIM_ACCOUNT AS
SELECT account, account_name, account_type
FROM DIM_ACCOUNT;
-- Expect 8 rows

-- Replaces any existing view with this name in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_PBI_DIM_PERIOD AS
SELECT DISTINCT
 period,
 TO_DATE(period || '-01') AS period_start,
 YEAR(TO_DATE(period || '-01')) + IFF(MONTH(TO_DATE(period || '-01')) >= 10, 1, 0) AS fiscal_year
FROM V_PBI_FACT_FIN;
-- Expect 12 rows (2025-10..2026-09), all fiscal_year 2026

-- Replaces any existing view with this name in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_PBI_CHECK_TOTALS AS
SELECT version, COUNT(*) AS row_count, SUM(amount) AS sf_total
FROM V_PBI_FACT_FIN
GROUP BY version;
-- Expect Actual 610 / 15446573.09, Budget 696 / 17253220.89

-- Orphan check: every fact key must exist in its dimension. Expect 0 / 0 / 0.
-- orphan_period is 0 by construction: V_PBI_DIM_PERIOD is a DISTINCT over V_PBI_FACT_FIN.
SELECT
 (SELECT COUNT(*) FROM V_PBI_FACT_FIN f WHERE NOT EXISTS (SELECT 1 FROM V_PBI_DIM_COST_CENTER d WHERE d.cost_center = f.cost_center)) AS orphan_cc,
 (SELECT COUNT(*) FROM V_PBI_FACT_FIN f WHERE NOT EXISTS (SELECT 1 FROM V_PBI_DIM_ACCOUNT d WHERE d.account = f.account)) AS orphan_account,
 (SELECT COUNT(*) FROM V_PBI_FACT_FIN f WHERE NOT EXISTS (SELECT 1 FROM V_PBI_DIM_PERIOD d WHERE d.period = f.period)) AS orphan_period;
