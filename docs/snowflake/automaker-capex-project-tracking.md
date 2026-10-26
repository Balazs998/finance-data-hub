---
date: 2026-10-25
home_tag: Automaker series
title: "Capex tracking: budget vs committed vs actual"
description: "One Snowflake view of budget, commitments and actuals per capex project, with exception flags and an alert list, for fictional FDH Motors."
social_image: automaker-capex-project-tracking.png
---

# Capex tracking: budget vs committed vs actual, with alerts only when something is wrong

<p class="post-meta">Snowflake · Intermediate · ~25 min · Automaker series</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>The Snowflake SQL in this post has not been run on a live account. Every check number was recomputed from the sample CSVs with the same logic as the SQL, and matches the sample data dictionary.</p>
</aside>

Capex usually lives in a spreadsheet: one tab per project, budget in one column, invoices pasted in another. What's missing is the money already promised. A purchase order for a paint robot is real spend the day it's signed, but it won't show in actuals until the invoice arrives. So an over-budget project surfaces at quarter-end, when nothing can be done about it.

This post builds one view of budget, committed and actual per project for the fictional FDH Motors, then a short list of exceptions: over budget, spend on a project nobody approved, and projects approved by their own owner. The alert fires only when that list isn't empty. The example uses Snowflake, but it's plain SQL, so any database can rebuild it.

## What you'll build

- `V_CAPEX_STATUS`: budget, committed (open POs), actual, remaining and % used per project, with approval status
- `V_CAPEX_EXCEPTIONS`: one row per project and reason (`OVER_BUDGET`, `UNAPPROVED_SPEND`, `SOD_FLAG`)
- `V_CAPEX_ALERT`: who gets told about which exception, from a recipients table

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="Capex flow">
  <a href="../capex-flow.svg"><img src="../capex-flow.svg" alt="Capex flow for FDH Motors: request (CAPEX_PROJECT), approve, commit (open POs in CAPEX_COMMIT), invoice (CAPEX_ACTUAL), check (V_CAPEX_STATUS, V_CAPEX_EXCEPTIONS: 2 over budget, 1 unapproved spend, 1 approver = owner), then alert (V_CAPEX_ALERT, 8 rows). If there are no exceptions, nothing is sent." width="840" height="320"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) to create views in `FDH_DEMO.MOTORS`. This pack adds no grants. `JEDOX_ETL_ROLE` is not touched.
    - Product version: any current Snowflake account (`IFF`, `LISTAGG`; docs-based, not run on a live account)
    - Previous posts: [13-week cash runway](automaker-13-week-cash-runway.md) and [Email only when a Jedox load fails](../jedox/failure-alerts.md) (the alert pattern)
    - Sample data: `capex_project.csv`, `capex_commit.csv`, `capex_actual.csv` and `motors_recipients.csv`, loaded by `load_motors.sql`

## Step 1: Know your three numbers

Every project has three amounts, and they come from three places:

- **Budget**: the approved amount on `CAPEX_PROJECT` (12 projects, 7,400,000.00 in total).
- **Committed**: purchase orders that are still **open** in `CAPEX_COMMIT`. A closed PO has been invoiced, so it's already in actual. Counting it again would double the spend.
- **Actual**: invoices in `CAPEX_ACTUAL`.

Remaining is budget minus committed minus actual. In the demo data, open POs total 1,202,500.00, invoices 5,320,500.00, and remaining is 877,000.00.

## Step 2: Build the status view

`01_v_capex_status.sql` sums open POs and invoices per project and joins them to the project table. Left joins keep projects with no POs or invoices yet, with 0 instead of NULL.

