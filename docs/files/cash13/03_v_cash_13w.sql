-- Step 3: scenario forecast. Scenarios are rows in CASH_SCENARIO, not copied sheets.
-- Receipts x receipt_mult, disbursements x disburse_mult. Closing balance = opening + running SUM.
-- The running sum stays unrounded; ROUND only for display.
USE SCHEMA FDH_DEMO.MOTORS;
CREATE OR REPLACE VIEW V_CASH_13W AS
WITH weeks AS (
 SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS week_no FROM TABLE(GENERATOR(ROWCOUNT => 13))
),
flows AS (
 SELECT s.scenario, w.week_no,
 SUM(IFF(w.flow_type = 'RECEIPT', w.amount * s.receipt_mult, 0)) AS receipts,
 SUM(IFF(w.flow_type = 'DISBURSEMENT', w.amount * s.disburse_mult, 0)) AS disbursements
 FROM V_CASH_FLOW_WEEK w
 CROSS JOIN CASH_SCENARIO s
 WHERE w.version = 'FORECAST' AND w.week_no BETWEEN 1 AND 13
 GROUP BY s.scenario, w.week_no
),
grid AS (
 SELECT s.scenario, k.week_no, COALESCE(f.receipts, 0) AS receipts, COALESCE(f.disbursements, 0) AS disbursements
 FROM CASH_SCENARIO s
 CROSS JOIN weeks k
 LEFT JOIN flows f ON f.scenario = s.scenario AND f.week_no = k.week_no
)
SELECT g.scenario, g.week_no,
 DATEADD('day', 7 * (g.week_no - 1), o.as_of_date) AS week_start,
 g.receipts, g.disbursements, g.receipts - g.disbursements AS net_flow,
 o.balance + SUM(g.receipts - g.disbursements) OVER (PARTITION BY g.scenario ORDER BY g.week_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS closing_balance
FROM grid g
CROSS JOIN CASH_OPENING o;

-- Display (pivot to week columns only here, in the output):
-- SELECT scenario, week_no, ROUND(closing_balance, 2) AS closing FROM V_CASH_13W ORDER BY scenario, week_no;
