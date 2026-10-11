const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const checks = require("../static-checks/checks.js");

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

const pack = readJson("knowledge/jedox-rules-2026.1.json");
const examples = readJson("knowledge/examples-2026.1.json");

function keyOf(item) {
  return [item.code, item.group, item.severity, item.source].join("|");
}

function runCase(ruleCase) {
  return checks.checkRule(ruleCase.rule, {
    version: ruleCase.jedox_version,
    cube: ruleCase.cube,
    pack: pack,
    metadata: examples.metadata
  });
}

const files = fs.readdirSync(path.join(root, "tests", "rules"))
  .filter(function (name) { return name.endsWith(".json"); })
  .sort();

const cases = [];
files.forEach(function (name) {
  const doc = readJson(path.join("tests", "rules", name));
  assert.ok(Array.isArray(doc.cases), name + " must contain a cases array");
  doc.cases.forEach(function (ruleCase) {
    ruleCase.file = name;
    cases.push(ruleCase);
  });
});

test("regression library has the signed-off 32 cases", function () {
  assert.deepEqual(files, ["broken.json", "correct.json", "inefficient.json"]);
  assert.equal(cases.length, 32);
});

cases.forEach(function (ruleCase) {
  test(ruleCase.id + " reproduces expected static findings", function () {
    const result = runCase(ruleCase);
    const actual = result.findings.map(keyOf).sort();
    const expected = (ruleCase.expected_findings || []).map(keyOf).sort();
    assert.deepEqual(
      actual,
      expected,
      ruleCase.id + "\nexpected " + expected.join(", ") + "\nactual   " + actual.join(", ") +
        "\nmessages " + result.findings.map(function (item) { return item.code + ": " + item.message; }).join(" | ")
    );
    result.findings.forEach(function (item) {
      assert.equal(item.source, "static");
      assert.ok(item.message && item.message.length > 0);
    });
  });
});

test("built-in examples keep known elements and do not raise syntax errors", function () {
  examples.examples.forEach(function (example) {
    const result = checks.checkRule(example.rule, {
      version: examples.jedox_version,
      cube: example.cube,
      pack: pack,
      metadata: examples.metadata
    });
    const syntaxErrors = result.findings.filter(function (item) {
      return item.group === "syntax" && item.severity === "error";
    });
    assert.deepEqual(syntaxErrors, [], example.id + " " + JSON.stringify(syntaxErrors));
  });
});

test("N: is a check-level legacy note, not a hard error", function () {
  const result = checks.checkRule(
    "['Version':'Variance'] = N: ['Version':'Actual'] - ['Version':'Budget']",
    { version: "2026.1", cube: "PnL", pack: pack, metadata: examples.metadata }
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].code, "LEGACY_PREFIX");
  assert.equal(result.findings[0].severity, "info");
  assert.equal(result.findings[0].source, "static");
});

test("a single variadic argument is not a hard error", function () {
  const result = checks.checkRule(
    "['Version':'Forecast'] = B: SUM(['Version':'Actual'])",
    { version: "2026.1", cube: "PnL", pack: pack, metadata: examples.metadata }
  );
  const hard = result.findings.filter(function (item) { return item.severity === "error"; });
  assert.deepEqual(hard, []);
  assert.ok(result.findings.some(function (item) { return item.code === "ARITY_UNVERIFIED" && item.severity === "check"; }));
});

test("full dictionary lists recognise CC4010 and 400000 and reject a typo", function () {
  const known = checks.checkRule(
    "['Version':'Forecast','CostCenter':'CC4010','Account':'400000'] = B: 0",
    { version: "2026.1", cube: "PnL", pack: pack, metadata: examples.metadata }
  );
  assert.deepEqual(known.findings.filter(function (item) { return item.severity === "error"; }), []);
  const typo = checks.checkRule(
    "['CostCenter':'CC9999'] = B: 1",
    { version: "2026.1", cube: "PnL", pack: pack, metadata: examples.metadata }
  );
  assert.ok(typo.findings.some(function (item) { return item.code === "UNKNOWN_ELEMENT"; }));
  ["['Period':'FY2026'] = B: 1", "['CostCenter':'All Cost Centers'] = B: 1"].forEach(function (rule) {
    const result = checks.checkRule(rule, { version: "2026.1", cube: "PnL", pack: pack, metadata: examples.metadata });
    assert.deepEqual(result.findings.filter(function (item) { return item.code === "UNKNOWN_ELEMENT"; }), [], rule);
  });
});

test("version switching loads the 2025.1 pack and marks unverified findings", function () {
  const pack2025 = readJson("knowledge/jedox-rules-2025.1.json");
  assert.equal(pack2025.jedox_version, "2025.1");
  const rule = "['Version':'Variance'] = B: COS(0)";
  const current = checks.checkRule(rule, { version: "2026.1", cube: "PnL", pack: pack, metadata: examples.metadata });
  const older = checks.checkRule(rule, { version: "2025.1", cube: "PnL", pack: pack2025, metadata: examples.metadata });
  const currentDde = current.findings.filter(function (item) { return item.code === "DDE_UNSUPPORTED_FUNCTION"; });
  const olderDde = older.findings.filter(function (item) { return item.code === "DDE_UNSUPPORTED_FUNCTION"; });
  assert.equal(currentDde.length, 1);
  assert.equal(olderDde.length, 1);
  assert.equal(currentDde[0].message.indexOf("unverified for 2025.1"), -1);
  assert.match(olderDde[0].message, /unverified for 2025.1/);
  const isnull = pack2025.functions.filter(function (fn) { return fn.name === "ISNULL"; })[0];
  assert.notEqual(isnull.unverified_for_version, true);
  const cos = pack2025.functions.filter(function (fn) { return fn.name === "COS"; })[0];
  assert.equal(cos.unverified_for_version, true);
  const ui = fs.readFileSync(path.join(root, "docs/javascripts/rule-studio-ui.js"), "utf8");
  assert.match(ui, /jedox-rules-2025\.1\.json/);
  assert.match(ui, /jedox-rules-2026\.1\.json/);
  assert.match(ui, /Jedox 2025\.1: rules are checked against the 2026\.1 reference; Jedox's public docs list no rule changes between these versions\./);
  assert.match(ui, /packs\["2026\.1"\]\) versionSelect\.value = "2026\.1"/);
});
