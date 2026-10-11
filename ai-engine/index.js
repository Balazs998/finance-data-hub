/* Provider selector. AI_PROVIDER is mock, openai, or anthropic. */
var validate = require("./validate.js");
var schemas = require("./schemas.js");

function createProvider(env) {
  var name = String((env && env.AI_PROVIDER) || "mock").toLowerCase();
  if (name === "openai") return require("./openai.js");
  if (name === "anthropic") return require("./anthropic.js");
  return require("./mock.js");
}

function stampMock(result) {
  if (!result || typeof result !== "object") return result;
  if (result.provider === "mock" || result.mock === true) {
    result.provider = "mock";
    result.mock = true;
    if (!result.label || result.label.indexOf("not real AI") < 0) {
      result.label = "Mock provider – not real AI";
    }
  }
  return result;
}

function splitCall(value) {
  if (
    value &&
    typeof value === "object" &&
    value.result &&
    typeof value.result === "object" &&
    Object.prototype.hasOwnProperty.call(value, "usage")
  ) {
    return { result: value.result, usage: value.usage };
  }
  return { result: value, usage: { promptTokens: 0, completionTokens: 0 } };
}

function addUsage(left, right) {
  if (!left || !right) return null;
  return {
    promptTokens: (Number(left.promptTokens) || 0) + (Number(right.promptTokens) || 0),
    completionTokens: (Number(left.completionTokens) || 0) + (Number(right.completionTokens) || 0)
  };
}

async function run(method, input, env) {
  var provider = createProvider(env || {});
  var first = splitCall(await provider[method](input, env || {}));
  var result = stampMock(first.result);
  var usage = first.usage;
  var errors = validate.validate(result, schemas.response).concat(validate.bannedKeys(result, "$", []));
  if (result.mock === true && String(result.label).indexOf("not real AI") < 0) {
    errors.push("mock output must say it is not real AI");
  }
  if (errors.length && provider.repair && result.mock !== true) {
    var repaired = splitCall(await provider.repair(method, input, result, errors, env || {}));
    result = stampMock(repaired.result);
    usage = addUsage(usage, repaired.usage);
    errors = validate.validate(result, schemas.response).concat(validate.bannedKeys(result, "$", []));
  }
  if (errors.length) {
    var error = new Error("ai_response");
    error.details = errors;
    error.usage = usage;
    throw error;
  }
  return { result: result, usage: usage };
}

module.exports = {
  createProvider: createProvider,
  analyze: function (input, env) { return run("analyze", input, env); },
  generate: function (input, env) { return run("generate", input, env); },
  refine: function (input, env) { return run("refine", input, env); }
};
