# Jedox rules knowledge pack (Rule Studio)

Owner: J-dox (Jedox accuracy). Status: signed off, 2026-10-11, after Sample Data Steward's name check. Built only from knowledgebase.jedox.com. Every entry has a `source` URL. Anything not stated in the docs is marked `"unverified": true` (or listed in `unverified_fields`) and must not be shown as a hard error. The studio shows those as "Check in your Jedox".

## Files

| File | Content |
| --- | --- |
| `jedox-rules-2026.1.json` | Syntax, operators, prefixes (`B:` / `C:` / `N:`), STET/CONTINUE, markers, performance guidance, 104 functions. Signed off for 2026.1. |
| `jedox-rules-2025.1.json` | The same rule reference carried over for 2025.1. Most entries are marked “assumed same as 2026.1, unverified for 2025.1”. |
| `examples-2026.1.json` | Demo metadata and 12 examples. Rule text is loaded from this file; the page does not hardcode the examples. |
| `schema.json` | JSON Schema for the pack |
| `../tests/rules/{correct,broken,inefficient}.json` | 32 regression cases. Expected findings are the contract; do not edit them to match the checker. |

## Demo model (dictionary v1.3)

Database `FDH_DEMO`.

| Cube | Dimensions |
| --- | --- |
| PnL | Version, Period, CostCenter, Account |
| FX_RATE | Currency, Period, Measure |
| PnL_FX | Version, Period, CostCenter, Account, Currency, Measure |

Version elements: Actual, Budget, Forecast, plus rule elements Variance and Variance %. Period runs `2025-10` through `2026-09`, with consolidated `FY2026` (`2025-10..2026-09`). CostCenter base codes are CC1000, CC1010, CC2000, CC3000, CC3010, CC4000, CC4010, CC5000, CC5010, CC6000, with parents Sales, Marketing, IT, G&A, and R&D, plus the top element All Cost Centers. Account base codes are 400000, 410000, 500000, 600000, 610000, 620000, 630000, 640000, with parents REVENUE and EXPENSE. Currency is EUR and USD. FX_RATE's measure is Rate. PnL_FX measures are Amount, Amount EUR, and Label (a string element).

`PALO.DATA` and `PALO.MARKER` take the database, the cube, then one coordinate per dimension of that cube, in the cube's dimension order. The FX lookup used by the examples is `PALO.DATA("FDH_DEMO","FX_RATE",!'Currency',!'Period',"Rate")`.

## Versions

The selector offers **2026.1** (the default) and **2025.1**. Jedox’s public docs list no rule changes between those versions. The 2025.1 pack is checked against the 2026.1 reference: three entries are sourced for 2025.1 (markers from 25.x, the 2025.1 multiparameter PALO.DATA note, and ISNULL deprecated since 2023.2). The rest say they are assumed the same as 2026.1 and unverified for 2025.1, and findings that use those entries say so. `N:` is accepted as the older form of the cell-type restriction and reported as info, not an error. Prefer `B:` or `C:`.

Nothing in this pack has been executed in Jedox.
