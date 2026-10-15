const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const ui = require("../docs/javascripts/rule-studio-ui.js");
const validate = require("../ai-engine/validate.js");

const root = path.join(__dirname, "..");

async function workerSchemas() {
  const handlerUrl = pathToFileURL(path.join(root, "worker/src/handler.js")).href;
  const worker = await import(handlerUrl);
  assert.equal(typeof worker.schemas, "object");
  assert.equal(typeof worker.schemas.analyzeRequest, "object");
  assert.equal(typeof worker.schemas.generateRequest, "object");
  assert.equal(typeof worker.schemas.refineRequest, "object");
  return worker.schemas;
}

function sampleInput(version, answers) {
  return {
    version: version,
    database: "FDH_DEMO",
    cube: "PnL",
    sourceCubes: "FX_RATE",
    dimensions: [{ name: "Account", elements: "400000", level: "Base", role: "Other" }],
    story: "Calculate variance as actual minus budget.",
    answers: answers,
    metadata: { database: "FDH_DEMO", cubes: { PnL: ["Account"] } },
    rule: "['Variance'] = ['Actual'] - ['Budget']",
    chips: ["Only actuals"],
    instruction: "Simpler explanation"
  };
}

async function posted(version, pathName, body) {
  var captured = null;
  var transport = ui.createTransport({
    turnstile: function () {
      return {
        getResponse: function () { return "page-token"; },
        reset: function () {}
      };
    },
    widgetId: function () { return "widget"; },
    ready: function () { return true; },
    version: function () { return version; },
    url: function (requestPath) { return "https://fdh-rule-studio.example" + requestPath; },
    fetch: function (url, init) {
      captured = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve({ ok: true, ai: { mock: true } }); }
      });
    },
    wait: function () { return Promise.resolve(); },
    pollMs: 1,
    tokenWaitMs: 0,
    readyWaitMs: 0
  });
  await transport.post(pathName, body);
  return captured;
}

test("page analyze, generate, and refine bodies match the worker schema for every picker version", async function () {
  const schemas = await workerSchemas();
  const versions = ui.VERSIONS;
  assert.ok(Array.isArray(versions) && versions.length >= 2);
  const page = fs.readFileSync(path.join(root, "docs/javascripts/rule-studio-ui.js"), "utf8");
  assert.equal(page.includes("answers || null"), false);
  assert.equal(page.includes("ruleStudioGenerateRequest"), true);
  assert.equal(page.includes("ruleStudioRefineRequest"), true);
  assert.equal(page.includes("ruleStudioAnalyzeRequest"), true);
  assert.match(page, /function showError\(message, detail\)[\s\S]*?esc\(message\)/);

  for (const version of versions) {
    const input = sampleInput(version, null);
    const analyze = await posted(version, "/analyze", ui.analyzeRequest(input));
    const generate = await posted(version, "/generate", ui.generateRequest(input));
    const refine = await posted(version, "/refine", ui.refineRequest({
      rule: input.rule,
      chips: null,
      instruction: null,
      cube: input.cube
    }));
    const answered = await posted(version, "/generate", ui.generateRequest(sampleInput(version, { basis: "Actual" })));

    assert.equal(analyze.version, version);
    assert.equal(generate.version, version);
    assert.equal(refine.version, version);
    assert.equal(generate.answers && typeof generate.answers, "object");
    assert.equal(Array.isArray(generate.answers), false);
    assert.deepEqual(generate.answers, {});
    assert.deepEqual(answered.answers, { basis: "Actual" });
    assert.ok(Array.isArray(refine.chips));
    assert.equal(typeof refine.instruction, "string");

    assert.deepEqual(validate.validate(analyze, schemas.analyzeRequest), [], version + " analyze");
    assert.deepEqual(validate.validate(generate, schemas.generateRequest), [], version + " generate");
    assert.deepEqual(validate.validate(refine, schemas.refineRequest), [], version + " refine");
    assert.deepEqual(validate.validate(answered, schemas.generateRequest), [], version + " generate answers");

    const rejected = Object.assign({}, generate, { answers: null });
    const errors = validate.validate(rejected, schemas.generateRequest);
    assert.ok(errors.some(function (item) { return item.indexOf("$.answers") === 0; }), version);
  }
});

test("invalid_request details are at most three escaped field paths", function () {
  const longName = "$.dimensions[0]." + "x".repeat(80);
  const message = ui.shownError({
    status: 400,
    payload: {
      error: "invalid_request",
      message: "ignore <b>worker</b> text",
      details: [
        "$.answers should be object",
        "$.story <script>alert(1)</script> is too short",
        longName + " is too long",
        "$.database is too long",
        "not a path, raw server text <img src=x>",
        { injected: "<i>no</i>" }
      ]
    }
  });
  assert.equal(message.indexOf("The request was not accepted. Check "), 0);
  assert.equal(message.includes("<"), false);
  assert.equal(message.includes("should be object"), false);
  assert.equal(message.includes("ignore"), false);
  assert.equal(message.includes("raw server"), false);
  const listed = message.slice("The request was not accepted. Check ".length).replace(/\.$/, "").split(", ");
  assert.equal(listed.length, 3);
  assert.deepEqual(listed.slice(0, 2), ["$.answers", "$.story"]);
  listed.forEach(function (item) { assert.ok(item.length <= 40, item); });

  assert.equal(ui.shownError({
    status: 403,
    payload: { error: "turnstile", message: "worker-turnstile-text", details: ["$.answers should be object"] }
  }), ui.TURNSTILE_FAILED);
  assert.equal(ui.shownError({
    status: 429,
    payload: { error: "rate_ip", message: "worker-rate-text", details: ["$.answers should be object"] }
  }), ui.RATE_LIMIT);
  assert.equal(ui.shownError({
    status: 400,
    payload: { error: "invalid_request" }
  }), "The request was not accepted.");
});
