---
title: "Jedox job alerts people read: email only when a load fails"
description: "Turn noisy 'job finished' mails into one failure-only alert per night for Jedox Integrator loads, with a run log, a Groovy job and a test mode that's on by default."
social_image: failure-alerts.png
---

# Jedox job alerts people read: email only when a load fails

<p class="post-meta">Jedox · Integrator</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>The mailer calls follow the Jedox 26.1 Integrator Scripting API pages linked below. We haven't run this job on a live install, and the scheduler's own email templates are covered only as an open point.</p>
</aside>

If every nightly load sends a "job finished" mail, people stop reading them, and the one failure on Thursday gets lost with the rest. If no load sends anything, a failed or empty load stays hidden until someone opens a report on Monday. This post keeps the start/finish idea from earlier posts but sends mail only when a run needs a person.

## What you'll build

- A run log, `job_runs.csv`, with one row per load run
- A Groovy job that emails only failed, warning and zero-row runs, as one message per night
- A test mode, on by default, that sends the alert to a test address

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" tabindex="0" aria-label="Failure-only alert flow">
  <a href="../failure-alerts-diagram.svg"><img src="../failure-alerts-diagram.svg" alt="Nightly load jobs write a row to the run log. A status check asks whether the run failed, warned or loaded zero rows. If yes, one alert email goes out. If no, no email is sent." width="840" height="500"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## Before you start

