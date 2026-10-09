---
title: "Check your Jedox email script: Groovy checker"
description: "Paste a Jedox Integrator Groovy script and find the usual email traps: ${ markers, missing reset(), old SMTP calls, HTML sent as plain text and more. Runs in your browser only."
hide:
  - toc
---

# Create your own email

Paste your Integrator Groovy script and check it for the usual traps. It runs in your browser only.
{ .email-lead }

<div class="email-tabs">
<a href="../email-builder/">Builder</a>
<a class="is-on" href="./" aria-current="page">Checker</a>
</div>

<p class="email-privacy">Everything runs in your browser. Nothing you type or paste is sent anywhere.</p>

The checker looks for nine mistakes we see again and again in Integrator email scripts. Each problem line gets an underline and a card that says what's wrong and how to fix it.

It reads your script as text. It doesn't connect to Jedox, so it can't see your extracts, columns or connections. Names it can't verify get a grey "Check in your Jedox" card.

<div id="email-checker" class="email-app">
<div class="email-type">
<span id="script-type-label">Script type</span>
<div class="email-seg" role="radiogroup" aria-labelledby="script-type-label">
<button type="button" class="email-seg-btn is-on" role="radio" aria-checked="true" data-script-type="job">Groovy job</button>
<button type="button" class="email-seg-btn" role="radio" aria-checked="false" data-script-type="function">Groovy function</button>
</div>
</div>
<div class="email-grid email-grid-checker">
<div class="email-editor-column">
<div class="email-codebox">
<div class="email-gutter" id="email-gutter" aria-hidden="true"></div>
<div class="email-code-main">
<pre class="email-highlight" id="email-highlight" aria-hidden="true"></pre>
<textarea id="email-script-input" aria-label="Your Groovy script" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Paste your Groovy job script here. Nothing leaves your browser."></textarea>
</div>
</div>
<div class="email-text-actions">
<button type="button" class="email-btn email-btn-primary" id="email-check-btn">Check script</button>
<button type="button" class="email-text-btn" id="email-example-btn">Try an example</button>
<button type="button" class="email-text-btn" id="email-clear-btn">Clear</button>
</div>
</div>
<div class="email-panel" id="email-panel">
<div class="email-pills" id="email-pills" aria-live="polite"></div>
<ul class="email-legend">
<li><strong>Error:</strong> the script will fail or send the wrong thing.</li>
<li><strong>Warning:</strong> it runs, but something is risky or doesn't do what it looks like.</li>
<li><strong>Check:</strong> we can't know from here. Look it up in your Jedox.</li>
</ul>
<p class="email-banner" id="email-banner" role="status"></p>
<div id="email-issue-list"></div>
</div>
</div>
<button type="button" class="email-sticky" id="email-checker-sticky" aria-expanded="false">Issues</button>
<noscript><p>This page needs JavaScript. The checker still runs only in your browser.</p></noscript>
</div>
