Attribute VB_Name = "modChecks"
Option Explicit

Public Function HasAccountCode(ByVal s As String) As Boolean
    Dim re As Object
    Set re = CreateObject("VBScript.RegExp")
    re.Pattern = "\b[4-6][0-9]{5}\b"
    HasAccountCode = re.Test(s)
End Function

Public Function CleanPeriod(ByVal s As String) As String
    Dim re As Object
    Set re = CreateObject("vbscript.RegExp")
    re.Pattern = "[^0-9-]"
    re.Global = True
    CleanPeriod = re.Replace(s, "")
End Function
