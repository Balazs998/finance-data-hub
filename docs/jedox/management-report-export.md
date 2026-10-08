# A management report export Excel can trust

A Jedox view can look right on screen and still arrive in Excel already double-counted, with months across the columns, and with numbers stored as text. The sample file is the shape to ask for. It is twenty rows so you can check it with a calculator.

## Rules for the file

| Rule | Why it matters |
| --- | --- |
| One amount column | A new month is a new row. Power Query does not break when September appears. |
| Base elements only | A consolidated parent plus its children will be summed twice. |
| Code and name | `A_4000` is what you join on. `Net revenue` is what a reader needs. Export both. |
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

Build a stored view with this layout:

- Rows: version, year, period, entity, account, cost center.
- The cell value is the amount. Nothing sits across the columns.
- Account, entity, and cost center use a base-level subset.
- The account alias is the name column. The element name stays the code.

Save the view, then run that same subset from Integrator as a cube extract on a schedule. A manual paste from the Excel add-in drifts the first time someone inserts a column.

If the element is called `A_4000` and the alias is `Net revenue`, export `A_4000` as `account_code` and the alias as `account_name`. The [Snowflake actuals extract](../snowflake/month-end-actuals.md) uses the same idea: a stable code, a readable name, and a positive revenue amount.

## Number format

A European locale that writes 1250000 as `1.250.000` gives Excel text, or a date, depending on the machine that opens the file. Set the extract to a plain number. Format it in the pack.
