Attribute VB_Name = "FPNA_MonthCloseChecks"
Option Explicit

' Month-close checks for an FP&A workbook.
'
' Run RunMonthCloseChecks, or assign that macro to a button.
' The module does not run when the workbook opens.
'
' It calculates the workbook, then writes a sheet named "Close checks" with:
'   1. A missing or blank named range ReportingPeriod.
'   2. Formula errors (#REF!, #VALUE!, #N/A, #DIV/0!, #NAME?, #NULL!, #NUM!).
'   3. Blank named ranges whose names start with Input_.
'      A zero is a value. Only empty cells are flagged.
'
' Import: Alt+F11, File, Import File, then save the workbook as .xlsm.
' Each run replaces the "Close checks" sheet.

Private Const REPORT_SHEET As String = "Close checks"
Private Const PERIOD_NAME As String = "ReportingPeriod"
Private Const INPUT_PREFIX As String = "Input_"
Private Const MAX_CELLS As Long = 50000

Private mPeriodLabel As String

Public Sub RunMonthCloseChecks()
    Dim previousCalc As XlCalculation
    Dim previousScreen As Boolean
    Dim previousStatus As Variant
    Dim findings As Collection

    previousCalc = Application.Calculation
    previousScreen = Application.ScreenUpdating
    previousStatus = Application.StatusBar
    On Error GoTo CleanFail

    Application.ScreenUpdating = False
    Application.StatusBar = "Running month-close checks..."
    Application.Calculation = xlCalculationAutomatic
    Application.Calculate

    Set findings = New Collection
    mPeriodLabel = ""
    CheckReportingPeriod findings
    CheckFormulaErrors findings
    CheckRequiredInputs findings
    WriteReport findings

    GoTo CleanExit

CleanFail:
    MsgBox "Month-close checks stopped: " & Err.Description, vbExclamation, "Month-close checks"
CleanExit:
    Application.Calculation = previousCalc
    Application.StatusBar = previousStatus
    Application.ScreenUpdating = previousScreen
End Sub

Private Sub CheckReportingPeriod(ByVal findings As Collection)
    Dim nm As Name
    Dim rng As Range

    Set nm = FindName(PERIOD_NAME)
    If nm Is Nothing Then
        AddFinding findings, "Period", PERIOD_NAME, _
            "Named range is missing. Name the cell that holds the reporting period."
        Exit Sub
    End If

    On Error Resume Next
    Set rng = nm.RefersToRange
    On Error GoTo 0

    If rng Is Nothing Then
        AddFinding findings, "Period", nm.Name, "ReportingPeriod does not point at a cell."
        Exit Sub
    End If
    If rng.Cells.Count <> 1 Then
        AddFinding findings, "Period", nm.Name, "ReportingPeriod must be a single cell."
        Exit Sub
    End If

    mPeriodLabel = Trim$(rng.Cells(1).Text)
    If Len(mPeriodLabel) = 0 Then
        AddFinding findings, "Period", rng.Worksheet.Name & "!" & rng.Address(False, False), _
            "Reporting period is blank."
    End If
End Sub

Private Sub CheckFormulaErrors(ByVal findings As Collection)
    Dim ws As Worksheet
    Dim formulas As Range
    Dim cell As Range
    Dim seen As Long

    For Each ws In ThisWorkbook.Worksheets
        If StrComp(ws.Name, REPORT_SHEET, vbTextCompare) = 0 Then GoTo NextSheet

        Set formulas = FormulaCells(ws)
        If Not formulas Is Nothing Then
            For Each cell In formulas.Cells
                seen = seen + 1
                If seen > MAX_CELLS Then
                    AddFinding findings, "Limit", "(workbook)", _
                        "Stopped after " & MAX_CELLS & " formulas. Raise MAX_CELLS if you need the rest."
                    Exit Sub
                End If
                If IsError(cell.Value) Then
                    AddFinding findings, "Formula", ws.Name & "!" & cell.Address(False, False), cell.Text
                End If
            Next cell
        End If
NextSheet:
    Next ws
End Sub

Private Sub CheckRequiredInputs(ByVal findings As Collection)
    Dim nm As Name
    Dim value As Variant
    Dim readable As Boolean

    For Each nm In ThisWorkbook.Names
        If StrComp(Left$(LocalName(nm.Name), Len(INPUT_PREFIX)), INPUT_PREFIX, vbTextCompare) <> 0 Then
            GoTo NextName
        End If

        If InStr(1, nm.RefersTo, "#REF!", vbTextCompare) > 0 Then
            AddFinding findings, "Input", nm.Name, "Named range refers to #REF!."
            GoTo NextName
        End If

        value = ReadNameValue(nm, readable)
        If Not readable Then
            AddFinding findings, "Input", nm.Name, "Could not read this name."
        ElseIf IsError(value) Then
            AddFinding findings, "Input", nm.Name, "The name does not return a value."
        ElseIf IsBlankValue(value) Then
            AddFinding findings, "Input", nm.Name, "Blank. A zero is fine. An empty cell is not."
        End If
