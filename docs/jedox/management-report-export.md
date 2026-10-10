# A management report export Excel can trust

A Jedox view can look right on screen and still arrive in Excel already double-counted, with months across the columns, and with numbers stored as text. The sample file is the shape to ask for. It is twenty rows so you can check it with a calculator.

## Rules for the file

| Rule | Why it matters |
| --- | --- |
| One amount column | A new month is a new row. Power Query does not break when September appears. |
| Base elements only | A consolidated parent plus its children will be summed twice. |
| Code and name | `4000` is what you join on. `Net revenue` is what a reader needs. Export both. |
| Version as a column | Actual and Budget live in one file. |
| Plain numbers | UTF-8, a header row, a dot as the decimal mark, no thousands separator. |

Year and period are integers (`2026` and `9`). Format "September" in Excel. Do not export the month name as the only period field, or the sort order becomes April, August, December.

## Why base elements only

E100 net revenue in the sample is 1,250,000. That number, if it were the consolidated parent, is already the sum of the children. Export the parent and the children, and a pivot shows 2,500,000. Keep the parent in the Jedox report. Keep it out of the file you hand to Excel.

The sample has no gross-profit row for the same reason. Gross profit is a formula in the pack.

## Check the sample in a minute

Filter to E100, Actual, period 9. Net revenue 1,250,000 minus cost of goods 480,000 is gross profit 770,000. Personnel is 310,000 across three cost centers (180,000 + 40,000 + 90,000). Marketing is 95,000.

E210 is in US dollars: net revenue 640,000, cost of goods 260,000. Do not add E210 to E100. The file contains two currencies on purpose.

[[download:jedox/mgmt_report_export_sample.csv|Download mgmt_report_export_sample.csv]]

## Setting the view

Use a stored view to check the layout on screen:

- Rows: version, year, period, entity, account, cost center.
- The cell value is the amount. Nothing sits across the columns.
- Account, entity, and cost center use a stored subset.
- The account name is the alias. The element name stays the code. In the sample, that code is `4000` and the name is `Net revenue`.

The scheduled file is an Integrator Cube extract. A Cube extract reads the cube with its own filters, not a saved report view. What carries over are the stored subsets: choose them in the extract's subset filter, and turn on Base elements only. That is what keeps the consolidated parent out of the file. A manual paste from the Excel add-in drifts the first time someone inserts a column.

The sample exports `4000` as `account_code` and `Net revenue` as `account_name`. The [Snowflake actuals extract](../snowflake/month-end-actuals.md) uses the same split: a stable code, a readable name, and revenue as a positive amount.

## Number format

A European locale that writes 1250000 as `1.250.000` gives Excel text, or a date, depending on the machine that opens the file. Check in your Integrator how the file load writes numbers, and keep the file free of thousands separators. Format it in the pack.
