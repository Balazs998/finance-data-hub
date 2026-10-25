-- Step 5: week-1 actual vs forecast by category.
-- FORECAST rows = the plan frozen at the as-of date. ACTUAL rows = what landed (actual_cash_date) in week 1.
-- Flag EXPLAIN when |variance| > 5% of forecast (a rule of thumb from Arandur's guide; pick your own).
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_CASH_WEEK1_AVF AS
WITH w1 AS (
 SELECT category,
 SUM(IFF(version = 'FORECAST', amount, 0)) AS forecast_wk1,
 SUM(IFF(version = 'ACTUAL', amount, 0)) AS actual_wk1
 FROM V_CASH_FLOW_WEEK
 WHERE week_no = 1
 GROUP BY category
)
SELECT category, forecast_wk1, actual_wk1, actual_wk1 - forecast_wk1 AS variance,
 IFF(ABS(actual_wk1 - forecast_wk1) > 0.05 * ABS(NULLIF(forecast_wk1, 0)), 'EXPLAIN', 'OK') AS flag
FROM w1;
-- SELECT * FROM V_CASH_WEEK1_AVF ORDER BY category;
