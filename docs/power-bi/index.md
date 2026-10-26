---
title: Power BI
description: "Power BI notes for FP&A, built on the same fictional Snowflake sample data as the rest of Finance Data Hub."
---

<div class="fdh-section fdh-section--power-bi" markdown>

# Power BI

Notes on Power BI for FP&A reporting. They use the same fictional sample data as the rest of the site, so the totals you see in Snowflake carry straight into the report.

- [Power BI on Snowflake views](power-bi-snowflake-views.md) builds a star schema as Snowflake views, chooses Import or DirectQuery on purpose, and adds a check visual that ties to 0.00.

These notes cover the data side a Power BI report reads from:

- [Plan vs actuals in Snowflake](../snowflake/plan-vs-actuals.md) joins budget and actuals without losing a row.
- [Excel as a thin front end](../vba/excel-thin-front-end.md) shapes P&L and variance as Snowflake views that a reporting tool can refresh.
- [Downloads](../downloads.md) has every sample file.

</div>
