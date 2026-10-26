---
title: "Excel as a thin front end: Snowflake views feed a refresh-only workbook"
description: "Move P&L and variance logic into two FDH_DEMO Snowflake views, connect Excel to them with Power Query, and refresh everything with one safe VBA button that waits for each query, logs the result and restores Excel's settings."
social_image: excel-thin-front-end.png
---

# Excel as a thin front end: Snowflake views feed a refresh-only workbook

<p class="post-meta">VBA · Intermediate · ~20 min</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>The refresh module uses <a href="https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.connections">Workbook.Connections</a>, <a href="https://learn.microsoft.com/en-us/office/vba/api/excel.workbookconnection.refresh">WorkbookConnection.Refresh</a> and <a href="https://learn.microsoft.com/en-us/office/vba/api/excel.oledbconnection.backgroundquery">OLEDBConnection.BackgroundQuery</a>, and the connection follows the <a href="https://docs.snowflake.com/en/developer-guide/odbc/odbc">Snowflake ODBC driver docs</a>. We have not run it against a live Snowflake account. View check numbers were derived from the pristine sample CSVs. The demo workbook hasn't been built yet, so the module hasn't been run in Excel. Re-check the views against the sample totals before you share the workbook.</p>
</aside>

Most month-end packs are a chain: export from the warehouse, paste into a workbook, fix the formulas that broke, paste into slides. Every link in that chain is manual, and every paste is a chance to send last month's numbers. The fix isn't a cleverer macro. It's moving the logic out of Excel. Let Snowflake do the joins, the variance maths and the sign rules in views; let Excel do what it's great at: showing numbers, pivoting them, and refreshing on demand.

## What you'll build

- Two views: `V_PNL_MONTHLY` (period × account) and `V_VARIANCE_BY_CC` (period × cost center × account type, with a favourable/unfavourable flag)
- A workbook with two Power Query tables and no pasted values
- `FDH_ThinFront.bas`: one button that refreshes every connection in order, logs each one and always puts Excel's settings back

## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` to create the views. Excel reads as `EXCEL_READ_ROLE` on `EXCEL_WH`. The two `SELECT ON VIEW` grants are in `02_excel_read_grants_PROPOSED.sql`, commented out. An admin reviews and runs these grants. No table grants, and `JEDOX_ETL_ROLE` is untouched.
    - Product version: Excel for Microsoft 365 on Windows (Power Query and VBA), the Snowflake ODBC driver, and a DSN named `SNOWFLAKE_DEMO`.
    - Previous posts: [Plan vs actuals in Snowflake](../snowflake/plan-vs-actuals.md) (the join pattern) and Key-pair auth for service users (how `EXCEL_ODBC_SVC` signs in)
    - Sample data: pristine [`fact_actuals.csv`](../files/samples/fact_actuals.csv) (610 rows), [`fact_budget.csv`](../files/samples/fact_budget.csv) (696 rows), [`dim_account.csv`](../files/samples/dim_account.csv) and [`dim_cost_center.csv`](../files/samples/dim_cost_center.csv). The views join `DIM_ACCOUNT` and `DIM_COST_CENTER`. Load the samples with [`load_snowflake.sql`](../files/samples/load_snowflake.sql), or use [Downloads](#downloads).

## The sample scenario

Actuals run 2025-10 to 2026-08; budget runs to 2026-09. So 2026-09 has budget but no actuals yet, and the views must say so instead of showing a 100% favourable variance. The sample stores revenue and cost as **positive** amounts, so "favourable" depends on account type: revenue above budget, or cost below budget.

## 1. The copy-paste chain and what it costs

Each manual step adds three risks: a stale source, a broken range, and a silent overwrite. You can't test a paste. You *can* test a view: it has a row count, a total and a definition in version control. That's the trade we're making.

## 2. Put the P&L and variance logic in Snowflake

```sql title="01_reporting_views.sql (excerpt)"
CREATE OR REPLACE VIEW V_VARIANCE_BY_CC AS
WITH a AS (
    SELECT f.period, f.cost_center, d.account_type, SUM(f.amount) AS actual
    FROM FACT_ACTUALS AS f JOIN DIM_ACCOUNT AS d ON d.account = f.account
    GROUP BY f.period, f.cost_center, d.account_type
),
b AS (
    -- same for FACT_BUDGET
),
j AS (
    -- FULL OUTER JOIN a and b, has_actuals = a.period IS NOT NULL
)
SELECT
    j.period,
    j.cost_center,
    c.cost_center_name,
    c.parent AS cost_center_group,
    j.account_type,
    j.actual,
    j.budget,
    j.actual - j.budget AS variance,
    CASE
        WHEN NOT j.has_actuals THEN 'No actuals yet'
        WHEN j.actual = j.budget THEN 'On plan'
        WHEN j.account_type = 'REVENUE' AND j.actual > j.budget THEN 'Favourable'
        WHEN j.account_type = 'EXPENSE' AND j.actual < j.budget THEN 'Favourable'
        ELSE 'Unfavourable'
    END AS variance_flag
FROM j
JOIN DIM_COST_CENTER AS c ON c.cost_center = j.cost_center;
```

Expected checks (all in the download):

| Check | Expected |
|---|---|
| `V_PNL_MONTHLY` rows | 96 (88 with actuals, 8 budget-only for 2026-09) |
| `V_VARIANCE_BY_CC` rows | 144 (132 with actuals, 12 "No actuals yet" for 2026-09) |
| Total actual / budget, both views | 15,446,573.09 / 17,253,220.89 |
| 2026-03 REVENUE | actual 229,693.47, budget 223,769.38, variance +5,924.09 (favourable) |
| 2026-03 EXPENSE | actual 1,236,450.39, budget 1,207,184.99, variance +29,265.40 (unfavourable) |

The March actual total (229,693.47 + 1,236,450.39 = 1,466,143.86) matches the figure used across the site.

## 3. Connect Excel, refresh-only

In Excel: **Data > Get Data > From Other Sources > From ODBC**, pick DSN `SNOWFLAKE_DEMO`, and use a native query such as `SELECT * FROM FDH_DEMO.SAMPLE.V_PNL_MONTHLY`. Load it as table `tPnlMonthly` on sheet PnL; repeat for `V_VARIANCE_BY_CC` as table `tVarianceByCC` on sheet Variance. The `SNOWFLAKE_DEMO` DSN sets `server` (`<account>.snowflakecomputing.com`), `uid` (EXCEL_ODBC_SVC), `authenticator=SNOWFLAKE_JWT`, `priv_key_file`, `database=FDH_DEMO`, `schema=SAMPLE`, `warehouse=EXCEL_WH`, `role=EXCEL_READ_ROLE`.

Then follow three rules:

- **No pasted values.** Every number on the Report sheet is a pivot or formula over `tPnlMonthly` or `tVarianceByCC`.
- **No logic in Power Query.** No merges, no custom columns. If you need a new measure, add it to the view.
- **No credentials in the file.** The DSN holds the connection; the workbook only knows its name. See the key-pair post for how the service user signs in.

Keep the private key file outside the workbook's folder and any synced, shared or Git folder, and encrypt it with a passphrase.

A **Checks** sheet makes the workbook self-testing: `=SUM(tPnlMonthly[actual])` should show 15,446,573.09 and `=COUNTIFS(tVarianceByCC[variance_flag],"No actuals yet")` should show 12. The full layout is in `BUILD-SPEC.md`.

## 4. One-click refresh with VBA

When background refresh is on, "Refresh All" can hand control back before every query has finished, so formulas and pivots may calculate on half-loaded tables. The module refreshes each connection in turn with background refresh switched off, logs it and restores settings even when something fails.

```vbnet title="FDH_ThinFront.bas (excerpt)"
Option Explicit

Private Const LOG_SHEET As String = "RefreshLog"
Private mLastError As String

Public Sub RefreshReport()
    Dim prevScreen As Boolean
    Dim prevEvents As Boolean
    Dim prevCalc As XlCalculation
    Dim prevStatus As Variant
    Dim conn As WorkbookConnection
    Dim startedAt As Date
    Dim failures As Long
    Dim stepName As String

    prevScreen = Application.ScreenUpdating
    prevEvents = Application.EnableEvents
    prevCalc = Application.Calculation
    prevStatus = Application.StatusBar

    On Error GoTo Fail
    stepName = "Check " & LOG_SHEET
    If Not SheetExists(LOG_SHEET) Then
        Err.Raise vbObjectError + 513, "RefreshReport", "Add a sheet named RefreshLog first."
    End If

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual

    For Each conn In ThisWorkbook.Connections
        stepName = conn.Name
        Application.StatusBar = "Refreshing " & stepName & "..."
        startedAt = Now
        If RefreshOne(conn) Then
            WriteLog stepName, startedAt, "OK", ""
        Else
            failures = failures + 1
            WriteLog stepName, startedAt, "FAILED", mLastError
        End If
    Next conn

    stepName = "Calculate"
    Application.Calculate
    ' ... failure message, then CleanExit restores every setting ...
End Sub

Private Function RefreshOne(ByVal conn As WorkbookConnection) As Boolean
    On Error GoTo Fail
    mLastError = ""
    Select Case conn.Type
        Case xlConnectionTypeOLEDB
            conn.OLEDBConnection.BackgroundQuery = False
        Case xlConnectionTypeODBC
            conn.ODBCConnection.BackgroundQuery = False
    End Select
    conn.Refresh
    RefreshOne = True
    Exit Function
Fail:
    mLastError = Err.Number & " " & Err.Description
    RefreshOne = False
End Function

Private Function SheetExists(ByVal sheetName As String) As Boolean
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If StrComp(ws.Name, sheetName, vbTextCompare) = 0 Then
            SheetExists = True
            Exit Function
        End If
    Next ws
End Function
```

`WriteLog` (5 cells to the RefreshLog sheet) is in the downloadable module.

What to notice:

- **The log sheet is checked first.** If RefreshLog is missing, the macro stops with "Add a sheet named RefreshLog first." before touching any setting or connection.
- **Settings are saved first and restored in one place** (`CleanExit`), on success and on error.
- **One failed query doesn't stop the rest.** `RefreshOne` traps its own error and the log records it; the user gets one message at the end.
- **No `Select` or `Activate`.** The log writes to `ThisWorkbook.Worksheets("RefreshLog")` cells directly.
- **No Windows API calls**, so there's no `Declare` and nothing needs `PtrSafe`; the module runs in 32-bit and 64-bit Office.
- **Power Query vs other OLE DB connections.** Power Query connections report as `xlConnectionTypeOLEDB` ([XlConnectionType](https://learn.microsoft.com/en-us/office/vba/api/excel.xlconnectiontype)) but use the `Microsoft.Mashup.OleDb.1` provider. Other OLE DB connections exist too; if you ever need to treat them differently, `InStr(conn.OLEDBConnection.Connection, "Microsoft.Mashup") > 0` tells them apart. This module refreshes both the same way, so it doesn't filter. The `BackgroundQuery` switch is saved with the workbook, which is intended for a refresh-only file.
- **Alternatives:** for a single table, `ListObject.QueryTable.Refresh BackgroundQuery:=False` does the same job; `Application.CalculateUntilAsyncQueriesDone` waits for async queries, but it has no per-connection logging.

Import the module (**File > Import File** in the VBA editor), save as `.xlsm`, and assign `RefreshReport` to a button on the Report sheet.

## 5. What about PowerPoint?

Linked charts in slides are the most fragile link in the chain. A safer pattern is to point slide content at named ranges on the Report sheet and update it from one macro. That's a follow-up post; it needs its own deck and review, so it isn't in this pack.

## Troubleshooting

- **Pivots show old numbers after refresh:** a connection is still on background refresh. Run `RefreshReport` instead of Refresh All, or check the log for a FAILED row.
- **"No actuals yet" rows look odd in a chart:** filter `variance_flag <> 'No actuals yet'` for closed-month views; keep them for budget-only views.
- **ODBC prompts for a password:** the DSN isn't set up for key-pair. Fix the DSN, not the workbook.
- **"Add a sheet named RefreshLog first.":** the workbook has no sheet named RefreshLog. Add it with the headers in `BUILD-SPEC.md` and run again.

## Wrap-up

- Logic in views, presentation in Excel.
- Refresh in order, wait for each query, log it.
- Always restore Excel's settings, even on error.

## Downloads

All files use synthetic sample data and placeholder names. The views need `DIM_ACCOUNT` and `DIM_COST_CENTER`.

[[download:samples/dim_account.csv|Download dim_account.csv]]
[[download:samples/dim_cost_center.csv|Download dim_cost_center.csv]]
[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]
[[download:thinfront/01_reporting_views.sql|Download 01_reporting_views.sql]]
[[download:thinfront/02_excel_read_grants_PROPOSED.sql|Download 02_excel_read_grants_PROPOSED.sql]]
[[download:thinfront/FDH_ThinFront.bas|Download FDH_ThinFront.bas]]
[[download:thinfront/BUILD-SPEC.md|Download BUILD-SPEC.md]]
[[download:thinfront/README.md|Download README.md]]
