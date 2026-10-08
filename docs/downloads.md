# Downloads

These files ship with the site. Save them and adapt the names to your model. The same buttons appear in the notes they belong to.

<div class="grid cards" markdown>

-   :material-database:{ .lg .middle } __gl_actuals_pnl.sql__

    ---

    Snowflake query for closed P&L actuals. One row per entity, cost center, account, fiscal period, and currency. Revenue is positive. `amount_gl` still ties to the trial balance.

    [[download:sql/gl_actuals_pnl.sql|Download .sql]]

-   :material-cube-outline:{ .lg .middle } __mgmt_report_export_sample.csv__

    ---

    A small Jedox-style management extract for September 2026. Base accounts only, Actual and Budget in one file, euros and dollars kept in separate rows.

    [[download:jedox/mgmt_report_export_sample.csv|Download .csv]]

-   :material-microsoft-excel:{ .lg .middle } __FPNA_MonthCloseChecks.bas__

    ---

    Excel module. It calculates the workbook, then lists a missing reporting period, blank `Input_` names, and formula errors on a sheet called Close checks.

    [[download:vba/FPNA_MonthCloseChecks.bas|Download .bas]]

</div>

Larger workbooks and Jedox exports are added as they are ready. Each file on this page is counted on its own when someone downloads it.
