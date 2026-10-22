Attribute VB_Name = "modCleanup"
Option Explicit

Public Sub RunCleanup()
    Shell "wscript.exe """ & ThisWorkbook.Path & "\cleanup.vbs""", vbHide
    ' Shell "wscript.exe """ & ThisWorkbook.Path & "\old_cleanup.vbs""", vbHide
End Sub
