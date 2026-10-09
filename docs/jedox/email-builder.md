---
title: "Create your own Jedox email: Groovy script builder"
description: "Fill in a short form and download a tested Jedox Integrator Groovy script that sends one Budget vs. Actual email per owner. Test mode is on by default, and it all runs in your browser."
hide:
  - toc
---

# Create your own email

Fill in the form, watch the email build, then download a tested Groovy script. Nothing you type leaves your browser.
{ .email-lead }

<div class="email-tabs">
<a class="is-on" href="./" aria-current="page">Builder</a>
<a href="../email-checker/">Checker</a>
</div>

<p class="email-privacy">Everything runs in your browser. Nothing you type or paste is sent anywhere.</p>

This builder writes the same Groovy job as the [Automated value emails](automated-value-emails.md) post, with your wording in it. The script is generated from the tested version in that post, so the safety rules come with it: `{{...}}` markers instead of `${...}`, single-quoted strings only, every value escaped, and test mode on by default.

The preview uses the site's made-up sample data. Your real emails will show your own cube's numbers. Every address in the examples is on `example.com`.

<div id="email-builder" class="email-app">
<form id="email-form" class="email-grid" autocomplete="off">
<div class="email-card email-form">
<p class="email-label">Email format</p>
<p class="email-fixed">HTML email with a styled table.</p>

<p class="email-label" id="dimension-label">Send one email per</p>
<div class="email-chips" role="radiogroup" aria-labelledby="dimension-label">
<button type="button" class="email-chip is-on" role="radio" aria-checked="true" data-dimension="cost_center">Cost center</button>
<button type="button" class="email-chip" role="radio" aria-checked="false" data-dimension="entity">Entity</button>
<button type="button" class="email-chip" role="radio" aria-checked="false" data-dimension="country">Country</button>
<button type="button" class="email-chip" role="radio" aria-checked="false" data-dimension="kpi">KPI</button>
</div>
<p class="email-help">Pick the dimension whose owners get their own email. It has to be a real dimension of your cube, not an attribute or a consolidation above it.</p>
<p class="email-help" id="dimension-note" hidden>In the script and in <code>recipients.csv</code>, this is still called <code>cost_center</code> and <code>{{COST_CENTER}}</code>. Only the words around it change, so the tested code stays the same.</p>

<label for="field-subject">Subject</label>
<input id="field-subject" type="text" value="{{COST_CENTER}} actuals for {{PERIOD}}" aria-describedby="help-subject msg-subject" spellcheck="false" autocomplete="off">
<p class="email-help" id="help-subject">Becomes the <code>SUBJECT_TEMPLATE</code> job variable. Use the markers below for values that change per email.</p>
<p class="email-field-msg" id="msg-subject" role="status"></p>

<div class="email-markers">
<p class="email-markers-title">Markers you can use</p>
<p>Type these exactly, with two curly braces on each side. The script fills them in for each email.</p>
<ul class="email-marker-list">
<li><code>{{COST_CENTER}}</code></li>
<li><code>{{COST_CENTER_NAME}}</code></li>
<li><code>{{OWNER_NAME}}</code></li>
<li><code>{{OWNER_EMAIL}}</code></li>
<li><code>{{PERIOD}}</code></li>
<li><code>{{VERSION_PLAN}}</code></li>
<li><code>{{VERSION_ACTUAL}}</code></li>
</ul>
<p>Use <code>{{...}}</code>, never <code>${...}</code>. Integrator replaces <code>${...}</code> in job scripts before your code runs.</p>
</div>

<label for="field-greeting">Greeting</label>
<input id="field-greeting" type="text" value="Hello {{OWNER_NAME}}," aria-describedby="help-greeting msg-greeting" spellcheck="false" autocomplete="off">
<p class="email-help" id="help-greeting">The first line of the email. <code>{{OWNER_NAME}}</code> comes from <code>recipients.csv</code>.</p>
<p class="email-field-msg" id="msg-greeting" role="status"></p>

