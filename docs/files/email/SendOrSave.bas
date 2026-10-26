Attribute VB_Name = "FDH_SendOrSave"
Option Explicit

Private mCount As Long, mFolder As String

Sub SendOrSave(toAddr As String, subj As String, body As String)
    Static n As Long
    Dim ol As Object, folder As String, f As Integer, filePath As String
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
    filePath = folder & "\unsent_" & Format(Now, "yyyymmdd_hhnnss") & "_" & n & ".txt"
    f = FreeFile
    On Error GoTo SaveFail
    Open filePath For Output As #f
    Print #f, "To: " & toAddr
    Print #f, "Subject: " & subj
    Print #f, body
    Close #f
    mCount = mCount + 1
    mFolder = folder
    Exit Sub

SaveFail:
    On Error Resume Next: Close #f
    MsgBox "Could not save unsent mail to " & folder & ": " & Err.Description, vbCritical
End Sub

Sub ShowUnsentMails()
    If mCount = 0 Then Exit Sub
    MsgBox mCount & " mail(s) couldn't be sent. They were saved as unsent_*.txt in " & mFolder & ".", vbExclamation
    mCount = 0
End Sub

' This sends a REAL email through your Outlook. The example.com address will bounce;
' replace it with your own address if you want to see the mail arrive.
Sub TestSendOrSave()
    SendOrSave "owner.cc1000@example.com", "FDH test", "Test body"
    ShowUnsentMails
End Sub
