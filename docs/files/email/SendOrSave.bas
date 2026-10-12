Attribute VB_Name = "SendOrSave"
Option Explicit

Sub SendOrSave(toAddr As String, subj As String, body As String)
    Static n As Long
    Dim ol As Object, folder As String, f As Integer
    On Error Resume Next
    Set ol = CreateObject("Outlook.Application")
    If Not ol Is Nothing Then
        With ol.CreateItem(0)
            .To = toAddr
            .Subject = subj
            .Body = body
            .Send
        End With
        If Err.Number = 0 Then Exit Sub
    End If
    On Error GoTo 0
    folder = ThisWorkbook.Path
    If Len(folder) = 0 Or InStr(folder, "://") > 0 Then folder = Environ$("TEMP")
    n = n + 1
    f = FreeFile
    Open folder & "\unsent_" & Format(Now, "yyyymmdd_hhnnss") & "_" & n & ".txt" For Output As #f
    Print #f, "To: " & toAddr
    Print #f, "Subject: " & subj
    Print #f, body
    Close #f
    MsgBox "The mail couldn't be sent. It was saved in " & folder & ".", vbExclamation
End Sub

' This sends a REAL email through your Outlook. The example.com address will bounce;
' replace it with your own address if you want to see the mail arrive.
Sub TestSendOrSave()
    SendOrSave "owner.cc1000@example.com", "FDH test", "Test body"
End Sub
