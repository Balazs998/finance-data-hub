-- Step 2: week bucketing. The week comes from the CASH date, never from invoice_due_date.
-- cash_date = COALESCE(actual_cash_date, expected_cash_date). Week 1 starts on CASH_OPENING.as_of_date.
-- week_no = FLOOR(days since as_of / 7) + 1, so week 1 = days 0..6.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_CASH_FLOW_WEEK AS
SELECT f.flow_id, f.flow_type, f.category, f.counterparty, f.version, f.amount,
 f.invoice_due_date, f.expected_cash_date, f.actual_cash_date,
 COALESCE(f.actual_cash_date, f.expected_cash_date) AS cash_date,
 FLOOR(DATEDIFF('day', o.as_of_date, COALESCE(f.actual_cash_date, f.expected_cash_date)) / 7) + 1 AS week_no,
 FLOOR(DATEDIFF('day', o.as_of_date, f.invoice_due_date) / 7) + 1 AS due_week_no,
 IFF(f.flow_type = 'RECEIPT', f.amount, -f.amount) AS signed_amount
FROM CASH_FLOW f
CROSS JOIN CASH_OPENING o;
-- Note: due_week_no can be 0 or negative when the invoice was due before the as-of date (CF0006).
