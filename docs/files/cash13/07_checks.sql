-- Step 7: checks. Expected values are in README.md.
USE SCHEMA FDH_DEMO.MOTORS;

-- a) Runway, 3 rows
SELECT scenario, first_breach_week, runway_weeks, min_closing, min_week, week13_closing, floor_alert FROM V_CASH_RUNWAY ORDER BY scenario;

-- a2) Every down week below the floor, 5 rows (DATA-DICTIONARY.md A4)
-- Expect: wk 8 1228558.33; wk 9 1344072.25; wk 10 1335115.64; wk 11 1466540.06; wk 13 1141952.25
-- Wk 12 (1674052.48) is not listed: it recovers above the floor. Down first_breach_week 8, runway_weeks 7.
SELECT scenario, week_no, closing_balance, headroom FROM V_CASH_FLOOR_ALERT WHERE scenario = 'down' ORDER BY week_no;

-- b) Independent week-13 check: opening + receipts - disbursements (base, FORECAST, weeks 1-13)
SELECT o.balance + SUM(w.signed_amount) AS base_week13_check
FROM V_CASH_FLOW_WEEK w CROSS JOIN CASH_OPENING o
WHERE w.version = 'FORECAST' AND w.week_no BETWEEN 1 AND 13
GROUP BY o.balance;

-- c) The down breach week is the payroll + tax week
SELECT flow_id, category, cash_date, week_no, amount FROM V_CASH_FLOW_WEEK
WHERE version = 'FORECAST' AND category IN ('payroll', 'tax') AND week_no = 8 ORDER BY cash_date;

-- d) Late receipt sits in its cash week, not its due week
SELECT flow_id, invoice_due_date, expected_cash_date, actual_cash_date, due_week_no, week_no FROM V_CASH_FLOW_WEEK WHERE flow_id = 'CF0006';

-- e) Refund is the only negative row
SELECT flow_id, flow_type, cash_date, week_no, amount FROM V_CASH_FLOW_WEEK WHERE amount < 0;

-- f) Week-1 actual vs forecast and receipt slip
SELECT * FROM V_CASH_WEEK1_AVF ORDER BY category;
SELECT * FROM V_CASH_RECEIPT_SLIP;
