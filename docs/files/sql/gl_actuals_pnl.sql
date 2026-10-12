-- Month-end GL actuals, shaped for a management P&L.
--
-- Change the three object names, then run this in a Snowflake worksheet.
-- It returns one row per entity, cost center, account, fiscal period, and
-- currency. Revenue is a positive number. Balance-sheet accounts are excluded.
--
-- FINANCE.GL_JOURNAL_LINE
-- journal_line_id, entity_code, cost_center_code, account_code,
-- accounting_date, currency_code, amount_gl, loaded_at, load_id
-- load_id is your own load or batch id.
-- amount_gl uses general-ledger sign: debits positive, credits negative.
--
-- FINANCE.DIM_ACCOUNT
-- account_code, account_name, statement ('PL' or 'BS'),
-- account_type ('REVENUE', 'COGS', 'OPEX', 'OTHER')
--
-- FINANCE.DIM_FISCAL_CALENDAR
-- calendar_date, fiscal_year, fiscal_period (1-12), period_status
-- period_status is 'OPEN' or 'CLOSED'.

WITH latest_line AS (
    -- A restatement is a new load of the same journal line.
    -- Keep the latest load so a rerun does not double count.
    SELECT
        journal_line_id,
        entity_code,
        cost_center_code,
        account_code,
        accounting_date,
        currency_code,
        amount_gl,
        loaded_at,
        load_id
    FROM FINANCE.GL_JOURNAL_LINE
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY journal_line_id
        ORDER BY loaded_at DESC, load_id DESC
    ) = 1
),
signed AS (
    SELECT
        COALESCE(NULLIF(TRIM(l.entity_code), ''), '(none)') AS entity_code,
        COALESCE(NULLIF(TRIM(l.cost_center_code), ''), '(none)') AS cost_center_code,
        l.account_code,
        a.account_name,
        a.account_type,
        c.fiscal_year,
        c.fiscal_period,
        l.currency_code,
        l.amount_gl,
        -- P&L packs show revenue and costs as positive amounts.
        -- Flip revenue only. Do not hard-code account numbers.
        CASE
            WHEN a.account_type = 'REVENUE' THEN -l.amount_gl
            ELSE l.amount_gl
        END AS amount_pnl
    FROM latest_line AS l
    -- Unmapped account codes never reach the result, so this total
    -- can sit below the trial balance.
    INNER JOIN FINANCE.DIM_ACCOUNT AS a
        ON a.account_code = l.account_code
    INNER JOIN FINANCE.DIM_FISCAL_CALENDAR AS c
        ON c.calendar_date = CAST(l.accounting_date AS DATE)
    WHERE a.statement = 'PL'
      AND c.period_status = 'CLOSED'
      -- AND COALESCE(NULLIF(TRIM(l.entity_code), ''), '(none)') NOT IN ('E900')
      -- drop elimination entities
      -- AND c.fiscal_year = 2026
      -- AND c.fiscal_period = 9
)
SELECT
    entity_code,
    cost_center_code,
    account_code,
    account_name,
    account_type,
    fiscal_year,
    fiscal_period,
    currency_code,
    SUM(amount_pnl) AS amount_pnl,
    SUM(amount_gl) AS amount_gl
FROM signed
GROUP BY
    entity_code,
    cost_center_code,
    account_code,
    account_name,
    account_type,
    fiscal_year,
    fiscal_period,
    currency_code
ORDER BY
    fiscal_year,
    fiscal_period,
    entity_code,
    account_code,
    cost_center_code;
