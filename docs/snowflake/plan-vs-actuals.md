---
title: "Plan vs. actuals in Snowflake SQL, without losing rows"
description: "Build a month-end budget vs. actual variance in Snowflake with a FULL OUTER JOIN, so budget-only and unbudgeted rows both show up."
social_image: plan-vs-actuals.png
---

# Plan vs. actuals in Snowflake SQL, without losing rows

A variance report has one job: show every euro that's in the budget or in the actuals. The most common way it fails is quiet. Somebody joins actuals to budget with a `LEFT JOIN` or an inner join, the report looks fine, and the rows that exist on only one side vanish.

This post builds the variance the safe way, using the site's made-up sample data: 10 cost centers and 8 accounts. Budget covers October 2025 to September 2026 and Actual covers October 2025 to August 2026.

## 1. Two kinds of rows that go missing

The sample data has both on purpose:

- **Budget only.** 91 cells have a budget but no actual. 58 of them are September 2026, which hasn't closed yet. The other 33 are cells where nothing was posted.
- **Actual only.** 5 postings of Material Cost (account `500000`) land on cost centers CC3010 and CC6000, which have no budget for that account at all. Together they're 14,896.50 of unbudgeted spend.

The second group is the one that matters most. Unbudgeted spend is exactly what a controller wants to see, and it's exactly what a budget-driven join throws away.

## 2. Sum each side first

Never join two fact tables at posting level. If a cell has three actual postings and two budget rows, a direct join produces six rows and inflates both totals. Sum each side to one row per cell first, then join.

```sql
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;
USE WAREHOUSE <your warehouse>;

WITH budget AS (
    SELECT cost_center, account, period, SUM(amount) AS budget
    FROM FACT_BUDGET
    GROUP BY cost_center, account, period
),
actuals AS (
    SELECT cost_center, account, period, SUM(amount) AS actual
    FROM FACT_ACTUALS
    GROUP BY cost_center, account, period
)
SELECT COUNT(*) FROM budget; -- 696 cells
```

## 3. The full outer join

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" tabindex="0" aria-label="Join coverage diagram, scroll sideways on small screens">
  <a href="../02-join-coverage.svg"><img src="../02-join-coverage.svg" alt="What each join keeps on the sample data. INNER JOIN keeps 605 cells with both budget and actual. LEFT JOIN from budget keeps 696, adding 91 budget-only cells. FULL OUTER JOIN keeps all 701, adding the 5 actual-only cells too." width="720" height="400"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

```sql
USE ROLE SYSADMIN;
CREATE OR REPLACE VIEW V_PLAN_VS_ACTUAL AS
WITH budget AS (
    SELECT cost_center, account, period, SUM(amount) AS budget
    FROM FACT_BUDGET
    GROUP BY cost_center, account, period
),
actuals AS (
    SELECT cost_center, account, period, SUM(amount) AS actual
    FROM FACT_ACTUALS
    GROUP BY cost_center, account, period
)
SELECT
    COALESCE(a.cost_center, b.cost_center) AS cost_center,
    COALESCE(a.account, b.account) AS account,
    COALESCE(a.period, b.period) AS period,
    COALESCE(b.budget, 0) AS budget,
    COALESCE(a.actual, 0) AS actual,
    COALESCE(a.actual, 0) - COALESCE(b.budget, 0) AS variance,
    CASE
        WHEN a.cost_center IS NULL THEN 'Budget only'
        WHEN b.cost_center IS NULL THEN 'Actual only'
        ELSE 'Both'
    END AS match_status
FROM actuals AS a
FULL OUTER JOIN budget AS b
    ON a.cost_center = b.cost_center
    AND a.account = b.account
    AND a.period = b.period;
```

Three details carry the whole thing:

- **`COALESCE` on the keys.** On a budget-only row, every column from `actuals` is NULL, so the key has to come from whichever side exists.
- **`COALESCE` on the amounts.** `100 - NULL` is NULL, not 100. Without the zero, every one-sided row would show no variance at all.
- **`match_status`.** It costs one line and makes the gaps visible instead of leaving readers to guess why a cell shows zero.

