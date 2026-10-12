/* Request and response schemas for /analyze, /generate, and /refine. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RuleSchemas = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var version = { type: "string", enum: ["2026.1", "2025.1"] };
  var token = { type: "string", minLength: 1, maxLength: 2048 };
  var cube = { type: "string", minLength: 1, maxLength: 80 };
  var rule = { type: "string", minLength: 1, maxLength: 8000 };

  var analyzeRequest = {
    type: "object",
    additionalProperties: false,
    required: ["version", "cube", "rule", "turnstileToken"],
    properties: {
      version: version,
      cube: cube,
      rule: rule,
      metadata: { type: "object" },
      turnstileToken: token
    }
  };

  var generateRequest = {
    type: "object",
    additionalProperties: false,
    required: ["version", "cube", "story", "turnstileToken"],
    properties: {
      version: version,
      database: { type: "string", maxLength: 80 },
      cube: cube,
      sourceCubes: { type: "string", maxLength: 400 },
      dimensions: { type: "array" },
      metadata: { type: "object" },
      story: { type: "string", minLength: 1, maxLength: 4000 },
      answers: { type: "object" },
      turnstileToken: token
    }
  };

  var refineRequest = {
    type: "object",
    additionalProperties: false,
    required: ["version", "cube", "rule", "turnstileToken"],
    properties: {
      version: version,
      cube: cube,
      rule: rule,
      chips: { type: "array", items: { type: "string", maxLength: 80 } },
      instruction: { type: "string", maxLength: 2000 },
      metadata: { type: "object" },
      turnstileToken: token
    }
  };

  var response = {
    type: "object",
    additionalProperties: false,
    required: ["provider", "mock", "label"],
    properties: {
      provider: { type: "string", enum: ["mock", "openai", "anthropic"] },
      mock: { type: "boolean" },
      label: { type: "string", minLength: 1, maxLength: 200 },
      findings: { type: "array" },
      scenarios: { type: "array" },
      clarification: {},
      rule: { type: "string", maxLength: 8000 },
      explanation: { type: "string", maxLength: 4000 },
      targetArea: { type: "string", maxLength: 1000 },
      references: { type: "string", maxLength: 2000 },
      performanceNotes: { type: "string", maxLength: 2000 },
      testIdeas: { type: "string", maxLength: 2000 },
      assumptions: { type: "string", maxLength: 2000 },
      optimization: {},
      before: { type: "string", maxLength: 8000 },
      after: { type: "string", maxLength: 8000 },
      diff: { type: "array" }
    }
  };

  return {
    analyzeRequest: analyzeRequest,
    generateRequest: generateRequest,
    refineRequest: refineRequest,
    response: response,
    MAX_RULE: 8000,
    MAX_STORY: 4000
  };
});
