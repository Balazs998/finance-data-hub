---
title: Snowflake SQL for FP&A
description: "Get finance-shaped extracts from Snowflake SQL: closed-period P&L actuals and plan vs actuals joins you can drop straight into Excel or Jedox."
---

# Snowflake

Snowflake is where the actuals live after the general ledger closes. Planning and the commentary still happen in Jedox and Excel. This section is about getting a finance-shaped extract out of Snowflake, not about warehouses, roles, or loading pipelines.

The first note is a month-end actuals query: fiscal periods, a single restatement per journal line, and revenue shown as a positive P&L amount. The SQL file on that page is the one to change. Swap the three object names for your own mart and tie `amount_gl` to the trial balance.

Scripts are Snowflake SQL. They're linked from each post and listed on the Downloads page.

[Month-end actuals](month-end-actuals.md){ .md-button }

Budget vs actual with a FULL OUTER JOIN, on the FDH_DEMO sample data.

[Plan vs actuals](plan-vs-actuals.md){ .md-button }

The Jedox load uses a separate synthetic sample set (FDH_DEMO.SAMPLE: cost centers, accounts, monthly Budget and Actual), not the FINANCE.* tables above. The job uses a key-pair service user, clears the Actual slice for the months in scope, then loads them again.

[Snowflake to Jedox load](../jedox/snowflake-to-jedox.md){ .md-button }
