-- Step 6: CONTROL_EVIDENCE. One row per run and control: who ran it, when, the result and where the proof is.
-- Writes: INSERT only (append). Table already exists (load_motors.sql). Never UPDATE or DELETE it.
-- Append-only: the role that writes LOAD_LOG and CONTROL_EVIDENCE has INSERT and SELECT only, plus USAGE on the database, schema and warehouse.
-- The table owner (SYSADMIN in this walkthrough) can still update or delete rows, so the demo shows the pattern but doesn't enforce
-- append-only. In production, the writing role must not own these tables. This pack adds no grants.
USE SCHEMA FDH_DEMO.MOTORS;

INSERT INTO CONTROL_EVIDENCE (control_id, period, run_id, performed_by_role, performed_at, result, evidence_ref)
SELECT 'ERP-RECON-01', period, run_id, CURRENT_ROLE(), CURRENT_TIMESTAMP(),
 CASE
 WHEN COUNT_IF(result IN ('MISMATCH', 'MISSING_HOP')) > 0 THEN 'FAIL'
 WHEN COUNT_IF(result = 'DUPLICATE') > 0 THEN 'DUPLICATE'
 WHEN COUNT_IF(result = 'PASS_WARNING') > 0 THEN 'PASS_WARNING'
 ELSE 'PASS'
 END,
 'V_CONTROL_RECON run_id=' || run_id
FROM V_CONTROL_RECON
WHERE run_id = $run_id
GROUP BY period, run_id;
