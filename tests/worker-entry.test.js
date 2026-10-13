const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const schemas = require("../ai-engine/schemas.js");
const validate = require("../ai-engine/validate.js");

const root = path.join(__dirname, "..");
const tools = path.join(root, "tests/.tools");
const outdir = path.join(tools, "worker-dist");
const ORIGIN = "https://balazs998.github.io";
const FIXTURE_TURNSTILE = "test-secret";

function ensureWrangler() {
  const bin = path.join(tools, "node_modules/.bin/wrangler");
  if (!fs.existsSync(bin)) {
    fs.mkdirSync(tools, { recursive: true });
    execFileSync("npm", ["install", "--prefix", tools, "wrangler@4", "--no-fund", "--no-audit"], {
      stdio: "inherit",
      timeout: 180000
    });
  }
  return bin;
}

function bundleWorker() {
  const bin = ensureWrangler();
  fs.rmSync(outdir, { recursive: true, force: true });
  const stdout = execFileSync(bin, ["deploy", "--dry-run", "--outdir", outdir, "--config", "wrangler.toml"], {
    cwd: path.join(root, "worker"),
    encoding: "utf8",
    env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: "false", CI: "1" }),
    timeout: 120000
  });
  return stdout;
}

function textBinding(value) {
  return { type: "text", value: String(value) };
}

test("wrangler bundle includes the engine, checks, and knowledge packs", { timeout: 180000 }, function () {
  const toml = fs.readFileSync(path.join(root, "worker/wrangler.toml"), "utf8");
  assert.match(toml, /^new_sqlite_classes = \["BudgetGate"\]$/m);
  assert.equal(/^\s*new_classes\s*=/m.test(toml), false);
  assert.equal(toml.includes("TURNSTILE_SECRET"), false);
  assert.equal(toml.includes("AI_API_KEY"), false);

  const stdout = bundleWorker();
  const upload = stdout.match(/Total Upload:\s+([0-9.]+)\s+KiB/);
  assert.ok(upload, stdout);
  assert.ok(Number(upload[1]) > 100, stdout);

  const bundlePath = path.join(outdir, "index.js");
  const bundle = fs.readFileSync(bundlePath, "utf8");
  assert.ok(fs.statSync(bundlePath).size > 100 * 1024);
  assert.match(bundle, /function checkRule|checkRule:/);
  assert.match(bundle, /PALO_DATA_ARITY/);
  assert.match(bundle, /Mock provider/);
  assert.match(bundle, /api\.openai\.com/);
  assert.match(bundle, /api\.anthropic\.com/);
  assert.match(bundle, /optimized for Jedox version 2026\.1/);
  assert.match(bundle, /no archived 2025\.1 rule pages/);
  assert.match(bundle, /DATA-DICTIONARY\.md v1\.3/);
  assert.equal(bundle.includes("readFileSync"), false);
  assert.equal(bundle.includes("createRequire"), false);
});

test("bundled worker entry serves health, analyze, Turnstile, and Origin", { timeout: 180000 }, async function () {
  bundleWorker();
  const miniflarePath = path.join(tools, "node_modules/miniflare/dist/src/index.js");
  const { Miniflare } = await import(pathToFileURL(miniflarePath).href);
  const script = fs.readFileSync(path.join(outdir, "index.js"), "utf8");
  const mf = new Miniflare({
    workers: [{
      config: {
        name: "fdh-rule-studio",
        compatibilityDate: "2026-10-01",
        compatibilityFlags: ["nodejs_compat"],
        manifest: {
          mainModule: "index.js",
          modules: {
            "index.js": { type: "esm", contents: script }
          }
        },
        exports: {
          BudgetGate: { type: "durable-object", storage: "sqlite" }
        },
        env: {
          BUDGET_GATE: { type: "durable-object", worker: "fdh-rule-studio", exportName: "BudgetGate" },
          AI_PROVIDER: textBinding("mock"),
          ALLOWED_ORIGIN: textBinding(ORIGIN),
          MAX_BODY_BYTES: textBinding("48000"),
          RATE_LIMIT_PER_IP: textBinding("30"),
          RATE_LIMIT_GLOBAL: textBinding("400"),
          DAILY_TOKEN_BUDGET: textBinding("100000"),
          DAILY_SPEND_BUDGET_USD: textBinding("2"),
          MAX_TOKENS: textBinding("1500"),
          INPUT_TOKEN_USD: textBinding("0.000002"),
          OUTPUT_TOKEN_USD: textBinding("0.000002"),
          TURNSTILE_HOSTNAME: textBinding("balazs998.github.io"),
          TURNSTILE_SECRET: textBinding(FIXTURE_TURNSTILE)
        }
      },
      dev: {
        outboundService: {
          type: "fetcher",
          handler: async function (request) {
            if (String(request.url).indexOf("siteverify") >= 0) {
              const params = new URLSearchParams(await request.text());
              const ok = params.get("response") === "ok";
              return new Response(JSON.stringify({
                success: ok,
                hostname: ok ? "balazs998.github.io" : "other.example"
              }), { headers: { "content-type": "application/json" } });
            }
            return new Response("blocked", { status: 403 });
          }
        }
      }
    }]
  });

  try {
    const health = await mf.dispatchFetch("https://worker.test/health");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, provider: "mock" });

    const rule = "['Version':'Variance'] = B: ['Version':'Actual'] - ['Version':'Budget']";
    const wrong = await mf.dispatchFetch("https://worker.test/analyze", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json"
      },
      body: JSON.stringify({ version: "2026.1", cube: "PnL", rule: rule, turnstileToken: "ok" })
    });
    assert.equal(wrong.status, 403);
    assert.equal((await wrong.json()).error, "origin");
    assert.equal(wrong.headers.get("access-control-allow-origin"), null);

    const missing = await mf.dispatchFetch("https://worker.test/analyze", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.8"
      },
      body: JSON.stringify({ version: "2026.1", cube: "PnL", rule: rule, turnstileToken: "missing" })
    });
    assert.equal(missing.status, 403);
    assert.equal((await missing.json()).error, "turnstile");

    const analyzed = await mf.dispatchFetch("https://worker.test/analyze", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.9"
      },
      body: JSON.stringify({ version: "2026.1", cube: "PnL", rule: rule, turnstileToken: "ok" })
    });
    assert.equal(analyzed.status, 200);
    const body = await analyzed.json();
    assert.equal(body.ok, true);
    assert.equal(body.mock, true);
    assert.equal(body.provider, "mock");
    assert.equal(body.usage, undefined);
    assert.equal(body.ai.usage, undefined);
    const errors = validate.validate(body.ai, schemas.response).concat(validate.bannedKeys(body.ai, "$", []));
    assert.deepEqual(errors, []);
    assert.match(body.ai.label, /not real AI/);
  } finally {
    await mf.dispose();
  }
});
