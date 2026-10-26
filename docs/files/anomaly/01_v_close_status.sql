-- Step 1: V_CLOSE_TASK and V_CLOSE_STATUS. Creates two VIEWS only (no tables, no grants). Reads CLOSE_TASK (load_motors.sql).
-- One row per close day (each distinct due_date): tasks due by then, done by then, open past due, blocked, % complete.
-- NULL handling: completed_at is NULL for tasks not done; those never count as done and count as overdue once past due_date.
-- Workdays come from CLOSE_TASK.due_date (Mon-Fri, no holiday calendar in the demo).
-- Close days are the distinct due dates, so a workday with no task due doesn't appear. In production, join to a workday calendar table instead.
USE SCHEMA FDH_DEMO.MOTORS;

CREATE OR REPLACE VIEW V_CLOSE_TASK AS
SELECT task_id, period, task_name, owner_role, due_workday, due_date, status, completed_at,
 TO_DATE(completed_at) AS completed_date,
 COALESCE(TO_DATE(completed_at) > due_date, FALSE) AS completed_late
FROM CLOSE_TASK;

CREATE OR REPLACE VIEW V_CLOSE_STATUS AS
WITH d AS (SELECT DISTINCT period, due_workday AS workday, due_date AS close_day FROM CLOSE_TASK)
SELECT d.period, d.workday, d.close_day,
 COUNT(*) AS tasks,
 COUNT_IF(t.due_date <= d.close_day) AS due_by_day,
 COUNT_IF(t.completed_date <= d.close_day) AS done_by_day,
 COUNT_IF(t.due_date <= d.close_day AND (t.completed_date IS NULL OR t.completed_date > d.close_day)) AS overdue_open,
 COUNT_IF(t.completed_late AND t.completed_date <= d.close_day) AS done_late_by_day,
 COUNT_IF(t.status = 'BLOCKED') AS blocked,
 COUNT_IF(t.completed_date <= d.close_day) / COUNT(*) AS pct_complete
FROM d JOIN V_CLOSE_TASK t ON t.period = d.period
GROUP BY d.period, d.workday, d.close_day;
