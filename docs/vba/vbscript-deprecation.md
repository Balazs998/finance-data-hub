---
title: Is your finance workbook hit by VBScript deprecation?
description: Find the macros that use VBScript RegExp or call .vbs scripts before Windows turns VBScript off, and what to change.
---

# Is your finance workbook hit by VBScript deprecation?

<p class="post-meta">VBA · Excel</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Based on official docs, not tested on a live install</p>
  <p>Every claim on this page is backed by a Microsoft page linked next to it. We reviewed the scanner code but haven't run it in Windows Excel.</p>
</aside>

## Intro

Windows is phasing out VBScript, and that reaches into Excel. Microsoft names two ways VBA projects use it: running external `.vbs` scripts, and referencing VBScript libraries such as `VBScript.RegExp` for regular expressions ([Prepare your VBA projects for VBScript deprecation, Microsoft 365 Developer Blog](https://devblogs.microsoft.com/microsoft365dev/how-to-prepare-vba-projects-for-vbscript-deprecation/)). If your cost-center checks or file clean-ups use either one, now is a good time to find them.

## What you'll build

- A short answer to "what changes, and when".
- A scanner macro that lists every line in your exported VBA files that uses VBScript RegExp or calls a `.vbs` script.
- A fix checklist for each kind of finding.

## Before you start

- Desktop Excel with macros enabled.
- Your macros exported as `.bas`, `.cls` or `.frm` files into one folder. In the VBA editor, right-click a module and choose **Export File**.
- The fictional demo files: the exported modules in `FDH_Macros/`. They're made up, and no `.vbs` file is included.

## The sample scenario

`FDH_Legacy_Tool` is an old, made-up month-end tool. It checks CC1000-style cost-center codes with a regular expression and calls a cleanup script, `cleanup.vbs`, when it's done. We'll find both.

## 1. What changes, and when

Microsoft describes three phases ([source](https://devblogs.microsoft.com/microsoft365dev/how-to-prepare-vba-projects-for-vbscript-deprecation/)):

- **Phase 1, now through 2026 or 2027:** VBScript stays on by default, and existing VBA projects keep running.
- **Phase 2, approximately 2026 or 2027:** VBScript is turned off by default.
- **Phase 3, date not set:** VBScript is removed from future Windows releases.

Microsoft hasn't given an exact date for Phase 2, so don't plan around one.

Once VBScript is off, Microsoft says two things stop working:

- Calling `.vbs` scripts from VBA is no longer supported.
- References to the VBScript RegExp library break, unless Office is on a supported build.

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" tabindex="0" aria-label="Does this affect me? Decision diagram">
  <a href="../16-vbscript-diagram.svg"><img src="../16-vbscript-diagram.svg" alt="Does this affect me? Three questions: does the macro call a .vbs script, does it use VBScript RegExp, is Office on Version 2508 or later, leading to not supported, not affected, or keeps working or breaks." width="840" height="420"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

## 2. The RegExp fix: Office Version 2508

From Office Version 2508 (Build 19127.20154) on Windows, VBA includes its own RegExp classes, so you don't need the VBScript library ([source](https://devblogs.microsoft.com/microsoft365dev/how-to-prepare-vba-projects-for-vbscript-deprecation/)). Whether old code keeps working depends on how it creates the object:

- **Early binding** (`Dim re As RegExp`, `Set re = New RegExp`, with no reference) needs Office 2508 or later. It won't run on older Office at all.
- **Late binding** (`CreateObject("VBScript.RegExp")`) keeps working on Office 2508 or later. On older Office, it only works while VBScript is still on in Windows.

Microsoft's post has compatibility tables for both cases. Check those rather than relying on this summary.

## 3. Scan your exported modules

The scanner reads the exported text files in `FDH_Macros\`, next to the workbook. It doesn't open workbooks or run any script. It skips comment lines, whether they start with `'` or `Rem`, and doesn't care about upper or lower case. Save the workbook first: the scanner looks for `FDH_Macros\` next to it, and stops with a message if the workbook has never been saved. If a file can't be read, it closes the file and shows "Scan stopped" with the reason.

Paste the code below into a new module. Or import `ScanVBScript.bas` with **File > Import File**.

```vba
Option Explicit

' Lists lines in exported VBA files (.bas, .cls, .frm) that use VBScript.
' Reads text files only. It doesn't open workbooks or run anything.

Sub ScanVBScript()
    If ThisWorkbook.Path = "" Then MsgBox "Save the workbook first.", vbExclamation: Exit Sub

    Dim folder As String
    folder = ThisWorkbook.Path & "\FDH_Macros\"

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets.Add
    ws.Range("A1:D1").Value = Array("File", "Line", "Finding", "Code")

    Dim outRow As Long
    outRow = 2

    Dim fileName As String
    Dim ext As String

    On Error GoTo Fail

    fileName = Dir(folder & "*.*")
    Do While fileName <> ""
        ext = LCase(Mid(fileName, InStrRev(fileName, ".") + 1))
        If ext = "bas" Or ext = "cls" Or ext = "frm" Then
            ScanFile folder & fileName, fileName, ws, outRow
        End If
        fileName = Dir()
    Loop

    MsgBox outRow - 2 & " finding(s). See the new sheet.", vbInformation
    Exit Sub

Fail:
    MsgBox "Scan stopped: " & Err.Description, vbExclamation
End Sub

Private Sub ScanFile(filePath As String, fileName As String, ws As Worksheet, ByRef outRow As Long)
    Dim f As Integer
    f = FreeFile
    On Error GoTo CleanUp
    Open filePath For Input As #f

    Dim lineNo As Long
    Dim codeLine As String
    Do While Not EOF(f)
        Line Input #f, codeLine
        lineNo = lineNo + 1

        Dim t As String
        t = LCase(Trim(codeLine))

        Dim finding As String
        finding = ""
        If Left(t, 1) = "'" Or Left(t, 4) = "rem " Then
            ' comment or Rem line, skip
        ElseIf InStr(t, "vbscript_regexp_55") > 0 Then
            finding = "Early-bound VBScript RegExp"
        ElseIf InStr(t, "vbscript.regexp") > 0 Then
            finding = "Late-bound VBScript RegExp"
        ElseIf InStr(t, ".vbs") > 0 Then
            finding = "Calls a .vbs script"
        End If

        If finding <> "" Then
            ws.Cells(outRow, 1).Value = fileName
            ws.Cells(outRow, 2).Value = lineNo
            ws.Cells(outRow, 3).Value = finding
            ws.Cells(outRow, 4).Value = "'" & Trim(codeLine)
            outRow = outRow + 1
        End If
    Loop

CleanUp:
    Close #f
    If Err.Number <> 0 Then Err.Raise Err.Number, , Err.Description
End Sub
```

Run `ScanVBScript`. It adds a new sheet with one row per finding: file, line number, the kind of finding and the code.

!!! warning "Also check Tools > References"
    The library reference itself isn't in the exported files. In the VBA editor, open **Tools > References** and look for the VBScript regular expressions library. A project with that reference ticked and `Dim re As RegExp` in the code won't show up as early-bound in the scan.

## 4. Fix what you found

- **Late-bound RegExp:** update Office to Version 2508 or later. Microsoft says the same code then runs whether or not VBScript is on.
- **Early-bound RegExp through the VBScript reference:** update Office to 2508 or later. In new code, use the RegExp built into VBA, which needs no reference ([source](https://devblogs.microsoft.com/microsoft365dev/how-to-prepare-vba-projects-for-vbscript-deprecation/)).
- **`.vbs` calls:** rewrite what the script does in VBA itself. There's no Office update for this one.
- **Then test:** Microsoft recommends testing your projects where VBScript is turned off, to find hidden dependencies.

## Check the result

!!! success "Expected: 4 findings in FDH_Legacy_Tool"
    One early-bound RegExp, two late-bound RegExp (one written in mixed case) and one `.vbs` call. Commented-out lines (`'` or `Rem`) aren't counted. You can check this by searching the exported `.bas` files by hand.

    The scan only finds early binding when the code names the library, as in `VBScript_RegExp_55.RegExp`. A plain `Dim re As RegExp` with the reference ticked won't show up, so also check **Tools > References**.

## If it doesn't match

- No findings at all: check that the files are in `FDH_Macros\` next to the workbook and end in `.bas`, `.cls` or `.frm`.
- A locked VBA project can't be exported, so the scanner can't see it. Ask the owner to unlock it or export it for you.
- A line was flagged that only mentions `.vbs` in a string or a file name: the scanner can't tell those apart, so check each finding by hand.

## Still open

These aren't answered on Microsoft's page, so we're leaving them open:

- **Office LTSC:** a reader asked in the comments whether this applies to LTSC builds, and there's no answer on the page yet.
- **`Scripting.Dictionary` and `FileSystemObject`:** asked about in the comments, Microsoft's author said they made no change to them and they "are supposed to work as expected". That's a reply in the comments, not a formal statement.

## Wrap-up

Export your modules, run the scan, and sort the findings into RegExp ones (update Office) and `.vbs` calls (rewrite in VBA). Phase 2 has no fixed date, so the earlier you know what you have, the calmer it'll be.

## Downloads

All files use synthetic sample data and placeholder names. These are the exported modules only. There is no workbook yet.

[[download:vba/ScanVBScript.bas|Download ScanVBScript.bas]]
[[download:vba/modChecks.bas|Download modChecks.bas]]
[[download:vba/modValidate.bas|Download modValidate.bas]]
[[download:vba/modCleanup.bas|Download modCleanup.bas]]
