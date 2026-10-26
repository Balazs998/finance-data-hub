# Thin front end pack (fictional FDH_DEMO data)
0. Load the samples with load_snowflake.sql.
1. `01_reporting_views.sql` - V_PNL_MONTHLY, V_VARIANCE_BY_CC + checks (SYSADMIN)
2. `02_excel_read_grants_for_admin.sql` - commented. An admin reviews and runs these grants.
3. `FDH_ThinFront.bas` - one-click refresh module
4. `BUILD-SPEC.md` - workbook layout and expected check values
