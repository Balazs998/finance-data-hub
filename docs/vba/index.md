# VBA and Excel

The pack is still finished in Excel. The modules here are standard `.bas` files: import them, save as `.xlsm`, and run them yourself. Nothing on this site runs when a workbook opens.

The first module is a month-close check. It looks for three things that quietly survive a refresh: the reporting period cell is blank or missing, an `Input_` driver is empty, or a formula has become `#REF!` or `#N/A`. It writes the list to a sheet called Close checks.

Name the cells you want checked. `ReportingPeriod` is the period. Any name that starts with `Input_` is a required driver. A zero is a real value and is left alone.

[Month-close checks](month-close-checks.md){ .md-button }
