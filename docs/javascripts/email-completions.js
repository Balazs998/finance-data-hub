/* Autocomplete for the email checker. Only calls the checker already
   understands, plus the job variables from the value-email post.
   The 3-argument setServer() call is deprecated and is not offered. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailCompletions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var JEDOX_CALLS = [
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

  function suggestions() {
    return JEDOX_CALLS.map(function (label) {
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
    JEDOX_CALLS: JEDOX_CALLS,
    JOB_VARIABLES: JOB_VARIABLES,
    MAX_ROWS: MAX_ROWS,
    suggestions: suggestions,
    matching: matching,
    visible: visible
  };
});