!!! info "You'll need"
    - Role / access: rights to create and run Groovy jobs in an Integrator project
    - Product version: Jedox 26.1. The SMTP server and From address are set centrally ([Cloud Console](https://knowledgebase.jedox.com/jedox/api/26-1/integrator-scripting/com/jedox/etl/components/scriptapi/MailAPI.html) on Jedox Cloud, [Web Administration > Settings](https://knowledgebase.jedox.com/jedox/maintenance/scheduler-integrator-jobs.htm) on-prem), not in scripts.
    - Snowflake: run [`v_fact_actuals.sql`](#downloads) once as SYSADMIN, so `JEDOX_ETL_ROLE` can read `V_FACT_ACTUALS` (check: 610 rows, total 15,446,573.09), and [`v_fact_budget.sql`](#downloads) once as SYSADMIN, so `JEDOX_ETL_ROLE` can read `V_FACT_BUDGET` (check: 696 rows, total 17,253,220.89).
    - Previous post: [Automated value emails from Jedox Integrator](automated-value-emails.md)
    - Sample data: [Downloads](#downloads)

## The sample scenario

The sample database `FDH_DEMO` has two nightly loads into the `PnL` cube: `load_actuals` (from the view `V_FACT_ACTUALS` over the `SNOWFLAKE_DEMO` connection) and `load_budget` (from the view `V_FACT_BUDGET`). The run log covers one made-up week, 2026-03-02 to 2026-03-08, with 14 runs.

| File | What's in it |
|---|---|
| `job_runs.csv` | 14 runs: `run_id,job,start,end,status,message,rows` |
| `alert_on_failure.groovy` | The alert job |
| `test_alert_logic.groovy` | Runs the alert logic on the CSV without Jedox |

Three runs in the week are problems on purpose:

- `R0105` on 2026-03-04: `load_actuals` failed, connection login timeout
- `R0108` on 2026-03-05: `load_budget` finished with a warning, 2 rows skipped for an unknown cost center
- `R0109` on 2026-03-06: `load_actuals` reported success but loaded 0 rows

The third one is the silent problem: a success mail would have told everyone things were fine.

## 1. Decide what counts as "needs attention"

Write the rule down before writing code. This post uses three cases:

- status is `error`
- status is `warning`
- status is `success` but `rows` is 0

Everything else gets no email. A quiet inbox means a quiet night.

!!! warning "Zero rows isn't success"
    An empty source still finishes cleanly. Check the row count, not just the status.

## 2. Keep the start/finish pattern, drop the success mail

The earlier pattern was: notify that the run started, poll the status, then notify on finish or failure on the same channel. Keep the polling and the failure branch. Remove the "finished OK" mail and the "started" mail for scheduled runs. Keep the "started" mail only for runs someone kicks off by hand, because that person is waiting.

## 3. Get the status into the run log

The alert job reads `job_runs.csv`. In this post the file is sample data. On a real install, each load would add its own row when it ends.

The Groovy API has no documented call that reads another job's last run. The documented route is a wrapper Groovy job that starts the load with [`API.executeJob('load_actuals')`](https://knowledgebase.jedox.com/jedox/api/26-1/integrator-scripting/com/jedox/etl/components/scriptapi/JobAPI.html), which returns a State. The [State](https://knowledgebase.jedox.com/jedox/api/26-1/integrator-scripting/com/jedox/etl/components/scriptapi/State.html) gives you the status, errors, warnings, start and stop time and the log, but no row count, so each load still writes its own row.

If you only need a status mail from the scheduler itself, its email templates have the placeholders `${etlJobStatus}` and `${etlJobStatusCode}`. They work only for scheduled Integrator tasks ([scheduler email templates](https://knowledgebase.jedox.com/jedox/maintenance/scheduler-email-templates.htm)). The status codes are ([scheduler task status codes](https://knowledgebase.jedox.com/jedox/maintenance/scheduler-task-status-codes.htm)):

| Code | Status |
|---|---|
| 10 | Successful |
| 20 | Warnings |
| 30 | Errors |
| 40 | Failed |
| 50 | Stopped |
| 55 | Interrupted |
| 60 | Aborted |
| 70 | Invalid |

The sample run log uses the words `success`, `warning` and `error`, not these codes.

## 4. Create the alert job

In the Integrator project, create a **File connection** named `RunLog`, location type `FileSystem`, with the file name set to `${RUN_LOG_FILE}`. Then create a **Groovy job** and paste `alert_on_failure.groovy`.

| Variable | Default | What it does |
|---|---|---|
| `TEST_MODE` | `true` | Anything except `false` sends the alert to `RECIPIENT_TEST` only |
| `RECIPIENT_TEST` | `test.recipient@example.com` | Where test alerts go |
| `RECIPIENT_ALERT` | `fdh.loads@example.com` | The team mailbox for real alerts |
| `RUN_DATE` | `2026-03-04` | The night to check, as `YYYY-MM-DD` |
| `RUN_LOG_FILE` | `job_runs.csv` | File name used by the `RunLog` connection |

The rule from step 1 is one small function:

```groovy
String alertReason(Map<String, String> run) {
    String status = run.status.toLowerCase()
    if (status == 'error') {
        return 'FAILED'
    }
    if (status == 'warning') {
        return 'WARNING'
    }
    if (status == 'success' && run.rows.toInteger() == 0) {
        return 'ZERO ROWS'
    }
    return null
}
```

If nothing is flagged, the job writes one log line and stops. Otherwise it sends a single email listing every flagged run:

```groovy
def mailer = API.getMailer()
mailer.addRecipient(to)
mailer.setSubject((testMode ? '[TEST] ' : '') + 'Nightly load alert ' + runDate + ': ' + flagged.size() + ' run(s) need attention')
mailer.setMessage(buildBody(flagged, runDate))
mailer.send()
mailer.reset()
```

The job reads the run log with `FILE.readBinary('RunLog').getText('UTF-8')` (FileAPI, bound as `FILE`) and writes its log line with `LOG.info(...)`. `setMessage` sends plain text; use `setHtmlMessage` for HTML. `API.getMailer()` here is the [JobAPI](https://knowledgebase.jedox.com/jedox/api/26-1/integrator-scripting/com/jedox/etl/components/scriptapi/JobAPI.html) mailer. The `ExecutionAPI.getMailer()` version is deprecated in 26.1, so don't copy it from older examples. If you read an extract in the same job, use `initSource()`: 26.1 marks `getSource()` as deprecated for removal ([ExecutionAPI 26.1](https://knowledgebase.jedox.com/jedox/api/26-1/integrator-scripting/com/jedox/etl/components/scriptapi/ExecutionAPI.html)).

!!! warning "Server time, not your time"
    Check which time zone your Jedox server uses and match `RUN_DATE` to it.

## 5. Add a daily summary (optional)

Some teams want one line a day even when nothing failed. If you add it, send it to a channel people skim, not to the alert mailbox, and keep it to counts: runs, failures, warnings, zero-row runs. The alert mail stays the only one that asks for action.

## Check the result

!!! success "Expected: 3 alert emails for the week, 4 quiet nights"
    ```text
    groovy test_alert_logic.groovy
    2026-03-03: no email
    2026-03-04: load_actuals FAILED
    2026-03-05: load_budget WARNING
    2026-03-06: load_actuals ZERO ROWS
    ```
    Rerun once more: the result must not change. Of the 14 runs, 3 are flagged and 11 send nothing.

The test script checks four nights; run the job with `RUN_DATE` from 2026-03-02 to 2026-03-08 to see all seven.

## If it doesn't match

- **Every night sends an email:** the status values have different case or spelling. Check the `status` column; the script lowercases it and expects `success`, `warning` or `error`.
- **The zero-row run isn't flagged:** `rows` is empty or not a number. Fill it with `0`.
- **No email arrives in test mode:** (see [Before you start](#before-you-start)). The script can't set the SMTP server or From address.
- **The alert covers the wrong night:** `RUN_DATE` is in local time but the log is in server time.

## Wrap-up

- Send mail only when someone has to act. Quiet nights stay quiet.
- Treat zero rows as a problem, not a success.
- Keep test mode on until the alert address is agreed.

## Downloads

All files use synthetic sample data and placeholder names.

[[download:alerts/job_runs.csv|Download job_runs.csv]]
[[download:alerts/alert_on_failure.groovy|Download alert_on_failure.groovy]]
[[download:alerts/test_alert_logic.groovy|Download test_alert_logic.groovy]]
[[download:relational/v_fact_actuals.sql|Download v_fact_actuals.sql (610 rows, 15,446,573.09)]]
[[download:relational/v_fact_budget.sql|Download v_fact_budget.sql (696 rows, 17,253,220.89)]]
