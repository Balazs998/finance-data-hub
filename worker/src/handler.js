/* Worker request handler. Logs counts only. Rule text is not stored or logged. */
import checks from "../../static-checks/checks.js";
import engine from "../../ai-engine/index.js";
import schemas from "../../ai-engine/schemas.js";
import validate from "../../ai-engine/validate.js";
import gate from "./gate.cjs";
import examples from "../../knowledge/examples-2026.1.json" with { type: "json" };
import pack2026 from "../../knowledge/jedox-rules-2026.1.json" with { type: "json" };
import pack2025 from "../../knowledge/jedox-rules-2025.1.json" with { type: "json" };

var packs = {
  "2026.1": pack2026,
  "2025.1": pack2025
};

function packFor(version) {
  return packs[version] || packs["2026.1"];
}

function knowledgeFor(pack) {
  return {
    jedox_version: pack.jedox_version,
    doc_basis: pack.doc_basis || "",
    status: pack.status || "",
    functions: (pack.functions || []).map(function (fn) {
      return {
        name: fn.name,
        min_args: fn.min_args,
        max_args: fn.max_args,
        unverified: !!fn.unverified,
        unverified_for_version: fn.unverified_for_version === true,
        version_status: fn.version_status || ""
      };
    })
  };
}

var ROUTES = {
  "/analyze": { method: "analyze", schema: schemas.analyzeRequest },
  "/generate": { method: "generate", schema: schemas.generateRequest },
  "/refine": { method: "refine", schema: schemas.refineRequest }
};

function allowedOrigin(request, env) {
  var origin = request.headers.get("Origin") || "";
  var list = String(env.ALLOWED_ORIGIN || "https://balazs998.github.io")
    .split(",")
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
  return list.indexOf(origin) >= 0 ? origin : "";
}

function json(status, body, cors) {
  var headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };
  if (cors) {
    headers["access-control-allow-origin"] = cors;
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers.vary = "Origin";
  }
  if (status === 204) return new Response(null, { status: 204, headers: headers });
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function logLine(pathname, status, tokens, error) {
  console.log(JSON.stringify({
    event: "rule_studio",
    path: pathname,
    status: status,
    tokens: tokens || 0,
    error: error || null
  }));
}

function clientIp(request) {
  var value = request.headers.get("CF-Connecting-IP");
  if (value == null) return "unknown";
  var trimmed = String(value).trim();
  return trimmed || "unknown";
}

function metadataFor(body) {
  if (body && body.metadata && body.metadata.cubes) return body.metadata;
  return examples.metadata;
}

var SYSTEM_PROMPT_TOKENS = 250;

