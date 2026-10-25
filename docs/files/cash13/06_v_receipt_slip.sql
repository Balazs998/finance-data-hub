-- Step 6: receipt-slip check. Receipts whose cash week is later than their due week.
-- These are the invoices a due-date forecast would have put in the wrong week.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_CASH_RECEIPT_SLIP AS
SELECT flow_id, counterparty, invoice_due_date, expected_cash_date, actual_cash_date, due_week_no, week_no, amount
FROM V_CASH_FLOW_WEEK
WHERE version = 'FORECAST' AND flow_type = 'RECEIPT' AND week_no > due_week_no;