NextName:
    Next nm
End Sub

Private Sub WriteReport(ByVal findings As Collection)
    Dim ws As Worksheet
    Dim item As Collection
    Dim row As Long

    Set ws = ReportSheet()
    ws.Range("A1").Value = "Month-close checks"
    ws.Range("A1").Font.Bold = True
    ws.Range("A1").Font.Size = 16

    ws.Range("A2").Value = "Ran at"
    ws.Range("B2").Value = Now
    ws.Range("B2").NumberFormat = "yyyy-mm-dd hh:mm"

    ws.Range("A3").Value = "Reporting period"
    If Len(mPeriodLabel) = 0 Then
        ws.Range("B3").Value = "(not set)"
    Else
        ws.Range("B3").Value = mPeriodLabel
    End If

    ws.Range("A4").Value = "Findings"
    ws.Range("B4").Value = findings.Count

    ws.Range("A6").Value = "Kind"
    ws.Range("B6").Value = "Where"
    ws.Range("C6").Value = "Detail"
    ws.Range("A6:C6").Font.Bold = True

    row = 6
    If findings.Count = 0 Then
        ws.Range("A7").Value = "Nothing to fix."
    Else
        For Each item In findings
            row = row + 1
            ws.Cells(row, 1).Value = item(1)
            ws.Cells(row, 2).Value = item(2)
            ws.Cells(row, 3).Value = item(3)
        Next item
        ws.Range("A6:C" & row).AutoFilter
    End If

    ws.Columns("A").ColumnWidth = 16
    ws.Columns("B").ColumnWidth = 36
    ws.Columns("C").ColumnWidth = 78
    ws.Rows("1:6").Font.Name = "Calibri"
    ws.Activate
    On Error Resume Next
    ActiveWindow.FreezePanes = False
    ws.Range("A7").Select
    ActiveWindow.FreezePanes = True
    ws.Range("A1").Select
    On Error GoTo 0
End Sub

Private Function ReportSheet() As Worksheet
    Dim ws As Worksheet

    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(REPORT_SHEET)
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = REPORT_SHEET
    Else
        If ws.AutoFilterMode Then ws.AutoFilterMode = False
        ws.Cells.Clear
        If ws.Visible <> xlSheetVisible Then ws.Visible = xlSheetVisible
    End If
    Set ReportSheet = ws
End Function

Private Function FormulaCells(ByVal ws As Worksheet) As Range
    On Error Resume Next
    Set FormulaCells = ws.UsedRange.SpecialCells(xlCellTypeFormulas)
    On Error GoTo 0
End Function

Private Function FindName(ByVal wanted As String) As Name
    Dim nm As Name
    Dim fallback As Name

    For Each nm In ThisWorkbook.Names
        If StrComp(LocalName(nm.Name), wanted, vbTextCompare) = 0 Then
            If InStr(nm.Name, "!") = 0 Then
                Set FindName = nm
                Exit Function
            End If
            If fallback Is Nothing Then Set fallback = nm
        End If
    Next nm
    Set FindName = fallback
End Function

Private Function LocalName(ByVal fullName As String) As String
    Dim bang As Long
    bang = InStrRev(fullName, "!")
    If bang > 0 Then
        LocalName = Mid$(fullName, bang + 1)
    Else
        LocalName = fullName
    End If
End Function

Private Function ReadNameValue(ByVal nm As Name, ByRef ok As Boolean) As Variant
    Dim rng As Range

    ok = False
    On Error Resume Next
    Set rng = nm.RefersToRange
    If Err.Number = 0 And Not rng Is Nothing Then
        ReadNameValue = rng.Value
        ok = (Err.Number = 0)
    Else
        Err.Clear
        ReadNameValue = Application.Evaluate(nm.Name)
        ok = (Err.Number = 0)
    End If
    On Error GoTo 0
End Function

Private Function IsBlankValue(ByVal value As Variant) As Boolean
    Dim item As Variant

    If IsError(value) Then
        IsBlankValue = False
        Exit Function
    End If
    If IsArray(value) Then
        IsBlankValue = True
        For Each item In value
            If Not IsBlankValue(item) Then
                IsBlankValue = False
                Exit Function
            End If
        Next item
        Exit Function
    End If
    If IsEmpty(value) Then
        IsBlankValue = True
    ElseIf VarType(value) = vbString Then
        IsBlankValue = (Len(Trim$(value)) = 0)
    Else
        IsBlankValue = False
    End If
End Function

Private Sub AddFinding(ByVal findings As Collection, ByVal kind As String, ByVal where As String, ByVal detail As String)
    Dim item As Collection
    Set item = New Collection
    item.Add kind
    item.Add where
    item.Add detail
    findings.Add item
End Sub
