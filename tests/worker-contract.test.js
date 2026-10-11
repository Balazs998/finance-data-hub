const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../worker/src/handler.cjs");

const ORIGIN = "https://balazs998.github.io";
const SECRET_RULE = "SUPER_SECRET_RULE_TEXT ['Version':'Variance'] = B: ['Version':'Actual']";

function passFetch() {
  return Promise.resolve({
    ok: true,
    json: function () { return Promise.resolve({ success: true }); }
  });
}

function baseEnv(extra) {
  return Object.assign({
    MEMORY_GATE: "1",
    TURNSTILE_SECRET: "test-secret",
    AI_PROVIDER: "mock",
    ALLOWED_ORIGIN: ORIGIN,
    fetchImpl: passFetch,
    DAILY_TOKEN_BUDGET: "100000",
    DAILY_SPEND_BUDGET_USD: "5",
    RATE_LIMIT_PER_IP: "30",
    RATE_LIMIT_GLOBAL: "400",
    TOKEN_USD: "0.000002"
  }, extra || {});
}

function post(pathname, body, env, headers) {
  return handler.handleRequest(new Request("https://worker.test" + pathname, {
    method: "POST",
    headers: Object.assign({
      "content-type": "application/json",
      origin: ORIGIN
    }, headers || {}),
    body: typeof body === "string" ? body : JSON.stringify(body)
  }), env);
}

test.describe("worker contract", { concurrency: 1 }, function () {
  test.beforeEach(function () {
    handler.resetGate();
  });

  test("mock analyze labels itself and returns static findings", async function () {
    const logs = [];
    const original = console.log;
    console.log = function (line) { logs.push(String(line)); };
    try {
      const response = await post("/analyze", {
        version: "2026.1",
        cube: "PnL_FX",
        rule: "['Measure':'Amount EUR'] = B: ['Measure':'Amount'] * PALO.DATA(\"FDH_DEMO\",\"FX_RATE\",!'Currency',\"Rate\")",
        turnstileToken: "ok"
      }, baseEnv());
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.mock, true);
      assert.equal(body.ai.mock, true);
      assert.match(body.ai.label, /not real AI/);
      assert.equal(body.provider, "mock");
      assert.ok(body.staticFindings.some(function (item) { return item.code === "PALO_DATA_ARITY" && item.source === "static"; }));
      assert.equal(JSON.stringify(body).match(/speedup|elapsed|benchmark|timing/i), null);
      assert.equal(logs.join("\n").includes("PALO.DATA"), false);
      assert.equal(logs.join("\n").includes("Amount EUR"), false);
    } finally {
      console.log = original;
    }
  });

  test("does not log rule text", async function () {
    const logs = [];
    const original = console.log;
    console.log = function (line) { logs.push(String(line)); };
    try {
      await post("/analyze", {
        version: "2026.1",
        cube: "PnL",
        rule: SECRET_RULE,
        turnstileToken: "ok"
      }, baseEnv());
      const joined = logs.join("\n");
      assert.equal(joined.includes("SUPER_SECRET_RULE_TEXT"), false);
      assert.equal(joined.includes("Variance"), false);
      assert.match(joined, /"event":"rule_studio"/);
    } finally {
      console.log = original;
    }
  });

  test("rejects an invalid body and an oversized body", async function () {
    const bad = await post("/analyze", "{", baseEnv());
    assert.equal(bad.status, 400);
    const missing = await post("/analyze", { version: "2026.1", turnstileToken: "ok" }, baseEnv());
    assert.equal(missing.status, 400);
    const huge = await post("/analyze", "x".repeat(50000), baseEnv({ MAX_BODY_BYTES: "1000" }));
    assert.equal(huge.status, 413);
  });

  test("rejects a failed Turnstile check", async function () {
    const response = await post("/analyze", {
      version: "2026.1",
      cube: "PnL",
      rule: "['Version':'Variance'] = B: ['Version':'Actual']",
      turnstileToken: "nope"
    }, baseEnv({
      fetchImpl: function () {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ success: false }); } });
      }
    }));
    assert.equal(response.status, 403);
  });

  test("rate limit and daily budget stop before the provider", async function () {
    const limited = baseEnv({ RATE_LIMIT_PER_IP: "1" });
    const payload = {
      version: "2026.1",
      cube: "PnL",
      rule: "['Version':'Variance'] = B: ['Version':'Actual'] - ['Version':'Budget']",
      turnstileToken: "ok"
    };
    assert.equal((await post("/analyze", payload, limited)).status, 200);
    const again = await post("/analyze", payload, limited);
    assert.equal(again.status, 429);
    assert.equal((await again.json()).error, "rate_ip");

    handler.resetGate();
    const broke = {
      version: "2026.1",
      cube: "PnL",
      rule: "['Version':'Varience'] = B: ['Version':'Actual']",
      turnstileToken: "ok"
    };
    const budget = await post("/analyze", broke, baseEnv({ DAILY_TOKEN_BUDGET: "10" }));
    const budgetBody = await budget.json();
    assert.equal(budget.status, 429);
    assert.equal(budgetBody.error, "budget_tokens");
    assert.ok(budgetBody.staticFindings.some(function (item) { return item.code === "UNKNOWN_ELEMENT"; }));
    assert.match(budgetBody.message, /not stored|usage limit/);
  });

  test("generate asks for clarification instead of inventing a rule", async function () {
    const response = await post("/generate", {
      version: "2026.1",
      cube: "PnL",
      story: "Please make something nice for finance",
      turnstileToken: "ok"
    }, baseEnv());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ai.mock, true);
    assert.ok(body.ai.clarification && body.ai.clarification.questions.length >= 1);
    assert.equal(body.ai.rule, "");
  });

  test("generate uses an example from the pack when the story matches", async function () {
    const response = await post("/generate", {
      version: "2026.1",
      cube: "PnL",
      story: "Calculate Variance as Actual minus Budget on base cells.",
      dimensions: [{ name: "Period", role: "Time" }],
      turnstileToken: "ok"
    }, baseEnv());
    const body = await response.json();
    assert.equal(body.ai.rule.includes("B:"), true);
    assert.equal(body.ai.rule.includes("N:"), false);
    assert.match(body.ai.rule, /Variance/);
    assert.match(body.ai.label, /not real AI/);
  });

  test("CORS allows the site origin only", async function () {
    const health = await handler.handleRequest(new Request("https://worker.test/health", {
      headers: { origin: ORIGIN }
    }), baseEnv());
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("access-control-allow-origin"), ORIGIN);
    const blocked = await handler.handleRequest(new Request("https://worker.test/health", {
      headers: { origin: "https://evil.example" }
    }), baseEnv());
    assert.equal(blocked.headers.get("access-control-allow-origin"), null);
    const preflight = await handler.handleRequest(new Request("https://worker.test/analyze", {
      method: "OPTIONS",
      headers: { origin: ORIGIN }
    }), baseEnv());
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);
  });
});
