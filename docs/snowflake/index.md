# Snowflake

Snowflake is where the actuals live after the general ledger closes. Planning and the commentary still happen in Jedox and Excel. This section is about getting a finance-shaped extract out of Snowflake, not about warehouses, roles, or loading pipelines.

The first note is a month-end actuals query: fiscal periods, a single restatement per journal line, and revenue shown as a positive P&L amount. The SQL file on that page is the one to change. Swap the three object names for your own mart and tie `amount_gl` to the trial balance.

Scripts in this section are Snowflake SQL and live under `docs/files/sql/` in the repository.

[Month-end actuals](month-end-actuals.md){ .md-button }

Those actuals can be loaded into Jedox from the same kind of sample files. The job uses a key-pair service user, clears the Actual slice, then loads the month again.

[Snowflake to Jedox load](../jedox/snowflake-to-jedox.md){ .md-button }
