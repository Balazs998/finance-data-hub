# pbi1: Power BI on Snowflake views (FDH_DEMO)

Fictional sample data only. No .pbix is shipped. Power BI steps: based on official docs, not tested on a live install.

| File | What it does |
|---|---|
| 01_pbi_views.sql | Star schema views: V_PBI_FACT_FIN (1,306 rows), V_PBI_DIM_COST_CENTER (10), V_PBI_DIM_ACCOUNT (8), V_PBI_DIM_PERIOD (12), V_PBI_CHECK_TOTALS (2) + orphan check |
| q_*.m.txt | Power Query M, one query per view (Snowflake.Databases connector) |
| measures.dax.txt | Amount PBI, Total SF, Check Diff for the check visual |

Relationships (single direction, one-to-many): DIM_COST_CENTER[COST_CENTER], DIM_ACCOUNT[ACCOUNT], DIM_PERIOD[PERIOD] to FACT_FIN; CHECK_TOTALS[VERSION] to FACT_FIN[VERSION].
Check visual: Actual 15,446,573.09 / Budget 17,253,220.89, Check Diff 0.00 on every row and the total.
Placeholders: <your_account>, <YOUR_WH>. Use your own lab account, never a production one.
