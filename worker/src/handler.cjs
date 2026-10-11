/* Worker request handler. Logs counts only. Rule text is not stored or logged. */
var fs = require("fs");
var path = require("path");
var checks = require("../../static-checks/checks.js");
var engine = require("../../ai-engine/index.js");
var schemas = require("../../ai-engine/schemas.js");
var validate = require("../../ai-engine/validate.js");
var gate = require("./gate.cjs");

var root = path.resolve(__dirname, "../..");
var examples = JSON.parse(fs.readFileSync(path.join(root, "knowledge/examples-2026.1.json"), "utf8"));
var packs = {
  "2026.1": JSON.parse(fs.readFileSync(path.join(root, "knowledge/jedox-rules-2026.1.json"), "utf8")),
  "2025.1": JSON.parse(fs.readFileSync(path.join(root, "knowledge/jedox-rules-2025.1.json"), "utf8"))
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
  return request.headers.get("CF-Connecting-IP")
    || request.headers.get("x-forwarded-for")
    || "unknown";
}

function metadataFor(body) {
  if (body && body.metadata && body.metadata.cubes) return body.metadata;
  return examples.metadata;
}

function estimate(body, env) {
  var text = String(body.rule || "") + "\n" + String(body.story || "") + "\n" + String(body.instruction || "");
  var tokens = Math.ceil(text.length / 4) + 200;
  var price = Number(env.TOKEN_USD || "0.000002");
  return {
    tokens: tokens,
    spend: Math.round(tokens * price * 1000000) / 1000000
  };
}

async function verifyTurnstile(token, secret, ip, fetchImpl) {
  var form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token || "");
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  var response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  var data = await response.json();
  return !!(data && data.success);
}

async function charge(env, ip, cost) {
  if (env.BUDGET_GATE) {
    var id = env.BUDGET_GATE.idFromName("global");
    var stub = env.BUDGET_GATE.get(id);
    var response = await stub.fetch("https://gate/charge", {
      method: "POST",
      body: JSON.stringify({ ip: ip, tokens: cost.tokens, spend: cost.spend })
    });
    return response.json();
  }
  if (String(env.MEMORY_GATE) === "1") {
    return gate.chargeMemory(
      { ip: ip, tokens: cost.tokens, spend: cost.spend },
      gate.limitsFrom(env),
      env.now ? new Date(env.now) : new Date()
    );
  }
  return { ok: false, error: "budget_unconfigured" };
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
    turned = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, ip, fetchImpl);
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
  var cost = estimate(body, env);
  var admission;
  try {
    admission = await charge(env, ip, cost);
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
  var ai;
  try {
    var chosen = packFor(body.version);
    ai = await engine[route.method]({
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
    logLine(pathname, 502, cost.tokens, "ai_response");
    return json(502, {
      ok: false,
      error: "ai_response",
      message: "The AI response did not match the expected shape. Static checks still ran. Your rule was not stored.",
      staticFindings: staticFindings
    }, cors);
  }
  logLine(pathname, 200, cost.tokens, null);
  return json(200, {
    ok: true,
    staticFindings: staticFindings,
    ai: ai,
    provider: ai.provider,
    mock: ai.mock === true
  }, cors);
}

module.exports = {
  handleRequest: handleRequest,
  resetGate: gate.resetMemory,
  examples: examples,
  pack: packs["2026.1"],
  packs: packs
};
