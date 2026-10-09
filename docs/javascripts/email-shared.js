/* Shared helpers for the email builder and checker.
   No network calls. Marker filling follows send_value_emails.groovy. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailShared = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "$": "&#36;",
    "{": "&#123;",
    "}": "&#125;"
  };

  /* The eight names the builder tags as a job variable. The value-email
     post defines these, so the checker treats them as known. */
  var KNOWN_JOB_VARIABLES = [
    "TEST_MODE",
    "RECIPIENT_TEST",
    "PERIOD",
    "VERSION_PLAN",
    "VERSION_ACTUAL",
    "SUBJECT_TEMPLATE",
    "COLOR_VARIANCE",
    "SOURCE_EXTRACT"
  ];

  /* Documented Integrator calls on API. Anything else, including an
     unfinished name like API.getM, is a name to check. */
  var DOCUMENTED_API_MEMBERS = [
    "getMailer",
    "initSource",
    "getProperty",
    "getSource"
  ];

  var WORDING_MARKERS = {
    COST_CENTER: true,
    COST_CENTER_NAME: true,
    OWNER_NAME: true,
    OWNER_EMAIL: true,
    PERIOD: true,
    VERSION_PLAN: true,
    VERSION_ACTUAL: true
  };

  var TEMPLATE_MARKERS = {
    SUBJECT: true,
    HEADER_LABEL: true,
    TITLE: true,
    PERIOD: true,
    VERSION: true,
    GREETING: true,
    INTRO: true,
    HEADER_CELLS: true,
    TABLE_ROWS: true,
    TOTAL_CELLS: true,
    NOTE: true,
    FOOTER: true
  };

  /* Cell snippets in the tested script fill these too. */
  var ENGINE_MARKERS = {
    LABEL: true,
    VALUE: true,
    NUMBER: true
  };

  var KNOWN_SCRIPT_MARKERS = {};
  [WORDING_MARKERS, TEMPLATE_MARKERS, ENGINE_MARKERS].forEach(function (set) {
    Object.keys(set).forEach(function (name) {
      KNOWN_SCRIPT_MARKERS[name] = true;
    });
  });

  function escapeHtml(value) {
    if (value == null) return "";
    var text = String(value);
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      out += Object.prototype.hasOwnProperty.call(HTML_ESCAPES, ch) ? HTML_ESCAPES[ch] : ch;
    }
    return out;
  }

  function groovyQuote(value) {
    var escaped = String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r\n|\n|\r/g, "\\n")
      .replace(/\t/g, "\\t");
    return "'" + escaped + "'";
  }

  function fillMarkers(template, values) {
    var out = "";
    var pos = 0;
    var source = String(template);
    while (true) {
      var start = source.indexOf("{{", pos);
      if (start < 0) {
        out += source.slice(pos);
        break;
      }
      var end = source.indexOf("}}", start + 2);
      if (end < 0) {
        throw new Error("Unclosed {{ marker at position " + start);
      }
      var name = source.slice(start + 2, end);
      if (!Object.prototype.hasOwnProperty.call(values, name)) {
        throw new Error("No value for marker {{" + name + "}}");
      }
      out += source.slice(pos, start);
      var value = values[name];
      out += value == null ? "" : String(value);
      pos = end + 2;
    }
    return out;
  }

  /* Problems in a visitor-typed field. An open {{ is reported and not escaped. */
  function fieldMarkerIssues(text, allowed) {
    var issues = [];
    var source = String(text);
    var pos = 0;
    while (pos < source.length) {
      var start = source.indexOf("{{", pos);
      if (start < 0) break;
      var end = source.indexOf("}}", start + 2);
      var nested = source.indexOf("{{", start + 2);
      if (end < 0 || (nested >= 0 && nested < end)) {
        issues.push({ type: "unclosed" });
        break;
      }
      var name = source.slice(start + 2, end);
      if (!Object.prototype.hasOwnProperty.call(allowed, name)) {
        issues.push({ type: "unknown", name: name });
      }
      pos = end + 2;
    }
    if (source.indexOf("${") >= 0) issues.push({ type: "dollar" });
    return issues;
  }

  function hasUnclosedMarker(text) {
    return fieldMarkerIssues(text, KNOWN_SCRIPT_MARKERS).some(function (issue) {
      return issue.type === "unclosed";
    });
  }

  /* Phone builder: smooth scroll, unless the reader asked for less motion.
     The margin keeps the sticky site header from covering the target. */
  function scrollBehavior(reducedMotion) {
    return reducedMotion ? "auto" : "smooth";
  }

  function previewScrollMargin(headerHeight) {
    var height = Number(headerHeight);
    if (!isFinite(height) || height < 0) height = 0;
    return Math.round(height) + 12;
  }

  function returnField(lastEdited, firstField) {
    return lastEdited || firstField;
  }

  function formatCents(cents) {
    var negative = cents < 0;
    var abs = Math.abs(cents);
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var body = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (negative ? "-" : "") + body + "." + (frac < 10 ? "0" : "") + frac;
  }

  function escapeText(text) {
    return escapeHtml(text);
  }

  function highlightGroovy(line) {
    var keywords = {
      def: true, if: true, else: true, while: true, for: true, return: true,
      new: true, throw: true, true: true, false: true, null: true, in: true
    };
    var html = "";
    var re = /\/\/.*$|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_][\w]*|\s+|./g;
    var match;
    while ((match = re.exec(String(line)))) {
      var token = match[0];
      var cls = "";
      if (token.slice(0, 2) === "//") cls = "tok-cmt";
      else if (token.charAt(0) === "'" || token.charAt(0) === '"') cls = "tok-str";
      else if (keywords[token]) cls = "tok-key";
      var safe = escapeHtml(token);
      html += cls ? '<span class="' + cls + '">' + safe + "</span>" : safe;
    }
    return html;
  }

  function inlineCode(text) {
    var html = "";
    var source = String(text);
    var re = /`([^`]+)`/g;
    var last = 0;
    var match;
    while ((match = re.exec(source))) {
      html += escapeHtml(source.slice(last, match.index));
      html += "<code>" + escapeHtml(match[1]) + "</code>";
      last = match.index + match[0].length;
    }
    html += escapeHtml(source.slice(last));
    return html;
  }

  return {
    highlightGroovy: highlightGroovy,
    inlineCode: inlineCode,
    HTML_ESCAPES: HTML_ESCAPES,
    KNOWN_JOB_VARIABLES: KNOWN_JOB_VARIABLES,
    DOCUMENTED_API_MEMBERS: DOCUMENTED_API_MEMBERS,
    WORDING_MARKERS: WORDING_MARKERS,
    TEMPLATE_MARKERS: TEMPLATE_MARKERS,
    KNOWN_SCRIPT_MARKERS: KNOWN_SCRIPT_MARKERS,
    scrollBehavior: scrollBehavior,
    previewScrollMargin: previewScrollMargin,
    returnField: returnField,
    escapeHtml: escapeHtml,
    escapeText: escapeText,
    groovyQuote: groovyQuote,
    fillMarkers: fillMarkers,
    fieldMarkerIssues: fieldMarkerIssues,
    hasUnclosedMarker: hasUnclosedMarker,
    formatCents: formatCents
  };
});
