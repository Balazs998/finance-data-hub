---
title: "Close tracking and journal anomaly flags in SQL: z-score, IQR and three plain rules"
description: "Track month-end close tasks by day, then flag unusual journal lines with z-scores, the interquartile range and simple rules, and mail the list only when there is something to review, for the fictional FDH Motors on FDH_DEMO.MOTORS. Simple statistics, not AI."
social_image: automaker-close-tracker-anomaly-flags.png
---

# Close tracking and journal anomaly flags in SQL

<p class="post-meta">Snowflake · Intermediate · ~30 min · Automaker series</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>The Snowflake SQL in this post has not been run on a live account. Every check number was recomputed from the sample CSVs with the same logic as the SQL, and matches the sample data dictionary. The flags are simple statistics and rules. They pick lines for a person to review; they don't detect fraud and make no accuracy claim.</p>
</aside>

Close status often lives in an email thread: "is the tax provision done?", "who has intercompany?". Unusual journal lines get found by someone scrolling, or not at all. And every few months someone promises that AI will fix both.

This post does something smaller and easier to check. A close tracker shows, for each close day, what was due, what's done, what's late and what's blocked. Then three methods flag journal lines for review: a z-score, the interquartile range (IQR) and three plain rules. No external service, no model, nothing you can't read in a few lines of SQL. The example uses Snowflake, but any database with standard aggregates can rebuild it.

## What you'll build

This pack creates **eight views and nothing else** (no tables, no grants):

- `V_CLOSE_TASK`, `V_CLOSE_STATUS`: the close tracker, per task and per close day
- `V_JE_STATS`, `V_JE_ZSCORE`: statistics per account × cost center, and z-score flags
- `V_JE_IQR`: IQR flags
- `V_JE_RULES`: weekend, round-amount and negative-expense rules
- `V_JE_FLAGS`, `V_JE_ALERT`: every flag with its reason, and who gets told

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="Close tracker anomaly flags">
  <a href="../close-anomaly.svg"><img src="../close-anomaly.svg" alt="The FDH Motors 2026-03 close by workday: 16% of 25 tasks done on WD1, 48% on WD3 and 96% on WD7. CT10, CT12 and CT21 finished late and CT19 is blocked. 1,602 journal lines go through V_JE_ZSCORE (3 flags), V_JE_IQR (33) and V_JE_RULES (3). That makes 39 flags on 35 distinct lines in V_JE_FLAGS, because the methods overlap. The gate returns 1, so V_JE_ALERT sends the review list." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) to create views in `FDH_DEMO.MOTORS` and read `FDH_DEMO.SAMPLE.DIM_ACCOUNT`. The views only read journals. This pack adds no grants, and `JEDOX_ETL_ROLE` is not touched.
    - Product version: any current Snowflake account (`STDDEV`, `PERCENTILE_CONT`, `DAYOFWEEKISO`, `COUNT_IF`; docs-based, not run)
    - Previous posts: [Control totals from ERP to Jedox](automaker-erp-control-totals.md) (same `ERP_GL_EXTRACT`) and [Email only when a Jedox load fails](../jedox/failure-alerts.md) (the alert pattern)
    - Sample data: `close_task.csv`, `erp_gl_extract.csv` (1,602 lines, 2025-10 to 2026-03) and `motors_recipients.csv`, loaded by `load_motors.sql`

## Step 1: Track the close by day

`CLOSE_TASK` has 25 tasks for the 2026-03 close, each with an owner role, a due workday (WD1 = 2026-04-01, Monday to Friday, no holiday calendar in the demo), a status and a completion time. Close days are the distinct due dates, so a workday with no task due doesn't appear. In production, join to a workday calendar table instead.

```sql
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
```

**NULL handling:** `completed_at` is NULL for a task that isn't done. It never counts as done, and once its due date has passed it counts as overdue. `completed_late` is FALSE, not NULL, for open tasks.

For 2026-03, three tasks finished late (CT10 Standard cost revaluation, CT12 Intercompany matching, CT21 Plan vs actual commentary) and one is blocked (CT19 Tax provision). By WD3 the close is 48.00% done with CT10 and CT12 overdue. By WD7, 2026-04-09, 24 of 25 tasks are done (96.00%) and only CT19 is open.

