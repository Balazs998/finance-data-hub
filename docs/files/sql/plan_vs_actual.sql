-- Plan vs. actuals variance, Finance Data Hub sample data (synthetic)
-- Run load_snowflake.sql first. Periods are zero-padded 'YYYY-MM'.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE OR REPLACE VIEW V_PLAN_VS_ACTUAL AS
WITH budget AS (
    SELECT cost_center, account, period, SUM(amount) AS budget
    FROM FACT_BUDGET
    GROUP BY cost_center, account, period
),
actuals AS (
    SELECT cost_center, account, period, SUM(amount) AS actual
    FROM FACT_ACTUALS
    GROUP BY cost_center, account, period
)
SELECT
    COALESCE(a.cost_center, b.cost_center) AS cost_center,
    COALESCE(a.account, b.account) AS account,
    COALESCE(a.period, b.period) AS period,
    COALESCE(b.budget, 0) AS budget,
    COALESCE(a.actual, 0) AS actual,
    COALESCE(a.actual, 0) - COALESCE(b.budget, 0) AS variance,
    CASE
        WHEN a.cost_center IS NULL THEN 'Budget only'
        WHEN b.cost_center IS NULL THEN 'Actual only'
        ELSE 'Both'
    END AS match_status
FROM actuals AS a
FULL OUTER JOIN budget AS b
    ON a.cost_center = b.cost_center
    AND a.account = b.account
    AND a.period = b.period;

-- Check queries need a warehouse SYSADMIN can use.
USE WAREHOUSE <your warehouse>;

-- Check: expect Actual only 5, Both 605, Budget only 91 (701 cells)
SELECT match_status, COUNT(*) AS cells, SUM(budget) AS budget, SUM(actual) AS actual
FROM V_PLAN_VS_ACTUAL
GROUP BY match_status
ORDER BY match_status;

-- Favorable / unfavorable, closed months only
SELECT
    v.*,
    d.account_type,
    CASE
        WHEN v.variance = 0 THEN 'On plan'
        WHEN d.account_type = 'REVENUE' AND v.variance > 0 THEN 'Favorable'
        WHEN d.account_type = 'EXPENSE' AND v.variance < 0 THEN 'Favorable'
        ELSE 'Unfavorable'
    END AS variance_flag
FROM V_PLAN_VS_ACTUAL AS v
JOIN DIM_ACCOUNT AS d ON d.account = v.account
WHERE v.period <= '2026-08';
