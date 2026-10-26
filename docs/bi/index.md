---
title: Power BI and Qlik
description: "Power BI and Qlik notes for FP&A, built on the same fictional Snowflake sample data as the rest of Finance Data Hub."
---

# Power BI and Qlik

Notes on Power BI and Qlik for FP&A reporting. They use the same fictional sample data as the rest of the site, so the totals you see in Snowflake carry straight into the report.

- [Power BI on Snowflake views](power-bi-snowflake-views.md) builds a star schema as Snowflake views, chooses Import or DirectQuery on purpose, and adds a check visual that ties to 0.00.

Qlik notes are coming next. These notes cover the data side a BI report reads from:

- [Plan vs actuals in Snowflake](../snowflake/plan-vs-actuals.md) joins budget and actuals without losing a row.
- [Excel as a thin front end](../vba/excel-thin-front-end.md) shapes P&L and variance as Snowflake views that a reporting tool can refresh.
- [Downloads](../downloads.md) has every sample file.
