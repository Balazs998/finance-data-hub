-- Step 4: runway and floor alert.
-- Breach = closing_balance < floor_amount (strictly below).
-- first_breach_week = first week that closes below the floor.
-- runway_weeks = full weeks that close at or above the floor before the first breach = first_breach_week - 1.
-- No breach inside the horizon = '>13' (we cannot see past week 13).
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_CASH_RUNWAY AS
WITH agg AS (
 SELECT c.scenario,
 MIN(IFF(c.closing_balance < l.floor_amount, c.week_no, NULL)) AS first_breach_week,
 MIN(c.closing_balance) AS min_closing,
 MAX_BY(c.closing_balance, c.week_no) AS week13_closing,
 MAX(l.floor_amount) AS floor_amount
 FROM V_CASH_13W c
 CROSS JOIN LIQUIDITY_FLOOR l
 GROUP BY c.scenario
),
low AS (
 -- ties: earliest week wins
 SELECT a.scenario, MIN(IFF(c.closing_balance = a.min_closing, c.week_no, NULL)) AS min_week
 FROM agg a
 JOIN V_CASH_13W c ON c.scenario = a.scenario
 GROUP BY a.scenario
)
SELECT a.scenario, a.first_breach_week,
 IFF(a.first_breach_week IS NULL, '>13', TO_VARCHAR(a.first_breach_week - 1)) AS runway_weeks,
 ROUND(a.min_closing, 2) AS min_closing, w.min_week, ROUND(a.week13_closing, 2) AS week13_closing, a.floor_amount,
 IFF(a.first_breach_week IS NULL, 'OK', 'ALERT') AS floor_alert
FROM agg a
JOIN low w ON w.scenario = a.scenario;

-- Every week below the floor (not just the first):
CREATE OR REPLACE VIEW V_CASH_FLOOR_ALERT AS
SELECT c.scenario, c.week_no, c.week_start, ROUND(c.closing_balance, 2) AS closing_balance, l.floor_amount,
 ROUND(c.closing_balance - l.floor_amount, 2) AS headroom
FROM V_CASH_13W c
CROSS JOIN LIQUIDITY_FLOOR l
WHERE c.closing_balance < l.floor_amount;