<label for="field-intro">Intro</label>
<input id="field-intro" type="text" value="Here are the {{PERIOD}} values for your cost center, {{VERSION_ACTUAL}} against {{VERSION_PLAN}} by account." aria-describedby="help-intro msg-intro" spellcheck="false" autocomplete="off">
<p class="email-help" id="help-intro">One or two sentences above the table.</p>
<p class="email-field-msg" id="msg-intro" role="status"></p>

<p class="email-label">Columns</p>
<p class="email-fixed">Account · Budget · Actual · Variance</p>
<p class="email-help">These four columns are fixed in this version. Variance is Actual minus Budget.</p>

<label for="field-note">Note under the table</label>
<input id="field-note" type="text" value="Variance is {{VERSION_ACTUAL}} minus {{VERSION_PLAN}}. Highlighted variances are unfavorable for that account type." aria-describedby="help-note msg-note" spellcheck="false" autocomplete="off">
<p class="email-help" id="help-note">A short line that explains the numbers. Leave it empty to skip it.</p>
<p class="email-field-msg" id="msg-note" role="status"></p>

<label for="field-footer">Footer</label>
<input id="field-footer" type="text" value="Sent automatically by a Jedox Integrator job." aria-describedby="help-footer msg-footer" spellcheck="false" autocomplete="off">
<p class="email-help" id="help-footer">The small print at the bottom. In test mode, the script adds who the email was meant for.</p>
<p class="email-field-msg" id="msg-footer" role="status"></p>

<button type="button" class="email-switch is-on" id="test-mode" role="switch" aria-checked="true">
<span class="email-switch-track" aria-hidden="true"></span>
<span>Test mode: send everything to one address</span>
</button>
<p class="email-help" id="test-mode-help-on">Every email goes to the test address. The subject starts with <code>[TEST for owner.cc4010@example.com]</code>, so you can see who it was meant for.</p>
<p class="email-help" id="test-mode-help-off" hidden>The script is the same either way. It only changes the default you download. We recommend keeping it on and switching <code>TEST_MODE</code> to <code>false</code> in Jedox for one run when you're ready.</p>

<label for="field-test-address">Test address</label>
<input id="field-test-address" type="text" inputmode="email" value="test.recipient@example.com" aria-describedby="help-test-address msg-testAddress" autocomplete="off" spellcheck="false">
<p class="email-help" id="help-test-address">Becomes the <code>RECIPIENT_TEST</code> job variable. Use your own mailbox when you run it in Jedox.</p>
<p class="email-field-msg" id="msg-testAddress" role="status"></p>

<details class="email-more">
<summary>More settings</summary>
<label for="field-period">Period</label>
<input id="field-period" type="text" value="2026-03" aria-describedby="help-period msg-period" autocomplete="off" spellcheck="false">
<p class="email-help" id="help-period">The month to report, as a Period element, for example <code>2026-03</code>. Becomes <code>PERIOD</code>.</p>
<p class="email-field-msg" id="msg-period" role="status"></p>

<label for="field-version-plan">Plan version</label>
<input id="field-version-plan" type="text" value="Budget" aria-describedby="help-version-plan msg-versionPlan" autocomplete="off" spellcheck="false">
<p class="email-help" id="help-version-plan">The version you compare against, for example <code>Budget</code> or <code>Forecast</code>. Becomes <code>VERSION_PLAN</code>.</p>
<p class="email-field-msg" id="msg-versionPlan" role="status"></p>

<label for="field-version-actual">Actual version</label>
<input id="field-version-actual" type="text" value="Actual" aria-describedby="help-version-actual msg-versionActual" autocomplete="off" spellcheck="false">
<p class="email-help" id="help-version-actual">Usually <code>Actual</code>. Becomes <code>VERSION_ACTUAL</code>.</p>
<p class="email-field-msg" id="msg-versionActual" role="status"></p>

