-- Month-end GL actuals, shaped for a management P&L.
--
-- Change the three object names, then run this in a Snowflake worksheet.
-- It returns one row per entity, cost center, account, fiscal period, and
-- currency. Revenue is a positive number. Balance-sheet accounts are excluded.
--
-- FINANCE.GL_JOURNAL_LINE
--   journal_line_id, entity_code, cost_center_code, account_code,
--   accounting_date, currency_code, amount_gl, loaded_at
--   amount_gl uses general-ledger sign: debits positive, credits negative.
--
-- FINANCE.DIM_ACCOUNT
--   account_code, account_name, statement ('PL' or 'BS'),
--   account_type ('REVENUE', 'COGS', 'OPEX', 'OTHER')
--
-- FINANCE.DIM_FISCAL_CALENDAR
--   calendar_date, fiscal_year, fiscal_period (1-12), period_status
--   period_status is 'OPEN' or 'CLOSED'.

with latest_line as (
    -- A restatement is a new load of the same journal line.
    -- Keep the latest load so a rerun does not double count.
    select
        journal_line_id,
        entity_code,
        cost_center_code,
        account_code,
        accounting_date,
        currency_code,
        amount_gl,
        loaded_at
    from FINANCE.GL_JOURNAL_LINE
    qualify row_number() over (
        partition by journal_line_id
        order by loaded_at desc
    ) = 1
),
signed as (
    select
        coalesce(nullif(trim(l.entity_code), ''), '(none)') as entity_code,
        coalesce(nullif(trim(l.cost_center_code), ''), '(none)') as cost_center_code,
        l.account_code,
        a.account_name,
        a.account_type,
        c.fiscal_year,
        c.fiscal_period,
        l.currency_code,
        l.amount_gl,
        -- P&L packs show revenue and costs as positive amounts.
        -- Flip revenue only. Do not hard-code account numbers.
        case
            when a.account_type = 'REVENUE' then -l.amount_gl
            else l.amount_gl
        end as amount_pnl
    from latest_line as l
    -- Unmapped account codes never reach the result, so this total can sit below the trial balance.
    inner join FINANCE.DIM_ACCOUNT as a
        on a.account_code = l.account_code
    inner join FINANCE.DIM_FISCAL_CALENDAR as c
        on c.calendar_date = cast(l.accounting_date as date)
    where a.statement = 'PL'
      and c.period_status = 'CLOSED'
      -- and coalesce(l.entity_code, '(none)') not in ('E900')  -- drop elimination entities
      -- and c.fiscal_year = 2026
      -- and c.fiscal_period = 9
)
select
    entity_code,
    cost_center_code,
    account_code,
    account_name,
    account_type,
    fiscal_year,
    fiscal_period,
    currency_code,
    sum(amount_pnl) as amount_pnl,
    sum(amount_gl) as amount_gl
from signed
group by
    entity_code,
    cost_center_code,
    account_code,
    account_name,
    account_type,
    fiscal_year,
    fiscal_period,
    currency_code
order by
    fiscal_year,
    fiscal_period,
    entity_code,
    account_code,
    cost_center_code;
