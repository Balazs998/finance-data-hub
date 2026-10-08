# Month-end actuals

The pack needs actuals after the books close, at a grain you can drop into Excel or Jedox: entity, cost center, account, fiscal period, and currency. A raw journal extract is where double counts and negative revenue come from. The script on this page is the extract to start from.

## Grain

One row per entity, cost center, account, fiscal year, fiscal period, and currency. Amounts are summed. Balance-sheet accounts are left out (`statement = 'PL'`).

`amount_pnl` is the figure for the pack. `amount_gl` is the same total in general-ledger sign, which is what ties to the trial balance.

## Sign

The ledger stores debits as positive and credits as negative, so revenue arrives negative. A P&L pack wants revenue positive and costs positive. The script flips the sign only when `account_type` is `REVENUE`. It does not contain a list of account numbers. If a revenue account is not tagged `REVENUE`, it stays negative and the total will look short.

## The script

Change three object names: `FINANCE.GL_JOURNAL_LINE`, `FINANCE.DIM_ACCOUNT`, and `FINANCE.DIM_FISCAL_CALENDAR`. The expected columns are commented at the top of the file. If your posting date is a timestamp, the join already casts it to a date.

```sql
--8<-- "files/sql/gl_actuals_pnl.sql"
```

[[download:sql/gl_actuals_pnl.sql|Download gl_actuals_pnl.sql]]

The [Jedox export](../jedox/management-report-export.md) uses the same presentation sign, so the two files can sit on top of each other once the currency is the same.

## What this is protecting you from

**Restated loads.** Reopening a period and loading it again must replace the old rows, not add to them. `qualify` keeps the latest `loaded_at` for each `journal_line_id`. Without that, September grows every time the loader is rerun.

**Fiscal period versus calendar month.** `date_trunc('month', accounting_date)` is wrong for a fiscal year that does not start in January, and it is wrong for a 4-4-5 calendar. The fiscal calendar table is the only place that maps a posting date to a period.

**Mixed currency.** The query does not convert currency. `amount_pnl` is in `currency_code`. Sum inside one currency, then apply the rate you actually report at.

**Open periods.** `period_status = 'CLOSED'` keeps a period that is still moving out of the pack. Remove that filter when you deliberately want a flash.

## Before you trust the total

Pick one entity and one closed period.

- Tie `amount_gl` to the trial balance. `amount_pnl` will not tie on revenue accounts, because the sign is flipped.
- Check a revenue account is positive in `amount_pnl` and negative in `amount_gl`.
- Decide whether elimination entities belong in this extract. The commented filter is `entity_code not in ('E900')`. Use your own code.

A blank cost center becomes `(none)` so those rows survive the trip into Excel. A blank currency stays blank. Do not coalesce it into a fake currency code and then sum it.
