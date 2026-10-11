const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const shared = require("../docs/javascripts/email-shared.js");
const sources = require("../docs/javascripts/email-sources.js");
const messages = require("../docs/javascripts/email-check-messages.js");
const generate = require("../docs/javascripts/email-generate.js");
const checker = require("../docs/javascripts/email-checker-core.js");
const completions = require("../docs/javascripts/email-completions.js");
const liveLint = require("../docs/javascripts/email-live-lint.js");

function problems(script, scriptType) {
  return checker.checkScript(script, { scriptType: scriptType || "job" }).issues
    .filter(function (issue) { return issue.severity !== "check"; })
    .map(function (issue) { return issue.rule + "@" + issue.line; });
}

function allIssues(script, scriptType) {
  return checker.checkScript(script, { scriptType: scriptType || "job" }).issues
    .map(function (issue) { return issue.severity + ":" + issue.rule + "@" + issue.line; });
}

test("html escape encodes quotes, <, &, $ and braces", function () {
  assert.equal(shared.escapeHtml("&<>\"'"), "&amp;&lt;&gt;&quot;&#39;");
  assert.equal(shared.escapeHtml("$"), "&#36;");
  assert.equal(shared.escapeHtml("{{"), "&#123;&#123;");
  assert.equal(shared.escapeHtml("}}"), "&#125;&#125;");
  assert.equal(
    shared.escapeHtml("H$R <Ops> & \"Q\" 'x' {{TITLE}}"),
    "H&#36;R &lt;Ops&gt; &amp; &quot;Q&quot; &#39;x&#39; &#123;&#123;TITLE&#125;&#125;"
  );
});

test("groovy single quotes escape quotes and backslashes", function () {
  assert.equal(shared.groovyQuote("O'Brien"), "'O\\'Brien'");
  assert.equal(shared.groovyQuote("a\\b"), "'a\\\\b'");
  assert.equal(shared.groovyQuote("line\nbreak"), "'line\\nbreak'");
});

test("open {{ blocks the script and names the field", function () {
  const result = generate.generate({ greeting: "Hello {{OWNER_NAME}," });
  assert.equal(result.ok, false);
  assert.equal(result.script, null);
  assert.equal(result.preview, null);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "greeting");
  assert.equal(result.errors[0].message, "Close or remove the open {{");
  assert.equal(result.downloadNote, "Fix the greeting to download.");
});

test("an open {{ is not escaped into a script", function () {
  const result = generate.generate({ subject: "Actuals {{PERIOD" });
  assert.equal(result.script, null);
  assert.equal(result.downloadNote, "Fix the subject to download.");
  assert.equal(result.errors[0].message, "Close or remove the open {{");
});

test("unknown markers and ${ stop generation", function () {
  const unknown = generate.generate({ greeting: "Hello {{OWNER}}," });
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors[0].message, /`\{\{OWNER\}\}` isn't a marker this script knows/);
  const dollar = generate.generate({ subject: "Actuals for ${PERIOD}" });
  assert.equal(dollar.script, null);
  assert.match(dollar.errors[0].message, /`\$\{` is how Integrator writes its own variables/);
});

