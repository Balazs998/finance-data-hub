---
date: 2026-10-13
home_tag: Outlook
title: Your VBA email macro after New Outlook
description: Why Excel macros that send mail through Outlook stop working in New Outlook for Windows, and what to switch to.
social_image: new-outlook-email.png
---

# Your VBA email macro after New Outlook

<p class="post-meta">VBA · Outlook</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>Every claim on this page is backed by a Microsoft page linked next to it. We haven't run these steps in a live Microsoft 365 tenant.</p>
</aside>

Lots of finance workbooks send their own reports: a macro builds the mail with `CreateObject("Outlook.Application")` and sends it. Microsoft says plainly that "VBA and Macros aren't supported in new Outlook" ([VBA alternatives, Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-365-apps/outlook/get-started/vba-alternatives)). If your team moves to New Outlook, those macros need a new route.

## What you'll build

- A quick way to tell which Outlook you're on.
- A macro that saves the mail as a text file instead of failing silently.
- A short look at the three alternatives Microsoft names: Power Automate, Microsoft Graph and Office.js.
- A checklist for moving your existing report macros.

## Before you start

!!! info "You'll need"
    - Desktop Excel for Windows. The macro sends only through classic Outlook; without it, it saves the mail as a file.
    - `recipients.csv` (10 cost centers, `@example.com` addresses). The addresses are made up.

## The sample scenario

Your workbook has a macro that emails each cost center owner their numbers, here the 10 owners in `recipients.csv`. Today it does that through Outlook.

## 1. Which Outlook are you on?

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="Which Outlook are you on? Decision diagram">
  <a href="../new-outlook-diagram.svg"><img src="../new-outlook-diagram.svg" alt="Which Outlook are you on? An Excel VBA email macro using CreateObject(&quot;Outlook.Application&quot;). If Outlook shows a Settings button at the top right, you are on New Outlook; if not, classic Outlook. Classic Outlook: the existing macro keeps working. New Outlook: VBA and macros aren't supported. Microsoft names three alternatives: Power Automate with Send an email (V2), Microsoft Graph sendMail (needs Mail.Send, 202 Accepted means accepted, not delivered), and Office.js web add-ins." width="840" height="480"></a>
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

- **Classic Outlook:** If classic Outlook is still installed, `CreateObject` usually succeeds even when you work in New Outlook, so the fallback only kicks in when classic is missing or broken.
- **New Outlook:** VBA and macros aren't supported, so the macro needs one of the alternatives in step 3 ([source](https://learn.microsoft.com/en-us/microsoft-365-apps/outlook/get-started/vba-alternatives)).

To check, look at the top right corner of Outlook. If there's a **Settings** button, you're on New Outlook. If it's missing, you're on classic Outlook. New Outlook's ribbon also only has the Home, View and Help tabs ([What version of Outlook do I have?, Microsoft Support](https://support.microsoft.com/en-us/Outlook/getstarted/what-version-of-outlook-do-i-have)).

## 2. Don't fail silently: save the mail as a text file

If the macro can't reach Outlook, save the message as a file so nothing gets lost. This is a pattern, not something we tested. After the sends, call `ShowUnsentMails` once. There's one message at the end with how many mails were saved as `unsent_*.txt` and the folder they're in.

```vba
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
    MsgBox "Could not save unsent mail to " & folder & ": " & Err.Description, vbCritical
End Sub

Sub ShowUnsentMails()
    If mCount = 0 Then Exit Sub
    MsgBox mCount & " mail(s) couldn't be sent. They were saved as unsent_*.txt in " & mFolder & ".", vbExclamation
    mCount = 0
End Sub
```

```vba
' This sends a REAL email through your Outlook. The example.com address will bounce;
' replace it with your own address if you want to see the mail arrive.
Sub TestSendOrSave()
    SendOrSave "owner.cc1000@example.com", "FDH test", "Test body"
    ShowUnsentMails
End Sub
```

The saved `.txt` files hold the full mail body in plain text; delete each once the mail has been resent, and never point the fallback at a shared folder.

## 3. Pick an alternative

Microsoft names three ([source](https://learn.microsoft.com/en-us/microsoft-365-apps/outlook/get-started/vba-alternatives)):

- **Power Automate**, for automating flows between apps.
- **Microsoft Graph**, for advanced flows and email integrations.
- **Office.js**, for building web add-ins for Outlook.

For a report macro, the realistic choices are Power Automate or Graph. Graph's `sendMail` call needs the `Mail.Send` permission. It returns `202 Accepted`, which only means the request was accepted, not that the mail was delivered, and by default it saves a copy in Sent Items ([user: sendMail, Microsoft Learn](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)). For a macro or flow sending as one person, use delegated `Mail.Send`. If IT grants application `Mail.Send`, limit it to the one sending mailbox with [RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

In Power Automate, the Office 365 Outlook connector's action is **Send an email (V2)**. It needs To, Subject and Body, and the Body is HTML. The older "Send an email" action is deprecated ([Office 365 Outlook connector, Microsoft Learn](https://learn.microsoft.com/en-us/connectors/office365connector/)). For a step-by-step guide, see [Create flows for popular email scenarios](https://learn.microsoft.com/en-us/power-automate/email-top-scenarios).

## 4. Migration checklist

- List every workbook that calls `Outlook.Application`.
- Add the fallback from step 2 that saves the mail as a text file so nothing fails quietly.
- Choose Power Automate or Graph for each one, then ask IT about the permission it needs.
- Don't treat a Graph `202` as proof of delivery.

## Check the result

!!! success "Expected: no mail lost"
    With Outlook unavailable, there's one message at the end with how many mails were saved as `unsent_*.txt` and the folder they're in. This is the intended behavior. We haven't tested it on a live install.

## If it doesn't match

- No file appears: check that the workbook is saved in a folder you can write to, and check the `%TEMP%` folder.
- The macro can't find Outlook even though it's open: check whether you're on New Outlook (step 1). One user in [a Microsoft Q&A thread](https://learn.microsoft.com/en-us/answers/questions/5286064/excel-vba-macros-new-outlook) reports that their macro worked again after switching back to classic Outlook. That's one user's report, not a statement from Microsoft.

## Wrap-up

New Outlook doesn't run VBA, so treat Outlook automation as something you'll need to move. Add the fallback now, then plan the move to Power Automate or Graph.

## Downloads

All files use synthetic sample data and placeholder names.

[[download:email/SendOrSave.bas|Download SendOrSave.bas]]
[[download:email/recipients.csv|Download recipients.csv]]

**Next:** [Is your finance workbook hit by VBScript deprecation?](vbscript-deprecation.md) checks your other macros for the next Windows change.