## Step 2: Z-score per account and cost center

A z-score says how many standard deviations a line sits from the average of its group. The group is account × cost center over the whole history (60 groups, 4 to 51 lines each). `STDDEV` (same as `STDDEV_SAMP`) is the sample standard deviation and returns a DOUBLE. `STDDEV_POP` divides by n instead of n−1 ([STDDEV](https://docs.snowflake.com/en/sql-reference/functions/stddev)).

```sql
CREATE OR REPLACE VIEW V_JE_STATS AS
SELECT account, cost_center, COUNT(*) AS n,
 AVG(amount) AS mean_amount, STDDEV(amount) AS sd_amount,
 PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY amount) AS q1,
 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY amount) AS median_amount,
 PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY amount) AS q3
FROM ERP_GL_EXTRACT
GROUP BY account, cost_center;

CREATE OR REPLACE VIEW V_JE_ZSCORE AS
WITH p AS (SELECT 3 AS z_limit)
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount,
 s.n, s.mean_amount, s.sd_amount,
 IFF(s.sd_amount IS NULL OR s.sd_amount = 0, NULL, (e.amount - s.mean_amount) / s.sd_amount) AS z,
 COALESCE(ABS(IFF(s.sd_amount IS NULL OR s.sd_amount = 0, NULL, (e.amount - s.mean_amount) / s.sd_amount)) > p.z_limit, FALSE) AS flag
FROM ERP_GL_EXTRACT e
JOIN V_JE_STATS s ON s.account = e.account AND s.cost_center = e.cost_center
CROSS JOIN p;
```

The limit is |z| > 3, set in the `p` CTE. It's a starting point, not a truth. A group with one line, or with identical amounts, has no usable standard deviation, so z is NULL and the line is never flagged.

Three lines pass the limit: **S1**, a line ten times its usual size (2,374.19 against a group median of 241.78, z 6.95), **S4**, an expense posted with the wrong sign (−1,840.25, z −5.06), and the **December bonus accrual** (26,679.13, z 4.86), which is legitimate. Z-score misses the other three seeded lines.

## Step 3: IQR fences

The IQR method takes the middle half of each group (Q1 to Q3) and flags anything more than 1.5 × IQR outside it. `PERCENTILE_CONT` interpolates linearly between the two nearest values ([PERCENTILE_CONT](https://docs.snowflake.com/en/sql-reference/functions/percentile_cont)).

```sql
CREATE OR REPLACE VIEW V_JE_IQR AS
WITH p AS (SELECT 1.5 AS k)
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount,
 s.n, s.q1, s.q3, s.q3 - s.q1 AS iqr,
 s.q1 - p.k * (s.q3 - s.q1) AS lower_fence, s.q3 + p.k * (s.q3 - s.q1) AS upper_fence,
 COALESCE(e.amount < s.q1 - p.k * (s.q3 - s.q1) OR e.amount > s.q3 + p.k * (s.q3 - s.q1), FALSE) AS flag
FROM ERP_GL_EXTRACT e
JOIN V_JE_STATS s ON s.account = e.account AND s.cost_center = e.cost_center
CROSS JOIN p;
```

IQR flags **33** lines: S1, S4, the seasonal accrual, and **S5**, which z-score missed, plus 29 lines that are just ordinary variation. Five of those 29 are other lines in S4's group.

Why does IQR catch S5 (393.23) when z-score doesn't? S5 sits in the same group as S1. S1's 2,374.19 drags the standard deviation of that group up to 299.33; without S1 it would be 34.87, and S5's z would be 4.09 instead of 0.34. Quartiles barely move when one value is extreme, so S5 still lands above the upper fence of 355.71. One big outlier can hide a smaller one from a z-score.

To stop a line hiding itself, leave it out of its own group's statistics with window functions:

```sql
-- WINDOW w AS (PARTITION BY account, cost_center); needs n >= 3
(SUM(amount) OVER w - amount) / (COUNT(*) OVER w - 1) AS mean_excl,
SQRT(GREATEST((SUM(amount * amount) OVER w - amount * amount
  - POWER(SUM(amount) OVER w - amount, 2) / (COUNT(*) OVER w - 1))
  / NULLIF(COUNT(*) OVER w - 2, 0), 0)) AS sd_excl
```

On this data that flags 8 lines instead of 3. It doesn't fix a group with two outliers, like the S1/S5 group, because each outlier still inflates the other's standard deviation. For that, the IQR method is the better tool.

## Step 4: Three plain rules

Some problems aren't statistical at all:

- **WEEKEND**: posted on a Saturday or Sunday. `DAYOFWEEKISO` returns 1 to 7 from Monday, whatever the session's week settings ([date parts](https://docs.snowflake.com/en/sql-reference/functions/year)).
- **ROUND_AMOUNT**: |amount| of at least 10,000 and a multiple of 1,000.
- **NEGATIVE_EXPENSE**: a negative amount on an EXPENSE account.

```sql
CREATE OR REPLACE VIEW V_JE_RULES AS
WITH p AS (SELECT 10000 AS round_min, 1000 AS round_step),
e AS (
 SELECT x.doc_id, x.line_no, x.posting_date, x.period, x.cost_center, x.account, x.amount, a.account_type
 FROM ERP_GL_EXTRACT x LEFT JOIN FDH_DEMO.SAMPLE.DIM_ACCOUNT a ON a.account = x.account
)
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount, 'WEEKEND' AS rule
FROM e WHERE DAYOFWEEKISO(e.posting_date) IN (6, 7)
UNION ALL
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount, 'ROUND_AMOUNT'
FROM e CROSS JOIN p WHERE ABS(e.amount) >= p.round_min AND MOD(e.amount, p.round_step) = 0
UNION ALL
SELECT e.doc_id, e.line_no, e.posting_date, e.period, e.cost_center, e.account, e.amount, 'NEGATIVE_EXPENSE'
FROM e WHERE e.account_type = 'EXPENSE' AND e.amount < 0;
```

Each rule hits exactly one line: S3 (posted Saturday 2026-03-14), S2 (25,000.00) and S4. **NULL handling:** the left join keeps lines whose account isn't in `DIM_ACCOUNT`; they get account_type NULL and can't hit the expense rule, so check e) counts them (0 in the demo).

## Step 5: One list, and mail only when it isn't empty

`V_JE_FLAGS` stacks every flag with its reason. `V_JE_ALERT` sends the list to the owner of the close task "Journal anomaly review" (GL_ACCOUNTANT), one row per line with all its reasons: 35 rows in the demo, to gl.accountant@example.com.

```sql
CREATE OR REPLACE VIEW V_JE_FLAGS AS
SELECT doc_id, line_no, posting_date, period, cost_center, account, amount, 'ZSCORE' AS reason, z AS score FROM V_JE_ZSCORE WHERE flag
UNION ALL
SELECT doc_id, line_no, posting_date, period, cost_center, account, amount, 'IQR', NULL FROM V_JE_IQR WHERE flag
UNION ALL
SELECT doc_id, line_no, posting_date, period, cost_center, account, amount, rule, NULL FROM V_JE_RULES;

CREATE OR REPLACE VIEW V_JE_ALERT AS
SELECT r.email, r.display_name, f.doc_id, f.line_no, f.period, f.cost_center, f.account, f.amount,
 LISTAGG(f.reason, ', ') WITHIN GROUP (ORDER BY f.reason) AS reasons
FROM V_JE_FLAGS f
JOIN MOTORS_RECIPIENTS r ON r.role = (SELECT MIN(owner_role) FROM CLOSE_TASK WHERE task_name = 'Journal anomaly review')
GROUP BY r.email, r.display_name, f.doc_id, f.line_no, f.period, f.cost_center, f.account, f.amount;

-- Gate, run by the scheduler before mailing: 1 = send V_JE_ALERT, 0 = send nothing.
SELECT IFF(COUNT(*) > 0, 1, 0) AS send_alert FROM V_JE_FLAGS;
```

The gate is the last query: 1 means read `V_JE_ALERT` and send, 0 means send nothing. It's the same idea as the [failure-alerts post](../jedox/failure-alerts.md): no mail on a quiet month, so people still read it on a busy one. In the demo the gate returns 1, and 35 distinct lines are flagged by at least one method.

The alert contains journal amounts. Give the sending job a role that can only SELECT `V_JE_FLAGS` and `V_JE_ALERT`, not `ERP_GL_EXTRACT`, and send it only to internal finance recipients. Keep real addresses in your own `MOTORS_RECIPIENTS` table, never in a file you publish.

## Check the result

Run `06_checks.sql`. You should see:

| Check | Expected |
|---|---|
| Late tasks | **3**: CT10, CT12, CT21 |
| Blocked | **1**: CT19 |
| WD7 (2026-04-09) | 24 of 25 done, 96.00% |
| ZSCORE | **3** lines |
| IQR | **33** lines |
| WEEKEND / ROUND_AMOUNT / NEGATIVE_EXPENSE | 1 / 1 / 1 |
| Lines flagged by any method | 35 |
| Unknown accounts | 0 |
| Gate | 1 |

The seeded lines, honestly:

| Seeded line | Z-score | IQR | Rules |
|---|---|---|---|
| S1 10× amount | caught | caught | — |
| S2 round 25,000.00 | missed | missed | ROUND_AMOUNT |
| S3 weekend posting | missed | missed | WEEKEND |
| S4 wrong sign | caught | caught | NEGATIVE_EXPENSE |
| S5 subtle (393.23) | missed | caught | — |
| December accrual (legitimate) | flagged | flagged | — |

Every seeded problem is caught by at least one method, and no single method catches them all. The legitimate December accrual is flagged by both statistical methods: a false positive a person has to clear.

## If it doesn't match

- **Z-score flags differ.** You used `STDDEV_POP` instead of the sample standard deviation, or grouped by account only.
- **IQR counts differ.** You used `PERCENTILE_DISC`, which picks an actual value instead of interpolating.
- **WEEKEND hits a lot of Fridays or Mondays.** You used `DAYOFWEEK`, which depends on the session's week settings. Use `DAYOFWEEKISO`.
- **Division by zero.** A group with identical amounts has a standard deviation of 0. Keep the `IFF` guard.
- **Late tasks show 4.** You counted the blocked CT19 as late. It's open, not completed late; it shows up as overdue in `V_CLOSE_STATUS`.
- **The alert view is empty but the gate says 1.** The owner role has no row in `MOTORS_RECIPIENTS`. Add one before relying on the mail.

## Caveats

- **Small samples.** Some groups have only 4 lines. A mean and standard deviation from 4 numbers say very little, so in production only compute z when the group has at least 10 lines: `IFF(s.n < 10 OR s.sd_amount IS NULL OR s.sd_amount = 0, NULL, …)`. On this data that changes no flag.
- **Seasonality.** A December accrual is unusual by design. Compare like months, or exclude known seasonal postings, before you trust a flag.
- **False positives.** IQR flags 29 ordinary lines here. That's the price of catching S5.
- **Thresholds are parameters.** 3 and 1.5 are common starting points, not truths. Tune them on your own history and write down why.

## Wrap-up

- A close tracker is one task table and one view by day.
- Z-scores, IQR fences and plain rules each catch different things. Use them together.
- One extreme line can hide a smaller one from a z-score.
- Mail only when there are flags, and call it what it is: a review list from simple statistics.

**That's the automaker series.** Start again from the [Snowflake notes](index.md).

## Downloads

All files use made-up sample data and placeholder names. FDH Motors is not a real company.

[[download:samples/motors/close_task.csv|Download close_task.csv]]
[[download:samples/motors/erp_gl_extract.csv|Download erp_gl_extract.csv]]
[[download:samples/motors/motors_recipients.csv|Download motors_recipients.csv]]
[[download:samples/motors/load_motors.sql|Download load_motors.sql]]
[[download:samples/dim_account.csv|Download dim_account.csv]]
[[download:anomaly/01_v_close_status.sql|Download 01_v_close_status.sql]]
[[download:anomaly/02_v_je_zscore.sql|Download 02_v_je_zscore.sql]]
[[download:anomaly/03_v_je_iqr.sql|Download 03_v_je_iqr.sql]]
[[download:anomaly/04_v_je_rules.sql|Download 04_v_je_rules.sql]]
[[download:anomaly/05_v_je_flags_alert.sql|Download 05_v_je_flags_alert.sql]]
[[download:anomaly/06_checks.sql|Download 06_checks.sql]]
[[download:anomaly/README.md|Download README.md]]
