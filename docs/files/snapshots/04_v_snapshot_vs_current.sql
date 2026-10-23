-- FDH_DEMO fictional sample only.
-- Compare each sent snapshot run to current FACT_ACTUALS for that run's period.
-- Late postings (current-only cells) attach to the run whose snapshot_period
-- matches their period, so filtering on run_id still shows them.
-- No grant. JEDOX_ETL_ROLE stays views-only and is not granted this view here.

USE SCHEMA FDH_DEMO.SAMPLE;

CREATE OR REPLACE VIEW V_SNAPSHOT_VS_CURRENT AS
WITH runs AS (
    SELECT DISTINCT snapshot_period, run_id
    FROM FACT_ACTUALS_SNAPSHOT
    WHERE sent_flag = TRUE
),
reported AS (
    SELECT
        snapshot_period,
        run_id,
        cost_center,
        account,
        period,
        version,
        SUM(amount) AS reported_amount
    FROM FACT_ACTUALS_SNAPSHOT
    WHERE sent_flag = TRUE
    GROUP BY
        snapshot_period,
        run_id,
        cost_center,
        account,
        period,
        version
),
current_for_run AS (
    SELECT
        runs.snapshot_period,
        runs.run_id,
        a.cost_center,
        a.account,
        a.period,
        a.version,
        SUM(a.amount) AS current_amount
    FROM runs
    INNER JOIN FACT_ACTUALS AS a
        ON a.period = runs.snapshot_period
    GROUP BY
        runs.snapshot_period,
        runs.run_id,
        a.cost_center,
        a.account,
        a.period,
        a.version
)
SELECT
    COALESCE(r.snapshot_period, c.snapshot_period) AS snapshot_period,
    COALESCE(r.run_id, c.run_id) AS run_id,
    COALESCE(r.cost_center, c.cost_center) AS cost_center,
    COALESCE(r.account, c.account) AS account,
    COALESCE(r.period, c.period) AS period,
    COALESCE(r.version, c.version) AS version,
    COALESCE(r.reported_amount, 0) AS reported_amount,
    COALESCE(c.current_amount, 0) AS current_amount,
    COALESCE(c.current_amount, 0) - COALESCE(r.reported_amount, 0) AS diff
FROM reported AS r
FULL OUTER JOIN current_for_run AS c
    ON r.snapshot_period = c.snapshot_period
    AND r.run_id = c.run_id
    AND r.cost_center = c.cost_center
    AND r.account = c.account
    AND r.period = c.period
    AND r.version = c.version;
