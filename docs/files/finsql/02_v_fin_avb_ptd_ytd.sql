-- FDH_DEMO fictional sample only. New view.
-- Month (period-to-date), fiscal quarter-to-date and fiscal year-to-date by account type.
-- Fiscal year starts in October (FY2026 = 2025-10..2026-09), matching the sample Period dimension.
-- Monthly grain: period-to-date equals the month itself.
USE ROLE SYSADMIN;
USE SCHEMA FDH_DEMO.SAMPLE;

-- Replaces any existing view named V_FIN_AVB_PTD_YTD in FDH_DEMO.SAMPLE.
CREATE OR REPLACE VIEW V_FIN_AVB_PTD_YTD AS
WITH base AS (
 SELECT
 c.period,
 d.account_type,
 SUM(COALESCE(c.actual_amt, 0)) AS actual_mtd,
 SUM(COALESCE(c.budget_amt, 0)) AS budget_mtd
 FROM V_FIN_AVB_CELL c
 JOIN DIM_ACCOUNT d
 ON d.account = c.account
 GROUP BY c.period, d.account_type
),
cal AS (
 SELECT
 b.*,
 YEAR(TO_DATE(b.period || '-01')) + IFF(MONTH(TO_DATE(b.period || '-01')) >= 10, 1, 0) AS fiscal_year,
 CEIL((MOD(MONTH(TO_DATE(b.period || '-01')) + 2, 12) + 1) / 3) AS fiscal_quarter
 FROM base b
)
SELECT
 period,
 fiscal_year,
 fiscal_quarter,
 account_type,
 actual_mtd,
 budget_mtd,
 actual_mtd - budget_mtd AS variance_mtd,
 SUM(actual_mtd) OVER (PARTITION BY account_type, fiscal_year, fiscal_quarter ORDER BY period ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS actual_qtd,
 SUM(budget_mtd) OVER (PARTITION BY account_type, fiscal_year, fiscal_quarter ORDER BY period ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS budget_qtd,
 SUM(actual_mtd) OVER (PARTITION BY account_type, fiscal_year ORDER BY period ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS actual_ytd,
 SUM(budget_mtd) OVER (PARTITION BY account_type, fiscal_year ORDER BY period ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS budget_ytd
FROM cal;

SELECT account_type, actual_mtd, budget_mtd, actual_qtd, budget_qtd, actual_ytd, budget_ytd
FROM V_FIN_AVB_PTD_YTD
WHERE period = '2026-03'
ORDER BY account_type;
-- Expect EXPENSE 1236450.39 / 1207184.99 / 3467414.55 / 3587063.92 / 6823277.07 / 7070654.85
-- Expect REVENUE 229693.47 / 223769.38 / 707191.67 / 664914.70 / 1368888.45 / 1310649.16
