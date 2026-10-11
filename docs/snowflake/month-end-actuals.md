---
title: Month-end actuals in Snowflake SQL
description: "Build month-end P&L actuals in Snowflake SQL: closed periods only, latest journal load, revenue as a positive amount ready for Excel or Jedox."
---

# Month-end actuals

<p class="post-meta">Snowflake</p>

If your September total grows every time the loader reruns, or revenue shows up negative in the pack, this query fixes both. You need actuals after the books close, at a grain you can drop into Excel or Jedox, and a raw journal extract is where double counts and negative revenue come from. The script on this page is the extract to start from.

## What you'll build

- One Snowflake SQL extract, `gl_actuals_pnl.sql`, that returns closed-period P&L actuals at one row per entity, cost center, account, fiscal year, fiscal period, and currency.
- Two amount columns: `amount_pnl` for the pack (revenue positive) and `amount_gl` in general-ledger sign, which ties to the trial balance.

## Before you start

!!! info "You'll need"
    - Snowflake access to your own GL journal, account, and fiscal calendar tables.
    - The column names your tables use. The expected columns are commented at the top of the script.
    - The script: [Downloads](#downloads).

## The sample scenario

!!! info "This post uses its own example data"
    This post uses its own illustrative GL model, not the FDH_DEMO sample used in the other posts. `FINANCE.*` are placeholder names for your own GL mart. They are not part of the FDH_DEMO sample data.

The script reads three tables: `FINANCE.GL_JOURNAL_LINE`, `FINANCE.DIM_ACCOUNT`, and `FINANCE.DIM_FISCAL_CALENDAR`. This note stores year and period separately (fiscal year and fiscal period). The FDH_DEMO sample uses one `YYYY-MM` text column (2026-09); both sort correctly.

## 1. Know the grain

One row per entity, cost center, account, fiscal year, fiscal period, and currency. Amounts are summed. Balance-sheet accounts are left out (`statement = 'PL'`).

`amount_pnl` is the figure for the pack. `amount_gl` is the same total in general-ledger sign, which is what ties to the trial balance.

## 2. Understand the sign flip

The ledger stores debits as positive and credits as negative, so revenue arrives negative. A P&L pack wants revenue positive and costs positive. The script flips the sign only when `account_type` is `REVENUE`. It does not contain a list of account numbers.

!!! warning "Untagged revenue stays negative"
    If a revenue account is not tagged `REVENUE`, it stays negative and the total will look short.

## 3. Point the script at your tables

Change three object names: `FINANCE.GL_JOURNAL_LINE`, `FINANCE.DIM_ACCOUNT`, and `FINANCE.DIM_FISCAL_CALENDAR`. The expected columns are commented at the top of the file. If your posting date is a timestamp, the join already casts it to a date.

```sql
--8<-- "files/sql/gl_actuals_pnl.sql"
```

## 4. Know what the script protects you from

**Restated loads.** Reopening a period and loading it again must replace the old rows, not add to them. `qualify` keeps the latest `loaded_at` for each `journal_line_id`. Without that, September grows every time the loader is rerun. If two loads can share a `loaded_at`, add `load_id`, your own load or batch id, as a tiebreaker: `order by loaded_at desc, load_id desc`.

**Fiscal period versus calendar month.** `date_trunc('month', accounting_date)` is wrong for a fiscal year that does not start in January, and it is wrong for a 4-4-5 calendar. The fiscal calendar table is the only place that maps a posting date to a period.

**Mixed currency.** The query does not convert currency. `amount_pnl` is in `currency_code`. Sum inside one currency, then apply the rate you actually report at.

**Open periods.** `period_status = 'CLOSED'` keeps a period that is still moving out of the pack. Remove that filter when you deliberately want a flash.

A null or blank entity or cost center, including an empty string, becomes `(none)` so those rows survive the trip into Excel. A blank currency stays blank. Do not coalesce it into a fake currency code and then sum it.

## Check the result

!!! success "Ties to the trial balance"
    Pick one entity and one closed period.

    - Tie `amount_gl` to the trial balance. `amount_pnl` will not tie on revenue accounts, because the sign is flipped.
    - Check a revenue account is positive in `amount_pnl` and negative in `amount_gl`.
    - Decide whether elimination entities belong in this extract. The commented filter is `coalesce(nullif(trim(l.entity_code), ''), '(none)') not in ('E900')`. Use your own code.

## If it doesn't match

- **The tie comes up short even though the sign is right:** the inner join to `DIM_ACCOUNT` drops postings on accounts that are not in that dimension. Add the missing accounts to the dimension.
- **Postings are missing for some dates:** postings dated outside the fiscal calendar table are dropped by the inner join too. Check the calendar covers every `accounting_date`.
- **Revenue is negative in `amount_pnl`:** the account is not tagged `REVENUE` in `account_type`. Fix the tag in `DIM_ACCOUNT`.
- **A period grows on every rerun:** the restated rows aren't being deduplicated. Keep the `qualify` on the latest `loaded_at` per `journal_line_id`, with `load_id` as a tiebreaker if loads can share a `loaded_at`.
- **The total mixes currencies:** the query does not convert. Sum inside one `currency_code`, then apply your reporting rate.

## Wrap-up

Map periods through the fiscal calendar, keep only the latest load of each journal line, and flip the sign by account type, not by account number. The [Jedox export](../jedox/management-report-export.md) uses the same presentation sign, so the two files can sit on top of each other once the currency is the same.

**Next:** [A management report export Excel can trust](../jedox/management-report-export.md)

## Downloads

All files use placeholder names.

[[download:sql/gl_actuals_pnl.sql|Download gl_actuals_pnl.sql]]
