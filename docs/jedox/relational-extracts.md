---
title: "Relational extract: table setup or your own SQL?"
description: "Jedox Integrator can read Snowflake with a point-and-click RelationalTable extract or a hand-written Relational extract. Same job both ways, same 58 rows, and when to pick which."
---

# Relational extract: table setup or your own SQL?

Jedox Integrator gives you two ways to read rows from Snowflake. The **RelationalTable extract** lets you point at a table or view and click your columns, filters and grouping together. The **Relational extract** lets you write the SELECT yourself.

A common belief is that the point-and-click version pulls the whole table into Jedox and filters there. It doesn't. Both run their filters in Snowflake. The real difference is how much SQL you're allowed to use.

To show it, we'll do the same job both ways: load Actuals for March 2026 from the sample data. Both routes should return **58 rows totaling 1,466,143.86**.

This post builds on [From Snowflake to Jedox](snowflake-to-jedox.md). It reuses your Snowflake connection from the launch post (we call it SNOWFLAKE_DEMO here), the service user `JEDOX_SVC`, the role `JEDOX_ETL_ROLE` and the warehouse `JEDOX_ETL_WH`.

> **Which Integrator UI?** The steps use the **legacy** Integrator UI.

---

## Setup: give the role a view to read

`JEDOX_ETL_ROLE` reads views only, so it can't select from `FACT_ACTUALS` directly. Create a plain pass-through view once and grant it to the role:

```sql
USE ROLE SYSADMIN;
CREATE OR REPLACE VIEW FDH_DEMO.SAMPLE.V_FACT_ACTUALS AS SELECT COST_CENTER, ACCOUNT, PERIOD, VERSION, AMOUNT FROM FDH_DEMO.SAMPLE.FACT_ACTUALS;
GRANT SELECT ON VIEW FDH_DEMO.SAMPLE.V_FACT_ACTUALS TO ROLE JEDOX_ETL_ROLE;
```

To undo it later:

```sql
REVOKE SELECT ON VIEW FDH_DEMO.SAMPLE.V_FACT_ACTUALS FROM ROLE JEDOX_ETL_ROLE;
```

Both routes below read `V_FACT_ACTUALS`. [[download:relational/v_fact_actuals.sql|Download v_fact_actuals.sql]]

## Two routes, one result

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="Two routes from Snowflake to the same rows in the cube">
  <a href="../relational-extract-diagram.svg"><img src="../relational-extract-diagram.svg" alt="Two routes from Snowflake to the same rows in the cube. Snowflake is on the left, where the WHERE runs. The top route is RelationalTable, point and click, for filters and group by. A dotted path brings a Snowflake view into that route. The bottom route is Relational, write it yourself, for joins, CTEs and functions. Both end at the same rows in the cube." width="840" height="500"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## The two setups

Both extracts use the `SNOWFLAKE_DEMO` connection and feed the same Cube Load into `PnL`.

=== "RelationalTable"

    1. Add a **RelationalTable extract** and pick the connection `SNOWFLAKE_DEMO`.
    2. Choose the view `FDH_DEMO.SAMPLE.V_FACT_ACTUALS`.
    3. Pick the columns `VERSION`, `PERIOD`, `COST_CENTER`, `ACCOUNT` and `AMOUNT`. Give them aliases if your Cube Load expects other names.
    4. Add two filters:

        | # | Column | Operator | Value |
        |---|---|---|---|
        | 1 | `VERSION` | `=` | `Actual` |
        | 2 | `PERIOD` | `=` | `2026-03` |

        Several filters are joined with AND unless you write a logical expression such as `(1 AND 2) OR 3`.

    5. Group by `VERSION`, `PERIOD`, `COST_CENTER` and `ACCOUNT`, and aggregate `AMOUNT` with a sum. That brings the data down to cube grain before it leaves Snowflake.
    6. Optionally sort by `COST_CENTER` and `ACCOUNT`, and run the extract preview.

    Available filter operators are `=`, `<>`, `<`, `<=`, `>`, `>=`, `LIKE`, `IN`, `NOT IN`, `IS NULL` and `IS NOT NULL`. There's also HAVING for filtering on aggregated values.

    Want the period to come from a job variable such as `${PERIOD}`? Check in your Integrator whether the filter value accepts it, as the docs don't say.

