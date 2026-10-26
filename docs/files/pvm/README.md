# Cost per vehicle and price/volume/mix SQL + rules pack (FDH_DEMO fictional)

All data is made up. "FDH Motors", its plants (P100-P300), models (M-A, M-B, M-C), markets (MK1-MK3) and amounts are placeholders from the Finance Data Hub sample pack, not a real company. Currency EUR.

**Schema:** `FDH_DEMO.MOTORS`, reading cost from `FDH_DEMO.SAMPLE` (FACT_ACTUALS, FACT_BUDGET, DIM_ACCOUNT). Role for the walkthrough: `SYSADMIN` (owner). This pack adds **no grants**. `JEDOX_ETL_ROLE` stays views-only and gets nothing here. Any later view grant needs an admin's review.

**Not run on a live account.** The SQL follows the Snowflake docs. The expected numbers below were recomputed from the CSVs in Python (Decimal) and match the sample pack's data dictionary. The Jedox rules in `05_jedox_rules.txt` are based on the Jedox docs, not run on a live Jedox install.

## Run order

1. Load the sample pack first (`load_motors.sql` for FDH_DEMO.MOTORS, `load_snowflake.sql` for FDH_DEMO.SAMPLE).
2. `01_v_plant_cost.sql` - `V_PLANT_COST`: expense accounts by cost center, split to plants by `alloc_pct`.
3. `02_v_cost_per_vehicle.sql` - `V_COST_PER_VEHICLE`: plant cost to plant x model by units produced, then cost per vehicle.
4. `03_v_unit_economics.sql` - `V_UNIT_ECONOMICS`: cost, net price and contribution per vehicle at model level.
5. `04_v_pvm_variance.sql` - `V_PVM_VARIANCE`: price, volume, mix, new and lost effects at model x market.
6. `05_jedox_rules.txt` - MOTORS_COST and MOTORS_SALES layout, ratio rules and what gets loaded (docs-based).
7. `06_checks.sql` - the checks below.

## Formula (0 = Budget, 1 = Actual, per model x market row)

- Continuing row: present in both versions. Qt = total units of continuing rows. mix = row units / Qt. P = net revenue / units.
- Price = (P1 - P0) x Q1
- Volume = (Q1t - Q0t) x mix0 x P0
- Mix = (mix1 - mix0) x Q1t x P0
- New = Actual revenue of rows with no Budget. Lost = minus Budget revenue of rows with no Actual.
- Check row = Price + Volume + Mix + New + Lost - (Actual - Budget) = 0.00

This is one common convention, not a standard. Volume is measured at budget mix and budget price, Mix at budget price, Price at actual units.

## Expected results

| Check | Expected |
|---|---|
| Cost per vehicle M-A / P200 / 2026-03 | Actual 1,914.16 (P200 cost 403,887.81, 134 of 211 units), Budget 1,959.33 (393,825.50) |
| Allocation leak (plant cost vs expense, every period/version) | 0 rows. 2026-03 expense Actual 1,236,450.39, Budget 1,207,184.99 |
| P300 / 2026-03 / Actual | M-A 0 units, 0 cost, NULL cost per vehicle. M-B 115 units, 2,832.70 |
| 2026-03 revenue | Actual 2,003,815.48, Budget 2,078,128.00, difference -74,312.52 |
| 2026-03 PVM | Price -5,336.52, Volume -18,242.22, Mix 96,130.22, New 88,800.00 (M-C), Lost -235,664.00 (M-B x MK3) |
| 2026-03 check row | 0.00 |
| Continuing units 2026-03 | Q0t 505, Q1t 500 |
| Check row, every period 2025-10..2026-08 | 0.00 (2026-09 has no Actual yet and is left out) |

Unit economics, 2026-03 (model level, recomputed, not in the data dictionary yet):

| model | version | units produced | units sold | cost per vehicle | net price | contribution |
|---|---|---|---|---|---|---|
| M-A | Actual | 247 | 217 | 2,246.04 | 3,191.28 | 945.24 |
| M-A | Budget | 303 | 303 | 2,181.45 | 3,185.74 | 1,004.29 |
| M-B | Actual | 253 | 283 | 2,558.20 | 4,319.81 | 1,761.62 |
| M-B | Budget | 254 | 254 | 2,150.41 | 4,381.29 | 2,230.88 |
| M-C | Actual | 18 | 18 | 1,914.16 | 4,933.33 | 3,019.17 |

Effects stay unrounded in the view. Round only after summing: rounding each row first gives Volume -18,242.21 and Mix 96,130.21 (the check row still nets to 0.00).
