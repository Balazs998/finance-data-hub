Attribute VB_Name = "modValidate"
Option Explicit

' Fictional demo: FDH_Legacy_Tool. Checks CC1000-style cost-center codes.
Public Function IsCostCenter(ByVal code As String) As Boolean
    Dim re As New VBScript_RegExp_55.RegExp
    re.Pattern = "^CC[0-9]{4}$"
    IsCostCenter = re.Test(code)
End Function
