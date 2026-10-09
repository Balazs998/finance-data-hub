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
    EM08: 2
  };
  Object.keys(cases).forEach(function (rule) {
    assert.deepEqual(allIssues(cases[rule], "job"), ["error:".concat(rule, "@", expectedLine[rule]).replace("error:EM03", "warning:EM03").replace("error:EM04", "warning:EM04").replace("error:EM05", "warning:EM05").replace("error:EM07", "warning:EM07")], rule);
  });
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
    "EM08@2",
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
  assert.match(job.issues[5].explanation, /Extract name `'PnL_Extract'` can't be verified here/);
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

test("plain setMessage is not an html error", function () {
  const script = "def mailer = API.getMailer()\nboolean testMode = true\nmailer.reset()\nmailer.addRecipient(to)\nmailer.setMessage('Hello')\nmailer.send()\n";
  assert.deepEqual(allIssues(script), []);
});
