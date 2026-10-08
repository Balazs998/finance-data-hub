# Month-close checks

Three things survive a refresh and still wreck a pack: the period cell still says August, a driver cell is empty, or a formula has become `#REF!`. `FPNA_MonthCloseChecks` calculates the workbook and writes those findings to a sheet called Close checks.

It does not run when the file opens. You run it, or you point a button at it.

## What it checks

**ReportingPeriod.** A single named cell. If the name is missing, points at more than one cell, or is blank, that is a finding. The value printed on the report is the text you see in the cell, so a date shows as a date.

**Input_ names.** Any name that starts with `Input_` is a required driver. `Input_TaxRate` is checked. `TaxRate` is not, so you opt in. An empty cell is a finding. A zero is not. A name that has become `#REF!` is a finding. Sheet-scoped names count as well as workbook-scoped names.

**Formula errors.** Every worksheet except Close checks is scanned, including hidden sheets. `#REF!`, `#VALUE!`, `#N/A`, `#DIV/0!`, `#NAME?`, `#NULL!`, and `#NUM!` are listed with the sheet and the cell. The scan stops after 50,000 formulas and says so. Raise `MAX_CELLS` in the module if a model is larger than that and you still want the rest.

Each run replaces the Close checks sheet. The previous list does not linger underneath the new one.

## Import it

1. Save the workbook as `.xlsm` if it is not already a macro workbook.
2. Press Alt+F11.
3. Choose File, then Import File, and pick `FPNA_MonthCloseChecks.bas`.
4. In the workbook, name the period cell `ReportingPeriod`.
5. Name each required driver so the name starts with `Input_`, for example `Input_FxRate`.
6. Run `RunMonthCloseChecks` from the Macros dialog.

To put it on a button: Developer, Insert, Button (Form Control), and assign `RunMonthCloseChecks`.

The first run calculates the whole workbook. On a large model that is the slow part, and it is the part you want before the pack goes out.

[[download:vba/FPNA_MonthCloseChecks.bas|Download FPNA_MonthCloseChecks.bas]]

## The module

```vbnet
--8<-- "files/vba/FPNA_MonthCloseChecks.bas"
```

The scan never selects cells. The only selection is at the end, so the Close checks sheet is the one on screen when the macro finishes. If the macro stops with a message, calculation mode and the status bar are put back the way they were.