If a key column in your source can be NULL, replace it with something like `'(none)'` inside the two CTEs. `NULL = NULL` never matches in a join, so otherwise the same cell comes out as two one-sided rows.

## 4. Check the counts

```sql
SELECT match_status,
       COUNT(*) AS cells,
       SUM(budget) AS budget,
       SUM(actual) AS actual
FROM V_PLAN_VS_ACTUAL
GROUP BY match_status
ORDER BY match_status;
```

On the sample files this returns:

| match_status | cells | budget | actual |
|---|---:|---:|---:|
| Actual only | 5 | 0.00 | 14,896.50 |
| Both | 605 | 14,968,531.49 | 15,431,676.59 |
| Budget only | 91 | 2,284,689.40 | 0.00 |

That's 701 cells in total. A `LEFT JOIN` from budget would return only 696, and the report would be 14,896.50 short on actuals with nothing on screen to say so.

## 5. Favorable or unfavorable

In the sample, revenue and expense are both stored as positive numbers. That means "actual minus budget" reads differently by account type: more revenue is good, more expense is bad. Join the account dimension and flag it:

```sql
SELECT
    v.*,
    d.account_type,
    CASE
        WHEN v.variance = 0 THEN 'On plan'
        WHEN d.account_type = 'REVENUE' AND v.variance > 0 THEN 'Favorable'
        WHEN d.account_type = 'EXPENSE' AND v.variance < 0 THEN 'Favorable'
        ELSE 'Unfavorable'
    END AS variance_flag
FROM V_PLAN_VS_ACTUAL AS v
JOIN DIM_ACCOUNT AS d
    ON d.account = v.account;
```

If your ledger stores revenue as negative numbers, flip the revenue sign before this step, not after.

## 6. Don't report a month that hasn't closed

September 2026 has budget and no actuals yet, so all 58 September cells show as "Budget only". Of those, 54 are expense cells, and zero spend against budget makes every one of them **Favorable**. The 4 revenue cells show as Unfavorable. An unclosed month makes costs look great, which is correct data and a misleading report. Filter to closed periods:

```sql
SELECT *
FROM V_PLAN_VS_ACTUAL
WHERE period <= '2026-08';
```

This works as plain text comparison only because periods are stored as zero-padded `YYYY-MM`. With `2026-9` instead of `2026-09`, September would sort after `2026-10`. In a real model, take the last closed period from a fiscal calendar table instead of typing it.

## 7. One month, one line per account type

For March 2026:

```sql
SELECT d.account_type,
       SUM(v.budget) AS budget,
       SUM(v.actual) AS actual,
       SUM(v.variance) AS variance
FROM V_PLAN_VS_ACTUAL AS v
JOIN DIM_ACCOUNT AS d ON d.account = v.account
WHERE v.period = '2026-03'
GROUP BY d.account_type
ORDER BY d.account_type;
```

| account_type | budget | actual | variance |
|---|---:|---:|---:|
| EXPENSE | 1,207,184.99 | 1,236,450.39 | 29,265.40 |
| REVENUE | 223,769.38 | 229,693.47 | 5,924.09 |

Actual adds up to 1,466,143.86. If you load the same sample files anywhere else, March should give that same total, which makes it a handy check.

## Wrap-up

Sum each side to one row per cell, join with `FULL OUTER JOIN`, `COALESCE` both the keys and the amounts, and label which side each row came from. Then filter out months that haven't closed. That's a variance report that can't quietly lose money.

## Downloads

[[download:samples/fact_budget.csv|Download fact_budget.csv]]
[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]
[[download:samples/dim_account.csv|Download dim_account.csv]]
[[download:samples/dim_cost_center.csv|Download dim_cost_center.csv]]
[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]
[[download:sql/plan_vs_actual.sql|Download plan_vs_actual.sql]]
