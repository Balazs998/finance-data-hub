/* Builds the tested Jedox email script from form fields.
   The visitor's text stays in the browser. Nothing here fetches. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailGenerate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function load(file, globalName) {
    if (typeof module === "object" && module.exports) return require("./" + file);
    return globalThis[globalName];
  }

  var shared = load("email-shared.js", "EmailShared");
  var sources = load("email-sources.js", "EmailSources");

  var MESSAGES = {
    unclosed: "Close or remove the open {{",
    unknown: "`{{[NAME]}}` isn't a marker this script knows. Check the spelling, or pick one from the list. The script stops on markers it doesn't know.",
    dollar: "`${` is how Integrator writes its own variables, so it would be replaced before your script runs. For a value that changes per email, use a `{{...}}` marker instead.",
    subjectEmpty: "Add a subject. Even a short one like `{{COST_CENTER}} {{PERIOD}}` works.",
    subjectLong: "Keep the subject to 150 characters.",
    periodInvalid: "Use YYYY-MM, like 2026-03.",
    greetingEmpty: "No greeting. The email will start with the table text.",
    testEmpty: "Add a test address, so test emails have somewhere to go.",
    testInvalid: "That doesn't look like an email address. Try something like `test.recipient@example.com`.",
    previewFailed: "The preview couldn't be built from these settings. Undo the last change, or reset to the example.",
    copyFailed: "Copy failed. Select the text and press Ctrl+C.",
    copied: "Copied ✓",
    downloaded: "Downloaded. Next, follow the steps below.",
    downloadNote: "Fix the [field name] to download."
  };

  var FIELD_LABELS = {
    subject: "subject",
    greeting: "greeting",
    intro: "intro",
    note: "note",
    footer: "footer",
    testAddress: "test address",
    period: "period",
    versionPlan: "plan version",
    versionActual: "actual version",
    extractName: "extract name"
  };

  var FIELD_ORDER = [
    "subject",
    "greeting",
    "intro",
    "note",
    "footer",
    "testAddress",
    "period",
    "versionPlan",
    "versionActual",
    "extractName"
  ];

  var DIMENSIONS = {
    cost_center: {
      id: "cost_center",
      label: "Cost center",
      noun: "cost center",
      header: "Monthly cost center report",
      title: "Cost center {{COST_CENTER}} {{COST_CENTER_NAME}}"
    },
    entity: {
      id: "entity",
      label: "Entity",
      noun: "entity",
      header: "Monthly entity report",
      title: "Entity {{COST_CENTER}} {{COST_CENTER_NAME}}"
    },
    country: {
      id: "country",
      label: "Country",
      noun: "country",
      header: "Monthly country report",
      title: "Country {{COST_CENTER}} {{COST_CENTER_NAME}}"
    },
    kpi: {
      id: "kpi",
      label: "KPI",
      noun: "KPI",
      header: "Monthly KPI report",
      title: "KPI {{COST_CENTER}} {{COST_CENTER_NAME}}"
    }
  };

  function introFor(dimensionId) {
    var noun = (DIMENSIONS[dimensionId] || DIMENSIONS.cost_center).noun;
    return "Here are the {{PERIOD}} values for your " + noun + ", {{VERSION_ACTUAL}} against {{VERSION_PLAN}} by account.";
  }

  var DEFAULTS = {
    dimension: "cost_center",
    subject: "{{COST_CENTER}} {{VERSION_ACTUAL}} vs {{VERSION_PLAN}}, {{PERIOD}}",
    greeting: "Hello {{OWNER_NAME}},",
    intro: introFor("cost_center"),
    note: "Variance is {{VERSION_ACTUAL}} minus {{VERSION_PLAN}}. Highlighted variances are unfavorable for that account type. Sample data only.",
    footer: "Sent automatically by a Jedox Integrator job.",
    testMode: true,
    testAddress: "test.recipient@example.com",
    period: "2026-03",
    versionPlan: "Budget",
    versionActual: "Actual",
    colorVariance: true,
    extractName: "PnL_BudgetActual"
  };

  var WORDING_FIELDS = {
    subject: true,
    greeting: true,
    intro: true,
    note: true,
    footer: true
  };

  var SAMPLE_ROWS = [
    { name: "Salaries", type: "EXPENSE", plan: 422360, actual: 441666 },
    { name: "Travel", type: "EXPENSE", plan: 3652071, actual: 4338767 },
    { name: "IT & Software", type: "EXPENSE", plan: 1186587, actual: 1109374 },
    { name: "Consulting", type: "EXPENSE", plan: 1215692, actual: 1197240 },
    { name: "Rent & Facilities", type: "EXPENSE", plan: 2653522, actual: 2613206 }
  ];

  var TH_LEFT = '<th align="left" style="padding:8px 10px;border-bottom:2px solid #1F2933;font-size:12px;text-transform:uppercase;color:#52606D;">{{LABEL}}</th>';
  var TH_RIGHT = '<th align="right" style="padding:8px 10px;border-bottom:2px solid #1F2933;font-size:12px;text-transform:uppercase;color:#52606D;">{{LABEL}}</th>';
  var TD_TEXT = '<td align="left" style="padding:8px 10px;border-bottom:1px solid #E4E9EE;">{{VALUE}}</td>';
  var TD_NUMBER = '<td align="right" style="padding:8px 10px;border-bottom:1px solid #E4E9EE;font-family:Consolas,Menlo,monospace;">{{NUMBER}}</td>';
  var TD_NUMBER_UNFAVORABLE = '<td align="right" style="padding:8px 10px;border-bottom:1px solid #E4E9EE;font-family:Consolas,Menlo,monospace;color:#C2410C;">{{NUMBER}}</td>';
  var TD_TOTAL = '<td align="right" style="padding:10px;border-top:2px solid #1F2933;font-weight:bold;font-family:Consolas,Menlo,monospace;">{{NUMBER}}</td>';
  var TD_TOTAL_LABEL = '<td align="left" style="padding:10px;border-top:2px solid #1F2933;font-weight:bold;">{{VALUE}}</td>';
  var ROW_BORDER = "border-bottom:1px solid #E4E9EE;";
  var ROW_BORDER_SHADED = "border-bottom:1px solid #E4E9EE;background:#F7F9FB;";
  var UNFAVORABLE_COLOR = "color:#C2410C;";
  var FOOTER_TEST = " Test mode: on. Intended recipient: {{OWNER_EMAIL}}.";
  var TEST_PREFIX = "[TEST for {{OWNER_EMAIL}}] ";

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalize(fields) {
    var input = fields || {};
    var dimension = DIMENSIONS[input.dimension] ? input.dimension : DEFAULTS.dimension;
    return {
      dimension: dimension,
      subject: trim(input.subject != null ? input.subject : DEFAULTS.subject),
      greeting: trim(input.greeting != null ? input.greeting : DEFAULTS.greeting),
      intro: trim(input.intro != null ? input.intro : introFor(dimension)),
      note: trim(input.note != null ? input.note : DEFAULTS.note),
      footer: trim(input.footer != null ? input.footer : DEFAULTS.footer),
      testMode: input.testMode !== false && input.testMode !== "false",
      testAddress: trim(input.testAddress != null ? input.testAddress : DEFAULTS.testAddress),
      period: trim(input.period != null ? input.period : DEFAULTS.period) || DEFAULTS.period,
      versionPlan: trim(input.versionPlan != null ? input.versionPlan : DEFAULTS.versionPlan) || DEFAULTS.versionPlan,
      versionActual: trim(input.versionActual != null ? input.versionActual : DEFAULTS.versionActual) || DEFAULTS.versionActual,
      colorVariance: input.colorVariance !== false && input.colorVariance !== "false",
      extractName: trim(input.extractName != null ? input.extractName : DEFAULTS.extractName) || DEFAULTS.extractName
    };
  }

  function messageFor(issue) {
    if (issue.type === "unclosed") return MESSAGES.unclosed;
    if (issue.type === "unknown") return MESSAGES.unknown.replace("[NAME]", issue.name);
    if (issue.type === "dollar") return MESSAGES.dollar;
    return MESSAGES.previewFailed;
  }

  function firstMarkerIssue(text, allowed) {
    var issues = shared.fieldMarkerIssues(text, allowed);
    var rank = { unclosed: 0, unknown: 1, dollar: 2 };
    issues.sort(function (a, b) { return rank[a.type] - rank[b.type]; });
    return issues[0] || null;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.indexOf("${") < 0 && value.indexOf("{{") < 0;
  }

  function validPeriod(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }

  function validate(fields) {
    var form = normalize(fields);
    var raw = fields || {};
    var errors = [];
    var hints = [];

    function addMarker(field, text, allowed) {
      var issue = firstMarkerIssue(text, allowed);
      if (issue) errors.push({ field: field, message: messageFor(issue) });
    }

    if (!trim(raw.subject != null ? raw.subject : DEFAULTS.subject)) {
      errors.push({ field: "subject", message: MESSAGES.subjectEmpty });
    } else {
      addMarker("subject", form.subject, shared.WORDING_MARKERS);
      if (form.subject.length > 150 && !errors.some(function (error) { return error.field === "subject"; })) {
        errors.push({ field: "subject", message: MESSAGES.subjectLong });
      }
    }

    if (!trim(raw.greeting != null ? raw.greeting : DEFAULTS.greeting)) {
      hints.push({ field: "greeting", message: MESSAGES.greetingEmpty });
    } else {
      addMarker("greeting", form.greeting, shared.WORDING_MARKERS);
    }

    addMarker("intro", form.intro, shared.WORDING_MARKERS);
    addMarker("note", form.note, shared.WORDING_MARKERS);
    addMarker("footer", form.footer, shared.WORDING_MARKERS);

    var testRaw = trim(raw.testAddress != null ? raw.testAddress : DEFAULTS.testAddress);
    addMarker("testAddress", testRaw, {});
    if (!errors.some(function (error) { return error.field === "testAddress"; })) {
      if (form.testMode && !testRaw) {
        errors.push({ field: "testAddress", message: MESSAGES.testEmpty });
      } else if (testRaw && !validEmail(testRaw)) {
        errors.push({ field: "testAddress", message: MESSAGES.testInvalid });
      }
    }

    ["period", "versionPlan", "versionActual", "extractName"].forEach(function (field) {
      var text = trim(raw[field] != null ? raw[field] : "");
      if (!text) return;
      if (field === "period" && !validPeriod(text)) {
        errors.push({ field: "period", message: MESSAGES.periodInvalid });
        return;
      }
      addMarker(field, text, {});
    });

    var seen = {};
    errors = errors.filter(function (error) {
      if (seen[error.field]) return false;
      seen[error.field] = true;
      return true;
    });
    errors.sort(function (a, b) {
      return FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field);
    });

    var downloadNote = null;
    if (errors.length) {
      downloadNote = MESSAGES.downloadNote.replace("[field name]", FIELD_LABELS[errors[0].field] || errors[0].field);
    }

    return { form: form, errors: errors, hints: hints, downloadNote: downloadNote, ok: errors.length === 0 };
  }

  function replacePairs(script, pairs) {
    var plan = pairs.map(function (pair) {
      var at = script.indexOf(pair[0]);
      if (at < 0) throw new Error("Canonical script is missing a line to customize.");
      if (script.indexOf(pair[0], at + 1) >= 0) {
        throw new Error("Canonical line is not unique.");
      }
      return { at: at, len: pair[0].length, insert: pair[1] };
    });
    plan.sort(function (a, b) { return b.at - a.at; });
    var out = script;
    plan.forEach(function (item) {
      out = out.slice(0, item.at) + item.insert + out.slice(item.at + item.len);
    });
    return out;
  }

  function quotedLine(prefix, value, suffix) {
    return prefix + shared.groovyQuote(value) + suffix;
  }

  function buildScript(form) {
    var dimension = DIMENSIONS[form.dimension];
    var groovy = sources.groovy;
    var script = replacePairs(groovy, [
      ["    HEADER_LABEL : 'Monthly cost center report',", quotedLine("    HEADER_LABEL : ", dimension.header, ",")],
      ["    TITLE : 'Cost center {{COST_CENTER}} {{COST_CENTER_NAME}}',", quotedLine("    TITLE : ", dimension.title, ",")],
      ["    GREETING : 'Hello {{OWNER_NAME}},',", quotedLine("    GREETING : ", form.greeting, ",")],
      ["    INTRO : 'Here are the {{PERIOD}} values for your cost center, {{VERSION_ACTUAL}} against {{VERSION_PLAN}} by account.',", quotedLine("    INTRO : ", form.intro, ",")],
      ["    NOTE : 'Variance is {{VERSION_ACTUAL}} minus {{VERSION_PLAN}}. Highlighted variances are unfavorable for that account type. Sample data only.',", quotedLine("    NOTE : ", form.note, ",")],
      ["    FOOTER : 'Sent automatically by a Jedox Integrator job.',", quotedLine("    FOOTER : ", form.footer, ",")],
      ["boolean testMode = !setting('TEST_MODE', 'true').equalsIgnoreCase('false')", "boolean testMode = !setting('TEST_MODE', " + shared.groovyQuote(form.testMode ? "true" : "false") + ").equalsIgnoreCase('false')"],
      ["String testTo = setting('RECIPIENT_TEST', 'test.recipient@example.com')", "String testTo = setting('RECIPIENT_TEST', " + shared.groovyQuote(form.testAddress || DEFAULTS.testAddress) + ")"],
      ["String period = setting('PERIOD', '2026-03')", "String period = setting('PERIOD', " + shared.groovyQuote(form.period) + ")"],
      ["String vPlan = setting('VERSION_PLAN', 'Budget')", "String vPlan = setting('VERSION_PLAN', " + shared.groovyQuote(form.versionPlan) + ")"],
      ["String vActual = setting('VERSION_ACTUAL', 'Actual')", "String vActual = setting('VERSION_ACTUAL', " + shared.groovyQuote(form.versionActual) + ")"],
      ["String subjectTpl = setting('SUBJECT_TEMPLATE', '{{COST_CENTER}} {{VERSION_ACTUAL}} vs {{VERSION_PLAN}}, {{PERIOD}}')", "String subjectTpl = setting('SUBJECT_TEMPLATE', " + shared.groovyQuote(form.subject) + ")"],
      ["boolean colorVar = !setting('COLOR_VARIANCE', 'true').equalsIgnoreCase('false')", "boolean colorVar = !setting('COLOR_VARIANCE', " + shared.groovyQuote(form.colorVariance ? "true" : "false") + ").equalsIgnoreCase('false')"],
      ["String extractName = setting('SOURCE_EXTRACT', 'PnL_BudgetActual')", "String extractName = setting('SOURCE_EXTRACT', " + shared.groovyQuote(form.extractName) + ")"]
    ]);

    var inserted = [
      dimension.header,
      dimension.title,
      form.greeting,
      form.intro,
      form.note,
      form.footer,
      form.subject,
      form.testAddress || DEFAULTS.testAddress,
      form.period,
      form.versionPlan,
      form.versionActual,
      form.extractName
    ];
    if (inserted.some(shared.hasUnclosedMarker)) return null;
    if (script.indexOf("${") >= 0) return null;
    return script;
  }

  function varianceFlag(type, cents) {
    if (cents === 0) return "ON_PLAN";
    if (type === "REVENUE") return cents > 0 ? "FAVORABLE" : "UNFAVORABLE";
    if (type === "EXPENSE") return cents < 0 ? "FAVORABLE" : "UNFAVORABLE";
    return "UNKNOWN";
  }

  function shade(snippet, shaded) {
    return shaded ? snippet.replace(ROW_BORDER, ROW_BORDER_SHADED) : snippet;
  }

  function numberCell(snippet, cents) {
    return shared.fillMarkers(snippet, { NUMBER: shared.escapeHtml(shared.formatCents(cents)) });
  }

  function buildPreview(form) {
    var dimension = DIMENSIONS[form.dimension];
    var words = {
      COST_CENTER: "CC4010",
      COST_CENTER_NAME: "HR",
      OWNER_NAME: "Gray Example",
      OWNER_EMAIL: "owner.cc4010@example.com",
      PERIOD: form.period,
      VERSION_PLAN: form.versionPlan,
      VERSION_ACTUAL: form.versionActual
    };
    var text = {
      HEADER_LABEL: dimension.header,
      TITLE: dimension.title,
      GREETING: form.greeting,
      INTRO: form.intro,
      NOTE: form.note,
      FOOTER: form.footer,
      COL_ACCOUNT: "Account",
      COL_VARIANCE: "Variance",
      TOTAL_EXPENSE: "Total expense"
    };
    function say(key) {
      return shared.escapeHtml(shared.fillMarkers(text[key], words).trim());
    }

    var headerCells = shared.fillMarkers(TH_LEFT, { LABEL: shared.escapeHtml(text.COL_ACCOUNT) }) +
      shared.fillMarkers(TH_RIGHT, { LABEL: shared.escapeHtml(form.versionPlan) }) +
      shared.fillMarkers(TH_RIGHT, { LABEL: shared.escapeHtml(form.versionActual) }) +
      shared.fillMarkers(TH_RIGHT, { LABEL: shared.escapeHtml(text.COL_VARIANCE) });

    var rows = "";
    var plan = 0;
    var actual = 0;
    SAMPLE_ROWS.forEach(function (row, index) {
      var variance = row.actual - row.plan;
      var unfavorable = form.colorVariance && varianceFlag(row.type, variance) === "UNFAVORABLE";
      var shadedRow = index % 2 === 1;
      rows += "<tr>";
      rows += shared.fillMarkers(shade(TD_TEXT, shadedRow), { VALUE: shared.escapeHtml(row.name) });
      rows += numberCell(shade(TD_NUMBER, shadedRow), row.plan);
      rows += numberCell(shade(TD_NUMBER, shadedRow), row.actual);
      rows += numberCell(shade(unfavorable ? TD_NUMBER_UNFAVORABLE : TD_NUMBER, shadedRow), variance);
      rows += "</tr>\n";
      plan += row.plan;
      actual += row.actual;
    });
    var totVariance = actual - plan;
    var totUnfavorable = form.colorVariance && varianceFlag("EXPENSE", totVariance) === "UNFAVORABLE";
    var totVarSnippet = totUnfavorable
      ? TD_TOTAL.replace("font-weight:bold;", "font-weight:bold;" + UNFAVORABLE_COLOR)
      : TD_TOTAL;
    var totalCells = shared.fillMarkers(TD_TOTAL_LABEL, { VALUE: say("TOTAL_EXPENSE") }) +
      numberCell(TD_TOTAL, plan) +
      numberCell(TD_TOTAL, actual) +
      numberCell(totVarSnippet, totVariance);

    var subject = shared.fillMarkers(form.subject, words);
    if (form.testMode) subject = shared.fillMarkers(TEST_PREFIX, words) + subject;
    subject = subject.replace(/[\r\n]+/g, " ").trim();
    var footer = shared.fillMarkers(form.footer, words) + (form.testMode ? shared.fillMarkers(FOOTER_TEST, words) : "");

    var values = {
      SUBJECT: shared.escapeHtml(subject),
      HEADER_LABEL: say("HEADER_LABEL"),
      TITLE: say("TITLE"),
      PERIOD: shared.escapeHtml(form.period),
      VERSION: shared.escapeHtml(form.versionActual + " vs " + form.versionPlan),
      GREETING: say("GREETING"),
      INTRO: say("INTRO"),
      HEADER_CELLS: headerCells,
      TABLE_ROWS: rows,
      TOTAL_CELLS: totalCells,
      NOTE: say("NOTE"),
      FOOTER: shared.escapeHtml(footer)
    };
    Object.keys(shared.TEMPLATE_MARKERS).forEach(function (name) {
      if (!sources.template || sources.template.indexOf("{{" + name + "}}") < 0) {
        throw new Error("Email template is missing markers: " + name);
      }
    });
    var html = shared.fillMarkers(sources.template, values);
    if (html.indexOf("{{") >= 0 || html.indexOf("}}") >= 0 || html.indexOf("${") >= 0) {
      throw new Error("Leftover marker in preview");
    }
    return { subject: subject, html: html };
  }

  function crc32(bytes) {
    var table = crc32.table;
    if (!table) {
      table = crc32.table = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosTime(date) {
    var d = date || new Date(Date.UTC(2026, 2, 9, 12, 0, 0));
    var time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
    var day = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
    return { time: time, date: day };
  }

  function buildZip(files) {
    var encoder = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;
    var stamp = dosTime();
    files.forEach(function (file) {
      var name = encoder.encode(file.name);
      var data = encoder.encode(file.text);
      var crc = crc32(data);
      var local = new Uint8Array(30 + name.length + data.length);
      var view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, stamp.time, true);
      view.setUint16(12, stamp.date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      parts.push(local);

      var cent = new Uint8Array(46 + name.length);
      var cv = new DataView(cent.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      cent.set(name, 46);
      central.push(cent);
      offset += local.length;
    });
    var centralSize = central.reduce(function (sum, part) { return sum + part.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    var total = offset + centralSize + end.length;
    var zip = new Uint8Array(total);
    var cursor = 0;
    parts.concat(central, [end]).forEach(function (part) {
      zip.set(part, cursor);
      cursor += part.length;
    });
    return zip;
  }

  function generate(fields) {
    var result = validate(fields);
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors,
        hints: result.hints,
        downloadNote: result.downloadNote,
        script: null,
        template: null,
        preview: null,
        form: result.form
      };
    }
    var script = buildScript(result.form);
    if (!script) {
      return {
        ok: false,
        errors: [{ field: "subject", message: MESSAGES.previewFailed }],
        hints: result.hints,
        downloadNote: MESSAGES.downloadNote.replace("[field name]", "subject"),
        script: null,
        template: null,
        preview: null,
        form: result.form
      };
    }
    var preview = null;
    try {
      preview = buildPreview(result.form);
    } catch (error) {
      return {
        ok: false,
        errors: [{ field: "subject", message: MESSAGES.previewFailed }],
        hints: result.hints,
        downloadNote: MESSAGES.downloadNote.replace("[field name]", "subject"),
        script: null,
        template: null,
        preview: null,
        form: result.form
      };
    }
    return {
      ok: true,
      errors: [],
      hints: result.hints,
      downloadNote: null,
      script: script,
      template: sources.template,
      preview: preview,
      form: result.form,
      zip: function () {
        return buildZip([
          { name: "send_value_emails.groovy", text: script },
          { name: "email-template.html", text: sources.template }
        ]);
      }
    };
  }

  return {
    MESSAGES: MESSAGES,
    FIELD_LABELS: FIELD_LABELS,
    DIMENSIONS: DIMENSIONS,
    DEFAULTS: DEFAULTS,
    introFor: introFor,
    normalize: normalize,
    validate: validate,
    generate: generate,
    buildZip: buildZip,
    groovyQuote: shared.groovyQuote,
    escapeHtml: shared.escapeHtml
  };
});