```sql
CREATE OR REPLACE VIEW V_CAPEX_STATUS AS
WITH c AS (
 SELECT project_id, SUM(amount) AS committed_open
 FROM CAPEX_COMMIT WHERE status = 'OPEN' GROUP BY project_id
), a AS (
 SELECT project_id, SUM(amount) AS actual, MAX(period) AS last_invoice_period
 FROM CAPEX_ACTUAL GROUP BY project_id
), l AS (
 SELECT x.project_id, COUNT(*) AS late_invoices
 FROM CAPEX_ACTUAL x JOIN CAPEX_PROJECT p ON p.project_id = x.project_id
 WHERE p.closed AND x.period > p.closed_period GROUP BY x.project_id
)
SELECT p.project_id, p.project_name, p.plant, p.owner_role, p.approval_status, p.approved_by_role,
 p.closed, p.closed_period, p.budget_amount,
 COALESCE(c.committed_open, 0) AS committed_open,
 COALESCE(a.actual, 0) AS actual,
 p.budget_amount - COALESCE(c.committed_open, 0) - COALESCE(a.actual, 0) AS remaining,
 IFF(p.budget_amount = 0, NULL, (COALESCE(c.committed_open, 0) + COALESCE(a.actual, 0)) / p.budget_amount) AS pct_used,
 a.last_invoice_period,
 COALESCE(l.late_invoices, 0) AS late_invoices
FROM CAPEX_PROJECT p
LEFT JOIN c ON c.project_id = p.project_id
LEFT JOIN a ON a.project_id = p.project_id
LEFT JOIN l ON l.project_id = p.project_id;
```

`late_invoices` counts invoices booked after a project was closed. It isn't an exception on its own, but someone should ask why a closed project still gets bills. In the demo, PRJ11 closed in 2026-05 and invoice INV0051 arrived in 2026-07.

## Step 3: List the exceptions

`02_v_capex_exceptions.sql` returns one row per project and reason. Three rules:

- **OVER_BUDGET**: committed + actual is more than budget × (1 + tolerance). The tolerance is 5% and sits in one place, so you can change it without hunting through the query. In production, move it to a one-row settings table so it can change without redeploying the view.
- **UNAPPROVED_SPEND**: the project isn't `APPROVED`, but money is already committed or spent. `IS DISTINCT FROM` also catches a blank (NULL) status. A plain `<>` would quietly skip it ([doc](https://docs.snowflake.com/en/sql-reference/functions/is-distinct-from)).
- **SOD_FLAG**: the role that approved the project is the role that owns it (a segregation-of-duties problem). This compares roles. If one person holds both roles, it won't catch them; compare user IDs if you have them. An approved project with no approver recorded is not flagged here; add a check for `approved_by_role IS NULL` if your data allows it.

```sql
CREATE OR REPLACE VIEW V_CAPEX_EXCEPTIONS AS
WITH t AS (SELECT 0.05 AS tolerance)
SELECT s.project_id, 'OVER_BUDGET' AS reason, s.owner_role,
 s.committed_open + s.actual - s.budget_amount AS amount_over_budget
FROM V_CAPEX_STATUS s CROSS JOIN t
WHERE s.committed_open + s.actual > s.budget_amount * (1 + t.tolerance)
UNION ALL
SELECT s.project_id, 'UNAPPROVED_SPEND', s.owner_role, NULL
FROM V_CAPEX_STATUS s
WHERE s.approval_status IS DISTINCT FROM 'APPROVED' AND s.committed_open + s.actual > 0
UNION ALL
SELECT s.project_id, 'SOD_FLAG', s.owner_role, NULL
FROM V_CAPEX_STATUS s
WHERE s.approved_by_role = s.owner_role;
```

On the demo data that gives four rows:

| Project | Reason | Why |
|---|---|---|
| PRJ03 | OVER_BUDGET | Invoices alone are 112.00% of budget (180,000.00 over) |
| PRJ05 | OVER_BUDGET | Invoices are 80.00% of budget, but 110.00% with open POs (80,000.00 over) |
| PRJ09 | UNAPPROVED_SPEND | Still PENDING, with 45,000.00 already invoiced |
| PRJ10 | SOD_FLAG | IT_PROJECTS_LEAD owns it and approved it |

PRJ05 is the reason committed spend matters: an invoices-only report would show it at 80% and nobody would look. PRJ07 is at 103.00% with open POs (85.00% from invoices alone), inside the 5% tolerance, so it doesn't alert.

## Step 4: Alert only when there's something to say

`03_v_capex_alert.sql` joins the exceptions to `MOTORS_RECIPIENTS`. Each owner hears about their own projects, and the capex committee gets every exception. On the demo data that's 8 rows: 4 to owners and 4 to the committee. Owners without a `MOTORS_RECIPIENTS` row get no mail; the committee row is always sent.

