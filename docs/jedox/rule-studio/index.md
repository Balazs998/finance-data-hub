---
title: Business Rule Studio
description: Test, explain and improve a Jedox business rule, or describe a calculation and get a draft. Static checks run in the browser. Nothing is executed in Jedox.
hide:
  - toc
---

# Business Rule Studio

Test, explain and improve Jedox business rules, or describe a calculation and get a draft rule. Analysis combines static checks and an AI assessment; nothing runs in Jedox.
{ .rs-lead }

<div id="rule-studio">
<div class="rs-title-row">
<span class="rs-badge rs-b-ill">Concept preview</span>
<span class="rs-badge rs-b-mock" id="rs-mock-badge">⚑ Mock provider – not real AI</span>
</div>
<p class="rs-cnt" id="rs-mode-note"></p>

<div class="rs-row" style="margin:18px 0">
<div role="tablist" class="rs-tabs" aria-label="Studio mode">
<button type="button" role="tab" id="t-test" aria-selected="true" aria-controls="p-test">Test &amp; Optimize</button>
<button type="button" role="tab" id="t-gen" aria-selected="false" aria-controls="p-gen" tabindex="-1">Generate Rule</button>
</div>
<span class="rs-sp"></span>
<div style="min-width:200px">
<label for="rs-version">Jedox version</label>
<select id="rs-version" class="rs-in"></select>
</div>
</div>

<section id="p-test" role="tabpanel" aria-labelledby="t-test">
<div class="rs-grid2">
<div class="rs-card">
<div class="rs-row" style="margin-bottom:10px">
<label for="rs-cube" style="margin:0">Cube</label>
<select id="rs-cube" class="rs-in" style="max-width:220px"></select>
<span class="rs-sp"></span>
<span class="rs-cnt" id="rs-lines">0 lines</span>
</div>
<div id="rs-editor" class="rs-editor-host" aria-label="Rule editor"></div>
<div class="rs-row" style="margin-top:16px">
<button type="button" class="rs-btn rs-pri" id="rs-analyze">Analyze rule</button>
<label class="rs-sr" for="rs-example">Examples</label>
<select id="rs-example" class="rs-in" style="max-width:280px"></select>
<span class="rs-sp"></span>
<button type="button" class="rs-btn rs-sec" id="rs-copy">Copy</button>
<button type="button" class="rs-btn rs-sec" id="rs-download">Download</button>
<button type="button" class="rs-btn rs-sec" id="rs-reset">Reset</button>
</div>
<p class="rs-cnt" style="margin-top:8px">Fictional data only. Examples are loaded from the demo pack.</p>
</div>
<div class="rs-card">
<h3 style="margin-top:0">What gets sent</h3>
<div class="rs-privacy">Your rule text and any metadata you enter are sent to our server and the AI provider only when a worker endpoint is configured. In the default offline mode nothing leaves this page. Nothing is stored or logged on the server; a configured worker records request counts only. History is off unless you turn it on below, and then it stays in this browser only.</div>
<div id="rs-turnstile" style="margin-top:12px"></div>
</div>
</div>
</section>

<section id="p-gen" role="tabpanel" aria-labelledby="t-gen" class="rs-card" hidden>
<div class="rs-step"><span class="rs-num">1</span><h3>Environment</h3></div>
<div class="rs-grid3">
<div><label for="rs-database">Database</label><input id="rs-database" class="rs-in" autocomplete="off"></div>
<div><label for="rs-target">Target cube</label><input id="rs-target" class="rs-in" list="rs-cube-list" autocomplete="off"></div>
<div><label for="rs-sources">Source cubes</label><input id="rs-sources" class="rs-in" autocomplete="off"></div>
</div>
<datalist id="rs-cube-list"></datalist>
<div class="rs-row" style="margin:20px 0 8px"><span class="rs-label" style="margin:0">Cube dimensions (in order)</span></div>
<div class="rs-dimhead"><span></span><span>Dimension</span><span>Key elements</span><span>Level</span><span>Role (hint)</span><span></span></div>
<div id="rs-dims"></div>
<p class="rs-hint">Role is a hint for the draft. Jedox has no special measures dimension type.</p>
<div class="rs-row" style="margin-top:6px">
<button type="button" class="rs-btn rs-sec" id="rs-add-dim">＋ Add dimension</button>
<button type="button" class="rs-btn rs-sec" id="rs-meta-toggle">Paste metadata (JSON / CSV)</button>
</div>
<div id="rs-meta-box" hidden style="margin-top:12px">
<label for="rs-meta">Structured metadata</label>
<textarea id="rs-meta" class="rs-in" placeholder="JSON from the demo pack, or CSV: dimension, key elements, level, role"></textarea>
<button type="button" class="rs-btn rs-sec" id="rs-meta-apply" style="margin-top:8px">Apply metadata</button>
</div>

<div class="rs-step" style="margin-top:28px"><span class="rs-num">2</span><h3>Your business story</h3></div>
<label for="rs-story">Describe what you want your business rule to calculate.</label>
<textarea id="rs-story" class="rs-in" placeholder="For example: calculate Variance as Actual minus Budget on base cells."></textarea>
<div class="rs-row" style="margin-top:14px">
<button type="button" class="rs-btn rs-pri" id="rs-generate">✦ Generate rule</button>
<span class="rs-cnt">Fictional examples only. No company data.</span>
</div>
<div id="rs-clarify" class="rs-card rs-clarify rs-state" hidden style="margin-top:16px"></div>
<div id="rs-draft" hidden style="margin-top:22px"></div>

<div class="rs-step" style="margin-top:28px"><span class="rs-num">4</span><h3>Refine</h3></div>
<div class="rs-chips" role="group" aria-label="Quick refinements">
<button type="button" class="rs-chip" aria-pressed="false">Only actuals</button>
<button type="button" class="rs-chip" aria-pressed="false">Exclude intercompany</button>
<button type="button" class="rs-chip" aria-pressed="false">Budget versions</button>
<button type="button" class="rs-chip" aria-pressed="false">Reduce calculations</button>
<button type="button" class="rs-chip" aria-pressed="false">Simpler explanation</button>
</div>
<div class="rs-row" style="margin-top:12px">
<input id="rs-instruction" class="rs-in" style="flex:1;min-width:220px" placeholder="Or type a change, for example also limit the period">
<button type="button" class="rs-btn rs-pri" id="rs-refine">Refine</button>
</div>
<div id="rs-refine-diff" hidden style="margin-top:14px"></div>
</section>

<div id="rs-results" style="margin-top:18px"></div>

<section class="rs-card" style="margin-top:18px" aria-labelledby="rs-history-title">
<div class="rs-row">
<h3 id="rs-history-title" style="margin:0">History</h3>
<span class="rs-sp"></span>
<button type="button" class="rs-switch" id="rs-history-switch" role="switch" aria-checked="false" aria-labelledby="rs-history-label"></button>
<span id="rs-history-label">Save history in this browser</span>
</div>
<p class="rs-cnt">Off by default. When on, analyses are saved in this browser’s local storage only. They are never sent as a stored history.</p>
<ul class="rs-hist" id="rs-history-list"></ul>
<button type="button" class="rs-btn rs-danger" id="rs-history-delete">Delete all history</button>
</section>
<p id="rs-live" class="rs-sr" aria-live="polite"></p>
<noscript><p>This page needs JavaScript.</p></noscript>
</div>
