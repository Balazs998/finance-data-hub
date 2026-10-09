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

  function statusBar(result) {
    var issues = result && result.issues ? result.issues : [];
    if (!result || result.empty || result.notGroovy) return { state: "hidden", text: "" };
    if (!issues.length) return { state: "clear", text: "✓ No problems found" };
    return { state: "issues", text: "Issues (" + issues.length + ")" };
  }

  return {
    QUIET_MS: QUIET_MS,
    STACK_BELOW: STACK_BELOW,
    DROPDOWN_MIN_WIDTH: DROPDOWN_MIN_WIDTH,
    createLiveLint: createLiveLint,
    dropdownEnabled: dropdownEnabled,
    issuesBelowEditor: issuesBelowEditor,
    howDetailsOpen: howDetailsOpen,
    statusBar: statusBar
  };
});