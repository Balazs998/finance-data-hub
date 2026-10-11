---
title: Month-close checks in Excel VBA
description: "Run an Excel VBA month-close check that flags a blank ReportingPeriod, empty Input_ drivers, and #REF! or #N/A errors on a Close checks sheet."
---

# Month-close checks

<p class="post-meta">VBA · Excel</p>

Three things survive a refresh and still wreck your pack: the period cell still says August, a driver cell is empty, or a formula has become `#REF!`. If you only find them after the pack goes out, a reader finds them first. `FPNA_MonthCloseChecks` calculates the workbook and writes those findings to a sheet called Close checks.

## What you'll build

- The `FPNA_MonthCloseChecks` module imported into your workbook.
- A `RunMonthCloseChecks` macro, optionally on a button, that writes a fresh Close checks sheet each run.

## Before you start

!!! info "You'll need"
    - Desktop Excel for Windows or Mac with macros enabled for this workbook (Excel for the web can't run VBA). Save the workbook as `.xlsm`.
    - The module file: [Downloads](#downloads).

## The sample scenario

!!! info "This post uses its own example data"
    This post uses your own workbook, not the FDH_DEMO sample used in the other posts.

It does not run when the file opens. You run it, or you point a button at it. It checks three things:

**ReportingPeriod.** A single named cell. If the name is missing, points at more than one cell, or is blank, that is a finding. The value printed on the report is the text you see in the cell, so a date shows as a date.

**Input_ names.** Any name that starts with `Input_` is a required driver. `Input_TaxRate` is checked. `TaxRate` is not, so you opt in. An empty cell is a finding. A zero is not. A name that has become `#REF!` is a finding. Sheet-scoped names count as well as workbook-scoped names.

**Formula errors.** Every worksheet except Close checks is scanned, including hidden sheets. `#REF!`, `#VALUE!`, `#N/A`, `#DIV/0!`, `#NAME?`, `#NULL!`, and `#NUM!` are listed with the sheet and the cell. The scan stops after 50,000 formulas and says so.

## 1. Import the module

1. Save the workbook as `.xlsm` if it is not already a macro workbook.
2. Press Alt+F11.
3. Choose File, then Import File, and pick `FPNA_MonthCloseChecks.bas`.

```vbnet
--8<-- "files/vba/FPNA_MonthCloseChecks.bas"
```

## 2. Name the period cell and drivers

1. In the workbook, name the period cell `ReportingPeriod`.
2. Name each required driver so the name starts with `Input_`, for example `Input_FxRate`.

## 3. Run it

Run `RunMonthCloseChecks` from the Macros dialog.

To put it on a button: Developer, Insert, Button (Form Control), and assign `RunMonthCloseChecks`.

Each run recalculates the workbook first. On a large model that is the slow part, and it is the part you want before the pack goes out.

## Check the result

!!! success "Close checks sheet is on screen"
    The Close checks sheet lists each finding with the sheet and the cell. Each run replaces the sheet, so the previous list does not linger underneath the new one.

    The scan never selects cells. The only selection is at the end, so the Close checks sheet is the one on screen when the macro finishes.

## If it doesn't match

- **A driver you expected isn't checked:** its name doesn't start with `Input_`. Rename it, for example `TaxRate` to `Input_TaxRate`.
- **ReportingPeriod is reported as a finding:** the name is missing, points at more than one cell, or the cell is blank. Point the name at one filled cell.
- **The report says the scan stopped:** the workbook has more than 50,000 formulas. Raise `MAX_CELLS` in the module if you still want the rest.
- **RunMonthCloseChecks isn't in the Macros list:** the workbook was saved as `.xlsx`, which removes the module, or macros are disabled. Save as `.xlsm`, import the module again, and enable macros.
- **An Input_ name says it does not return a value:** the driver cell holds an error such as `#N/A`. Fix that cell.
- **Nothing happened when the file opened:** the macro doesn't run on open. Run `RunMonthCloseChecks` or put it on a button.
- **The macro stopped with a message:** calculation mode and the status bar are put back the way they were. Fix the reported problem and run it again.

## Wrap-up

Name the period cell, opt drivers in with `Input_`, and run the check before every send-out.

**Next:** [A management report export Excel can trust](../jedox/management-report-export.md)

## Downloads

All files use placeholder names.

[[download:vba/FPNA_MonthCloseChecks.bas|Download FPNA_MonthCloseChecks.bas]]
