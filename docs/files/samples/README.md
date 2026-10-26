# Finance Data Hub sample data (fictional) -> FDH_DEMO.SAMPLE

All of this data is made up. None of it comes from a real company, and every name is a placeholder.

- `dim_cost_center.csv`: 10 cost centers, each with a parent group
- `dim_account.csv`: 8 accounts, each with an account type
- `fact_budget.csv`: 696 rows of monthly Budget for FY2026 (Oct 2025 to Sep 2026), total 17,253,220.89
- `fact_actuals.csv`: 610 rows of monthly Actual for Oct 2025 to Aug 2026, total 15,446,573.09

Gaps in both directions are built in on purpose, so a FULL OUTER JOIN has work to do on each side:

- Budget-only: about 5% of Actual cells are missing, and Sep 2026 has Budget but no Actual.
- Actual-only: 5 unbudgeted Material Cost (500000) postings, 3 on CC3010 and 2 on CC6000.

Periods are zero-padded `YYYY-MM` strings. All amounts are positive, and revenue keeps its positive sign.

Load order: run `load_snowflake.sql`. It creates FDH_DEMO.SAMPLE and its tables, then loads these files. The FDH Motors pack in `motors/` builds on top of it.