=== "Relational"

    1. Add a **Relational extract** and pick the connection `SNOWFLAKE_DEMO`.
    2. Paste the query:

        ```sql
        SELECT VERSION, PERIOD, COST_CENTER, ACCOUNT, SUM(AMOUNT) AS AMOUNT
        FROM FDH_DEMO.SAMPLE.V_FACT_ACTUALS
        WHERE VERSION = 'Actual'
        AND PERIOD = '2026-03'
        GROUP BY VERSION, PERIOD, COST_CENTER, ACCOUNT
        ORDER BY COST_CENTER, ACCOUNT
        ```

    3. Run the extract preview.

    To reuse the job for other months, swap `'2026-03'` for `'${PERIOD}'`, as in the launch post.

**Use uppercase column names.** Snowflake stores unquoted names in uppercase, so `period` in a table is really `PERIOD`. If a name gets quoted exactly as you typed it, `"period"` won't match. Typing uppercase avoids the question.

**Aggregate in Snowflake, in both modes.** Group down to cube grain (one row per Version, Period, CostCenter and Account) before anything reaches Integrator. Fewer rows cross the network, and the totals match the cube exactly.

!!! note "Both run in Snowflake"
    The RelationalTable extract doesn't download the table. It turns your columns, filters and grouping into a SELECT with WHERE, GROUP BY and HAVING, and Snowflake runs it. You can see this yourself. Run both extracts, then look them up in query history (same lookup as the launch post):

    ```sql
    USE ROLE SYSADMIN;
    SELECT start_time, query_text, rows_produced, total_elapsed_time
    FROM TABLE(FDH_DEMO.INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(WAREHOUSE_NAME => 'JEDOX_ETL_WH', END_TIME_RANGE_START => DATEADD('day', -7, CURRENT_TIMESTAMP()), RESULT_LIMIT => 10000))
    WHERE query_tag = 'jedox_actuals_load'
    ORDER BY start_time DESC;
    ```

    Both queries carry the tag because the launch post sets it on the service user (`ALTER USER JEDOX_SVC SET QUERY_TAG = 'jedox_actuals_load'`), so every query from `JEDOX_SVC` has it, including the SQL that RelationalTable generates. The lookup only covers the last 7 days.

    Both queries should show a WHERE on `PERIOD` and produce 58 rows. The generated one also shows you exactly how Integrator wrote your column names.

## Check the result

Both routes should give the same answer for Actual 2026-03: **58 rows, total 1,466,143.86**. Check the total plus a row count: 58 rows in the extract preview, then 1,466,143.86 in the cube after loading. If one route returns more than 58 rows, the grouping is probably missing.

## Side by side

| | RelationalTable (point and click) | Relational (own SQL) |
|---|---|---|
| Setup effort | ✓ Low, no SQL needed | ✕ You write and test the SQL |
| Filters (run in Snowflake) | ✓ | ✓ |
| Aggregation and sort (GROUP BY, without SQL) | ✓ | ✓ (in SQL) |
| Joins and CTEs | ✕ | ✓ |
| Other SQL functions (CASE, date and string functions) | ✕ | ✓ |
| Job variables | Check in your Integrator | ✓ |
| Readability for the next person | ✓ Settings are easy to scan | Depends on how clean the SQL is |
| Column renamed or dropped | Check in your Integrator | Check in your Integrator |

## When to use which

- **One table or view, simple filters and a sum?** Use the RelationalTable extract. It's quick to set up and easy for the next person to read.
- **Need joins, CTEs, functions or job variables in the query?** Use the Relational extract. The Jedox docs point to it whenever the table setup isn't enough.
- **The middle ground:** put the joins and logic in a Snowflake view, and let a RelationalTable extract read the view. The SQL lives in Snowflake where it's easy to test, and the Integrator side stays point and click. The optional view in the downloads shows the idea by joining the cost center group onto the actuals.

## Wrap-up

Both extracts filter in Snowflake, so you're not choosing between fast and slow. You're choosing between simple and flexible. Start with the table setup, move the logic into a view when it grows, and write your own SQL when you need the full language. For the full load around it (service user, slice clear and Cube Load), see [From Snowflake to Jedox](snowflake-to-jedox.md).

Jedox docs: [Relational extract](https://knowledgebase.jedox.com/integration/extracts/relational-extract.htm) and [RelationalTable extract](https://knowledgebase.jedox.com/integration/extracts/relational-table-extract.htm).

## Downloads

All files use synthetic sample data and placeholder names.

[[download:relational/v_fact_actuals.sql|Download v_fact_actuals.sql (setup view and grant)]]
[[download:relational/relational_extract_actuals.sql|Download relational_extract_actuals.sql]]
[[download:relational/v_jedox_actuals_by_group.sql|Download v_jedox_actuals_by_group.sql (optional view)]]
[[download:relational/query_history_lookup.sql|Download query_history_lookup.sql]]
[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]
[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]
