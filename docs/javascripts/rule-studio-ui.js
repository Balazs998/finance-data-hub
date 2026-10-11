/* Business Rule Studio page. Static checks stay in the browser. The worker
   is used only when FDH_RULE_STUDIO.endpoint is set. */
(function () {
  var HISTORY_KEY = "fdh-rule-studio-history";
  var HISTORY_FLAG = "fdh-rule-studio-history-on";
  var ROLES = ["Time", "Version", "Measure/Value type", "Other"];

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cfg() {
    return window.FDH_RULE_STUDIO || { endpoint: "", turnstileSiteKey: "" };
  }

  function offline() {
    return !String(cfg().endpoint || "").trim();
  }

  ready(function () {
    var root = document.getElementById("rule-studio");
    if (!root || !window.RuleChecks || !window.RuleMock) return;

    var pack = null;
    var examplesDoc = null;
    var view = null;
    var dims = [];
    var pasted = null;
    var dragFrom = -1;
    var lastStatic = [];
    var lastAi = null;
    var widgetId = null;

    var editorHost = document.getElementById("rs-editor");
    var results = document.getElementById("rs-results");
    var versionSelect = document.getElementById("rs-version");
    var cubeSelect = document.getElementById("rs-cube");
    var exampleSelect = document.getElementById("rs-example");
    var lineCount = document.getElementById("rs-lines");
    var live = document.getElementById("rs-live");
    var mockBadge = document.getElementById("rs-mock-badge");

    function say(text) {
      if (live) live.textContent = text;
    }

    function ruleText() {
      if (view) return view.state.doc.toString();
      var box = document.getElementById("rs-fallback");
      return box ? box.value : "";
    }

    function setRule(text) {
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text }
        });
      } else {
        var box = document.getElementById("rs-fallback");
        if (box) box.value = text;
      }
      countLines();
    }

    function countLines() {
      var text = ruleText();
      var n = text ? text.split("\n").length : 0;
      if (lineCount) lineCount.textContent = n + (n === 1 ? " line" : " lines");
    }

    function roleFor(name) {
      if (name === "Period") return "Time";
      if (name === "Version") return "Version";
      if (name === "Measure") return "Measure/Value type";
      return "Other";
    }

    function preview(cube, dimension) {
      var names = window.RuleChecks.elementsFor(examplesDoc.metadata, cube, dimension);
      if (!names) return "";
      return Array.from(names).slice(0, 6).join(", ");
    }

    function dimsFromCube(cube) {
      var list = (examplesDoc.metadata.cubes || {})[cube] || [];
      return list.map(function (name) {
        return { name: name, elements: preview(cube, name), level: "Base", role: roleFor(name) };
      });
    }

    function metadataForChecks() {
      if (pasted && pasted.cubes) return pasted;
      return examplesDoc.metadata;
    }

    function selectedCube() {
      return cubeSelect.value || Object.keys(examplesDoc.metadata.cubes || {})[0] || "";
    }

    function mountEditor() {
      var cm = window.EmailCodeMirror;
      if (!cm || !cm.jedox || !cm.EditorView) {
        editorHost.innerHTML = '<textarea id="rs-fallback" class="rs-in" rows="8" aria-label="Rule editor" placeholder="Paste a Jedox rule."></textarea>';
        editorHost.querySelector("textarea").addEventListener("input", countLines);
        return;
      }
      var lintFindings = [];
      function lintSource(state) {
        return lintFindings.map(function (item) {
          var lineNo = Math.min(Math.max(item.line || 1, 1), state.doc.lines);
          var line = state.doc.line(lineNo);
          var severity = item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : "info";
          return { from: line.from, to: line.to, severity: severity, message: item.message };
        });
      }
      view = new cm.EditorView({
        state: cm.EditorState.create({
          doc: "",
          extensions: [
            cm.lineNumbers(),
            cm.history(),
            cm.highlightActiveLine(),
            cm.drawSelection(),
            cm.EditorView.lineWrapping,
            cm.jedox(),
            cm.lintGutter(),
            cm.linter(lintSource),
            cm.keymap.of([].concat(cm.defaultKeymap, cm.historyKeymap)),
            cm.EditorView.theme({
              "&": { backgroundColor: "transparent", color: "var(--dn-text)" },
              ".cm-content": { padding: "8px 0" },
              ".cm-gutters": { backgroundColor: "transparent", borderRight: "1px solid var(--dn-border)" },
              ".cm-activeLine": { backgroundColor: "rgba(56, 189, 248, 0.06)" },
              ".cm-tooltip": { backgroundColor: "var(--dn-surface)", color: "var(--dn-text)", border: "1px solid var(--dn-border)" }
            }),
            cm.EditorView.updateListener.of(function (update) {
              if (update.docChanged) countLines();
            })
          ]
        }),
        parent: editorHost
      });
      view._setLint = function (findings) {
        lintFindings = findings || [];
        cm.forceLinting(view);
      };
    }

    function drawDims() {
      var box = document.getElementById("rs-dims");
      box.innerHTML = "";
      dims.forEach(function (dim, index) {
        var row = document.createElement("div");
        row.className = "rs-dimrow";
        row.draggable = true;
        row.innerHTML =
          '<span class="rs-handle" aria-hidden="true" title="Drag to reorder">⠿</span>' +
          '<input class="rs-in rs-dn" aria-label="Dimension ' + (index + 1) + ' name" value="' + esc(dim.name) + '">' +
          '<input class="rs-in rs-dk" aria-label="Key elements" value="' + esc(dim.elements) + '">' +
          '<div class="rs-seg rs-dt" role="group" aria-label="Level">' +
            '<button type="button" data-level="Base" aria-pressed="' + (dim.level !== "Consol." ) + '">Base</button>' +
            '<button type="button" data-level="Consol." aria-pressed="' + (dim.level === "Consol.") + '">Consol.</button>' +
          '</div>' +
          '<select class="rs-in rs-dm" aria-label="Role hint for ' + esc(dim.name || "dimension") + '">' +
            ROLES.map(function (role) {
              return '<option' + (role === dim.role ? " selected" : "") + '>' + esc(role) + "</option>";
            }).join("") +
          "</select>" +
          '<span class="rs-row rs-da" style="gap:6px;flex-wrap:nowrap">' +
            '<button type="button" class="rs-ico" data-act="up" aria-label="Move up"' + (index === 0 ? " disabled" : "") + ">↑</button>" +
            '<button type="button" class="rs-ico" data-act="down" aria-label="Move down"' + (index === dims.length - 1 ? " disabled" : "") + ">↓</button>" +
            '<button type="button" class="rs-ico" data-act="remove" aria-label="Remove dimension">✕</button>' +
          "</span>";
        row.addEventListener("input", function (event) {
          if (event.target.classList.contains("rs-dn")) dim.name = event.target.value;
          if (event.target.classList.contains("rs-dk")) dim.elements = event.target.value;
        });
        row.addEventListener("change", function (event) {
          if (event.target.classList.contains("rs-dm")) dim.role = event.target.value;
        });
        row.querySelectorAll("[data-level]").forEach(function (button) {
          button.addEventListener("click", function () {
            dim.level = button.getAttribute("data-level");
            drawDims();
          });
        });
        row.querySelectorAll("[data-act]").forEach(function (button) {
          button.addEventListener("click", function () {
            var act = button.getAttribute("data-act");
            if (act === "remove") dims.splice(index, 1);
            if (act === "up" && index > 0) dims.splice(index - 1, 0, dims.splice(index, 1)[0]);
            if (act === "down" && index < dims.length - 1) dims.splice(index + 1, 0, dims.splice(index, 1)[0]);
            drawDims();
          });
        });
        row.addEventListener("dragstart", function () { dragFrom = index; });
        row.addEventListener("dragover", function (event) { event.preventDefault(); });
        row.addEventListener("drop", function (event) {
          event.preventDefault();
          if (dragFrom < 0 || dragFrom === index) return;
          var moved = dims.splice(dragFrom, 1)[0];
          dims.splice(index, 0, moved);
          dragFrom = -1;
          drawDims();
        });
        box.appendChild(row);
      });
    }

    function fillChrome() {
      versionSelect.innerHTML = "";
      var option = document.createElement("option");
      option.value = pack.jedox_version;
      option.textContent = "Jedox " + pack.jedox_version;
      versionSelect.appendChild(option);
      cubeSelect.innerHTML = "";
      var list = document.getElementById("rs-cube-list");
      list.innerHTML = "";
      Object.keys(examplesDoc.metadata.cubes).forEach(function (name) {
        var cubeOption = document.createElement("option");
        cubeOption.value = name;
        cubeOption.textContent = name;
        cubeSelect.appendChild(cubeOption);
        var dataOption = document.createElement("option");
        dataOption.value = name;
        list.appendChild(dataOption);
      });
      document.getElementById("rs-database").value = examplesDoc.metadata.database || "";
      document.getElementById("rs-target").value = cubeSelect.value;
      var others = Object.keys(examplesDoc.metadata.cubes).filter(function (name) { return name !== cubeSelect.value; });
      document.getElementById("rs-sources").value = others.join(", ");
      exampleSelect.innerHTML = '<option value="">Load example</option>';
      examplesDoc.examples.forEach(function (example) {
        var item = document.createElement("option");
        item.value = example.id;
        item.textContent = example.title;
        exampleSelect.appendChild(item);
      });
      dims = dimsFromCube(cubeSelect.value);
      drawDims();
      mockBadge.hidden = !offline();
      var note = document.getElementById("rs-mode-note");
      note.textContent = offline()
        ? "Offline mock. The page checks the rule here and the draft is labelled mock. Nothing is sent."
        : "This page sends the rule to the configured worker for an AI assessment. Static checks still run here too.";
    }

    function severityClass(severity) {
      if (severity === "error") return "rs-sev-h";
      if (severity === "warning") return "rs-sev-m";
      return "rs-sev-l";
    }

    function severityWord(severity) {
      if (severity === "error") return "High";
      if (severity === "warning") return "Medium";
      if (severity === "check") return "Check";
      return "Low";
    }

    function sourceBadge(source, severity) {
      if (severity === "check") return '<span class="rs-badge rs-b-check">Check in your Jedox</span>';
      if (source === "ai") return '<span class="rs-badge rs-b-ai">AI assessment</span>';
      if (source === "simulated") return '<span class="rs-badge rs-b-sim">Simulated test</span>';
      return '<span class="rs-badge rs-b-static">Static check</span>';
    }

    function performanceRisk(findings) {
      var relevant = findings.filter(function (item) {
        return item.group === "performance" || item.group === "optimization";
      });
      if (relevant.some(function (item) { return item.severity === "error"; })) return "High";
      if (relevant.some(function (item) { return item.severity === "warning"; })) return "Medium";
      return "Low";
    }

    function renderCode(text, mark) {
      var rows = String(text || "").split("\n");
      return '<div class="rs-code" tabindex="0">' + rows.map(function (row, index) {
        return '<div class="rs-line ' + (mark || "") + '"><span class="rs-n">' + (index + 1) + "</span>" + esc(row) + "</div>";
      }).join("") + "</div>";
    }

    function renderDiff(before, after) {
      var rows = window.RuleDiff ? window.RuleDiff.diffLines(before, after) : [];
      if (!rows.length) return renderCode(after || before, "");
      return '<div class="rs-code" tabindex="0">' + rows.map(function (row) {
        var cls = row.type === "add" ? "rs-add" : row.type === "del" ? "rs-del" : "";
        var n = row.type === "add" ? row.right : row.left;
        return '<div class="rs-line ' + cls + '"><span class="rs-n">' + esc(n) + "</span>" + esc(row.text) + "</div>";
      }).join("") + "</div>";
    }

    function groupFindings(findings, group) {
      return findings.filter(function (item) { return item.group === group; });
    }

    function findingCard(item) {
      var title = item.title || item.message;
      var body = item.title ? item.message : "";
      return '<div class="rs-finding"><div class="rs-row"><b>' + esc(title) + "</b>" +
        '<span class="rs-badge ' + severityClass(item.severity) + '">' + esc(severityWord(item.severity)) + "</span>" +
        '<span class="rs-sp"></span>' + sourceBadge(item.source, item.severity) + "</div>" +
        (body ? "<p>" + esc(body) + "</p>" : "") + "</div>";
    }

    function renderResults(staticFindings, ai, mode) {
      var findings = (staticFindings || []).concat((ai && ai.findings) || []);
      var syntax = groupFindings(findings, "syntax");
      var performance = groupFindings(findings, "performance");
      var logic = groupFindings(findings, "logic");
      var optimization = groupFindings(findings, "optimization");
      var syntaxErrors = syntax.filter(function (item) { return item.severity === "error"; });
      var risk = performanceRisk(findings);
      var suggestions = findings.length;
      var headline = findings.filter(function (item) {
        return item.severity === "error" || item.severity === "warning";
      })[0];
      var mock = !ai || ai.mock !== false;
      var html = '<article class="rs-card" aria-labelledby="rs-analysis-title">' +
        '<div class="rs-row"><h2 id="rs-analysis-title">Rule Analysis</h2><span class="rs-sp"></span>' +
        (mock ? '<span class="rs-badge rs-b-mock">⚑ Mock provider – not real AI</span><span class="rs-badge rs-b-ill">Illustrative result</span>' : '<span class="rs-badge rs-b-ai">' + esc(ai.label || "AI assessment") + "</span>") +
        "</div>" +
        '<div class="rs-grid4" style="margin-top:18px">' +
          '<div class="rs-tile"><div class="rs-t">Syntax</div><div class="rs-v">' + (syntaxErrors.length ? "Needs review" : "✓ Review passed") + "</div></div>" +
          '<div class="rs-tile"><div class="rs-t">Performance risk</div><div class="rs-v"><span class="rs-badge ' + severityClass(risk === "High" ? "error" : risk === "Medium" ? "warning" : "info") + '">' + risk + "</span></div></div>" +
          '<div class="rs-tile"><div class="rs-t">Suggestions</div><div class="rs-v">' + suggestions + " found</div></div>" +
          '<div class="rs-tile"><div class="rs-t">Validation</div><div class="rs-v">Simulated only</div></div>' +
        "</div>";
      if (headline) {
        html += '<div class="rs-finding rs-impact"><div class="rs-row"><h3>Potential high-impact issue</h3>' +
          '<span class="rs-badge ' + severityClass(headline.severity) + '">' + esc(severityWord(headline.severity)) + "</span>" +
          '<span class="rs-sp"></span>' + sourceBadge(headline.source, headline.severity) + "</div><p>" + esc(headline.message) + "</p>" +
          '<div class="rs-inv"><b>Recommended investigation</b><p>Check whether the rule can be restricted to a smaller area or simplified without changing the business logic. Nothing here was executed in Jedox.</p></div></div>';
      }
      html += section("Syntax", syntax, syntaxErrors.length ? "Review" : "✓ Passed", syntaxErrors.length ? "warning" : "info");
      html += section("Performance", performance, risk + " risk", risk === "High" ? "error" : risk === "Medium" ? "warning" : "info");
      html += section("Logic", logic, logic.length ? "Review" : "None", logic.some(function (item) { return item.severity === "warning" || item.severity === "error"; }) ? "warning" : "info");
      html += '<details class="rs-fg" ' + (optimization.length || (ai && ai.optimization) ? "open" : "") + "><summary><h3>Optimization</h3><span class=\"rs-cnt\">" +
        ((ai && ai.optimization) ? "1 proposal" : optimization.length + " findings") + '</span><span class="rs-sp"></span><span class="rs-badge rs-b-ai">AI assessment</span></summary>';
      html += optimization.map(findingCard).join("");
      if (ai && ai.optimization) {
        html += '<div class="rs-grid2 equal" style="margin-top:14px"><div><div class="rs-label">Original</div>' +
          renderCode(ai.optimization.before, "") +
          "</div><div><div class=\"rs-label\">Proposed</div>" + renderDiff(ai.optimization.before, ai.optimization.after) + "</div></div>";
        html += "<p class=\"rs-cnt\">" + esc(ai.optimization.note || "") + "</p>";
      }
      html += "</details>";
      var scenarios = (ai && ai.scenarios) || [];
      html += '<details class="rs-fg" ' + (scenarios.length ? "open" : "") + '><summary><h3>Test scenarios</h3><span class="rs-cnt">' +
        scenarios.length + ' scenarios</span><span class="rs-sp"></span><span class="rs-badge rs-b-sim">Simulated test</span></summary>';
      scenarios.forEach(function (scenario) {
        var status = scenario.status === "passed" ? "✓ Passed" : scenario.status === "failed" ? "✕ Failed" : "? Not verifiable";
        var cls = scenario.status === "passed" ? "rs-sev-l" : scenario.status === "failed" ? "rs-sev-h" : "rs-b-check";
        html += '<div class="rs-finding"><div class="rs-row"><b>' + esc(scenario.title) + '</b><span class="rs-sp"></span>' +
          '<span class="rs-badge ' + cls + '">' + status + "</span>" + sourceBadge("simulated") +
          (scenario.status === "not_verifiable"
            ? '<span class="rs-badge rs-b-jedox rs-tip" tabindex="0" aria-disabled="true">Confirmed in Jedox<span class="rs-tt">Not available yet. Confirming a result needs a real Jedox connection, planned for phase 3. Today, no rule is executed in Jedox.</span></span>'
            : "") +
          "</div>" + (scenario.detail ? "<p>" + esc(scenario.detail) + "</p>" : "") + "</div>";
      });
      html += "</details>";
      html += '<div class="rs-foot">No rule has been executed in Jedox. Badges show where each finding comes from: <b>Static check</b> (rule parser), <b>AI assessment</b>' +
        (mock ? " (mock provider, not a live model)" : " (model opinion)") +
        ', <b>Simulated test</b> (fictional values). <span class="rs-badge rs-b-jedox">Confirmed in Jedox</span> is disabled until phase 3.</div></article>';
      results.innerHTML = html;
      if (view && view._setLint) view._setLint(staticFindings);
      say(mode === "error" ? "Showing static checks." : "Analysis ready. " + suggestions + " findings. No rule was executed in Jedox.");
    }

    function section(title, items, badge, severity) {
      return '<details class="rs-fg" ' + (items.length ? "open" : "") + "><summary><h3>" + title + "</h3><span class=\"rs-cnt\">" +
        items.length + (items.length === 1 ? " finding" : " findings") + '</span><span class="rs-sp"></span><span class="rs-badge ' +
        severityClass(severity) + '">' + esc(badge) + "</span></summary>" +
        (items.length ? items.map(findingCard).join("") : '<p class="rs-cnt">Nothing in this group.</p>') + "</details>";
    }

    function showEmpty() {
      results.innerHTML = '<div class="rs-card rs-state" style="align-items:center;justify-content:center;text-align:center">' +
        '<h3>No rule yet</h3><p class="rs-cnt" style="max-width:40ch">Paste a Jedox rule above or load a fictional example to see syntax, performance and logic findings.</p>' +
        '<button type="button" class="rs-btn rs-sec" id="rs-empty-load">Load example</button></div>';
      var button = document.getElementById("rs-empty-load");
      if (button) button.addEventListener("click", loadFirstExample);
    }

    function showLoading() {
      results.innerHTML = '<div class="rs-card rs-state" aria-busy="true"><div class="rs-row"><h3>Loading</h3><span class="rs-sp"></span><span class="rs-badge rs-b-static">Static check running</span></div>' +
        '<p class="rs-cnt" role="status">Checking syntax, then asking the AI provider…</p>' +
        '<div class="rs-grid4"><div class="rs-sk" style="height:64px"></div><div class="rs-sk" style="height:64px"></div><div class="rs-sk" style="height:64px"></div><div class="rs-sk" style="height:64px"></div></div>' +
        '<div class="rs-sk" style="width:70%"></div><div class="rs-sk" style="width:90%"></div></div>';
    }

    function showError(message, detail) {
      results.innerHTML = '<div class="rs-card rs-state rs-error" role="alert"><div class="rs-row"><h3>Error</h3><span class="rs-badge rs-sev-h">✕ Error</span></div>' +
        "<p>" + esc(message) + "</p><p class=\"rs-cnt\">" + esc(detail || "Your rule was not stored.") + "</p>" +
        '<div class="rs-row"><button type="button" class="rs-btn rs-sec" id="rs-show-static">Show static results</button></div></div>';
      document.getElementById("rs-show-static").addEventListener("click", function () {
        renderResults(lastStatic, { mock: true, label: "Mock provider – not real AI", findings: [], scenarios: [] });
      });
    }

    function historyOn() {
      return localStorage.getItem(HISTORY_FLAG) === "1";
    }

    function readHistory() {
      try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
      catch (error) { return []; }
    }

    function writeHistory(items) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
      drawHistory();
    }

    function remember(entry) {
      if (!historyOn()) return;
      var items = readHistory();
      items.unshift(entry);
      writeHistory(items);
    }

    function drawHistory() {
      var list = document.getElementById("rs-history-list");
      var items = historyOn() ? readHistory() : [];
      if (!items.length) {
        list.innerHTML = '<li class="rs-cnt">Nothing saved in this browser.</li>';
        return;
      }
      list.innerHTML = items.map(function (item, index) {
        return "<li><span class=\"rs-badge " + (item.kind === "generate" ? "rs-b-ai" : "rs-b-static") + "\">" +
          esc(item.kind === "generate" ? "Generate" : "Test") + "</span><span>" + esc(item.title) +
          '</span><span class="rs-sp rs-cnt">' + esc(item.note || "") + '</span><button type="button" class="rs-btn rs-sec" data-open="' + index + '">Open</button></li>';
      }).join("");
      list.querySelectorAll("[data-open]").forEach(function (button) {
        button.addEventListener("click", function () {
          var item = readHistory()[Number(button.getAttribute("data-open"))];
          if (!item) return;
          if (item.kind === "generate") {
            document.getElementById("rs-story").value = item.story || "";
            document.getElementById("rs-target").value = item.cube || "";
            selectTab(document.getElementById("t-gen"));
          }
          setRule(item.rule || "");
          if (item.cube) cubeSelect.value = item.cube;
        });
      });
    }

    function selectTab(tab) {
      root.querySelectorAll("[role=tab]").forEach(function (button) {
        var on = button === tab;
        button.setAttribute("aria-selected", on ? "true" : "false");
        button.tabIndex = on ? 0 : -1;
        document.getElementById(button.getAttribute("aria-controls")).hidden = !on;
      });
    }

    function loadExample(id) {
      var example = examplesDoc.examples.filter(function (item) { return item.id === id; })[0] || examplesDoc.examples[0];
      if (!example) return;
      setRule(example.rule);
      cubeSelect.value = example.cube;
      document.getElementById("rs-target").value = example.cube;
      dims = dimsFromCube(example.cube);
      drawDims();
      say("Loaded " + example.title + ". Fictional data only.");
    }

    function loadFirstExample() {
      if (!examplesDoc.examples.length) return;
      exampleSelect.value = examplesDoc.examples[0].id;
      loadExample(examplesDoc.examples[0].id);
    }

    function dimensionPayload() {
      return dims.map(function (dim) {
        return { name: dim.name, elements: dim.elements, level: dim.level, role: dim.role, roleHint: true };
      });
    }

    async function turnstileToken() {
      if (offline()) return "offline";
      var config = cfg();
      if (!config.turnstileSiteKey || !window.turnstile || widgetId == null) {
        throw new Error("Turnstile is not ready. Add the site key or clear the endpoint to stay offline.");
      }
      var token = window.turnstile.getResponse(widgetId);
      if (!token) throw new Error("Complete the Turnstile check, then try again.");
      return token;
    }

    async function post(path, body) {
      var token = await turnstileToken();
      body.turnstileToken = token;
      body.version = versionSelect.value;
      var response = await fetch(String(cfg().endpoint).replace(/\/$/, "") + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      var payload = await response.json();
      if (!response.ok || payload.ok === false) {
        var error = new Error(payload.message || "The request was not accepted.");
        error.payload = payload;
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    async function analyze() {
      var rule = ruleText().trim();
      if (!rule) {
        showEmpty();
        say("Paste a rule first.");
        return;
      }
      showLoading();
      var cube = selectedCube();
      var local = window.RuleChecks.checkRule(rule, {
        version: versionSelect.value,
        cube: cube,
        pack: pack,
        metadata: metadataForChecks()
      });
      lastStatic = local.findings;
      try {
        var ai;
        if (offline()) {
          await wait(280);
          ai = window.RuleMock.analyzeSync({ rule: rule, cube: cube, examples: examplesDoc.examples, staticFindings: local.findings });
        } else {
          var payload = await post("/analyze", { cube: cube, rule: rule, metadata: metadataForChecks() });
          ai = payload.ai;
          lastStatic = payload.staticFindings || local.findings;
        }
        lastAi = ai;
        renderResults(lastStatic, ai);
        remember({ kind: "test", title: cube + " rule", cube: cube, rule: rule, note: lastStatic.length + " static", at: Date.now() });
      } catch (error) {
        var payload = error.payload || {};
        lastStatic = payload.staticFindings || lastStatic;
        showError(payload.message || error.message, "Static checks still ran. Your rule was not stored.");
      }
    }

    function showClarification(ai) {
      var box = document.getElementById("rs-clarify");
      var questions = (ai.clarification && ai.clarification.questions) || [];
      box.hidden = false;
      box.innerHTML = '<h3>Needs your input</h3><span class="rs-badge rs-b-ai">? Clarification</span>' +
        "<p>Before generating a rule the mock provider needs a few details. This is not a live model.</p>" +
        questions.map(function (question, index) {
          var choices = (question.choices || []).slice(0, 12).map(function (choice) {
            return '<option>' + esc(choice) + "</option>";
          }).join("");
          return '<label for="rs-q' + index + '">' + (index + 1) + ". " + esc(question.prompt) + "</label>" +
            (choices
              ? '<select class="rs-in" id="rs-q' + index + '" data-qid="' + esc(question.id) + '"><option value="">Choose</option>' + choices + "</select>"
              : '<input class="rs-in" id="rs-q' + index + '" data-qid="' + esc(question.id) + '">');
        }).join("") +
        '<div class="rs-row" style="margin-top:12px"><button type="button" class="rs-btn rs-pri" id="rs-continue">Continue</button></div>';
      document.getElementById("rs-continue").addEventListener("click", function () {
        var answers = {};
        box.querySelectorAll("[data-qid]").forEach(function (field) {
          answers[field.getAttribute("data-qid")] = field.value;
        });
        generate(answers);
      });
    }

    function renderDraft(ai) {
      var box = document.getElementById("rs-draft");
      if (ai.clarification) {
        box.hidden = true;
        showClarification(ai);
        say("The draft needs a clarification.");
        return;
      }
      document.getElementById("rs-clarify").hidden = true;
      box.hidden = false;
      var mock = ai.mock !== false;
      box.innerHTML = '<div class="rs-step"><span class="rs-num">3</span><h3>Draft rule</h3><span class="rs-sp"></span>' +
        (mock ? '<span class="rs-badge rs-b-mock">⚑ Mock provider – not real AI</span>' : '<span class="rs-badge rs-b-ai">AI assessment</span>') +
        "</div>" + renderCode(ai.rule, "") +
        '<dl class="rs-kv" style="margin-top:16px">' +
        "<dt>Explanation</dt><dd>" + esc(ai.explanation) + "</dd>" +
        "<dt>Target area</dt><dd><code>" + esc(ai.targetArea) + "</code></dd>" +
        "<dt>References</dt><dd>" + esc(ai.references) + "</dd>" +
        "<dt>Performance notes</dt><dd>" + esc(ai.performanceNotes) + "</dd>" +
        "<dt>Test ideas</dt><dd>" + esc(ai.testIdeas) + "</dd>" +
        "<dt>Assumptions</dt><dd>" + esc(ai.assumptions) + "</dd></dl>" +
        '<div class="rs-row" style="margin-top:12px"><button type="button" class="rs-btn rs-sec" id="rs-copy-draft">Copy</button>' +
        '<button type="button" class="rs-btn rs-sec" id="rs-download-draft">Download</button>' +
        '<button type="button" class="rs-btn rs-sec" id="rs-use-draft">Use in editor</button></div>';
      document.getElementById("rs-copy-draft").addEventListener("click", function () { copyText(ai.rule); });
      document.getElementById("rs-download-draft").addEventListener("click", function () { downloadText(ai.rule); });
      document.getElementById("rs-use-draft").addEventListener("click", function () {
        setRule(ai.rule);
        selectTab(document.getElementById("t-test"));
      });
      var local = window.RuleChecks.checkRule(ai.rule, {
        version: versionSelect.value,
        cube: document.getElementById("rs-target").value,
        pack: pack,
        metadata: metadataForChecks()
      });
      renderResults(local.findings, window.RuleMock.analyzeSync({ rule: ai.rule, cube: document.getElementById("rs-target").value, examples: examplesDoc.examples }));
      say("Draft ready. It is labelled mock and has not been executed in Jedox.");
    }

    async function generate(answers) {
      var story = document.getElementById("rs-story").value.trim();
      var cube = document.getElementById("rs-target").value.trim();
      showLoading();
      try {
        var ai;
        var input = {
          database: document.getElementById("rs-database").value.trim(),
          cube: cube,
          sourceCubes: document.getElementById("rs-sources").value.trim(),
          dimensions: dimensionPayload(),
          story: story,
          answers: answers || null,
          examples: examplesDoc.examples,
          metadata: metadataForChecks()
        };
        if (offline()) {
          await wait(280);
          ai = window.RuleMock.generateSync(input);
        } else {
          var payload = await post("/generate", input);
          ai = payload.ai;
        }
        renderDraft(ai);
        if (ai.rule) {
          remember({ kind: "generate", title: story.slice(0, 80) || cube, cube: cube, rule: ai.rule, story: story, note: "1 rule", at: Date.now() });
        }
      } catch (error) {
        showError((error.payload && error.payload.message) || error.message, "No rule was stored.");
      }
    }

    async function refine() {
      var before = ruleText();
      var chips = [];
      root.querySelectorAll(".rs-chip[aria-pressed=true]").forEach(function (chip) { chips.push(chip.textContent.trim()); });
      var instruction = document.getElementById("rs-instruction").value.trim();
      var cube = document.getElementById("rs-target").value.trim() || selectedCube();
      try {
        var ai;
        if (offline()) {
          ai = window.RuleMock.refineSync({ rule: before, chips: chips, instruction: instruction, cube: cube, examples: examplesDoc.examples });
        } else {
          var payload = await post("/refine", { rule: before, chips: chips, instruction: instruction, cube: cube });
          ai = payload.ai;
        }
        if (ai.mock === false) {
          /* A live provider may return a rule. The badge stays off only then. */
        }
        setRule(ai.rule || before);
        var host = document.getElementById("rs-refine-diff");
        host.hidden = false;
        host.innerHTML = '<div class="rs-grid2 equal"><div><div class="rs-label">Before</div>' + renderCode(before, "rs-del") +
          '</div><div><div class="rs-label">After</div>' + renderDiff(before, ai.rule || before) + "</div></div>" +
          '<p class="rs-cnt">' + esc(ai.explanation || "") + (ai.mock !== false ? " Mock provider – not real AI." : "") + "</p>";
        say("Refine draft ready.");
      } catch (error) {
        showError((error.payload && error.payload.message) || error.message);
      }
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say("Copied."); }, function () { say("Copy failed."); });
      }
    }

    function downloadText(text) {
      var blob = new Blob([text], { type: "text/plain" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "fdh-demo-rule.txt";
      link.click();
      URL.revokeObjectURL(link.href);
    }

    function wait(ms) {
      return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
    }

    function parseMetadata(text) {
      var raw = text.trim();
      if (!raw) return null;
      if (raw.charAt(0) === "{" || raw.charAt(0) === "[") {
        var data = JSON.parse(raw);
        if (data.metadata) return data.metadata;
        return data;
      }
      var rows = raw.split(/\r?\n/).filter(Boolean);
      var header = rows[0].toLowerCase();
      var start = header.indexOf("dimension") >= 0 ? 1 : 0;
      var built = { database: examplesDoc.metadata.database, cubes: {}, elements: {} };
      var cube = document.getElementById("rs-target").value.trim() || selectedCube();
      built.cubes[cube] = [];
      for (var i = start; i < rows.length; i++) {
        var cells = rows[i].split(",").map(function (cell) { return cell.trim(); });
        if (!cells[0]) continue;
        built.cubes[cube].push(cells[0]);
        built.elements[cells[0]] = (cells[1] || "").split(/[;|]/).map(function (part) { return part.trim(); }).filter(Boolean);
        dims.push({ name: cells[0], elements: cells[1] || "", level: cells[2] || "Base", role: cells[3] || roleFor(cells[0]) });
      }
      return built;
    }

    function bind() {
      root.querySelectorAll("[role=tab]").forEach(function (tab) {
        tab.addEventListener("click", function () { selectTab(tab); });
      });
      document.getElementById("rs-analyze").addEventListener("click", analyze);
      document.getElementById("rs-generate").addEventListener("click", function () { generate(null); });
      document.getElementById("rs-refine").addEventListener("click", refine);
      document.getElementById("rs-copy").addEventListener("click", function () { copyText(ruleText()); });
      document.getElementById("rs-download").addEventListener("click", function () { downloadText(ruleText()); });
      document.getElementById("rs-reset").addEventListener("click", function () {
        setRule("");
        document.getElementById("rs-story").value = "";
        document.getElementById("rs-draft").hidden = true;
        document.getElementById("rs-refine-diff").hidden = true;
        document.getElementById("rs-clarify").hidden = true;
        showEmpty();
        say("Cleared.");
      });
      exampleSelect.addEventListener("change", function () {
        if (exampleSelect.value) loadExample(exampleSelect.value);
      });
      cubeSelect.addEventListener("change", function () {
        document.getElementById("rs-target").value = cubeSelect.value;
      });
      document.getElementById("rs-target").addEventListener("change", function () {
        var name = document.getElementById("rs-target").value.trim();
        if ((examplesDoc.metadata.cubes || {})[name]) {
          cubeSelect.value = name;
          dims = dimsFromCube(name);
          drawDims();
        }
      });
      document.getElementById("rs-add-dim").addEventListener("click", function () {
        dims.push({ name: "", elements: "", level: "Base", role: "Other" });
        drawDims();
      });
      document.getElementById("rs-meta-toggle").addEventListener("click", function () {
        var box = document.getElementById("rs-meta-box");
        box.hidden = !box.hidden;
      });
      document.getElementById("rs-meta-apply").addEventListener("click", function () {
        var previous = dims.slice();
        try {
          dims = [];
          pasted = parseMetadata(document.getElementById("rs-meta").value);
          if (!dims.length) dims = dimsFromCube(document.getElementById("rs-target").value.trim() || selectedCube());
          drawDims();
          say("Metadata applied for the next check.");
        } catch (error) {
          dims = previous;
          say("That metadata could not be read. Use JSON or CSV.");
        }
      });
      root.querySelectorAll(".rs-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
        });
      });
      var historySwitch = document.getElementById("rs-history-switch");
      historySwitch.setAttribute("aria-checked", historyOn() ? "true" : "false");
      historySwitch.addEventListener("click", function () {
        var on = !historyOn();
        localStorage.setItem(HISTORY_FLAG, on ? "1" : "0");
        historySwitch.setAttribute("aria-checked", on ? "true" : "false");
        drawHistory();
      });
      document.getElementById("rs-history-delete").addEventListener("click", function () {
        localStorage.removeItem(HISTORY_KEY);
        drawHistory();
        say("History deleted from this browser.");
      });
      var siteKey = cfg().turnstileSiteKey;
      if (!offline() && siteKey && window.turnstile) {
        widgetId = window.turnstile.render("#rs-turnstile", { sitekey: siteKey });
      } else if (!offline() && siteKey) {
        var script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.onload = function () {
          widgetId = window.turnstile.render("#rs-turnstile", { sitekey: siteKey });
        };
        document.head.appendChild(script);
      }
    }

    fetch("pack/jedox-rules-2026.1.json")
      .then(function (response) { return response.json(); })
      .then(function (loaded) {
        pack = loaded;
        return fetch("pack/examples-2026.1.json");
      })
      .then(function (response) { return response.json(); })
      .then(function (loaded) {
        examplesDoc = loaded;
        mountEditor();
        fillChrome();
        bind();
        showEmpty();
        drawHistory();
        countLines();
      })
      .catch(function () {
        results.innerHTML = '<div class="rs-card rs-error" role="alert"><h3>Error</h3><p>The knowledge pack did not load. The page needs the pack files next to this article.</p></div>';
      });
  });
})();
