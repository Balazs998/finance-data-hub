/* OpenAI chat adapter. The API key stays in the worker environment. */
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
  "Set provider to openai and mock to false.",
  "label must be the model name, never a claim that this ran inside Jedox."
].join(" ");

function extractJson(text) {
  var raw = String(text || "").trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

async function complete(env, messages, fetchImpl) {
  var response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.AI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.AI_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: messages
    })
  });
  if (!response.ok) throw new Error("openai HTTP " + response.status);
  var body = await response.json();
  var text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  return extractJson(text);
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
    var messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPayload(kind, input || {}) }
    ];
    var result = await complete(env, messages, fetchImpl);
    result.provider = "openai";
    result.mock = false;
    if (!result.label) result.label = env.AI_MODEL || "gpt-4o-mini";
    return result;
  };
}

async function repair(kind, input, previous, errors, env) {
  var fetchImpl = (env && env.fetchImpl) || fetch;
  var messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userPayload(kind, input || {}) },
    {
      role: "user",
      content: "The previous JSON was rejected: " + errors.join("; ") + ". Return only a corrected JSON object. Previous: " + JSON.stringify(previous)
    }
  ];
  var result = await complete(env, messages, fetchImpl);
  result.provider = "openai";
  result.mock = false;
  if (!result.label) result.label = env.AI_MODEL || "gpt-4o-mini";
  if (validate.bannedKeys(result, "$", []).length) {
    throw new Error("openai response included a timing field");
  }
  return result;
}

module.exports = {
  id: "openai",
  analyze: call("analyze"),
  generate: call("generate"),
  refine: call("refine"),
  repair: repair
};