test("generated wording escapes quotes and keeps closed markers", function () {
  const greeting = "Hi {{OWNER_NAME}} & <tag> $5 'x'";
  const result = generate.generate({ greeting: greeting });
  assert.equal(result.ok, true);
  assert.ok(result.script.indexOf("GREETING : 'Hi {{OWNER_NAME}} & <tag> $5 \\'x\\'',") >= 0);
  assert.equal(result.script.indexOf("${"), -1);
  assert.equal(shared.hasUnclosedMarker(greeting), false);
  assert.match(result.preview.html, /Hi Gray Example &amp; &lt;tag&gt; &#36;5 &#39;x&#39;/);
  assert.match(result.preview.html, /IT &amp; Software/);
  assert.match(result.preview.html, /193\.06/);
  assert.match(result.preview.html, /#C2410C/);
  assert.match(result.preview.subject, /^\[TEST for owner\.cc4010@example\.com\] /);
  assert.doesNotMatch(result.preview.html, /\{\{/);
});

test("turning variance color and test mode off changes the preview and the script", function () {
  const result = generate.generate({ testMode: false, colorVariance: false, testAddress: "" });
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.preview.html, /#C2410C/);
  assert.doesNotMatch(result.preview.subject, /\[TEST for /);
  assert.match(result.script, /setting\('TEST_MODE', 'false'\)/);
  assert.match(result.script, /setting\('COLOR_VARIANCE', 'false'\)/);
  assert.match(result.script, /setting\('RECIPIENT_TEST', 'test\.recipient@example\.com'\)/);
});

test("defaults generate the same script as the download", function () {
  const result = generate.generate();
  assert.equal(result.ok, true);
  assert.equal(result.script, sources.groovy);
  assert.equal(result.preview.subject, "[TEST for owner.cc4010@example.com] CC4010 Actual vs Budget, 2026-03");
  assert.match(result.preview.html, /Sample data only\./);
});

test("the email template fits a phone without a fixed width", function () {
  const template = fs.readFileSync(path.join(root, "docs/files/email/email-template.html"), "utf8");
  const groovy = fs.readFileSync(path.join(root, "docs/files/email/send_value_emails.groovy"), "utf8");
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-generate.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  const builder = fs.readFileSync(path.join(root, "docs/javascripts/email-builder-ui.js"), "utf8");
  const msoOpen = '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->';
  const msoClose = '<!--[if mso]></td></tr></table><![endif]-->';
  const visible = template.replace(/<!--\[if mso\][\s\S]*?<!\[endif\]-->/g, "");
  assert.equal(template.split(msoOpen).length - 1, 1);
  assert.equal(template.split(msoClose).length - 1, 1);
  assert.ok(template.indexOf(msoOpen) < template.indexOf(msoClose));
  assert.equal(visible.includes('width="600"'), false);
  assert.equal(visible.replace(/max-width:600px/g, "").includes("width:600px"), false);
  assert.equal((visible.match(/<table\b[^>]*>/g) || []).length, 3);
  const tables = visible.match(/<table\b[^>]*>/g);
  assert.match(tables[1], /width="100%"/);
  assert.match(tables[1], /max-width:600px/);
  assert.match(tables[2], /width="100%"/);
  assert.match(tables[2], /max-width:600px/);
  ["white-space:nowrap", "word-wrap:break-word"].forEach(function (piece) {
    assert.ok(groovy.includes(piece), piece);
    assert.ok(ui.includes(piece), piece);
  });
  const result = generate.generate();
  assert.equal(result.script, sources.groovy);
  assert.match(result.preview.html, /white-space:nowrap/);
  assert.match(result.preview.html, /193\.06/);
  assert.match(result.preview.html, /6,866\.96/);
  assert.match(result.preview.html, /5,700\.21/);
  assert.equal(result.preview.html.split(msoOpen).length - 1, 1);
  assert.equal(result.preview.html.split(msoClose).length - 1, 1);
  assert.ok(result.preview.html.indexOf(msoOpen) < result.preview.html.indexOf("193.06"));
  assert.ok(result.preview.html.indexOf("5,700.21") < result.preview.html.indexOf(msoClose));
  const zip = Buffer.from(result.zip()).toString("latin1");
  assert.equal(zip.split(msoOpen).length - 1, 1);
  assert.equal(zip.split(msoClose).length - 1, 1);
  assert.equal(result.preview.html.replace(/<!--\[if mso\][\s\S]*?<!\[endif\]-->/g, "").includes('width="600"'), false);
  assert.match(result.preview.html, /Sent automatically by a Jedox Integrator job\./);
  assert.match(result.preview.html, /Test mode: on\. Intended recipient:/);
  assert.doesNotMatch(css, /\.email-frame-wrap \{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(css, /\.email-frame-wrap \{[^}]*width:\s*\d+px/);
  assert.equal(builder.includes('frame.style.width = width + "px"'), false);
});

test("outlook conditional comments are not checker issues", function () {
  const open = '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->';
  const close = '<!--[if mso]></td></tr></table><![endif]-->';
  const script = [
    "def mailer = API.getMailer()",
    open,
    "boolean testMode = true",
    "mailer.reset()",
    "mailer.addRecipient(to)",
    "mailer.setHtmlMessage(email.html)",
    "mailer.send()",
    close
  ].join("\n");
  assert.deepEqual(checker.checkScript(script, { scriptType: "job" }).issues, []);
  const hidden = [
    "def mailer = API.getMailer()",
    "<!--[if mso]>API.getNope()<![endif]-->",
    "boolean testMode = true",
    "mailer.reset()",
    "mailer.addRecipient(to)",
    "mailer.setHtmlMessage(email.html)",
    "mailer.send()"
  ].join("\n");
  assert.deepEqual(checker.checkScript(hidden, { scriptType: "job" }).issues, []);
});

test("period must be a zero-padded YYYY-MM", function () {
  const bad = generate.generate({ period: "2026-3" });
  assert.equal(bad.ok, false);
  assert.equal(bad.script, null);
  assert.equal(bad.errors[0].field, "period");
  assert.equal(bad.errors[0].message, "Use YYYY-MM, like 2026-03.");
  assert.equal(bad.downloadNote, "Fix the period to download.");
  assert.equal(generate.generate({ period: "2026-13" }).ok, false);
  assert.equal(generate.generate({ period: "2026-03" }).ok, true);
  assert.equal(generate.generate({ period: "" }).ok, true);
});

test("subject is capped at 150 characters", function () {
  const ok = generate.generate({ subject: "A".repeat(150) });
  assert.equal(ok.ok, true);
  const tooLong = generate.generate({ subject: "A".repeat(151) });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.script, null);
  assert.equal(tooLong.errors[0].message, "Keep the subject to 150 characters.");
  assert.equal(tooLong.downloadNote, "Fix the subject to download.");
});

test("entity wording keeps the cost_center marker", function () {
  const result = generate.generate({ dimension: "entity" });
  assert.match(result.script, /TITLE : 'Entity \{\{COST_CENTER\}\} \{\{COST_CENTER_NAME\}\}',/);
  assert.match(result.script, /r\.cost_center/);
  assert.equal(result.script.indexOf("${"), -1);
});

test("embedded sources match the tested files", function () {
  const groovy = fs.readFileSync(path.join(root, "docs/files/email/send_value_emails.groovy"), "utf8");
  const template = fs.readFileSync(path.join(root, "docs/files/email/email-template.html"), "utf8");
  assert.equal(sources.groovy, groovy);
  assert.equal(sources.template, template);
});

test("default script and the published script raise no errors or warnings", function () {
  const generated = generate.generate();
  assert.equal(generated.ok, true);
  assert.deepEqual(problems(generated.script, "job"), []);
  assert.deepEqual(problems(sources.groovy, "job"), []);
  assert.deepEqual(problems(checker.CLEAN_SCRIPT, "job"), []);
  assert.deepEqual(allIssues(checker.CLEAN_SCRIPT, "job"), []);
});

test("each checker rule flags exactly one line", function () {
  const cases = {
    EM01: "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nString subject = \"${cc} actuals for ${period}\"\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n",
    EM02: "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nString greeting = 'Hello {{OWNER}},'\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n",
    EM03: "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\nmailer.addRecipient(next)\n",
    EM04: "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nmailer.setServer('smtp.example.com', 'user', 'secret')\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n",
    EM05: "def mailer = API.getMailer()\nmailer.reset()\nmailer.addRecipient(r.owner_email)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n",
    EM06: "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setMessage(html)\nmailer.send()\n",
    EM07: "def src = API.getSource(extractName)\nif (src == null) throw new IllegalStateException('missing')\nwhile (src.nextRow()) {\n    rows.add([cc: src.getColumnString(ccColumn)])\n}\nboolean testMode = true\ndef mailer = API.getMailer()\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n",
    EM08: "def src = API.initSource(extractName)\nwhile (src.nextRow()) {\n    rows.add([cc: src.getColumnString(ccColumn)])\n}\nboolean testMode = true\ndef mailer = API.getMailer()\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n"
  };
  const expectedLine = {
    EM01: 4,
    EM02: 4,
    EM03: 7,
    EM04: 4,
    EM05: 3,
    EM06: 5,
    EM07: 1,
    EM08: 1
  };
  Object.keys(cases).forEach(function (rule) {
    assert.deepEqual(allIssues(cases[rule], "job"), ["error:".concat(rule, "@", expectedLine[rule]).replace("error:EM03", "warning:EM03").replace("error:EM04", "warning:EM04").replace("error:EM05", "warning:EM05").replace("error:EM07", "warning:EM07")], rule);
  });
});

test("initSource without a later null check is an error on the assignment", function () {
  function em08(script) {
    return checker.checkScript(script, { scriptType: "job" }).issues.filter(function (issue) {
      return issue.rule === "EM08";
    });
  }
  const alone = em08("def src = API.initSource('X')");
  assert.equal(alone.length, 1);
  assert.equal(alone[0].severity, "error");
  assert.equal(alone[0].line, 1);
  assert.match(alone[0].title, /No null check/);
  assert.equal(em08("def src = API.initSource('X')\nif (src == null) throw new IllegalStateException('missing')").length, 0);
  assert.equal(em08("def src = API.initSource('X')\nif (src != null) src.nextRow()").length, 0);
  assert.equal(em08("def src = API.initSource('X')\nif (null == src) return").length, 0);
  assert.equal(em08("def src = API.initSource('X')\nif (null != src) src.nextRow()").length, 0);
  assert.equal(em08("def src = API.initSource('X')\nsrc?.nextRow()").length, 0);
  assert.equal(em08("def src = API.initSource('X'); if (src == null) return").length, 0);
  const used = em08("def src = API.initSource(extractName)\nwhile (src.nextRow()) {}");
  assert.equal(used.length, 1);
  assert.equal(used[0].line, 1);
  const bare = em08("API.initSource('X')");
  assert.equal(bare.length, 1);
  assert.equal(bare[0].line, 1);
  const commented = em08("def src = API.initSource('X')\n// if (src == null) return\nString note = \"src != null\"");
  assert.equal(commented.length, 1);
  assert.equal(commented[0].line, 1);
  const second = em08("def src = API.initSource('X')\nsrc?.close()\ndef other = API.initSource('Y')");
  assert.deepEqual(second.map(function (issue) { return issue.line; }), [3]);
});

test("test mode off by default is its own warning", function () {
  const script = "def mailer = API.getMailer()\nboolean testMode = false\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setHtmlMessage(email.html)\nmailer.send()\n";
  const result = checker.checkScript(script, { scriptType: "job" });
  assert.deepEqual(allIssues(script), ["warning:EM05@2"]);
  assert.equal(result.issues[0].title, "Test mode is off by default.");
});

test("getMailer is an error only when the script is a Groovy function", function () {
  const script = checker.CLEAN_SCRIPT;
  assert.deepEqual(allIssues(script, "job"), []);
  const asFunction = checker.checkScript(script, { scriptType: "function" });
  assert.deepEqual(allIssues(script, "function"), ["error:EM09@11"]);
  assert.match(asFunction.issues[0].title, /getMailer\(\)/);
  const guarded = [
    "def mailer = API.getMailer()",
    "if (mailer == null) throw new IllegalStateException('No mailer: run this as a Groovy job')",
    "boolean testMode = true",
    "mailer.reset()",
    "mailer.addRecipient(to)",
    "mailer.setHtmlMessage(email.html)",
    "mailer.send()"
  ].join("\n");
  assert.deepEqual(allIssues(guarded, "function"), []);
  assert.deepEqual(allIssues(guarded, "job"), []);
});

test("the example script matches the nine-check severities", function () {
  const job = checker.checkScript(checker.EXAMPLE_SCRIPT, { scriptType: "job" });
  assert.deepEqual(job.issues.map(function (issue) { return issue.rule + "@" + issue.line; }), [
    "EM08@1",
    "EM06@8",
    "EM04@6",
    "EM05@7",
    "EM03@10",
    "NAME@1",
    "NAME@3"
  ]);
  assert.equal(job.issues[0].label, "Error");
  assert.equal(job.issues[0].icon, "✕");
  assert.equal(job.issues[2].label, "Warning");
  assert.equal(job.issues[2].icon, "!");
  assert.equal(job.issues[5].label, "Check");
  assert.equal(job.issues[5].explanation, "1 extract to check in your Jedox. Make sure an extract with this exact name is in the project.");
  assert.deepEqual(job.issues[5].items, [{ name: "PnL_Extract", lines: [1] }]);
  assert.equal(job.issues[6].explanation, "1 column name to check in your Jedox. Open the extract preview and compare the names. The value column's name isn't stated in the Cube extract docs, so check `#Value` in the preview too, or set Rename value to `#Value` in the extract.");
  assert.deepEqual(job.issues[6].items, [{ name: "CostCenter", lines: [3] }]);
  const smtp = job.issues.filter(function (issue) { return issue.rule === "EM04"; })[0];
  assert.equal(smtp.severity, "warning");
  assert.equal(smtp.line, 6);
  assert.match(checker.EXAMPLE_SCRIPT, /mail\.setServer\('smtp\.example\.com', 'user', 'secret'\)/);
  const asFunction = checker.checkScript(checker.EXAMPLE_SCRIPT, { scriptType: "function" });
  assert.ok(asFunction.issues.some(function (issue) { return issue.rule === "EM09" && issue.line === 5; }));
  assert.equal(checker.checkScript(checker.EXAMPLE_SCRIPT, { scriptType: "job" }).issues.some(function (issue) {
    return issue.rule === "EM09";
  }), false);
});

test("signed-off check wording is in the messages file", function () {
  const blob = JSON.stringify(messages);
  assert.equal(blob.indexOf("That goes for comments too."), -1);
  assert.ok(messages.rules.EM03.explanation.replace(/`/g, "").indexOf("addRecipient() adds to the list each time, and reset() clears the recipients, subject and body") >= 0);
  assert.match(messages.rules.EM04.before, /mailer\.setServer\('smtp\.example\.com', 'user', 'secret'\)/);
  assert.match(messages.rules.EM01.title, /will be replaced before your script runs/);
  assert.equal(messages.rules.EM08.severity, "error");
  assert.equal(messages.rules.EM04.severity, "warning");
  assert.match(messages.checks.column, /Column `'\{name\}'` can't be verified here/);
});

test("zip download contains the script and the template", function () {
  const result = generate.generate();
  const zip = Buffer.from(result.zip());
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const text = zip.toString("latin1");
  assert.ok(text.indexOf("send_value_emails.groovy") >= 0);
  assert.ok(text.indexOf("email-template.html") >= 0);
  assert.ok(text.indexOf("PART 2: Jedox block") >= 0);
  assert.ok(text.indexOf("{{SUBJECT}}") >= 0);
});

test("grey Jedox cards are grouped by kind and list every line", function () {
  const published = checker.checkScript(sources.groovy, { scriptType: "job" });
  const checks = published.issues.filter(function (issue) { return issue.severity === "check"; });
  assert.deepEqual(checks.map(function (issue) { return issue.kind; }), ["connection", "column"]);
  assert.equal(checks.length, 2);
  const names = checks.reduce(function (sum, issue) { return sum + issue.items.length; }, 0);
  assert.equal(names, 8);
  shared.KNOWN_JOB_VARIABLES.forEach(function (name) {
    assert.equal(checks.some(function (issue) {
      return issue.items.some(function (item) { return item.name === name; });
    }), false, name);
  });

  function linesFor(kind, name) {
    const card = checks.filter(function (issue) { return issue.kind === kind; })[0];
    const item = card.items.filter(function (entry) { return entry.name === name; })[0];
    assert.ok(item, kind + " " + name);
    return item.lines;
  }
  function lineOf(needle) {
    const index = sources.groovy.split("\n").findIndex(function (line) { return line.indexOf(needle) >= 0; });
    assert.ok(index >= 0, needle);
    return index + 1;
  }
  assert.deepEqual(linesFor("connection", "EmailTemplate"), [lineOf("readFile('EmailTemplate')")]);
  assert.deepEqual(linesFor("connection", "EmailRecipients"), [lineOf("readFile('EmailRecipients')")]);
  assert.deepEqual(linesFor("connection", "Accounts"), [lineOf("readFile('Accounts')")]);
  assert.deepEqual(linesFor("connection", "CostCenters"), [lineOf("readFile('CostCenters')")]);
  assert.deepEqual(linesFor("column", "CostCenter"), [lineOf("getColumnString('CostCenter')")]);
  assert.deepEqual(linesFor("column", "Account"), [lineOf("getColumnString('Account')")]);
  assert.deepEqual(linesFor("column", "Version"), [lineOf("getColumnString('Version')")]);
  assert.deepEqual(linesFor("column", "#Value"), [lineOf("getColumnValue('#Value')")]);
  assert.equal(checks[0].explanation, "4 file connections to check in your Jedox. Each name must match a File connection in the project. A relative path is read from the local files folder.");
  assert.equal(checks[1].explanation, "4 column names to check in your Jedox. Open the extract preview and compare the names. The value column's name isn't stated in the Cube extract docs, so check `#Value` in the preview too, or set Rename value to `#Value` in the extract.");

  const mixed = [
    "def src = API.initSource('PnL_BudgetActual')",
    "def other = API.initSource('OtherExtract')",
    "rows << src.getColumnString('CostCenter')",
    "rows << src.getColumnString('Account')",
    "rows << src.getColumnString('CostCenter')",
    "readFile('EmailTemplate')",
    "setting('CUSTOM_FLAG', 'true')",
    "setting('CUSTOM_FLAG', 'false')",
    "def mailer = API.getMailer()",
    "boolean testMode = true",
    "mailer.reset()",
    "mailer.addRecipient(to)",
    "mailer.setHtmlMessage(email.html)",
    "mailer.send()"
  ].join("\n");
  const grouped = checker.checkScript(mixed, { scriptType: "job" }).issues.filter(function (issue) {
    return issue.severity === "check";
  });
  assert.equal(grouped.length, 4);
  assert.equal(grouped.filter(function (issue) { return issue.kind === "extract"; })[0].explanation, "2 extracts to check in your Jedox. Make sure an extract with this exact name is in the project.");
  assert.deepEqual(grouped.filter(function (issue) { return issue.kind === "column"; })[0].items, [
    { name: "CostCenter", lines: [3, 5] },
    { name: "Account", lines: [4] }
  ]);
  assert.deepEqual(grouped.filter(function (issue) { return issue.kind === "variable"; })[0].items, [
    { name: "CUSTOM_FLAG", lines: [7, 8] }
  ]);
  assert.equal(grouped.filter(function (issue) { return issue.kind === "variable"; })[0].explanation, "1 job variable to check in your Jedox. This script reads them with `API.getProperty()`. Make sure each one exists in the job, or that the default in the script is what you want.");
  assert.equal(grouped.filter(function (issue) { return issue.kind === "connection"; })[0].explanation, "1 file connection to check in your Jedox. Each name must match a File connection in the project. A relative path is read from the local files folder.");
});

test("the builder's eight job variables are known names", function () {
  const builder = fs.readFileSync(path.join(root, "docs/jedox/email-builder.md"), "utf8");
  assert.equal((builder.match(/email-var-tag/g) || []).length, 8);
  assert.deepEqual(shared.KNOWN_JOB_VARIABLES, [
    "TEST_MODE",
    "RECIPIENT_TEST",
    "PERIOD",
    "VERSION_PLAN",
    "VERSION_ACTUAL",
    "SUBJECT_TEMPLATE",
    "COLOR_VARIANCE",
    "SOURCE_EXTRACT"
  ]);
  shared.KNOWN_JOB_VARIABLES.forEach(function (name) {
    assert.ok(builder.indexOf(name) >= 0, name);
    assert.deepEqual(checker.checkScript("API.getProperty('" + name + "')", { scriptType: "job" }).issues, [], name);
    assert.deepEqual(checker.checkScript("def mailer = API.getMailer()\nsetting('" + name + "', 'x')", { scriptType: "job" }).issues, [], name);
  });
  const unknown = checker.checkScript("API.getProperty('TEMPLATE_FILE')\nAPI.getProperty('PERIOD')", { scriptType: "job" });
  assert.deepEqual(unknown.issues.map(function (issue) { return issue.kind + ":" + issue.items[0].name; }), ["variable:TEMPLATE_FILE"]);
  assert.deepEqual(liveLint.statusBar(unknown), {
    state: "names",
    text: "? No errors or warnings. 1 name to check in your Jedox, listed below."
  });
  assert.deepEqual(liveLint.statusBar(checker.checkScript("API.getProperty('PERIOD')\nsetting('TEST_MODE', 'true')", { scriptType: "job" })), {
    state: "clear",
    text: "✓ No problems found"
  });
});

test("copy tells you it worked on the button, then restores the label", function () {
  assert.equal(generate.MESSAGES.copied, "Copied ✓");
  assert.equal(generate.MESSAGES.copyFailed, "Copy failed. Select the text and press Ctrl+C.");
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-builder-ui.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "docs/jedox/email-builder.md"), "utf8");
  assert.match(ui, /copyBtn\.textContent = gen\.MESSAGES\.copied/);
  assert.match(ui, /copyBtn\.textContent = copyLabel/);
  assert.match(ui, /setTimeout\(function \(\) \{[\s\S]*copyBtn\.textContent = copyLabel;[\s\S]*\}, 2000\)/);
  assert.match(ui, /status\.textContent = gen\.MESSAGES\.copyFailed/);
  assert.match(page, /id="email-status" role="status" aria-live="polite"/);
});

test("plain setMessage is not an html error", function () {
  const script = "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setMessage('Hello')\nmailer.send()\n";
  assert.deepEqual(allIssues(script), []);
});

test("autocomplete offers Jedox calls and job variables, not deprecated setServer", function () {
  const labels = completions.suggestions().map(function (item) { return item.label; });
  const joined = labels.join("\n");
  ["API.getMailer()", "API.initSource()", "API.getProperty()", "setHtmlMessage()", "setting()", "readFile()"].forEach(function (label) {
    assert.ok(labels.indexOf(label) >= 0, label);
  });
  ["TEST_MODE", "RECIPIENT_TEST", "PERIOD", "VERSION_PLAN", "VERSION_ACTUAL", "SUBJECT_TEMPLATE", "COLOR_VARIANCE", "SOURCE_EXTRACT", "TEMPLATE_FILE", "RECIPIENTS_FILE", "ACCOUNTS_FILE", "COST_CENTERS_FILE"].forEach(function (label) {
    const item = completions.suggestions().filter(function (row) { return row.label === label; })[0];
    assert.ok(item, label);
    assert.equal(item.detail, "job variable");
  });
  assert.equal(completions.suggestions().filter(function (row) { return row.label === "API.initSource()"; })[0].detail, "Jedox API");
  assert.equal(joined.indexOf("setServer"), -1);
  assert.equal(joined.indexOf("setSMTPServer"), -1);
  assert.equal(joined.indexOf("setSender"), -1);
  assert.equal(joined.indexOf("smtp.example.com"), -1);
  assert.deepEqual(completions.matching("setServer").map(function (item) { return item.label; }), []);
  assert.deepEqual(completions.matching("setS").map(function (item) { return item.label; }), ["setSubject()"]);
  assert.ok(completions.matching("set").every(function (item) { return item.label.indexOf("setServer") < 0; }));
  assert.equal(completions.visible(completions.suggestions()).length, completions.MAX_ROWS);
  assert.equal(completions.MAX_ROWS, 8);
});

test("autocomplete excludes calls the checker flags as deprecated or wrong", function () {
  assert.deepEqual(completions.wrongCallRules(), ["EM04", "EM06", "EM07"]);
  assert.equal(completions.blockedByChecker("API.getSource()"), "EM07");
  assert.equal(completions.blockedByChecker("setServer('smtp.example.com', 'user', 'secret')"), "EM04");
  assert.equal(completions.blockedByChecker("mailer.setServer('smtp.example.com', 'user', 'secret')"), "EM04");
  assert.equal(completions.blockedByChecker("setSMTPServer('smtp.example.com')"), "EM04");
  assert.equal(completions.blockedByChecker("setSender('reports@example.com')"), "EM04");
  assert.equal(completions.blockedByChecker("setMessage(html)"), "EM06");
  assert.equal(completions.blockedByChecker("API.initSource()"), "");
  assert.equal(completions.blockedByChecker("setHtmlMessage()"), "");
  assert.equal(completions.blockedByChecker("setMessage()"), "");
  assert.equal(completions.blockedByChecker("API.getMailer()"), "");
  assert.equal(completions.blockedByChecker("readFile()"), "");
  assert.equal(completions.blockedByChecker("setting()"), "");
  const labels = completions.suggestions().map(function (item) { return item.label; });
  assert.equal(labels.indexOf("API.getSource()"), -1);
  assert.equal(labels.indexOf("setMessage(html)"), -1);
  assert.ok(labels.indexOf("API.initSource()") >= 0);
  assert.ok(labels.indexOf("API.getMailer()") >= 0);
  assert.ok(labels.indexOf("setMessage()") >= 0);
  completions.CANDIDATES.forEach(function (label) {
    const blocked = completions.blockedByChecker(label);
    assert.equal(labels.indexOf(label) >= 0, !blocked, label + " " + blocked);
  });
  labels.forEach(function (label) {
    assert.equal(completions.blockedByChecker(label), "", label);
  });
  assert.ok(completions.CANDIDATES.indexOf("API.getSource()") >= 0);
  assert.ok(completions.CANDIDATES.some(function (label) {
    return label.indexOf("setServer(") >= 0 && label.indexOf("secret") >= 0;
  }));
  assert.deepEqual(completions.matching("getSource").map(function (item) { return item.label; }), []);
  assert.ok(completions.matching("getS").every(function (item) { return item.label.indexOf("getSource") < 0; }));
  assert.deepEqual(completions.JEDOX_CALLS, labels.filter(function (label) {
    return completions.JOB_VARIABLES.indexOf(label) < 0;
  }));
});

test("autocomplete matches the documented Jedox 26.1 calls", function () {
  const rows = completions.suggestions();
  const labels = rows.map(function (item) { return item.label; });
  ["getColumnDouble()", "getColumnInt()", "getColumnLong()", "readText()"].forEach(function (label) {
    assert.equal(completions.CANDIDATES.indexOf(label), -1, label);
    assert.equal(labels.indexOf(label), -1, label);
  });
  ["nextRow()", "getColumnString()", "getColumnValue()", "close()", "readBinary()"].forEach(function (label) {
    const item = rows.filter(function (row) { return row.label === label; })[0];
    assert.ok(item, label);
    assert.equal(item.detail, "Jedox API");
  });
  ["readFile()", "setting()"].forEach(function (label) {
    const item = rows.filter(function (row) { return row.label === label; })[0];
    assert.ok(item, label);
    assert.equal(item.detail, "from the email script");
  });
  assert.deepEqual(completions.matching("readT").map(function (item) { return item.label; }), []);
  assert.deepEqual(completions.matching("read").map(function (item) { return item.label; }).sort(), ["readBinary()", "readFile()"]);
  assert.ok(completions.matching("getColumn").every(function (item) {
    return item.label !== "getColumnDouble()" && item.label !== "getColumnInt()" && item.label !== "getColumnLong()";
  }));
  assert.deepEqual(completions.matching("API.").map(function (item) { return item.label; }), [
    "API.getMailer()",
    "API.getProperty()",
    "API.initSource()"
  ]);
});

test("live lint waits 400ms after typing stops", function () {
  const { mock } = require("node:test");
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(liveLint.QUIET_MS, 400);
    assert.equal(liveLint.DROPDOWN_MIN_WIDTH, 640);
    assert.equal(liveLint.STACK_BELOW, 1100);
    assert.equal(liveLint.dropdownEnabled(639), false);
    assert.equal(liveLint.dropdownEnabled(640), true);
    assert.equal(liveLint.dropdownEnabled(390), false);
    assert.equal(liveLint.issuesBelowEditor(1099), true);
    assert.equal(liveLint.issuesBelowEditor(1100), false);
    assert.equal(liveLint.issuesBelowEditor(1440), false);
    const runs = [];
    const live = liveLint.createLiveLint(liveLint.QUIET_MS);
    live.push(function () { runs.push("first"); });
    mock.timers.tick(399);
    assert.deepEqual(runs, []);
    live.push(function () { runs.push("second"); });
    mock.timers.tick(399);
    assert.deepEqual(runs, []);
    mock.timers.tick(1);
    assert.deepEqual(runs, ["second"]);
    assert.equal(live.pending(), false);
  } finally {
    mock.timers.reset();
  }
});

test("the checker page lints on the quiet period and stacks by width", function () {
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-checker-ui.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "docs/jedox/email-checker.md"), "utf8");
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  assert.match(ui, /delay:\s*liveLint\.QUIET_MS/);
  assert.match(ui, /maxRenderedOptions:\s*completions\.MAX_ROWS/);
  assert.match(ui, /dropdownEnabled\(window\.innerWidth\)/);
  assert.doesNotMatch(page, /Check script/);
  assert.match(page, /data-placeholder="Paste or type your Groovy script here\."/);
  assert.doesNotMatch(page, /Nothing leaves your browser\."/);
  assert.match(page, /It suggests documented Jedox calls, plus the helper functions and job variables from the Automated value emails script\./);
  assert.doesNotMatch(page, /It also suggests/);
  assert.equal(page.split("as you type").length - 1, 1);
  const leadAt = page.indexOf("Paste or type your Groovy script. It checks as you type, and nothing leaves your browser.");
  const editorAt = page.indexOf('id="email-editor"');
  const gridAt = page.indexOf('<div class="email-grid email-grid-checker">');
  const howAt = page.indexOf('<details class="email-how" id="email-how" open>');
  assert.equal(ui.indexOf("how.open"), -1);
  assert.ok(leadAt >= 0 && leadAt < editorAt && editorAt < howAt);
  const betweenGridAndHow = page.slice(gridAt, howAt);
  assert.equal((betweenGridAndHow.match(/<div\b/g) || []).length, (betweenGridAndHow.match(/<\/div>/g) || []).length);
  assert.match(css, /@media screen and \(max-width: 1100px\)/);
  assert.match(css, /underline dotted #9aa7b4/);
  assert.match(css, /#email-checker \.cm-content:focus-visible \{\s*outline: none;/);
  assert.match(css, /@media screen and \(min-width: 1100px\) \{\s*#email-checker \.email-grid-checker \{\s*grid-template-columns: minmax\(0, 1\.7fr\) minmax\(320px, 1fr\);/);
  assert.equal(css.includes("position: sticky"), false);
  assert.match(css, /#email-checker \.email-editor-column,\s*#email-checker \.email-editor \{\s*position: static;/);
  assert.doesNotMatch(css, /#email-checker \.email-how \{\s*grid-column:/);
  assert.doesNotMatch(css, /#email-checker \.email-how \{\s*order:/);
  assert.match(css, /#email-checker \.cm-lint-marker-error \{\s*color: #f87171;/);
  assert.match(css, /#email-checker \.cm-lint-marker-warning \{\s*color: #fbbf24;/);
  assert.match(ui, /mark = "✕"/);
  assert.match(ui, /mark = "!"/);
  assert.match(ui, /setAttribute\("aria-label", kind\)/);
  assert.match(css, /#email-checker \.cm-content,\s*#email-checker \.cm-line,\s*#email-checker \.cm-gutters \{\s*font-size: 13px;/);
  assert.match(css, /\.email-issue pre > code \{[^}]*white-space: pre-wrap;/);
  assert.match(css, /\.email-issue pre > code \{[^}]*overflow-wrap: anywhere;/);
  const bundle = fs.readFileSync(path.join(root, "docs/javascripts/codemirror-bundle.js"), "utf8");
  assert.equal(bundle.indexOf("jsdelivr"), -1);
  assert.equal(bundle.indexOf("unpkg.com"), -1);
  assert.equal(bundle.indexOf("esm.sh"), -1);
});

test("the issues bar has four states", function () {
  assert.deepEqual(liveLint.statusBar({ empty: true, issues: [] }), { state: "hidden", text: "" });
  assert.deepEqual(liveLint.statusBar({ empty: false, notGroovy: true, issues: [] }), { state: "hidden", text: "" });
  assert.deepEqual(liveLint.statusBar({ empty: false, issues: [] }), { state: "clear", text: "✓ No problems found" });
  const knownOnly = checker.checkScript("API.getProperty('PERIOD')", { scriptType: "job" });
  assert.deepEqual(knownOnly.issues, []);
  assert.deepEqual(liveLint.statusBar(knownOnly), { state: "clear", text: "✓ No problems found" });
  const oneName = checker.checkScript("API.getProperty('NOT_A_JOB_VARIABLE')", { scriptType: "job" });
  assert.deepEqual(oneName.issues.map(function (issue) { return issue.severity; }), ["check"]);
  assert.deepEqual(liveLint.statusBar(oneName), {
    state: "names",
    text: "? No errors or warnings. 1 name to check in your Jedox, listed below."
  });
  const twoNames = checker.checkScript("API.getProperty('NOT_A_JOB_VARIABLE')\nAPI.getProperty('ALSO_UNKNOWN')", { scriptType: "job" });
  assert.deepEqual(liveLint.statusBar(twoNames), {
    state: "names",
    text: "? No errors or warnings. 2 names to check in your Jedox, listed below."
  });
  const threeNames = liveLint.statusBar({
    empty: false,
    issues: [
      { severity: "check", items: [{ name: "PERIOD" }] },
      { severity: "check", items: [{ name: "PnL" }, { name: "Other" }] }
    ]
  });
  assert.equal(threeNames.state, "names");
  assert.equal(threeNames.text, "? No errors or warnings. 3 names to check in your Jedox, listed below.");
  assert.deepEqual(liveLint.statusBar({
    empty: false,
    issues: [{ severity: "error", rule: "EM01" }, { severity: "check", rule: "NAME", items: [{ name: "PERIOD" }] }]
  }), {
    state: "issues",
    text: "Issues (2)"
  });
  assert.deepEqual(liveLint.statusBar({ empty: false, issues: [{ rule: "EM01" }, { rule: "EM04" }] }), {
    state: "issues",
    text: "Issues (2)"
  });
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-checker-ui.js"), "utf8");
  const messages = fs.readFileSync(path.join(root, "docs/javascripts/email-check-messages.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  assert.equal(ui.indexOf("withChecks"), -1);
  assert.equal(ui.indexOf("There are still"), -1);
  assert.equal(messages.indexOf("There are still"), -1);
  assert.match(ui, /!errors\.length && !warnings\.length && !checks\.length/);
  assert.match(ui, /is-names/);
  assert.equal(liveLint.howDetailsOpen(639), false);
  assert.equal(liveLint.howDetailsOpen(640), true);
  assert.equal(liveLint.howDetailsOpen(1440), true);
  assert.match(ui, /aria-live="polite"|statusLive/);
  assert.match(ui, /liveLint\.statusBar\(result\)/);
  assert.match(css, /#email-checker \.email-sticky\.is-clear \{[^}]*color: #A3E635;/);
  assert.match(css, /#email-checker \.email-sticky\.is-clear \{[^}]*border: 1px solid #A3E635;/);
  assert.match(css, /#email-checker \.email-sticky\.is-names,\s*#email-checker \.email-sticky\.is-cutoff \{[^}]*color: #8B98A5;/);
  assert.match(css, /#email-checker \.email-sticky\.is-names,\s*#email-checker \.email-sticky\.is-cutoff \{[^}]*border: 1px solid #8B98A5;/);
  assert.match(css, /#email-checker \.email-sticky\[hidden\] \{\s*display: none !important;/);
  assert.match(css, /min-height: 48px;/);
  assert.match(css, /#email-checker \.email-how > summary::before \{[^}]*content: none;/);
  assert.match(css, /#email-checker \.email-how > summary::before \{[^}]*display: none;/);
  assert.match(css, /#email-checker \.email-how > summary::after \{[^}]*border-right: 2px solid currentColor;/);
});

test("a long script counts eight names in the bar and the pill", function () {
  assert.equal(sources.groovy.replace(/\n$/, "").split("\n").length, 393);
  const published = checker.checkScript(sources.groovy, { scriptType: "job" });
  assert.equal(published.issues.every(function (issue) { return issue.severity === "check"; }), true);
  assert.equal(liveLint.nameCount(published.issues), 8);
  assert.equal(liveLint.checkPillText(published), "8 names to check");
  const bar = liveLint.statusBar(published);
  assert.equal(bar.state, "names");
  assert.ok(bar.text.indexOf(liveLint.checkPillText(published)) >= 0, bar.text);
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-checker-ui.js"), "utf8");
  assert.match(ui, /liveLint\.checkPillText\(result\)/);
});

test("an unknown API call is a name to check", function () {
  const unknown = checker.checkScript("def m = API.getM", { scriptType: "job" });
  assert.equal(unknown.issues.length, 1);
  assert.equal(unknown.issues[0].severity, "check");
  assert.equal(unknown.issues[0].kind, "call");
  assert.equal(unknown.issues[0].items[0].name, "API.getM");
  assert.equal(liveLint.statusBar(unknown).state, "names");
  assert.equal(liveLint.checkPillText(unknown), "1 name to check");
  assert.ok(liveLint.statusBar(unknown).text.indexOf("1 name to check") >= 0);
  const known = checker.checkScript("def m = API.getMailer()", { scriptType: "job" });
  assert.deepEqual(known.issues, []);
  assert.equal(liveLint.statusBar(known).state, "clear");
  const commented = checker.checkScript("def m = API.getMailer()\n// API.getM\nString s = 'API.getNope'", { scriptType: "job" });
  assert.deepEqual(commented.issues, []);
  const deprecated = checker.checkScript("def src = API.getSource('X')", { scriptType: "job" });
  assert.ok(deprecated.issues.some(function (issue) { return issue.rule === "EM07"; }));
  assert.equal(deprecated.issues.some(function (issue) { return issue.kind === "call"; }), false);
  assert.notEqual(liveLint.statusBar(deprecated).state, "clear");
  const members = completions.CANDIDATES.map(function (label) {
    var match = /^API\.([A-Za-z_][\w]*)/.exec(label);
    return match ? match[1] : "";
  }).filter(Boolean);
  assert.deepEqual(members.slice().sort(), shared.DOCUMENTED_API_MEMBERS.slice().sort());
  members.forEach(function (member) {
    const result = checker.checkScript("def x = API." + member + "()", { scriptType: "job" });
    assert.equal(result.issues.some(function (issue) { return issue.kind === "call"; }), false, member);
  });
});

test("paste keeps the cursor on line 1", function () {
  const empty = liveLint.pasteChange(0, 0, sources.groovy, 0);
  assert.equal(empty.pinTop, true);
  assert.equal(empty.selection.anchor, 0);
  assert.equal(empty.selection.head, 0);
  assert.equal(empty.scrollIntoView, false);
  assert.equal(empty.changes.insert, sources.groovy);
  const replaced = liveLint.pasteChange(0, 80, "line one\nline two\n", 80);
  assert.equal(replaced.pinTop, true);
  assert.equal(replaced.selection.anchor, 0);
  assert.equal(liveLint.pasteReplacesAll(0, 80, 80), true);
  const mid = liveLint.pasteChange(10, 12, "hello\nthere", 40);
  assert.equal(mid.pinTop, false);
  assert.equal(mid.scrollIntoView, true);
  assert.equal(mid.selection.anchor, 10 + "hello\nthere".length);
  assert.equal(mid.selection.head, mid.selection.anchor);
  const atStart = liveLint.pasteChange(0, 0, "x", 40);
  assert.equal(atStart.pinTop, false);
  assert.equal(atStart.selection.anchor, 1);
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-checker-ui.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  const page = fs.readFileSync(path.join(root, "docs/jedox/email-checker.md"), "utf8");
  assert.match(ui, /liveLint\.pasteChange\([\s\S]*docLength\)/);
  assert.match(ui, /if \(change\.pinTop\)/);
  assert.match(ui, /editorView\.scrollDOM\.scrollTop = 0/);
  assert.match(ui, /scrollIntoView\(head, \{ y: "nearest" \}\)/);
  assert.doesNotMatch(ui, /EditorView\.lineWrapping/);
  assert.match(ui, /is-line-target/);
  assert.match(ui, /cm-lint-marker/);
  assert.match(ui, /revealCard\(/);
  assert.match(css, /max-height: calc\(100vh - 160px\)/);
  assert.match(css, /max-height: 60vh/);
  assert.match(css, /max-height: 50vh/);
  assert.match(css, /overscroll-behavior: auto/);
  assert.match(css, /white-space: pre;/);
  assert.match(page, /id="email-expand-btn" aria-expanded="false"/);
  assert.match(page, /Expand editor ↕/);
});

test("phone preview scrolls below the header and returns to the last field", function () {
  assert.equal(shared.scrollBehavior(true), "auto");
  assert.equal(shared.scrollBehavior(false), "smooth");
  assert.equal(shared.previewScrollMargin(48), 60);
  assert.equal(shared.previewScrollMargin(0), 12);
  assert.equal(shared.previewScrollMargin(-4), 12);
  assert.equal(shared.labelScrollMargin(48), "calc(48px + 16px)");
  assert.equal(shared.labelScrollMargin(48.4), "calc(48px + 16px)");
  assert.equal(shared.labelScrollMargin(0), "calc(0px + 16px)");
  assert.equal(shared.labelScrollMargin(-4), "calc(0px + 16px)");
  assert.equal(shared.returnField(null, "field-subject"), "field-subject");
  assert.equal(shared.returnField(undefined, "field-subject"), "field-subject");
  assert.equal(shared.returnField("field-note", "field-subject"), "field-note");
  const periodLabel = { tagName: "LABEL" };
  const periodDoc = {
    querySelector: function (selector) {
      return selector === 'label[for="field-period"]' ? periodLabel : null;
    }
  };
  const periodField = { id: "field-period", ownerDocument: periodDoc };
  assert.equal(shared.fieldLabel(periodField), periodLabel);
  assert.equal(shared.fieldLabel({ id: "field-missing", ownerDocument: periodDoc }).id, "field-missing");
  assert.equal(shared.fieldLabel(null), null);
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-builder-ui.js"), "utf8");
  assert.match(ui, /scrollIntoView\(/);
  assert.match(ui, /scrollMarginTop/);
  assert.match(ui, /prefers-reduced-motion: reduce/);
  assert.match(ui, /max-width: 760px/);
  assert.match(ui, /lastEdited = fields\[name\]/);
  assert.match(ui, /shared\.returnField\(lastEdited, fields\.subject\)/);
  assert.match(ui, /shared\.fieldLabel\(field\)/);
  assert.match(ui, /shared\.labelScrollMargin\(headerOffset\(\)\)/);
  assert.match(ui, /shared\.previewScrollMargin\(headerOffset\(\)\)/);
  assert.match(ui, /focus\(\{ preventScroll: true \}\)/);
  assert.match(ui, /getElementById\("tab-preview"\)/);
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  const extra = fs.readFileSync(path.join(root, "docs/stylesheets/extra.css"), "utf8");
  const builderPage = fs.readFileSync(path.join(root, "docs/jedox/email-builder.md"), "utf8");
  assert.match(builderPage, /class="email-bar-space"/);
  assert.match(css, /#email-builder \.email-bar-space \{\s*height: 64px;/);
  assert.match(css, /#email-builder \.email-frame-wrap iframe \{\s*min-height: 640px;/);
  assert.match(css, /:has\(#email-builder\) > \.email-lead \{\s*min-height: 135px;/);
  assert.match(extra, /font-family: "Inter Fallback"/);
  assert.match(extra, /font-family: "JetBrains Mono Fallback"/);
  assert.doesNotMatch(css, /@font-face/);
  assert.match(css, /body:has\(#email-builder\) \.md-path \{\s*font-family: "Inter", "Inter Fallback"/);
  assert.match(css, /@media screen and \(max-width: 390px\) \{\s*#email-builder \{\s*min-height: 1862\.45px;/);
  assert.match(css, /@media screen and \(min-width: 391px\) and \(max-width: 412px\) \{\s*#email-builder \{\s*min-height: 1769\.67px;/);
  assert.equal(ui.indexOf("paddingBottom"), -1);
  assert.equal(ui.indexOf("email-bar-space"), -1);
});

test("a mistake on line 2051 does not count as a clean script", function () {
  const lines = ["def mailer = API.getMailer()"];
  while (lines.length < 2050) lines.push("// still fine");
  lines.push('String subject = "${cc}"');
  assert.equal(lines.length, 2051);
  const hidden = checker.checkScript(lines.join("\n"), { scriptType: "job" });
  assert.equal(hidden.truncated, true);
  assert.equal(hidden.lineLimit, 2000);
  assert.equal(hidden.issues.length, 0);
  assert.equal(hidden.issues.some(function (issue) { return issue.line === 2051; }), false);
  const bar = liveLint.statusBar(hidden);
  assert.notEqual(bar.state, "clear");
  assert.equal(bar.state, "cutoff");
  assert.equal(bar.text, "? No problems in the first 2,000 lines. The rest wasn't checked.");
  lines[10] = 'String early = "${period}"';
  const found = checker.checkScript(lines.join("\n"), { scriptType: "job" });
  assert.ok(found.issues.some(function (issue) { return issue.rule === "EM01" && issue.line === 11; }));
  assert.equal(found.issues.some(function (issue) { return issue.line > 2000; }), false);
  assert.deepEqual(liveLint.statusBar(found), {
    state: "issues",
    text: "Issues (1)"
  });
  assert.equal(liveLint.checkedLinesNote(2000), "Only the first 2,000 lines were checked.");
  assert.equal(
    messages.tooLong.replace("{n}", liveLint.formatLineCount(2000)),
    "That's a long script. The checker reads the first 2,000 lines."
  );
  const within = checker.checkScript("def mailer = API.getMailer()\n", { scriptType: "job" });
  assert.equal(within.truncated, false);
  assert.equal(liveLint.statusBar(within).state, "clear");
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-checker-ui.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  assert.match(ui, /is-cutoff/);
  assert.match(ui, /email-sticky-note/);
  assert.match(ui, /copy\.tooLong\.replace\("\{n\}", liveLint\.formatLineCount\(result\.lineLimit\)\)/);
  assert.match(ui, /!result\.truncated && !errors\.length/);
  assert.match(css, /#email-checker \.email-sticky\.is-cutoff \{[^}]*color: #8B98A5;/);
  assert.match(css, /#email-checker \.cm-scroller \{\s*padding-bottom: 56px;/);
});

test("the live editor uses the Web Designer syntax colours", function () {
  const entry = fs.readFileSync(path.join(root, "tools/codemirror/entry.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/email-checker-ui.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "docs/stylesheets/email-tool.css"), "utf8");
  assert.match(entry, /@codemirror\/legacy-modes\/mode\/groovy/);
  assert.match(entry, /StreamLanguage\.define/);
  assert.match(ui, /cm\.groovy\(\)/);
  assert.match(css, /#email-checker \.tok-key \{[^}]*color: #a78bfa;/);
  assert.match(css, /#email-checker \.tok-fn \{[^}]*color: #38bdf8;/);
  assert.match(css, /#email-checker \.tok-str \{[^}]*color: #a3e635;/);
  assert.match(css, /#email-checker \.tok-num \{[^}]*color: #f0abfc;/);
  assert.match(css, /#email-checker \.tok-cmt \{[^}]*color: #8b98a5;[^}]*font-style: italic;/);
  assert.match(css, /#email-checker \.cm-line \{[^}]*color: #e6edf3;/);
  assert.doesNotMatch(css, /#email-checker \.tok-(?:key|fn|str|num|cmt) \{[^}]*(#f87171|#fbbf24)/i);
  assert.doesNotMatch(css, /#email-checker \.tok-(?:key|str|cmt|num|fn) \{[^}]*text-decoration/);
});

test("the CodeMirror bundle keeps the MIT banner", function () {
  const bundle = fs.readFileSync(path.join(root, "docs/javascripts/codemirror-bundle.js"), "utf8");
  const license = fs.readFileSync(path.join(root, "docs/javascripts/LICENSE-codemirror.txt"), "utf8");
  assert.ok(bundle.startsWith("/*!\n" + license + "*/\n"), "banner is the licence file at the top of the bundle");
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
  [
    "@codemirror/autocomplete",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/legacy-modes",
    "@codemirror/lint",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@marijn/find-cluster-break",
    "crelt",
    "style-mod",
    "w3c-keyname"
  ].forEach(function (name) {
    assert.match(license, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
  [
    "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
    "Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
    "Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin>",
    "Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>",
    "Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others"
  ].forEach(function (line) {
    assert.ok(license.indexOf(line) >= 0, line);
  });
  const code = bundle.slice(bundle.indexOf("*/\n") + 3);
  assert.ok(code.length > 1000);
  const commentAt = code.indexOf("/*");
  assert.equal(code.slice(commentAt - 1, commentAt + 3), '"/*"', "the only /* after the banner is the Groovy block-comment delimiter");
  assert.equal(code.indexOf("/*", commentAt + 2), -1);
});
