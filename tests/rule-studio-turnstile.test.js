const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ui = require("../docs/javascripts/rule-studio-ui.js");

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/* A widget that issues one token, then a new one only after reset. */
function scriptedWidget(tokens) {
  var current = tokens[0] || "";
  var next = 1;
  var resets = 0;
  var api = {
    getResponse: function () { return current; },
    reset: function () {
      resets += 1;
      current = "";
      var issued = tokens[next] || "";
      next += 1;
      setTimeout(function () { current = issued; }, 0);
    }
  };
  return {
    api: api,
    resets: function () { return resets; }
  };
}

function harness(widget, fetchImpl, options) {
  options = options || {};
  return ui.createTransport({
    turnstile: function () { return widget ? widget.api : null; },
    widgetId: function () { return options.widgetId === undefined ? "widget-1" : options.widgetId; },
    ready: function () { return options.ready ? options.ready() : true; },
    version: function () { return "2026.1"; },
    url: function (path) { return "https://fdh-rule-studio.example" + path; },
    fetch: fetchImpl,
    wait: delay,
    pollMs: 5,
    tokenWaitMs: options.tokenWaitMs == null ? 400 : options.tokenWaitMs,
    readyWaitMs: options.readyWaitMs == null ? 0 : options.readyWaitMs
  });
}

function okFetch(sent) {
  return function (url, init) {
    sent.push(JSON.parse(init.body).turnstileToken);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () { return Promise.resolve({ ok: true, ai: { mock: true } }); }
    });
  };
}

test("reset runs after each post and the next call uses a new token", async function () {
  var widget = scriptedWidget(["token-a", "token-b"]);
  var sent = [];
  var transport = harness(widget, okFetch(sent));
  var first = { cube: "PnL", rule: "a" };
  var second = { cube: "PnL", rule: "b" };
  await transport.post("/analyze", first);
  await transport.post("/analyze", second);
  assert.deepEqual(sent, ["token-a", "token-b"]);
  assert.notEqual(sent[0], sent[1]);
  assert.equal(widget.resets(), 2);
  assert.equal(first.turnstileToken, undefined);
  assert.equal(second.turnstileToken, undefined);
});

test("reset still runs when the worker answers 400, 403, 429, or the network fails", async function () {
  var cases = [
    { status: 400, body: { ok: false, error: "invalid_request", message: "The request was not accepted." } },
    { status: 403, body: { ok: false, error: "turnstile", message: "worker-turnstile-text" } },
    { status: 429, body: { ok: false, error: "rate_ip" } },
    { network: true }
  ];
  for (var i = 0; i < cases.length; i += 1) {
    var item = cases[i];
    var widget = scriptedWidget(["token-" + i, "unused-" + i]);
    var transport = harness(widget, function () {
      if (item.network) return Promise.reject(new Error("failed to fetch"));
      return Promise.resolve({
        ok: false,
        status: item.status,
        json: function () { return Promise.resolve(item.body); }
      });
    });
    await assert.rejects(function () { return transport.post("/refine", { rule: "x" }); });
    assert.equal(widget.resets(), 1, "status " + (item.status || "network"));
  }
});

test("turnstile and rate-limit errors are fixed text and never fall back", async function () {
  var widget = scriptedWidget(["token-a", "token-b", "token-c"]);
  var turnstileTransport = harness(widget, function () {
    return Promise.resolve({
      ok: false,
      status: 403,
      json: function () {
        return Promise.resolve({ ok: false, error: "turnstile", message: "worker-turnstile-text" });
      }
    });
  });
  var turnstileError = await turnstileTransport.post("/generate", { story: "x" }).then(function () {
    throw new Error("expected turnstile failure");
  }, function (error) { return error; });
  assert.equal(turnstileError.message, ui.TURNSTILE_FAILED);
  assert.equal(ui.shownError(turnstileError), ui.TURNSTILE_FAILED);
  assert.equal(turnstileError.message.includes("worker-turnstile-text"), false);
  assert.equal(ui.shownError(turnstileError).includes("worker-turnstile-text"), false);
  assert.equal(ui.useOffline(turnstileError), false);

  var limitTransport = harness(widget, function () {
    return Promise.resolve({
      ok: false,
      status: 429,
      json: function () {
        return Promise.resolve({ ok: false, error: "rate_ip", message: "worker-rate-text" });
      }
    });
  });
  var limitError = await limitTransport.post("/analyze", { rule: "x" }).then(function () {
    throw new Error("expected rate limit");
  }, function (error) { return error; });
  assert.equal(limitError.message, ui.RATE_LIMIT);
  assert.equal(ui.shownError(limitError), ui.RATE_LIMIT);
  assert.equal(limitError.message.includes("worker-rate-text"), false);
  assert.equal(ui.useOffline(limitError), false);

  var bareTransport = harness(widget, function () {
    return Promise.resolve({
      ok: false,
      status: 429,
      json: function () { return Promise.resolve({ ok: false, error: "rate_global" }); }
    });
  });
  var bareError = await bareTransport.post("/analyze", { rule: "x" }).then(function () {
    throw new Error("expected bare rate limit");
  }, function (error) { return error; });
  assert.equal(bareError.message, ui.RATE_LIMIT);
  assert.equal(ui.useOffline(bareError), false);
});

test("a Turnstile script that never becomes ready uses the offline fallback", async function () {
  var calls = 0;
  var transport = harness(null, function () {
    calls += 1;
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
  }, {
    ready: function () { return false; },
    widgetId: null,
    readyWaitMs: 0
  });
  var error = await transport.post("/analyze", { rule: "x" }).then(function () {
    throw new Error("expected the widget to be missing");
  }, function (caught) { return caught; });
  assert.equal(error.turnstileUnavailable, true);
  assert.equal(ui.useOffline(error), true);
  assert.equal(calls, 0);
  assert.equal(ui.useOffline({ status: 403, payload: { error: "turnstile" } }), false);
  assert.equal(ui.useOffline({ status: 429, payload: { error: "rate_ip" } }), false);
});

test("the page does not store or log the Turnstile token", function () {
  var source = fs.readFileSync(path.join(__dirname, "../docs/javascripts/rule-studio-ui.js"), "utf8");
  assert.equal(/localStorage\.(setItem|getItem)\([^)]*turnstile/i.test(source), false);
  assert.equal(/console\.(log|debug|info|warn|error)\(/.test(source), false);
  assert.equal(source.includes("createRuleStudioTransport"), true);
});
