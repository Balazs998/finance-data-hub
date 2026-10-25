-- Step 7: checks. Expected values are in README.md. Round only here, after summing.
USE SCHEMA FDH_DEMO.MOTORS;

-- a) The source ties: ERP_GL_EXTRACT 2026-03 vs FACT_ACTUALS 2026-03 (expect 284 lines, 58 cells, 1,466,143.86 both, 0 cell differences)
SELECT
 (SELECT COUNT(*) FROM ERP_GL_EXTRACT WHERE period = '2026-03') AS erp_lines,
 (SELECT ROUND(SUM(amount), 2) FROM ERP_GL_EXTRACT WHERE period = '2026-03') AS erp_total,
 (SELECT COUNT(*) FROM FDH_DEMO.SAMPLE.FACT_ACTUALS WHERE period = '2026-03' AND version = 'Actual') AS fa_cells,
 (SELECT ROUND(SUM(amount), 2) FROM FDH_DEMO.SAMPLE.FACT_ACTUALS WHERE period = '2026-03' AND version = 'Actual') AS fa_total;

WITH e AS (SELECT cost_center, account, SUM(amount) AS amount FROM ERP_GL_EXTRACT WHERE period = '2026-03' GROUP BY cost_center, account),
f AS (SELECT cost_center, account, amount FROM FDH_DEMO.SAMPLE.FACT_ACTUALS WHERE period = '2026-03' AND version = 'Actual')
SELECT COUNT(*) AS cell_differences
FROM e FULL OUTER JOIN f ON f.cost_center = e.cost_center AND f.account = e.account
WHERE e.amount IS DISTINCT FROM f.amount;

-- b) Landed lines whose amount or date did not parse (expect 0)
SELECT COUNT(*) AS unparsed FROM V_ERP_GL_LANDED WHERE amount IS NULL OR posting_date IS NULL;

-- c) Recon per run (R1 clean: 3 PASS, R2 dropped: 1 MISMATCH at step 1, step 2 PASS, step 3 MISSING_HOP (no Jedox load), R3 duplicate: DUPLICATE on all 3 steps)
SELECT run_id, step_no, prev_hop, hop, prev_rows, hop_rows, prev_total, hop_total, total_diff, result
FROM V_CONTROL_RECON ORDER BY run_id, step_no;

-- d) Mismatches per run (expect R1 0, R2 1)
SELECT run_id, COUNT_IF(result = 'MISMATCH') AS mismatches FROM V_CONTROL_RECON GROUP BY run_id ORDER BY run_id;

-- e) Evidence trail
SELECT control_id, period, run_id, performed_by_role, performed_at, result, evidence_ref FROM CONTROL_EVIDENCE ORDER BY performed_at;