function configuredNumber(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  var n = Number(value);
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

function roundMoney(value) {
  return Math.round(value * 1000000) / 1000000;
}

function prices(env) {
  env = env || {};
  var input = configuredNumber(
    env.INPUT_TOKEN_USD != null && String(env.INPUT_TOKEN_USD) !== "" ? env.INPUT_TOKEN_USD : env.TOKEN_USD,
    0.000002
  );
  var output = configuredNumber(env.OUTPUT_TOKEN_USD, input);
  return { input: input, output: output };
}

function maxTokens(env) {
  var n = Number(env && env.MAX_TOKENS);
  if (!isFinite(n) || n < 1) return 1500;
  return Math.floor(n);
}

function repairPossible(env) {
  var name = String((env && env.AI_PROVIDER) || "mock").toLowerCase();
  return name === "openai" || name === "anthropic";
}

function inputEstimate(body) {
  var chosen = packFor(body && body.version);
  var text = JSON.stringify({
    version: (body && body.version) || chosen.jedox_version,
    database: (body && body.database) || "",
    cube: (body && body.cube) || "",
    story: (body && body.story) || "",
    rule: (body && body.rule) || "",
    instruction: (body && body.instruction) || "",
    knowledge: knowledgeFor(chosen)
  });
  return Math.ceil(text.length / 4) + SYSTEM_PROMPT_TOKENS;
}

function quote(body, env) {
  var inputTokens = inputEstimate(body || {});
  var completionCap = maxTokens(env);
  var calls = repairPossible(env) ? 2 : 1;
  var rate = prices(env);
  var tokens = (inputTokens + completionCap) * calls;
  var spend = roundMoney((inputTokens * rate.input + completionCap * rate.output) * calls);
  return {
    inputTokens: inputTokens,
    maxTokens: completionCap,
    calls: calls,
    tokens: tokens,
    spend: spend
  };
}

function priceUsage(usage, env) {
  var rate = prices(env);
  var prompt = Number(usage && usage.promptTokens) || 0;
  var completion = Number(usage && usage.completionTokens) || 0;
  return {
    tokens: prompt + completion,
    spend: roundMoney(prompt * rate.input + completion * rate.output)
  };
}

function turnstileHost(env) {
  var host = env && env.TURNSTILE_HOSTNAME;
  if (host == null || String(host).trim() === "") return "balazs998.github.io";
  return String(host).trim();
}

async function verifyTurnstile(token, secret, ip, fetchImpl, expectedHost) {
  var form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token || "");
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  var response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  var data = await response.json();
  return !!(data && data.success === true && String(data.hostname || "") === expectedHost);
}

async function gateOp(env, body) {
  if (env.BUDGET_GATE) {
    var id = env.BUDGET_GATE.idFromName("global");
    var stub = env.BUDGET_GATE.get(id);
    var response = await stub.fetch("https://gate/charge", {
      method: "POST",
      body: JSON.stringify(body)
    });
    return response.json();
  }
  if (String(env.MEMORY_GATE) === "1") {
    var limits = gate.limitsFrom(env);
    var now = env.now ? new Date(env.now) : new Date();
    if (body.op === "settle") return gate.settleMemory(body, limits, now);
    return gate.reserveMemory(
      { ip: body.ip, tokens: body.tokens, spend: body.spend },
      limits,
      now
    );
  }
  return { ok: false, error: "budget_unconfigured" };
}

async function settleUsage(env, reserved, usage) {
  if (!usage) return false;
  var actual = priceUsage(usage, env);
  await gateOp(env, {
    op: "settle",
    reservedTokens: reserved.tokens,
    reservedSpend: reserved.spend,
    actualTokens: actual.tokens,
    actualSpend: actual.spend
  });
  return actual;
}

function staticFor(body) {
  if (!body.rule) return [];
  var chosen = packFor(body.version);
  return checks.checkRule(body.rule, {
    version: body.version || chosen.jedox_version,
    cube: body.cube,
    pack: chosen,
    metadata: metadataFor(body)
  }).findings;
}

