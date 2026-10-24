# FDH_ThinFront_Demo.xlsm build spec (post 02) - for Grok Bot, checked by VBA Pro
Status: PROPOSED (Sample Data Steward to confirm names). Workbook not built yet.
- Connection: ODBC DSN `SNOWFLAKE_DEMO` (placeholder; no account URL, user or key stored in the workbook). Role EXCEL_READ_ROLE, warehouse EXCEL_WH.
- Queries (Power Query, From ODBC, native query = SELECT * FROM FDH_DEMO.SAMPLE.<view>):
  - qPnlMonthly -> table tPnlMonthly on sheet PnL (expect 96 rows)
  - qVarianceByCC -> table tVarianceByCC on sheet Variance (expect 144 rows)
- Sheets: Report (pivots / formulas off the two tables only, no pasted values), PnL, Variance, RefreshLog (headers: query_name, start, end, status, error_message), Checks.
- Checks sheet formulas: =SUM(tPnlMonthly[actual]) expect 15,446,573.09; =SUM(tPnlMonthly[budget]) expect 17,253,220.89; =COUNTIFS(tVarianceByCC[variance_flag],"No actuals yet") expect 12.
- Module: FDH_ThinFront.bas, button "Refresh" on Report assigned to RefreshReport.
- Offline variant for reviewers without Snowflake: same queries From Text/CSV over a CSV export of each view (to be generated from the demo account by Flake, not hand-made).
