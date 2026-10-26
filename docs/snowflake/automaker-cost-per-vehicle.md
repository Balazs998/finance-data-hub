---
date: 2026-10-25
home_tag: Automaker series
title: "Cost per vehicle in Snowflake, variance in Jedox"
description: "Allocate cost to plant and model by units, get cost per vehicle, and split revenue variance into price, volume and mix, for fictional FDH Motors."
social_image: automaker-cost-per-vehicle.png
---

# Cost per vehicle in Snowflake, variance in Jedox

<p class="post-meta">Snowflake + Jedox · Intermediate · ~30 min · Automaker series</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>The Snowflake SQL in this post has not been run on a live account. Every check number was recomputed from the sample CSVs with the same logic as the SQL, and matches the sample data dictionary. The Jedox cubes and rules are based on the Jedox docs, but were not run on a live Jedox install.</p>
</aside>

"What does one M-A cost us at the Riverbend plant this month, and why is revenue off plan?" Two simple questions, and in most finance teams neither has a quick answer. Cost sits on cost centers. Units sit in a production system. Revenue sits by model and market. Nobody owns the bridge between them.

Then the variance gets explained in a spreadsheet where "mix" is whatever is left after price and volume. Ask two analysts and you get two mix numbers, both "right".

This post builds both answers on the same fictional FDH Motors data from the [13-week cash post](automaker-13-week-cash-runway.md). Snowflake does the arithmetic: allocation, cost per vehicle and a price/volume/mix split with a written-down formula and a check row that has to be 0.00. Jedox stores the results for planners to slice, and never recalculates the variance itself.

## What you'll build

- `V_PLANT_COST`: cost-center expense split to plants by a mapping table
- `V_COST_PER_VEHICLE`: plant cost allocated to each model by **units produced**, then cost per vehicle
- `V_UNIT_ECONOMICS`: cost, net price and contribution per vehicle at model level
- `V_PVM_VARIANCE`: actual vs budget revenue split into price, volume, mix, new and lost, per model and market
- Two Jedox cubes, `MOTORS_COST` and `MOTORS_SALES`, with ratio rules for the per-unit measures


## Before you start

