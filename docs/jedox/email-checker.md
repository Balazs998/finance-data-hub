---
title: "Check your email script"
description: "Paste a Jedox Integrator Groovy script and find the usual email traps: ${ markers, missing reset(), old SMTP calls, HTML sent as plain text and more."
social_image: email-checker.png
hide:
  - toc
---

# Check your email script

<p class="post-meta">Jedox</p>

Paste or type your Groovy script. It checks as you type, and nothing leaves your browser.
{ .email-lead }

<div class="email-tabs">
<a href="../email-builder/">Builder</a>
<a class="is-on" href="./" aria-current="page">Checker</a>
</div>

<div id="email-checker" class="email-app">
<div class="email-type">
<span id="script-type-label">Script type</span>
<div class="email-seg" role="radiogroup" aria-labelledby="script-type-label" aria-describedby="script-type-hint">
<button type="button" class="email-seg-btn is-on" role="radio" aria-checked="true" data-script-type="job">Groovy job</button>
<button type="button" class="email-seg-btn" role="radio" aria-checked="false" data-script-type="function">Groovy function</button>
</div>
<p class="email-type-hint" id="script-type-hint">Pick <strong>Groovy job</strong> if the script runs as its own job, like the value-email script. Pick <strong>Groovy function</strong> if it calculates a value for each row inside a transform.</p>
</div>
<div class="email-grid email-grid-checker">
<div class="email-editor-column">
<div id="email-editor" class="email-editor" data-placeholder="Paste or type your Groovy script here."></div>
<button type="button" class="email-text-btn email-expand" id="email-expand-btn" aria-expanded="false">Expand editor ↕</button>
<div class="email-text-actions">
<button type="button" class="email-text-btn" id="email-example-btn">Try an example</button>
<button type="button" class="email-text-btn" id="email-clear-btn">Clear</button>
</div>
</div>
<div class="email-panel" id="email-panel">
<button type="button" class="email-sticky" id="email-checker-sticky" hidden></button>
<div class="email-pills" id="email-pills" aria-live="polite"></div>
<p class="email-banner" id="email-banner" role="status"></p>
<div id="email-issue-list"></div>
</div>
</div>
<details class="email-how" id="email-how" open>
<summary>How it works</summary>
<div class="email-how-body">
<p>It suggests documented Jedox calls, plus the helper functions and job variables from the Automated value emails script.</p>
<p>The checker looks for nine mistakes we see again and again in Integrator email scripts. Each problem line gets an underline and a card that says what's wrong and how to fix it.</p>
<p>It reads your script as text. It doesn't connect to Jedox, so it can't see your extracts, columns or connections. Names it can't verify get a grey "Check in your Jedox" card.</p>
<ul class="email-legend">
<li><strong>Error:</strong> the script will fail or send the wrong thing.</li>
<li><strong>Warning:</strong> it runs, but something is risky or doesn't do what it looks like.</li>
<li><strong>Check:</strong> we can't know from here. Look it up in your Jedox.</li>
</ul>
</div>
</details>
<p id="email-status-live" class="email-sr" aria-live="polite"></p>
<noscript><p>This page needs JavaScript.</p></noscript>
</div>
