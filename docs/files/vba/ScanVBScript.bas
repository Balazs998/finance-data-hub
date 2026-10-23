Attribute VB_Name = "FDH_ScanVBScript"
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