```sql
CREATE OR REPLACE VIEW V_CAPEX_ALERT AS
SELECT r.email, r.display_name, e.project_id, e.reason, e.amount_over_budget
FROM V_CAPEX_EXCEPTIONS e JOIN MOTORS_RECIPIENTS r ON r.role = e.owner_role
UNION ALL
SELECT r.email, r.display_name, e.project_id, e.reason, e.amount_over_budget
FROM V_CAPEX_EXCEPTIONS e JOIN MOTORS_RECIPIENTS r ON r.role = 'CAPEX_COMMITTEE';
```

Whatever sends the mail (your scheduler, an Integrator job, a script) should decide on one number, not on parsing text:

```sql
SELECT COUNT(*) AS exception_count FROM V_CAPEX_EXCEPTIONS;
```

0 means stop and send nothing. Anything above 0 means read `V_CAPEX_ALERT` and send. This is the same idea as the [failure-alerts post](../jedox/failure-alerts.md): no mail on a good day, so people still read the mail on a bad one. The job only needs to read these views; it never writes to the capex tables.

Give the sending job a role that can only SELECT these three views, and keep real addresses in your own `MOTORS_RECIPIENTS` table, never in a file you publish.

## Check the result

Run `04_checks.sql`. You should see:

| Check | Expected |
|---|---|
| Totals | Budget **7,400,000.00**, committed 1,202,500.00, actual 5,320,500.00, remaining 877,000.00 |
| Status view vs tables | 0.00 difference on budget, committed and actual |
| OVER_BUDGET | **2**: PRJ03, PRJ05 |
| UNAPPROVED_SPEND | **1**: PRJ09 |
| SOD_FLAG | **1**: PRJ10 |
| PRJ07 | 103.00% used with open POs (85.00% invoiced), no alert |
| PRJ11 | late_invoices 1 |
| Alert rows | 8 |

## If it doesn't match

- **Actual-plus-committed is too high, and more projects are over budget.** You counted closed POs as committed. Their invoices are already in actual. Filter `status = 'OPEN'`.
- **PRJ05 doesn't show up.** You compared only invoices to budget. Add open commitments.
- **PRJ07 alerts.** The tolerance is missing or set to 0. It should be 0.05.
- **A project with no POs disappears from the status view.** Use LEFT JOINs and `COALESCE(..., 0)`.
- **PRJ09 is missing from UNAPPROVED_SPEND.** You checked for `'PENDING'` and the status has a different case or spacing, or you only looked at commitments (PRJ09 has invoices but no open POs).
- **Fewer than 8 alert rows.** An owner role has no row in `MOTORS_RECIPIENTS`. An inner join drops that exception silently for the owner, though the committee still gets it. Check that every `owner_role` has a recipient.
- **Budget total is wrong.** The status view must have one row per project. If you joined POs and invoices in one step before grouping, the budget repeats.

## Wrap-up

- Committed means open POs only. Closed POs are already in actual.
- Write the exception rules down as SQL, with the tolerance in one place.
- Segregation of duties is a one-line check once approvals are data.
- Alert on a count, and send nothing when the count is 0.

**Next in the automaker series:** [rolling up BOM cost and purchase price variance](automaker-bom-cost-rollup.md).

## Downloads

All files use made-up sample data and placeholder names. FDH Motors is not a real company.

[[download:samples/motors/capex_project.csv|Download capex_project.csv]]
[[download:samples/motors/capex_commit.csv|Download capex_commit.csv]]
[[download:samples/motors/capex_actual.csv|Download capex_actual.csv]]
[[download:samples/motors/motors_recipients.csv|Download motors_recipients.csv]]
[[download:samples/motors/load_motors.sql|Download load_motors.sql]]
[[download:capex/01_v_capex_status.sql|Download 01_v_capex_status.sql]]
[[download:capex/02_v_capex_exceptions.sql|Download 02_v_capex_exceptions.sql]]
[[download:capex/03_v_capex_alert.sql|Download 03_v_capex_alert.sql]]
[[download:capex/04_checks.sql|Download 04_checks.sql]]
[[download:capex/README.md|Download README.md]]
