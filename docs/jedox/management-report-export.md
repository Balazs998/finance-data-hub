---
title: A management report export Excel can trust
description: "Shape a Jedox Cube extract that Excel can trust: one amount column, base elements only, no thousands separators, and a 20-row sample to check by hand."
---

# A management report export Excel can trust

<p class="post-meta">Jedox · Excel</p>

You can build a Jedox view that looks right on screen and still arrives in Excel already double-counted, with months across the columns, and with numbers stored as text. Then your pivot shows twice the revenue, or Power Query breaks when a new month appears. The sample file is the shape to ask for, and it is twenty rows so you can check it with a calculator.

## What you'll build

- A stored view to check the export layout on screen.
- A scheduled Integrator Cube extract that writes one flat file: one amount column, base elements only, code and name, version as a column, no thousands separators.

## Before you start

!!! info "You'll need"
    - Jedox with Integrator, and a cube with version, year, period, entity, account, and cost center.
    - Stored subsets for account, entity, and cost center.
    - Excel to open the file and check the sample.
    - Sample file: [Downloads](#downloads).

## The sample scenario

!!! info "This post uses its own example data"
    This post uses its own illustrative example (entities E100 and E210, year and period as integers), not the FDH_DEMO sample used in the other posts.

The sample has twenty rows for two entities. E100 reports in one currency and E210 in US dollars, on purpose. Year and period are stored separately as integers (`2026` and `9`). The FDH_DEMO sample uses one `YYYY-MM` text column (2026-09); both sort correctly. Versions are `Actual` and `Budget`.

The sample exports `4000` as `account_code` and `Net revenue` as `account_name`. The [Snowflake actuals extract](../snowflake/month-end-actuals.md) uses the same split: a stable code, a readable name, and revenue as a positive amount.

## 1. Agree the rules for the file

| Rule | Why it matters |
| --- | --- |
| One amount column | A new month is a new row. Power Query does not break when September appears. |
| Base elements only | A consolidated parent plus its children will be summed twice. |
| Code and name | `4000` is what you join on. `Net revenue` is what a reader needs. Export both. |
| Version as a column | Actuals and budget live in one file. |
| No thousands separators | UTF-8, a header row, a dot as the decimal mark, no thousands separator. |

Year and period are integers (`2026` and `9`). Format "September" in Excel. Do not export the month name as the only period field, or the sort order becomes April, August, December.

## 2. Keep consolidated elements out

E100 net revenue in the sample is 1,250,000. That number, if it were the consolidated parent, is already the sum of the children. Export the parent and the children, and a pivot shows 2,500,000. Keep the parent in the Jedox report. Keep it out of the file you hand to Excel.

The sample has no gross-profit row for the same reason. Gross profit is a formula in the pack.

## 3. Set the view

Use a stored view to check the layout on screen:

- Rows: version, year, period, entity, account, cost center.
- The cell value is the amount. Nothing sits across the columns.
- Account, entity, and cost center use a stored subset.
- The account name is the alias. The element name stays the code. In the sample, that code is `4000` and the name is `Net revenue`.

## 4. Build the Cube extract

The scheduled file is an Integrator Cube extract. A Cube extract reads the cube with its own filters, not a saved report view. What carries over are the stored subsets: choose them in the extract's subset filter, and turn on Base elements only. That is what keeps the consolidated parent out of the file.

!!! warning "Don't paste from the add-in"
    A manual paste from the Excel add-in drifts the first time someone inserts a column.

## 5. Keep the numbers plain

A European locale that writes 1250000 as `1.250.000` gives Excel text, or a date, depending on the machine that opens the file. Check in your Integrator how the file load writes numbers, and keep the file free of thousands separators. Format it in the pack.

## Check the result

!!! success "Expected: E100 net revenue 1,250,000, gross profit 770,000 in Excel"
    Filter to E100, `Actual`, period 9. Net revenue 1,250,000 minus cost of goods 480,000 is gross profit 770,000. Personnel is 310,000 across three cost centers (180,000 + 40,000 + 90,000). Marketing is 95,000.

    E210 is in US dollars: net revenue 640,000, cost of goods 260,000. Do not add E210 to E100. The file contains two currencies on purpose.

## If it doesn't match

- **Net revenue shows 2,500,000 instead of 1,250,000:** the consolidated parent was exported with its children. Turn on Base elements only in the Cube extract.
- **Amounts arrive as text or dates in Excel:** the file has thousands separators from a European locale. Check how your Integrator file load writes numbers and keep separators out.
- **Months sort April, August, December:** the month name is the only period field. Export year and period as integers and format the month name in Excel.
- **Columns shift after someone edits the report:** the file was pasted from the Excel add-in. Use the scheduled Cube extract instead.
- **E100 and E210 totals look too large together:** they are in different currencies. Don't add them.

## Wrap-up

Export base elements only, keep one amount column, and leave formatting to the pack.

**Next:** [Month-close checks in Excel VBA](../vba/month-close-checks.md)

## Downloads

All files use synthetic sample data and placeholder names.

[[download:jedox/mgmt_report_export_sample.csv|Download mgmt_report_export_sample.csv]]