async function handleRequest(request, env) {
  env = env || {};
  var url = new URL(request.url);
  var pathname = url.pathname.replace(/\/$/, "") || "/";
  var cors = allowedOrigin(request, env);
  if (request.method === "OPTIONS") {
    return json(204, {}, cors);
  }
  if (request.method === "GET" && (pathname === "/" || pathname === "/health")) {
    logLine(pathname, 200, 0, null);
    return json(200, { ok: true, provider: env.AI_PROVIDER || "mock" }, cors);
  }
  if (request.method === "POST" && !cors) {
    logLine(pathname, 403, 0, "origin");
    return json(403, { ok: false, error: "origin" }, "");
  }
  var route = ROUTES[pathname];
  if (!route) {
    logLine(pathname, 404, 0, "not_found");
    return json(404, { ok: false, error: "not_found" }, cors);
  }
  if (request.method !== "POST") {
    logLine(pathname, 405, 0, "method");
    return json(405, { ok: false, error: "method" }, cors);
  }
  var maxBytes = Number(env.MAX_BODY_BYTES || 48000);
  var raw = await request.text();
  if (raw.length > maxBytes) {
    logLine(pathname, 413, 0, "too_large");
    return json(413, { ok: false, error: "too_large" }, cors);
  }
  var body;
  try {
    body = JSON.parse(raw);
  } catch (error) {
    logLine(pathname, 400, 0, "invalid_json");
    return json(400, { ok: false, error: "invalid_json" }, cors);
  }
  var schemaErrors = validate.validate(body, route.schema);
  if (schemaErrors.length) {
    logLine(pathname, 400, 0, "invalid_request");
    return json(400, { ok: false, error: "invalid_request", details: schemaErrors }, cors);
  }
  if (!env.TURNSTILE_SECRET) {
    logLine(pathname, 503, 0, "turnstile_unconfigured");
    return json(503, { ok: false, error: "turnstile_unconfigured" }, cors);
  }
  var ip = clientIp(request);
  var fetchImpl = env.fetchImpl || fetch;
  var turned = false;
  try {
    turned = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, ip, fetchImpl, turnstileHost(env));
  } catch (error) {
    turned = false;
  }
  if (!turned) {
    logLine(pathname, 403, 0, "turnstile");
    return json(403, { ok: false, error: "turnstile" }, cors);
  }
  var staticFindings = [];
  try {
    staticFindings = staticFor(body);
  } catch (error) {
    staticFindings = [];
  }
  var reserved = quote(body, env);
  var admission;
  try {
    admission = await gateOp(env, {
      op: "reserve",
      ip: ip,
      tokens: reserved.tokens,
      spend: reserved.spend
    });
  } catch (error) {
    admission = { ok: false, error: "budget_unconfigured" };
  }
  if (!admission.ok) {
    var status = admission.error === "budget_unconfigured" ? 503 : 429;
    var message = admission.error === "rate_ip" || admission.error === "rate_global"
      ? "Too many requests from this network right now. Nothing was stored."
      : "The daily usage limit was reached, so no further requests are sent today.";
    logLine(pathname, status, 0, admission.error);
    return json(status, {
      ok: false,
      error: admission.error,
      message: message,
      staticFindings: staticFindings
    }, cors);
  }
  var outcome;
  try {
    var chosen = packFor(body.version);
    outcome = await engine[route.method]({
      version: body.version || chosen.jedox_version,
      database: body.database,
      cube: body.cube,
      sourceCubes: body.sourceCubes,
      dimensions: body.dimensions,
      story: body.story,
      rule: body.rule,
      chips: body.chips,
      instruction: body.instruction,
      answers: body.answers,
      examples: examples.examples,
      pack: chosen,
      knowledge: knowledgeFor(chosen),
      staticFindings: staticFindings
    }, env);
  } catch (error) {
    var failedUsage = error && error.usage ? priceUsage(error.usage, env) : null;
    if (failedUsage) {
      try { await settleUsage(env, reserved, error.usage); } catch (settleError) { failedUsage = null; }
    }
    logLine(pathname, 502, failedUsage ? failedUsage.tokens : reserved.tokens, "ai_response");
    return json(502, {
      ok: false,
      error: "ai_response",
      message: "The AI response did not match the expected shape. Static checks still ran. Your rule was not stored.",
      staticFindings: staticFindings
    }, cors);
  }
  var ai = outcome.result;
  var actual = null;
  try {
    actual = await settleUsage(env, reserved, outcome.usage);
  } catch (error) {
    actual = null;
  }
  logLine(pathname, 200, actual ? actual.tokens : reserved.tokens, null);
  return json(200, {
    ok: true,
    staticFindings: staticFindings,
    ai: ai,
    provider: ai.provider,
    mock: ai.mock === true
  }, cors);
}

var pack = packs["2026.1"];

function resetGate() {
  return gate.resetMemory();
}

function gateSnapshot() {
  return gate.snapshot();
}

export {
  handleRequest,
  resetGate,
  quote,
  gateSnapshot,
  examples,
  pack,
  packs
};
