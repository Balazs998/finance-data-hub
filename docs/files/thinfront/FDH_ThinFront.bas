Attribute VB_Name = "FDH_ThinFront"
' Finance Data Hub - thin Excel front end (fictional FDH_DEMO data)
' One click refreshes every workbook connection in order, waits for each,
' logs the result to sheet RefreshLog and always restores Excel's settings.
' Power Query connections are xlConnectionTypeOLEDB with provider Microsoft.Mashup.OleDb.1;
' the BackgroundQuery switch set here is saved with the workbook.
' No Windows API calls, so no Declare / PtrSafe is needed; runs in 32- and 64-bit Office.
Option Explicit

Private Const LOG_SHEET As String = "RefreshLog"
Private mLastError As String

Public Sub RefreshReport()
    Dim prevScreen As Boolean
    Dim prevEvents As Boolean
    Dim prevCalc As XlCalculation
    Dim prevStatus As Variant
    Dim conn As WorkbookConnection
    Dim startedAt As Date
    Dim failures As Long
    Dim stepName As String

    prevScreen = Application.ScreenUpdating
    prevEvents = Application.EnableEvents
    prevCalc = Application.Calculation
    prevStatus = Application.StatusBar

    On Error GoTo Fail
    stepName = "Check " & LOG_SHEET
    If Not SheetExists(LOG_SHEET) Then
        Err.Raise vbObjectError + 513, "RefreshReport", "Add a sheet named RefreshLog first."
    End If

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual

    For Each conn In ThisWorkbook.Connections
        stepName = conn.Name
        Application.StatusBar = "Refreshing " & stepName & "..."
        startedAt = Now
        If RefreshOne(conn) Then
            WriteLog stepName, startedAt, "OK", ""
        Else
            failures = failures + 1
            WriteLog stepName, startedAt, "FAILED", mLastError
        End If
    Next conn

    stepName = "Calculate"
    Application.Calculate

    If failures > 0 Then
        MsgBox failures & " connection(s) failed. See sheet " & LOG_SHEET & ".", vbExclamation, "FDH refresh"
    End If

CleanExit:
    Application.Calculation = prevCalc
    Application.EnableEvents = prevEvents
    Application.ScreenUpdating = prevScreen
    Application.StatusBar = prevStatus
    Exit Sub

Fail:
    MsgBox "Refresh stopped at " & stepName & ":" & vbCrLf & Err.Number & " " & Err.Description, vbCritical, "FDH refresh"
    Resume CleanExit
End Sub

' Refreshes one connection synchronously. Returns False and sets mLastError on failure.
Private Function RefreshOne(ByVal conn As WorkbookConnection) As Boolean
    On Error GoTo Fail
    mLastError = ""
    Select Case conn.Type
        Case xlConnectionTypeOLEDB
            conn.OLEDBConnection.BackgroundQuery = False
        Case xlConnectionTypeODBC
            conn.ODBCConnection.BackgroundQuery = False
    End Select
    conn.Refresh
    RefreshOne = True
    Exit Function
Fail:
    mLastError = Err.Number & " " & Err.Description
    RefreshOne = False
End Function

Private Function SheetExists(ByVal sheetName As String) As Boolean
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If StrComp(ws.Name, sheetName, vbTextCompare) = 0 Then
            SheetExists = True
            Exit Function
        End If
    Next ws
End Function

Private Sub WriteLog(ByVal queryName As String, ByVal startedAt As Date, ByVal status As String, ByVal message As String)
    Dim ws As Worksheet
    Dim nextRow As Long
    Set ws = ThisWorkbook.Worksheets(LOG_SHEET)
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    ws.Cells(nextRow, 1).Value = queryName
    ws.Cells(nextRow, 2).Value = startedAt
    ws.Cells(nextRow, 3).Value = Now
    ws.Cells(nextRow, 4).Value = status
    ws.Cells(nextRow, 5).Value = message
End Sub