!!! info "You'll need"
    - Role / access: `SYSADMIN` (or equivalent) to create views in `FDH_DEMO.MOTORS` and read `FDH_DEMO.SAMPLE`. This pack adds no grants. `JEDOX_ETL_ROLE` stays views-only and is not touched here.
    - Product version: any current Snowflake account (window functions, `IFF`, `FULL OUTER JOIN`; docs-based, not run on a live account). For the Jedox part, a Jedox install where you can create cubes and rules (docs-based, not run).
    - Previous posts: [Snowflake to Jedox](../jedox/snowflake-to-jedox.md) (the load pattern) and [Plan vs actuals](plan-vs-actuals.md)
    - Sample data: the FDH Motors files (`fact_production.csv`, `fact_vehicle_sales.csv`, `map_cost_center_plant.csv` and the three dimension files), the core sample pack (`fact_actuals.csv`, `fact_budget.csv`, `dim_account.csv`), plus the [Downloads](#downloads) pack

## The sample scenario

FDH Motors is a made-up vehicle maker with three plants, **P100 Northfield**, **P200 Riverbend** and **P300 Lakeside**, and three models. M-A and M-B are continuing models. **M-C is new from 2026-03**: it has actuals but no budget. Sales run over three markets, MK1 to MK3, and one continuing pair, **M-B in MK3, is discontinued**: it is budgeted but sells nothing.

Cost comes from the ten cost centers in the core sample pack. `MAP_COST_CENTER_PLANT` says which plant each one belongs to. Most map 100% to one plant, while shared ones are split: CC3000 goes 50/30/20 across the three plants, and CC4000 60/40 between P100 and P200.

A few things are seeded on purpose:

1. **A plant-month with zero units.** P300 built no M-A in 2026-03 (the row is there, with 0 units).
2. **A mix shift.** In 2026-03, M-A sells about 12% fewer units than plan and M-B about 12% more.
3. **A new model and a lost market.** M-C appears in MK1 and MK2, and M-B × MK3 drops out.

## 1. Move cost from cost centers to plants

`V_PLANT_COST` (file 01) takes the **expense** accounts from `FACT_ACTUALS` and `FACT_BUDGET`, joins the mapping, and multiplies by `alloc_pct`:

```sql
SELECT m.plant, gl.period, gl.version, SUM(gl.amount * m.alloc_pct) AS plant_cost
```

The mapping is the single point of truth. If a cost center's percentages don't add up to 1.00, cost leaks out (or appears from nowhere), so the checks compare plant cost with total expense for every period and version. On the sample data nothing leaks: 2026-03 expense is **1,236,450.39** actual and **1,207,184.99** budget, and the plants add up to exactly that.

## 2. Cost per vehicle uses units produced

Now split each plant's cost across the models it built, in proportion to **units produced**:

- allocated cost = plant cost × model units ÷ plant units
- cost per vehicle = allocated cost ÷ model units

Use units produced, not units sold. Cost is incurred in the factory when the car is built. Divide by units sold and every inventory build or sell-off swings your "cost per vehicle", although nothing changed in the plant.

For **M-A at P200 in 2026-03**: P200's actual cost is **403,887.81** and it built 211 vehicles, 134 of them M-A. That gives M-A 256,497.47 of cost and a cost per vehicle of **1,914.16**. Budget was **1,959.33** on 393,825.50 of cost.

Notice the shortcut in that formula: allocated cost ÷ model units simplifies to plant cost ÷ plant units. With a pure units allocation, **every model in a plant-month gets the same cost per vehicle**. M-C at P200 is also 1,914.16. That's not a bug, it's what the method says. If an M-B really costs more to build than an M-A, you need a different driver (standard hours, or a bill of materials, which is a later post in this series). Be honest about that before anyone uses these numbers for pricing.

This post doesn't cover fixed-cost absorption. The demo ledger has no split between fixed and variable cost, so every expense is spread by units produced. If your ledger tags fixed cost, absorption at normal capacity is a separate calculation. Don't read it into these numbers.

The zero-unit case: at P300 in 2026-03, M-A has 0 units, so it gets 0 cost and a NULL cost per vehicle, not a divide-by-zero error. M-B carries all of P300's cost and comes out at **2,832.70**.

## 3. Cost, price and contribution per vehicle

`V_UNIT_ECONOMICS` (file 03) rolls up to model level across all plants and markets. The rule for every per-unit number is the same: **add up the totals, then divide**. Never average the plant-level ratios, and never add them.

For 2026-03 actual, M-A costs 2,246.04 per vehicle across plants, sells at a net 3,191.28, and contributes **945.24** per vehicle (budget 1,004.29). M-B contributes 1,761.62 against a budget of 2,230.88.

Contribution mixes a price per unit **sold** with a cost per unit **produced**, on purpose. When the two unit counts drift apart (M-B built 253 and sold 283 in 2026-03), that gap is inventory moving, not margin.

## 4. Price, volume and mix with a formula you can write down

This is where most variance analyses get vague, so here's the formula in full. It's one common convention, not a standard, and it's computed per **model × market** row, the lowest grain where both price and units exist. 0 is budget, 1 is actual.

- A **continuing** row exists in both budget and actual for the period.
- **Qt** is the total units of the continuing rows. **mix** is a row's units ÷ Qt. **P** is net revenue ÷ units.
- **Price** = (P1 − P0) × Q1
- **Volume** = (Q1t − Q0t) × mix0 × P0
- **Mix** = (mix1 − mix0) × Q1t × P0
- **New** = actual revenue of rows with no budget. **Lost** = minus the budget revenue of rows with no actual. Both stay out of Qt.
- **Check row** = Price + Volume + Mix + New + Lost − (Actual − Budget) = **0.00**

Add the three continuing effects for one row and everything cancels except r1 − r0, that row's revenue change. So the effects reconcile to the total **by construction**. Mix is computed, never a plug.

The SQL writes each effect with a single division, so no rounded unit price sneaks in:

```sql
j.r1 - j.r0 * j.q1 / j.q0 AS price_effect,
(t.q1t - t.q0t) * j.r0 / t.q0t AS volume_effect,
j.r0 * j.q1 / j.q0 - j.r0 * t.q1t / t.q0t AS mix_effect
```

In Snowflake, dividing NUMBER values keeps up to 6 more decimals than the number being divided, capped at 12 ([docs](https://docs.snowflake.com/en/sql-reference/operators-arithmetic)). Revenue at 2 decimals divided by units comes out at 8, so the unrounded effects are exact enough to add up. Round only the totals.

New and lost models get their own line because they break the formula: a model with no budget has no P0, and one with no actual has no P1. Forcing them into "volume" or "mix" is how mix numbers get silly. Unit-cost changes don't belong here either. They show up in cost per vehicle (step 2), never folded into Price.

`V_PVM_VARIANCE` (file 04) only compares periods that have Actual rows. Otherwise a month that hasn't closed yet shows up as one big "Lost" line (2026-09 would show −2,018,888.00). The test is "at least one Actual row", so load a month's actuals completely before you read its variance.

## 5. What 2026-03 tells FDH Motors

Revenue came in at **2,003,815.48** against a budget of **2,078,128.00**, so **−74,312.52**. The split:

| Effect | 2026-03 |
|---|---|
| Price | −5,336.52 |
| Volume | −18,242.22 |
| Mix | 96,130.22 |
| New (M-C) | 88,800.00 |
| Lost (M-B × MK3) | −235,664.00 |
| **Total** | **−74,312.52** |
| Check row | 0.00 |

Continuing units were almost on plan, 500 against 505, so volume is small. Mix is strongly positive because buyers moved from M-A to the pricier M-B. Price is slightly negative. The real story is the bottom two lines: M-C's launch brought in 88,800.00, but losing M-B in MK3 cost 235,664.00. Without the new/lost line, that whole swing would be smeared into volume and mix and nobody would see it.

## 6. Store it in Jedox, but don't recalculate it there

Plant and market can't live in one cube. Sales have no plant, and cost and production have no market. So there are two cubes, both using the shared PnL Version (Actual, Budget, Forecast, Variance, Variance %) and Period (2025-10 to 2026-09, with FY2026) dimensions:

- `MOTORS_COST`: Version × Period × Plant × Model × Measure (UnitsProduced, Cost, CostPerVehicle)
- `MOTORS_SALES`: Version × Period × Model × Market × Measure (UnitsSold, NetRevenue, UnitPrice, ContributionPerVehicle, PriceEffect, VolumeEffect, MixEffect, NewLostEffect)

Per-unit measures are **rules, never loaded and never summed**:

```text
['CostPerVehicle'] = IF(['UnitsProduced']=0, STET(), ['Cost']/['UnitsProduced'])
['UnitPrice'] = IF(['UnitsSold']=0, STET(), ['NetRevenue']/['UnitsSold'])
```

They're plain rules with no N: or C: qualifier, so they also run on consolidated cells. On All Models, CostPerVehicle is total cost ÷ total units, not an average of the models. `STET()` makes a zero-unit cell behave as if there were no rule ([rule functions](https://knowledgebase.jedox.com/jedox/in-memory-db/rule-functions.htm), [rules overview](https://knowledgebase-onprem.jedox.com/jedox/in-memory-db/rules-overview.htm)). Put the Version Variance and Variance % rules above these ratio rules, so Variance CostPerVehicle is Actual CPV − Budget CPV rather than ΔCost ÷ ΔUnits.

The PVM effects are **loaded** from `V_PVM_VARIANCE` at model × market, written to Version Actual (base). Budget stays empty for these measures, so the Variance rule shows the same effect; Variance % is blank. They consolidate by plain sum, because they're additive. NewLostEffect is New + Lost in one measure (−146,864.00 for 2026-03). Don't write a rule like Mix = Total − Price − Volume in Jedox: mix depends on Qt across all continuing rows, which a cell rule can't see.

Contribution per vehicle at model level is price per vehicle sold minus cost per vehicle produced, so it needs the cost from the other cube. That's a PALO.DATA cross-cube rule on a rule-only ContributionPerVehicle measure in MOTORS_SALES, reading the All Plants value from MOTORS_COST, with the same zero-units guard. It's in `05_jedox_rules.txt` ([cell references](https://knowledgebase.jedox.com/jedox/in-memory-db/rules-cell-reference-offset.htm), [rule targets](https://knowledgebase.jedox.com/jedox/in-memory-db/rules-dimensions-rule-targets-strings.htm)). Markers are optional. In Jedox 25.x and later they are rarely needed because the Dynamic Data Engine (DDE) usually optimizes the calculation itself ([markers](https://knowledgebase.jedox.com/jedox/in-memory-db/markers.htm)).

Load the base values with the same Integrator pattern as the [Snowflake to Jedox](../jedox/snowflake-to-jedox.md) post.

## Check the result

Run `06_checks.sql`. You should see:

| Check | Expected |
|---|---|
| Cost per vehicle M-A / P200 / 2026-03 | Actual **1,914.16**, Budget 1,959.33 |
| Allocation leak | 0 rows (plant cost = expense in every period and version) |
| P300 / 2026-03 / Actual | M-A 0 units, NULL cost per vehicle. M-B **2,832.70** |
| 2026-03 revenue, actual − budget | 2,003,815.48 − 2,078,128.00 = **−74,312.52** |
| 2026-03 effects | Price −5,336.52, Volume −18,242.22, Mix 96,130.22, New 88,800.00, Lost −235,664.00 |
| 2026-03 check row | **0.00** |
| Continuing units | Q0t 505, Q1t 500 |
| Check row, 2025-10 to 2026-08 | 0.00 on every row |

## If it doesn't match

- **Volume reads −18,242.21 and Mix 96,130.21.** You rounded each row before summing. Keep the view unrounded and round only the totals. The check row is 0.00 either way.
- **The check row is not 0.00.** New or lost rows slipped into Qt, or a row with no budget went through the price formula. Qt counts continuing rows only.
- **The check row shows −0.00.** That's a floating-point sign on zero, not a difference. It's fine.
- **2026-09 shows a huge Lost line.** That month has no actuals yet. The view should only compare periods that have Actual rows.
- **Cost per vehicle swings when sales change.** You divided by units sold. Use `FACT_PRODUCTION.units_produced`.
- **Division by zero.** The P300 / M-A / 2026-03 row has 0 units. Guard the division (NULL in Snowflake, `STET()` in Jedox).
- **All Models cost per vehicle in Jedox is a big sum.** The measure was loaded or consolidated instead of calculated. It has to be a rule with no N: qualifier.
- **Plant cost doesn't match expense.** A cost center's `alloc_pct` doesn't sum to 1.00, or a cost center is missing from the mapping.

## Wrap-up

- Allocate cost by units produced, and say out loud that a pure units driver gives every model in a plant the same cost per vehicle.
- Per-unit numbers are totals divided by totals, in Snowflake and in Jedox. Never sum or average them.
- Write the PVM formula down, keep new and lost models on their own line, and prove it with a check row of 0.00.
- Let Snowflake compute the variance and Jedox store it.

**Next in the automaker series:** [tracking capex projects against budget and commitments](automaker-capex-project-tracking.md).

## Downloads

All files use made-up sample data and placeholder names. FDH Motors is not a real company.

[[download:samples/motors/fact_production.csv|Download fact_production.csv]]
[[download:samples/motors/fact_vehicle_sales.csv|Download fact_vehicle_sales.csv]]
[[download:samples/motors/map_cost_center_plant.csv|Download map_cost_center_plant.csv]]
[[download:samples/motors/dim_plant.csv|Download dim_plant.csv]]
[[download:samples/motors/dim_model.csv|Download dim_model.csv]]
[[download:samples/motors/dim_market.csv|Download dim_market.csv]]
[[download:samples/fact_actuals.csv|Download fact_actuals.csv]]
[[download:samples/fact_budget.csv|Download fact_budget.csv]]
[[download:samples/dim_account.csv|Download dim_account.csv]]
[[download:samples/motors/load_motors.sql|Download load_motors.sql]]
[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]
[[download:pvm/01_v_plant_cost.sql|Download 01_v_plant_cost.sql]]
[[download:pvm/02_v_cost_per_vehicle.sql|Download 02_v_cost_per_vehicle.sql]]
[[download:pvm/03_v_unit_economics.sql|Download 03_v_unit_economics.sql]]
[[download:pvm/04_v_pvm_variance.sql|Download 04_v_pvm_variance.sql]]
[[download:pvm/05_jedox_rules.txt|Download 05_jedox_rules.txt]]
[[download:pvm/06_checks.sql|Download 06_checks.sql]]
[[download:pvm/README.md|Download README.md]]
