/* Anthropic messages adapter. The API key stays in the worker environment. */
var validate = require("./validate.js");

var SYSTEM = [
  "You draft and review Jedox cube business rules.",
  "Reply with one JSON object and no markdown.",
  "Use only functions from the supplied knowledge pack.",
  "Prefer B: for base cells and C: for consolidated cells. N: is the older form.",
  "PALO.DATA takes database, cube, then one element per dimension of that cube, in order.",
  "A stored 0 is shown as an empty cell. Do not call that a failure.",
  "Do not include timings, durations, speedups, benchmarks, or milliseconds.",
  "If the story is missing the cube, the target element, or the calculation, set clarification.questions and leave rule empty.",
  "Set provider to anthropic and mock to false.",
  "label must be the model name, never a claim that this ran inside Jedox."
].join(" ");

function extractJson(text) {
  var raw = String(text || "").trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

async function complete(env, user, fetchImpl) {
  var response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.AI_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.AI_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 2000,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: "user", content: user }]
    })
  });
  if (!response.ok) throw new Error("anthropic HTTP " + response.status);
  var body = await response.json();
  var block = body && body.content && body.content[0] && body.content[0].text;
  return extractJson(block);
}

function userPayload(kind, input) {
  return JSON.stringify({
    task: kind,
    version: input.version,
    database: input.database,
    cube: input.cube,
    sourceCubes: input.sourceCubes,
    dimensions: input.dimensions,
    story: input.story,
    rule: input.rule,
    chips: input.chips,
    instruction: input.instruction,
    answers: input.answers,
    staticFindings: input.staticFindings || [],
    roleNote: "Dimension role is a hint only. Jedox has no special measures dimension type."
  });
}

function call(kind) {
  return async function run(input, env) {
    var fetchImpl = (env && env.fetchImpl) || fetch;
    var result = await complete(env, userPayload(kind, input || {}), fetchImpl);
    result.provider = "anthropic";
    result.mock = false;
    if (!result.label) result.label = env.AI_MODEL || "claude-3-5-haiku-latest";
    return result;
  };
}

async function repair(kind, input, previous, errors, env) {
  var fetchImpl = (env && env.fetchImpl) || fetch;
  var result = await complete(
    env,
    userPayload(kind, input || {}) + "\nThe previous JSON was rejected: " + errors.join("; ") + ". Return only corrected JSON. Previous: " + JSON.stringify(previous),
    fetchImpl
  );
  result.provider = "anthropic";
  result.mock = false;
  if (!result.label) result.label = env.AI_MODEL || "claude-3-5-haiku-latest";
  if (validate.bannedKeys(result, "$", []).length) throw new Error("anthropic response included a timing field");
  return result;
}

module.exports = {
  id: "anthropic",
  analyze: call("analyze"),
  generate: call("generate"),
  refine: call("refine"),
  repair: repair
};
