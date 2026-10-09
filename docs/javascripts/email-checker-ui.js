/* Checker page. The pasted script stays in the browser. */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var root = document.getElementById("email-checker");
    if (!root || !globalThis.EmailChecker || !globalThis.EmailShared || !globalThis.EmailCheckMessages) return;

    var checker = globalThis.EmailChecker;
    var shared = globalThis.EmailShared;
    var copy = globalThis.EmailCheckMessages;
    var input = document.getElementById("email-script-input");
    var highlight = document.getElementById("email-highlight");
    var gutter = document.getElementById("email-gutter");
    var list = document.getElementById("email-issue-list");
    var pills = document.getElementById("email-pills");
    var banner = document.getElementById("email-banner");
    var sticky = document.getElementById("email-checker-sticky");
    var scriptType = "job";
    var checkedOnce = false;

    function typeLabel(severity) {
      return copy.labels[severity];
    }

    function countText(count, one, many) {
      return count + " " + (count === 1 ? one : many);
    }

    function renderEditor(text, issues) {
      var lines = String(text).split("\n");
      var byLine = {};
      function issueLines(issue) {
        if (!issue.items) return [issue.line];
        var lines = [];
        issue.items.forEach(function (item) {
          item.lines.forEach(function (lineNo) {
            if (lines.indexOf(lineNo) < 0) lines.push(lineNo);
          });
        });
        return lines.length ? lines : [issue.line];
      }
      issues.forEach(function (issue) {
        issueLines(issue).forEach(function (lineNo) {
          var current = byLine[lineNo];
          if (!current) byLine[lineNo] = issue;
          else if (issue.severity === "error") byLine[lineNo] = issue;
          else if (issue.severity === "warning" && current.severity === "check") byLine[lineNo] = issue;
        });
      });
      var code = "";
      var gut = "";
      lines.forEach(function (line, index) {
        var issue = byLine[index + 1];
        var kind = issue ? issue.severity : "";
        var cls = kind ? " is-" + (kind === "check" ? "check" : kind === "warning" ? "warning" : "error") : "";
        var icon = issue ? issue.icon : "";
        var label = issue ? typeLabel(issue.severity) : "";
        code += "<div class=\"email-line" + cls + "\" title=\"" + shared.escapeHtml(label) + "\">" +
          "<span class=\"email-wavy\">" + (shared.highlightGroovy(line) || " ") + "</span></div>";
        gut += "<div class=\"email-gline" + cls + "\">" +
          "<span class=\"email-gicon\" title=\"" + shared.escapeHtml(label) + "\">" + shared.escapeHtml(icon) + "</span>" +
          "<span class=\"email-gnum\">" + (index + 1) + "</span></div>";
      });
      highlight.innerHTML = code;
      gutter.innerHTML = gut;
      syncScroll();
    }

    function scrollToLine(lineNo) {
      var lines = highlight.querySelectorAll(".email-line");
      var line = lines[lineNo - 1];
      if (!line || !lines.length) return;
      var pitch = lines[0].getBoundingClientRect().height || 22.1;
      input.scrollTop = Math.max(0, (lineNo - 1) * pitch - (input.clientHeight - pitch) / 2);
      syncScroll();
    }

    function syncScroll() {
      var x = -input.scrollLeft;
      var y = -input.scrollTop;
      highlight.style.transform = "translate(" + x + "px," + y + "px)";
      gutter.style.transform = "translateY(" + y + "px)";
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
        var list = document.createElement("ul");
        list.className = "email-name-list";
        issue.items.forEach(function (item) {
          var row = document.createElement("li");
          var where = item.lines.length === 1 ? "line " + item.lines[0] : "lines " + item.lines.join(", ");
          row.innerHTML = "<code>" + shared.escapeHtml(item.name) + "</code> · " + shared.escapeHtml(where);
          row.addEventListener("click", function (event) {
            event.stopPropagation();
            scrollToLine(item.lines[0]);
          });
          list.appendChild(row);
        });
        article.appendChild(list);
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
        if (checkedOnce) showBanner(copy.empty);
      } else if (result.notGroovy) {
        showBanner(copy.notGroovy);
      } else if (!errors.length && !warnings.length) {
        var heading = document.createElement("h3");
        heading.textContent = copy.noProblems.heading;
        var note = document.createElement("p");
        var nameCount = checks.reduce(function (sum, issue) {
          return sum + (issue.items ? issue.items.length : 1);
        }, 0);
        note.textContent = checks.length
          ? copy.noProblems.withChecks.replace("{n}", String(nameCount))
          : copy.noProblems.text;
        list.appendChild(heading);
        list.appendChild(note);
      }
      result.issues.forEach(function (issue) { list.appendChild(card(issue)); });

      if (sticky) {
        var open = root.classList.contains("is-panel-open");
        var total = result.issues.length;
        sticky.textContent = open ? "Back to script" : (total ? "Issues (" + total + ")" : "Issues");
      }
    }

    function runCheck() {
      checkedOnce = true;
      var result = checker.checkScript(input.value, { scriptType: scriptType });
      renderEditor(input.value, result.empty ? [] : result.issues);
      renderIssues(result);
    }

    input.addEventListener("input", runCheck);
    input.addEventListener("scroll", syncScroll);

    root.querySelectorAll(".email-seg-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        scriptType = button.getAttribute("data-script-type");
        root.querySelectorAll(".email-seg-btn").forEach(function (item) {
          var on = item === button;
          item.classList.toggle("is-on", on);
          item.setAttribute("aria-checked", on ? "true" : "false");
        });
        runCheck();
      });
    });

    document.getElementById("email-check-btn").addEventListener("click", function () {
      runCheck();
      list.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
    document.getElementById("email-example-btn").addEventListener("click", function () {
      input.value = checker.EXAMPLE_SCRIPT;
      runCheck();
    });
    document.getElementById("email-clear-btn").addEventListener("click", function () {
      input.value = "";
      runCheck();
    });

    if (sticky) {
      sticky.addEventListener("click", function () {
        var open = root.classList.toggle("is-panel-open");
        sticky.setAttribute("aria-expanded", open ? "true" : "false");
        runCheck();
      });
    }

    renderEditor("", []);
    renderIssues({ empty: true, notGroovy: false, truncated: false, lineLimit: checker.MAX_LINES, issues: [] });
  });
})();
