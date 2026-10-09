/* Autocomplete for the email checker. Documented Jedox calls, plus the
   job variables from the value-email post. A call is offered only when
   the checker does not flag it: rules whose signed-off text says the
   call is deprecated, or whose before-example drops the call, are probed
   against a clean job. The 3-argument setServer() and API.getSource()
   fail that probe and are not offered. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailCompletions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function load(file, globalName) {
    if (typeof module === "object" && module.exports) return require("./" + file);
    return globalThis[globalName];
  }

  var CANDIDATES = [
    "API.getMailer()",
    "API.initSource()",
    "API.getProperty()",
    "API.getSource()",
    "addRecipient()",
    "addCcRecipient()",
    "addBccRecipient()",
    "reset()",
    "send()",
    "setSubject()",
    "setHtmlMessage()",
    "setMessage()",
    "setMessage(html)",
    "setServer('smtp.example.com', 'user', 'secret')",
    "setSMTPServer('smtp.example.com')",
    "setSender('reports@example.com')",
    "nextRow()",
    "close()",
    "getColumnString()",
    "getColumnValue()",
    "getColumnDouble()",
    "getColumnInt()",
    "getColumnLong()",
    "readFile()",
    "readBinary()",
    "readText()",
    "setting()"
  ];

  var JOB_VARIABLES = [
    "TEST_MODE",
    "RECIPIENT_TEST",
    "PERIOD",
    "VERSION_PLAN",
    "VERSION_ACTUAL",
    "SUBJECT_TEMPLATE",
    "COLOR_VARIANCE",
    "SOURCE_EXTRACT",
    "TEMPLATE_FILE",
    "RECIPIENTS_FILE",
    "ACCOUNTS_FILE",
    "COST_CENTERS_FILE"
  ];

  var MAX_ROWS = 8;
  var blockCache = {};
  var allowedCalls = null;

  function callNames(text) {
    var found = [];
    var re = /([A-Za-z_][\w.]*)\s*\(/g;
    var match;
    while ((match = re.exec(String(text || "")))) {
      if (found.indexOf(match[1]) < 0) found.push(match[1]);
    }
    return found;
  }

  function wrongCallRules(rules) {
    var source = rules || load("email-check-messages.js", "EmailCheckMessages").rules;
    var ids = [];
    Object.keys(source).forEach(function (id) {
      var spec = source[id];
      var before = callNames(spec.before);
      var after = callNames(spec.after);
      var removed = before.some(function (name) { return after.indexOf(name) < 0; });
      var blob = String(spec.title || "") + "\n" + String(spec.explanation || "");
      if (removed || blob.toLowerCase().indexOf("deprecat") >= 0) ids.push(id);
    });
    return ids;
  }

  function probeLines(snippet) {
    var text = String(snippet);
    var lines = [text];
    var callee = /^([A-Za-z_][\w.]*)\s*\(/.exec(text);
    var name = callee ? callee[1] : text;
    if (name.indexOf(".") < 0) lines.push("mailer." + text);
    return lines;
  }

  function blockedByChecker(snippet) {
    var key = String(snippet);
    if (Object.prototype.hasOwnProperty.call(blockCache, key)) return blockCache[key];
    var checker = load("email-checker-core.js", "EmailChecker");
    var bad = wrongCallRules();
    function badRules(script) {
      return checker.checkScript(script, { scriptType: "job" }).issues.filter(function (issue) {
        return bad.indexOf(issue.rule) >= 0;
      });
    }
    var baseKeys = badRules(checker.CLEAN_SCRIPT).map(function (issue) {
      return issue.rule + "@" + issue.line;
    });
    var found = "";
    probeLines(snippet).some(function (line) {
      var extra = badRules(checker.CLEAN_SCRIPT + "\n" + line).filter(function (issue) {
        return baseKeys.indexOf(issue.rule + "@" + issue.line) < 0;
      });
      if (extra.length) {
        found = extra[0].rule;
        return true;
      }
      return false;
    });
    blockCache[key] = found;
    return found;
  }

  function allowedJedoxCalls() {
    if (allowedCalls) return allowedCalls;
    allowedCalls = CANDIDATES.filter(function (label) {
      return !blockedByChecker(label);
    });
    return allowedCalls;
  }

  function suggestions() {
    return allowedJedoxCalls().map(function (label) {
      return { label: label, detail: "Jedox API", apply: label };
    }).concat(JOB_VARIABLES.map(function (label) {
      return { label: label, detail: "job variable", apply: label };
    }));
  }

  function rank(label, query) {
    var value = label.toLowerCase();
    if (value.indexOf(query) === 0) return 0;
    var tail = value.slice(value.lastIndexOf(".") + 1);
    if (tail.indexOf(query) === 0) return 1;
    if (value.indexOf(query) >= 0) return 2;
    return 9;
  }

  function matching(query) {
    var q = String(query || "").trim().toLowerCase();
    var items = suggestions();
    if (!q) return items.slice();
    return items.filter(function (item) {
      return rank(item.label, q) < 9;
    }).sort(function (a, b) {
      return rank(a.label, q) - rank(b.label, q) || a.label.localeCompare(b.label);
    });
  }

  function visible(items) {
    return items.slice(0, MAX_ROWS);
  }

  return {
    CANDIDATES: CANDIDATES,
    JEDOX_CALLS: allowedJedoxCalls(),
    JOB_VARIABLES: JOB_VARIABLES,
    MAX_ROWS: MAX_ROWS,
    wrongCallRules: wrongCallRules,
    blockedByChecker: blockedByChecker,
    suggestions: suggestions,
    matching: matching,
    visible: visible
  };
});
