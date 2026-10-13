const assert = require("node:assert/strict");
const test = require("node:test");

let handler;

const ORIGIN = "https://balazs998.github.io";
const SECRET_RULE = "SUPER_SECRET_RULE_TEXT ['Version':'Variance'] = B: ['Version':'Actual']";

function passFetch() {
  return Promise.resolve({
    ok: true,
    json: function () {
      return Promise.resolve({ success: true, hostname: "balazs998.github.io" });
    }
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
    INPUT_TOKEN_USD: "0.000002",
    OUTPUT_TOKEN_USD: "0.000002"
  }, extra || {});
}

function money(value) {
  return Math.round(value * 1000000) / 1000000;
}

const SAMPLE = {
  version: "2026.1",
  cube: "PnL",
  rule: "['Version':'Variance'] = B: ['Version':'Actual'] - ['Version':'Budget']",
  turnstileToken: "ok"
};

function turnstileOr(handler) {
  return function (url, init) {
    if (String(url).indexOf("siteverify") >= 0) return passFetch();
    return handler(url, init);
  };
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
  test.before(async function () {
    handler = await import("../worker/src/handler.js");
  });

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

  test("analyze uses the pack for the selected version", async function () {
    const older = await post("/analyze", {
      version: "2025.1",
      cube: "PnL",
      rule: "['Version':'Variance'] = B: COS(0)",
      turnstileToken: "ok"
    }, baseEnv());
    const olderBody = await older.json();
    assert.equal(older.status, 200);
    const olderDde = olderBody.staticFindings.filter(function (item) { return item.code === "DDE_UNSUPPORTED_FUNCTION"; });
    assert.equal(olderDde.length, 1);
    assert.match(olderDde[0].message, /unverified for 2025.1/);
    assert.match(olderBody.ai.explanation, /unverified for 2025.1/);
    const current = await post("/analyze", {
      version: "2026.1",
      cube: "PnL",
      rule: "['Version':'Variance'] = B: COS(0)",
      turnstileToken: "ok"
    }, baseEnv());
    const currentBody = await current.json();
    const currentDde = currentBody.staticFindings.filter(function (item) { return item.code === "DDE_UNSUPPORTED_FUNCTION"; });
    assert.equal(currentDde.length, 1);
    assert.equal(currentDde[0].message.indexOf("unverified for 2025.1"), -1);
    assert.equal(currentBody.ai.explanation.indexOf("unverified for 2025.1"), -1);
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
    const posted = await post("/analyze", SAMPLE, baseEnv(), { origin: "https://evil.example" });
    assert.equal(posted.status, 403);
    assert.equal((await posted.json()).error, "origin");
    assert.equal(posted.headers.get("access-control-allow-origin"), null);
    const missing = await handler.handleRequest(new Request("https://worker.test/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SAMPLE)
    }), baseEnv());
    assert.equal(missing.status, 403);
    assert.equal((await missing.json()).error, "origin");
  });

  test("client IP comes only from CF-Connecting-IP", async function () {
    const limited = baseEnv({ RATE_LIMIT_PER_IP: "1" });
    const first = await post("/analyze", SAMPLE, limited, {
      "CF-Connecting-IP": "1.1.1.1",
      "x-forwarded-for": "9.9.9.9"
    });
    assert.equal(first.status, 200);
    const otherForwarded = await post("/analyze", SAMPLE, limited, {
      "CF-Connecting-IP": "2.2.2.2",
      "x-forwarded-for": "9.9.9.9"
    });
    assert.equal(otherForwarded.status, 200);
    const sameClient = await post("/analyze", SAMPLE, limited, {
      "CF-Connecting-IP": "1.1.1.1",
      "x-forwarded-for": "8.8.8.8"
    });
    assert.equal(sameClient.status, 429);
    assert.equal((await sameClient.json()).error, "rate_ip");
  });

  test("Turnstile hostname must match the configured site", async function () {
    const wrong = await post("/analyze", SAMPLE, baseEnv({
      fetchImpl: function () {
        return Promise.resolve({
          ok: true,
          json: function () { return Promise.resolve({ success: true, hostname: "evil.example" }); }
        });
      }
    }));
    assert.equal(wrong.status, 403);
    assert.equal((await wrong.json()).error, "turnstile");
    const preview = await post("/analyze", SAMPLE, baseEnv({
      TURNSTILE_HOSTNAME: "preview.example",
      fetchImpl: function () {
        return Promise.resolve({
          ok: true,
          json: function () { return Promise.resolve({ success: true, hostname: "preview.example" }); }
        });
      }
    }));
    assert.equal(preview.status, 200);
  });

  test("output-heavy reservation uses the output price and settles completion tokens", async function () {
    const inputPrice = 0.000001;
    const outputPrice = 0.02;
    const env = {
      AI_PROVIDER: "openai",
      AI_API_KEY: "test",
      MAX_TOKENS: "1500",
      INPUT_TOKEN_USD: String(inputPrice),
      OUTPUT_TOKEN_USD: String(outputPrice),
      DAILY_TOKEN_BUDGET: "1000000",
      DAILY_SPEND_BUDGET_USD: "0.05"
    };
    const quoted = handler.quote(SAMPLE, baseEnv(env));
    assert.equal(quoted.maxTokens, 1500);
    assert.equal(quoted.calls, 2);
    assert.ok(quoted.inputTokens * inputPrice < 0.05);
    assert.ok(quoted.spend > 0.05);
    let providerCalls = 0;
    const refused = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      fetchImpl: turnstileOr(function () {
        providerCalls += 1;
        return Promise.reject(new Error("provider should not be called"));
      })
    })));
    assert.equal(refused.status, 429);
    assert.equal((await refused.json()).error, "budget_spend");
    assert.equal(providerCalls, 0);
    assert.equal(handler.gateSnapshot().tokens, 0);

    handler.resetGate();
    const promptTokens = 20;
    const completionTokens = 1400;
    const accepted = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      DAILY_SPEND_BUDGET_USD: "80",
      fetchImpl: turnstileOr(function (url, init) {
        providerCalls += 1;
        const sent = JSON.parse(init.body);
        assert.equal(sent.max_tokens, 1500);
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              choices: [{
                message: {
                  content: JSON.stringify({
                    provider: "openai",
                    mock: false,
                    label: "gpt-4o-mini",
                    explanation: "Reviewed."
                  })
                }
              }],
              usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens }
            });
          }
        });
      })
    })));
    assert.equal(accepted.status, 200);
    const acceptedBody = await accepted.json();
    assert.equal(acceptedBody.ai.usage, undefined);
    assert.equal(providerCalls, 1);
    const spent = money(promptTokens * inputPrice + completionTokens * outputPrice);
    assert.equal(handler.gateSnapshot().spend, spent);
    assert.equal(handler.gateSnapshot().tokens, promptTokens + completionTokens);
    assert.ok(spent > quoted.inputTokens * inputPrice);
    const follow = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      DAILY_SPEND_BUDGET_USD: "80",
      fetchImpl: turnstileOr(function () {
        providerCalls += 1;
        return Promise.reject(new Error("provider should not be called"));
      })
    })));
    assert.equal(follow.status, 429);
    assert.equal((await follow.json()).error, "budget_spend");
    assert.equal(providerCalls, 1);
  });

  test("repair doubles the reservation and settles both calls", async function () {
    const env = {
      AI_PROVIDER: "openai",
      AI_API_KEY: "test",
      AI_MODEL: "gpt-4o-mini",
      MAX_TOKENS: "100",
      INPUT_TOKEN_USD: "0.001",
      OUTPUT_TOKEN_USD: "0.002",
      DAILY_SPEND_BUDGET_USD: "100"
    };
    const quoted = handler.quote(SAMPLE, baseEnv(env));
    assert.equal(quoted.calls, 2);
    const oneCall = quoted.tokens / 2;
    let providerCalls = 0;
    const tight = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      DAILY_TOKEN_BUDGET: String(oneCall),
      fetchImpl: turnstileOr(function () {
        providerCalls += 1;
        return Promise.reject(new Error("provider should not be called"));
      })
    })));
    assert.equal(tight.status, 429);
    assert.equal((await tight.json()).error, "budget_tokens");
    assert.equal(providerCalls, 0);

    handler.resetGate();
    const usages = [
      { prompt_tokens: 30, completion_tokens: 40 },
      { prompt_tokens: 50, completion_tokens: 60 }
    ];
    const repaired = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      DAILY_TOKEN_BUDGET: String(quoted.tokens),
      fetchImpl: turnstileOr(function (url, init) {
        const sent = JSON.parse(init.body);
        assert.equal(sent.max_tokens, 100);
        const usage = usages[providerCalls];
        const content = providerCalls === 0
          ? { speedup: "2x" }
          : { provider: "openai", mock: false, label: "gpt-4o-mini", explanation: "Reviewed." };
        providerCalls += 1;
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              choices: [{ message: { content: JSON.stringify(content) } }],
              usage: usage
            });
          }
        });
      })
    })));
    assert.equal(repaired.status, 200);
    assert.equal(providerCalls, 2);
    assert.equal(handler.gateSnapshot().tokens, 180);
    assert.equal(handler.gateSnapshot().spend, money((30 + 50) * 0.001 + (40 + 60) * 0.002));
    assert.ok(handler.gateSnapshot().tokens < quoted.tokens);
  });

  test("a provider error keeps the worst-case reservation", async function () {
    const env = {
      AI_PROVIDER: "openai",
      AI_API_KEY: "test",
      MAX_TOKENS: "1500",
      INPUT_TOKEN_USD: "0.000002",
      OUTPUT_TOKEN_USD: "0.000002",
      DAILY_TOKEN_BUDGET: "100000",
      DAILY_SPEND_BUDGET_USD: "5"
    };
    const quoted = handler.quote(SAMPLE, baseEnv(env));
    const response = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      fetchImpl: turnstileOr(function () {
        return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } });
      })
    })));
    assert.equal(response.status, 502);
    assert.equal(handler.gateSnapshot().tokens, quoted.tokens);
    assert.equal(handler.gateSnapshot().spend, quoted.spend);
  });

  test("anthropic sends max_tokens and settles reported usage", async function () {
    const env = {
      AI_PROVIDER: "anthropic",
      AI_API_KEY: "test-anthropic",
      AI_MODEL: "claude-3-5-haiku-latest",
      INPUT_TOKEN_USD: "0.000001",
      OUTPUT_TOKEN_USD: "0.000004",
      DAILY_TOKEN_BUDGET: "100000",
      DAILY_SPEND_BUDGET_USD: "5"
    };
    const quoted = handler.quote(SAMPLE, baseEnv(env));
    assert.equal(quoted.calls, 2);
    assert.equal(quoted.maxTokens, 1500);
    let providerCalls = 0;
    const response = await post("/analyze", SAMPLE, baseEnv(Object.assign({}, env, {
      fetchImpl: turnstileOr(function (url, init) {
        providerCalls += 1;
        assert.equal(String(url), "https://api.anthropic.com/v1/messages");
        const sent = JSON.parse(init.body);
        assert.equal(sent.max_tokens, 1500);
        assert.equal(init.headers["x-api-key"], "test-anthropic");
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              content: [{
                type: "text",
                text: JSON.stringify({
                  provider: "anthropic",
                  mock: false,
                  label: "claude-3-5-haiku-latest",
                  explanation: "Reviewed."
                })
              }],
              usage: { input_tokens: 11, output_tokens: 22 }
            });
          }
        });
      })
    })));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, "anthropic");
    assert.equal(body.ai.mock, false);
    assert.equal(body.ai.usage, undefined);
    assert.equal(providerCalls, 1);
    assert.equal(handler.gateSnapshot().tokens, 33);
    assert.equal(handler.gateSnapshot().spend, money(11 * 0.000001 + 22 * 0.000004));
    assert.ok(handler.gateSnapshot().tokens < quoted.tokens);
  });

  test("settle cannot record more than the daily cap", function () {
    const gate = require("../worker/src/gate.cjs");
    const limits = { perIp: 10, global: 10, tokens: 100, spend: 1 };
    const now = new Date("2026-10-11T12:00:00Z");
    const reserved = gate.applyReserve(null, { ip: "a", tokens: 80, spend: 0.8 }, limits, now);
    assert.equal(reserved.ok, true);
    const settled = gate.applySettle(reserved.state, {
      reservedTokens: 80,
      reservedSpend: 0.8,
      actualTokens: 500,
      actualSpend: 9
    }, limits, now);
    assert.equal(settled.state.tokens, 100);
    assert.equal(settled.state.spend, 1);
    const again = gate.applyReserve(settled.state, { ip: "b", tokens: 1, spend: 0.01 }, limits, now);
    assert.equal(again.ok, false);
    assert.equal(again.error, "budget_tokens");
    assert.equal(again.state.tokens, 100);
  });
});
