/* Quiet period for the checker. CodeMirror waits this long after the
   last keystroke, and the same helper is what the unit test drives. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailLiveLint = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var QUIET_MS = 400;
  var STACK_BELOW = 1100;
  var DROPDOWN_MIN_WIDTH = 640;

  function createLiveLint(delay, schedule, cancel) {
    var wait = delay == null ? QUIET_MS : delay;
    var setTimer = schedule || function (fn, ms) { return setTimeout(fn, ms); };
    var clearTimer = cancel || function (id) { clearTimeout(id); };
    var timer = null;
    var generation = 0;
    return {
      delay: wait,
      push: function (run) {
        generation += 1;
        var token = generation;
        if (timer != null) clearTimer(timer);
        timer = setTimer(function () {
          timer = null;
          if (token === generation) run();
        }, wait);
        return token;
      },
      cancel: function () {
        generation += 1;
        if (timer != null) clearTimer(timer);
        timer = null;
      },
      pending: function () {
        return timer != null;
      }
    };
  }

  function dropdownEnabled(width) {
    return width >= DROPDOWN_MIN_WIDTH;
  }

  function issuesBelowEditor(width) {
    return width < STACK_BELOW;
  }

  function howDetailsOpen(width) {
    return width >= DROPDOWN_MIN_WIDTH;
  }

  function isNameCheck(issue) {
    return issue.severity === "check" || issue.rule === "NAME";
  }

  function nameCount(issues) {
    return (issues || []).reduce(function (sum, issue) {
      if (!isNameCheck(issue)) return sum;
      return sum + (issue.items && issue.items.length ? issue.items.length : 1);
    }, 0);
  }

  function checkPillText(result) {
    var count = nameCount(result && result.issues);
    if (!count) return "";
    return (count === 1 ? "1 name" : count + " names") + " to check";
  }

  function formatLineCount(n) {
    return String(n == null ? 2000 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function checkedLinesNote(lineLimit) {
    return "Only the first " + formatLineCount(lineLimit) + " lines were checked.";
  }

  function cutoffClearText(lineLimit) {
    return "? No problems in the first " + formatLineCount(lineLimit) + " lines. The rest wasn't checked.";
  }

  function statusBar(result) {
    var issues = result && result.issues ? result.issues : [];
    if (!result || result.empty || result.notGroovy) return { state: "hidden", text: "" };
    if (result.truncated && !issues.length) {
      return { state: "cutoff", text: cutoffClearText(result.lineLimit) };
    }
    if (!issues.length) return { state: "clear", text: "✓ No problems found" };
    if (issues.every(isNameCheck)) {
      return {
        state: "names",
        text: "? No errors or warnings. " + checkPillText(result) + " in your Jedox, listed below."
      };
    }
    return { state: "issues", text: "Issues (" + issues.length + ")" };
  }

  /* A paste that fills an empty editor, or replaces the whole script,
     stays on line 1. The editor scroller is reset by the caller.
     A smaller paste leaves the cursor after the text that went in. */
  function pasteReplacesAll(from, to, docLength) {
    return docLength === 0 || (from === 0 && to === docLength);
  }

  function pasteChange(from, to, text, docLength) {
    var whole = pasteReplacesAll(from, to, docLength);
    var cursor = whole ? 0 : from + String(text).length;
    return {
      changes: { from: from, to: to, insert: text },
      selection: { anchor: cursor, head: cursor },
      scrollIntoView: !whole,
      userEvent: "input.paste",
      pinTop: whole
    };
  }

  return {
    QUIET_MS: QUIET_MS,
    STACK_BELOW: STACK_BELOW,
    DROPDOWN_MIN_WIDTH: DROPDOWN_MIN_WIDTH,
    createLiveLint: createLiveLint,
    dropdownEnabled: dropdownEnabled,
    issuesBelowEditor: issuesBelowEditor,
    howDetailsOpen: howDetailsOpen,
    nameCount: nameCount,
    checkPillText: checkPillText,
    formatLineCount: formatLineCount,
    checkedLinesNote: checkedLinesNote,
    cutoffClearText: cutoffClearText,
    statusBar: statusBar,
    pasteReplacesAll: pasteReplacesAll,
    pasteChange: pasteChange
  };
});