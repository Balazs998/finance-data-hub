-- Post 02: the logic lives in Snowflake; Excel only refreshes
-- Proposed objects (Sample Data Steward to confirm): V_PNL_MONTHLY, V_VARIANCE_BY_CC
-- Sign convention: the sample stores revenue and cost as positive amounts.
-- variance = actual - budget; favourable means revenue above budget or cost below budget.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

CREATE OR REPLACE VIEW V_PNL_MONTHLY AS
WITH a AS (
    SELECT period, account, SUM(amount) AS actual FROM FACT_ACTUALS GROUP BY period, account
),
b AS (
    SELECT period, account, SUM(amount) AS budget FROM FACT_BUDGET GROUP BY period, account
)
SELECT
    COALESCE(a.period, b.period) AS period,
    d.account,
    d.account_name,
    d.account_type,
    COALESCE(a.actual, 0) AS actual,
    COALESCE(b.budget, 0) AS budget,
    COALESCE(a.actual, 0) - COALESCE(b.budget, 0) AS variance,
    a.period IS NOT NULL AS has_actuals
FROM a
FULL OUTER JOIN b ON b.period = a.period AND b.account = a.account
JOIN DIM_ACCOUNT AS d ON d.account = COALESCE(a.account, b.account);

CREATE OR REPLACE VIEW V_VARIANCE_BY_CC AS
WITH a AS (
    SELECT f.period, f.cost_center, d.account_type, SUM(f.amount) AS actual
    FROM FACT_ACTUALS AS f JOIN DIM_ACCOUNT AS d ON d.account = f.account
    GROUP BY f.period, f.cost_center, d.account_type
),
b AS (
    SELECT f.period, f.cost_center, d.account_type, SUM(f.amount) AS budget
    FROM FACT_BUDGET AS f JOIN DIM_ACCOUNT AS d ON d.account = f.account
    GROUP BY f.period, f.cost_center, d.account_type
),
j AS (
    SELECT
        COALESCE(a.period, b.period) AS period,
        COALESCE(a.cost_center, b.cost_center) AS cost_center,
        COALESCE(a.account_type, b.account_type) AS account_type,
        COALESCE(a.actual, 0) AS actual,
        COALESCE(b.budget, 0) AS budget,
        a.period IS NOT NULL AS has_actuals
    FROM a
    FULL OUTER JOIN b
        ON b.period = a.period
        AND b.cost_center = a.cost_center
        AND b.account_type = a.account_type
)
SELECT
    j.period,
    j.cost_center,
    c.cost_center_name,
    c.parent AS cost_center_group,
    j.account_type,
    j.actual,
    j.budget,
    j.actual - j.budget AS variance,
    CASE
        WHEN NOT j.has_actuals THEN 'No actuals yet'
        WHEN j.actual = j.budget THEN 'On plan'
        WHEN j.account_type = 'REVENUE' AND j.actual > j.budget THEN 'Favourable'
        WHEN j.account_type = 'EXPENSE' AND j.actual < j.budget THEN 'Favourable'
        ELSE 'Unfavourable'
    END AS variance_flag
FROM j
JOIN DIM_COST_CENTER AS c ON c.cost_center = j.cost_center;

-- Checks
-- V_PNL_MONTHLY: expect 96 rows (88 with actuals, 8 budget-only for 2026-09)
SELECT COUNT(*) AS row_count, COUNT_IF(has_actuals) AS with_actuals FROM V_PNL_MONTHLY;
-- V_VARIANCE_BY_CC: expect 144 rows (132 with actuals, 12 'No actuals yet' for 2026-09)
SELECT COUNT(*) AS row_count, COUNT_IF(variance_flag = 'No actuals yet') AS no_actuals FROM V_VARIANCE_BY_CC;
-- 2026-03: expect REVENUE 229,693.47 vs 223,769.38 (+5,924.09), EXPENSE 1,236,450.39 vs 1,207,184.99 (+29,265.40)
SELECT account_type, SUM(actual) AS actual, SUM(budget) AS budget, SUM(variance) AS variance
FROM V_PNL_MONTHLY WHERE period = '2026-03' GROUP BY account_type ORDER BY account_type;
-- Totals: expect actual 15,446,573.09, budget 17,253,220.89 on both views
SELECT SUM(actual), SUM(budget) FROM V_PNL_MONTHLY;
SELECT SUM(actual), SUM(budget) FROM V_VARIANCE_BY_CC;
