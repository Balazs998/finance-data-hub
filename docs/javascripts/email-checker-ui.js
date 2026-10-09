/* Checker page. The script stays in the browser. CodeMirror is the
   self-hosted bundle; linting waits until typing has stopped. */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var root = document.getElementById("email-checker");
    var cm = globalThis.EmailCodeMirror;
    if (!root || !cm || !globalThis.EmailChecker || !globalThis.EmailShared || !globalThis.EmailCheckMessages || !globalThis.EmailCompletions || !globalThis.EmailLiveLint) return;

    var checker = globalThis.EmailChecker;
    var shared = globalThis.EmailShared;
    var copy = globalThis.EmailCheckMessages;
    var completions = globalThis.EmailCompletions;
    var liveLint = globalThis.EmailLiveLint;
    var host = document.getElementById("email-editor");
    var list = document.getElementById("email-issue-list");
    var pills = document.getElementById("email-pills");
    var banner = document.getElementById("email-banner");
    var sticky = document.getElementById("email-checker-sticky");
    var statusLive = document.getElementById("email-status-live");
    var how = document.getElementById("email-how");
    var scriptType = "job";
    var sawEdit = false;
    var lintEpoch = 0;
    var lintSeen = 0;
    var completionCompartment = new cm.Compartment();
    var media = window.matchMedia("(max-width: " + (liveLint.DROPDOWN_MIN_WIDTH - 1) + "px)");

    function typeLabel(severity) {
      return copy.labels[severity];
    }

    function labelGutterMarkers(editorView) {
      editorView.dom.querySelectorAll(".cm-lint-marker").forEach(function (el) {
        var kind = "Check";
        var mark = "?";
        if (el.classList.contains("cm-lint-marker-error")) {
          kind = "Error";
          mark = "✕";
        } else if (el.classList.contains("cm-lint-marker-warning")) {
          kind = "Warning";
          mark = "!";
        }
        if (el.textContent !== mark) el.textContent = mark;
        if (el.getAttribute("role") !== "img") el.setAttribute("role", "img");
        if (el.getAttribute("aria-label") !== kind) el.setAttribute("aria-label", kind);
      });
    }

    function countText(count, one, many) {
      return count + " " + (count === 1 ? one : many);
    }

    function lineNumbersOf(issue) {
      if (!issue.items) return [issue.line];
      var lines = [];
      issue.items.forEach(function (item) {
        item.lines.forEach(function (lineNo) {
          if (lines.indexOf(lineNo) < 0) lines.push(lineNo);
        });
      });
      return lines.length ? lines : [issue.line];
    }

    function scrollToLine(lineNo) {
      if (!view || lineNo < 1 || lineNo > view.state.doc.lines) return;
      var pos = view.state.doc.line(lineNo).from;
      view.dispatch({
        selection: { anchor: pos },
        effects: cm.EditorView.scrollIntoView(pos, { y: "center" })
      });
      view.focus();
    }

    function card(issue) {
      var article = document.createElement("article");
      article.className = "email-issue is-" + (issue.severity === "warning" ? "warning" : issue.severity === "check" ? "check" : "error");
      var label = document.createElement("p");
      label.className = "email-issue-label";
      var listedLines = [];
      if (issue.items) {
        issue.items.forEach(function (item) {
          item.lines.forEach(function (lineNo) {
            if (listedLines.indexOf(lineNo) < 0) listedLines.push(lineNo);
          });
        });
      }
      label.textContent = issue.icon + " " + typeLabel(issue.severity) +
        (listedLines.length === 1 ? " · line " + listedLines[0] : listedLines.length ? "" : " · line " + issue.line);
      var title = document.createElement("h3");
      title.innerHTML = shared.inlineCode(issue.title);
      var body = document.createElement("p");
      body.innerHTML = shared.inlineCode(issue.explanation);
      article.appendChild(label);
      article.appendChild(title);
      article.appendChild(body);
      if (issue.fix) {
        var fix = document.createElement("p");
        fix.innerHTML = "<strong>Fix: </strong>" + shared.inlineCode(issue.fix);
        article.appendChild(fix);
      }
      if (issue.items && issue.items.length) {
        var names = document.createElement("ul");
        names.className = "email-name-list";
        issue.items.forEach(function (item) {
          var row = document.createElement("li");
          var where = item.lines.length === 1 ? "line " + item.lines[0] : "lines " + item.lines.join(", ");
          row.innerHTML = "<code>" + shared.escapeHtml(item.name) + "</code> · " + shared.escapeHtml(where);
          row.addEventListener("click", function (event) {
            event.stopPropagation();
            scrollToLine(item.lines[0]);
          });
          names.appendChild(row);
        });
        article.appendChild(names);
      }
      if (issue.before) {
        var pre = document.createElement("pre");
        var code = document.createElement("code");
        code.textContent = "// Before\n" + issue.before + "\n\n// After\n" + issue.after;
        pre.appendChild(code);
        article.appendChild(pre);
      }
      article.addEventListener("click", function () {
        scrollToLine(issue.line);
      });
      return article;
    }

    function renderIssues(result) {
      pills.textContent = "";
      list.textContent = "";
      banner.textContent = "";
      var errors = result.issues.filter(function (issue) { return issue.severity === "error"; });
      var warnings = result.issues.filter(function (issue) { return issue.severity === "warning"; });
      var checks = result.issues.filter(function (issue) { return issue.severity === "check"; });

      function pill(className, text) {
        var span = document.createElement("span");
        span.className = "email-pill " + className;
        span.textContent = text;
        pills.appendChild(span);
      }
      if (errors.length) pill("email-pill-error", countText(errors.length, "error", "errors"));
      if (warnings.length) pill("email-pill-warning", countText(warnings.length, "warning", "warnings"));
      if (checks.length) pill("email-pill-check", countText(checks.length, "check", "checks"));

      function showBanner(text) {
        banner.innerHTML = text ? shared.inlineCode(text) : "";
      }
      if (result.truncated) {
        showBanner(copy.tooLong.replace("{n}", String(result.lineLimit)));
      }
      if (result.empty) {
        if (sawEdit) showBanner(copy.empty);
      } else if (result.notGroovy) {
        showBanner(copy.notGroovy);
      } else if (!errors.length && !warnings.length && !checks.length) {
        var heading = document.createElement("h3");
        heading.textContent = copy.noProblems.heading;
        var note = document.createElement("p");
        note.textContent = copy.noProblems.text;
        list.appendChild(heading);
        list.appendChild(note);
      }
      result.issues.forEach(function (issue) { list.appendChild(card(issue)); });
      applyStatus(result);
    }

    function applyStatus(result) {
      if (!sticky) return;
      var bar = liveLint.statusBar(result);
      sticky.classList.toggle("is-clear", bar.state === "clear");
      sticky.classList.toggle("is-names", bar.state === "names");
      sticky.classList.toggle("is-issues", bar.state === "issues");
      sticky.hidden = bar.state === "hidden";
      sticky.textContent = bar.text;
      if (bar.state === "issues") sticky.setAttribute("aria-expanded", "false");
      else sticky.removeAttribute("aria-expanded");
      if (statusLive && statusLive.textContent !== bar.text) statusLive.textContent = bar.text;
    }

    function diagnosticsFor(state, result) {
      if (!result || result.empty || result.notGroovy) return [];
      var byLine = {};
      result.issues.forEach(function (issue) {
        lineNumbersOf(issue).forEach(function (lineNo) {
          if (!byLine[lineNo]) byLine[lineNo] = [];
          byLine[lineNo].push(issue);
        });
      });
      var rank = { error: 0, warning: 1, check: 2 };
      var severityName = { error: "error", warning: "warning", check: "info" };
      return Object.keys(byLine).map(function (key) {
        var lineNo = Number(key);
        if (lineNo < 1 || lineNo > state.doc.lines) return null;
        var found = byLine[lineNo].slice().sort(function (a, b) {
          return rank[a.severity] - rank[b.severity];
        });
        var line = state.doc.line(lineNo);
        var skip = line.text.search(/\S/);
        var from = skip < 0 ? line.from : line.from + skip;
        var to = line.to > from ? line.to : from;
        var lead = found[0];
        return {
          from: from,
          to: to,
          severity: severityName[lead.severity] || "info",
          message: lead.title.replace(/`/g, ""),
          renderMessage: function () {
            var box = document.createElement("div");
            box.className = "email-hover-stack";
            found.forEach(function (issue) {
              var article = document.createElement("article");
              article.className = "email-issue is-" + (issue.severity === "warning" ? "warning" : issue.severity === "check" ? "check" : "error");
              var label = document.createElement("p");
              label.className = "email-issue-label";
              label.textContent = issue.icon + " " + typeLabel(issue.severity);
              var title = document.createElement("h3");
              title.innerHTML = shared.inlineCode(issue.title);
              var body = document.createElement("p");
              body.innerHTML = shared.inlineCode(issue.explanation);
              article.appendChild(label);
              article.appendChild(title);
              article.appendChild(body);
              box.appendChild(article);
            });
            return box;
          }
        };
      }).filter(Boolean);
    }

    function lintSource(editorView) {
      var result = checker.checkScript(editorView.state.doc.toString(), { scriptType: scriptType });
      renderIssues(result);
      return diagnosticsFor(editorView.state, result);
    }

    function completionSource(context) {
      var word = context.matchBefore(/[A-Za-z_][\w.]*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;
      var query = word.text;
      var items = query ? completions.matching(query) : completions.suggestions();
      if (!items.length) return null;
      return {
        from: word.from,
        filter: false,
        options: items.map(function (item) {
          return { label: item.label, detail: item.detail, apply: item.apply };
        })
      };
    }

    function completionExtension() {
      if (!liveLint.dropdownEnabled(window.innerWidth)) return [];
      return cm.autocompletion({
        override: [completionSource],
        activateOnTyping: true,
        maxRenderedOptions: completions.MAX_ROWS,
        defaultKeymap: true,
        closeOnBlur: true,
        icons: false
      });
    }

    function focusables() {
      return Array.prototype.filter.call(document.querySelectorAll("a[href], button, input, textarea, select, [tabindex]"), function (el) {
        if (el.tabIndex < 0) return false;
        if (el.closest(".cm-tooltip")) return false;
        var style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function moveFocus(forward) {
      return function (editorView) {
        cm.closeCompletion(editorView);
        var items = focusables().filter(function (el) {
          return !editorView.dom.contains(el);
        });
        var found = null;
        if (forward) {
          items.some(function (el) {
            if (editorView.dom.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
              found = el;
              return true;
            }
            return false;
          });
        } else {
          items.forEach(function (el) {
            if (editorView.dom.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) found = el;
          });
        }
        if (!found) return false;
        found.focus();
        return true;
      };
    }

    var keys = cm.Prec.highest(cm.keymap.of([
      { key: "Tab", run: moveFocus(true), shift: moveFocus(false) },
      { key: "Escape", run: function (editorView) { return cm.closeCompletion(editorView); } }
    ]));

    var view = new cm.EditorView({
      parent: host,
      state: cm.EditorState.create({
        doc: "",
        extensions: [
          cm.EditorView.darkTheme.of(true),
          cm.EditorView.lineWrapping,
          cm.groovy(),
          cm.EditorView.contentAttributes.of({ "aria-label": "Your Groovy script", spellcheck: "false" }),
          cm.placeholder(host.getAttribute("data-placeholder") || ""),
          cm.lineNumbers(),
          cm.highlightActiveLine(),
          cm.highlightActiveLineGutter(),
          cm.drawSelection(),
          cm.history(),
          cm.tooltips({ parent: root }),
          cm.lintGutter(),
          cm.keymap.of(cm.defaultKeymap.concat(cm.historyKeymap)),
          keys,
          completionCompartment.of(completionExtension()),
          cm.linter(lintSource, {
            delay: liveLint.QUIET_MS,
            needsRefresh: function () {
              if (lintEpoch !== lintSeen) {
                lintSeen = lintEpoch;
                return true;
              }
              return false;
            }
          }),
          cm.EditorView.updateListener.of(function (update) {
            if (update.docChanged) sawEdit = true;
            labelGutterMarkers(update.view);
          })
        ]
      })
    });

    function relintNow() {
      lintEpoch += 1;
      view.dispatch({ effects: completionCompartment.reconfigure(completionExtension()) });
      cm.forceLinting(view);
    }

    function onWidthChange() {
      view.dispatch({ effects: completionCompartment.reconfigure(completionExtension()) });
      if (!liveLint.dropdownEnabled(window.innerWidth)) cm.closeCompletion(view);
    }

    if (media.addEventListener) media.addEventListener("change", onWidthChange);
    else if (media.addListener) media.addListener(onWidthChange);

    var howMedia = window.matchMedia("(max-width: " + (liveLint.DROPDOWN_MIN_WIDTH - 1) + "px)");
    function syncHow() {
      if (how) how.open = liveLint.howDetailsOpen(window.innerWidth);
    }
    syncHow();
    if (howMedia.addEventListener) howMedia.addEventListener("change", syncHow);
    else if (howMedia.addListener) howMedia.addListener(syncHow);

    root.querySelectorAll(".email-seg-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        scriptType = button.getAttribute("data-script-type");
        root.querySelectorAll(".email-seg-btn").forEach(function (item) {
          var on = item === button;
          item.classList.toggle("is-on", on);
          item.setAttribute("aria-checked", on ? "true" : "false");
        });
        sawEdit = true;
        relintNow();
      });
    });

    document.getElementById("email-example-btn").addEventListener("click", function () {
      sawEdit = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: checker.EXAMPLE_SCRIPT },
        selection: { anchor: 0 }
      });
      view.focus();
    });
    document.getElementById("email-clear-btn").addEventListener("click", function () {
      sawEdit = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "" }
      });
      view.focus();
    });

    if (sticky) {
      sticky.addEventListener("click", function () {
        var panel = document.getElementById("email-panel");
        if (panel) panel.scrollIntoView({ block: "start", behavior: "auto" });
        sticky.setAttribute("aria-expanded", "true");
      });
    }

    renderIssues({ empty: true, notGroovy: false, truncated: false, lineLimit: checker.MAX_LINES, issues: [] });
  });
})();