<button type="button" class="email-switch is-on" id="color-variance" role="switch" aria-checked="true">
<span class="email-switch-track" aria-hidden="true"></span>
<span>Highlight unfavorable variances</span>
</button>
<p class="email-help">Colors a variance when it's bad news for that account type. Becomes <code>COLOR_VARIANCE</code>.</p>

<label for="field-extract">Extract name</label>
<input id="field-extract" type="text" value="PnL_BudgetActual" aria-describedby="help-extract msg-extractName" autocomplete="off" spellcheck="false">
<p class="email-help" id="help-extract">The name of your Cube Slice extract. Becomes <code>SOURCE_EXTRACT</code>.</p>
<p class="email-field-msg" id="msg-extractName" role="status"></p>
</details>
</div>

<div class="email-card email-panel" id="email-panel">
<div class="email-ptabs" role="tablist" aria-label="Preview">
<button type="button" class="email-tab is-on" role="tab" id="tab-preview" data-tab="preview" aria-selected="true" aria-controls="panel-preview">Email preview</button>
<button type="button" class="email-tab" role="tab" id="tab-script" data-tab="script" aria-selected="false" aria-controls="panel-script">Groovy script</button>
<button type="button" class="email-tab" role="tab" id="tab-template" data-tab="template" aria-selected="false" aria-controls="panel-template">Template</button>
</div>
<div id="panel-preview" role="tabpanel" aria-labelledby="tab-preview">
<p class="email-caption">Sample data: cost center CC4010, March 2026. In test mode the real subject also starts with <code>[TEST for ...]</code>.</p>
<p class="email-subject-line" id="email-subject-line"></p>
<p class="email-help" id="email-fallback" hidden></p>
<div class="email-frame-wrap">
<iframe id="email-frame" title="Email preview" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>
</div>
</div>
<div id="panel-script" role="tabpanel" aria-labelledby="tab-script" hidden>
<p class="email-caption">This is the job script. Paste it into a Groovy job in your Integrator project.</p>
<pre class="email-code-view" id="email-script-view"></pre>
</div>
<div id="panel-template" role="tabpanel" aria-labelledby="tab-template" hidden>
<p class="email-caption">This is <code>email-template.html</code>. Put it in the local files folder. Keep all 12 <code>{{...}}</code> markers.</p>
<pre class="email-template-view" id="email-template-view"></pre>
</div>
<div class="email-actions">
<button type="button" class="email-btn email-btn-primary" id="email-download">Download script + template</button>
<button type="button" class="email-btn" id="email-copy">Copy script</button>
<p class="email-download-note" id="email-download-note" hidden></p>
</div>
<p class="email-status" id="email-status" role="status"></p>
<button type="button" class="email-text-btn" id="email-reset">Reset to the example</button>
</div>
</form>
<button type="button" class="email-sticky" id="email-builder-sticky" aria-expanded="false">Preview</button>
<noscript><p>This page needs JavaScript. The builder still runs only in your browser.</p></noscript>
</div>

<div class="email-next" markdown="1">

## Next: run it in Jedox in test mode first

1. Put `email-template.html`, `recipients.csv`, `dim_account.csv` and `dim_cost_center.csv` in the local files folder. Create the four File connections: `EmailTemplate`, `EmailRecipients`, `Accounts` and `CostCenters`.
2. Create the Cube Slice extract and run its preview. Check that the column names match the script, including the value column `#Value`.
3. Create a Groovy job, paste the script and add the job variables. Leave `TEST_MODE` set to `true`.
4. Run the job. Every email goes to your test address. Open them in Outlook, in web mail and on a phone.
5. When they look right, set `TEST_MODE` to `false` for that one run only, not in the variable's default.

If mail doesn't arrive, check the mail settings in Cloud Console. Since Jedox 24.2, the SMTP server and the From address are set there, not in the script.

The [Automated value emails](automated-value-emails.md) post walks through each step.

</div>
