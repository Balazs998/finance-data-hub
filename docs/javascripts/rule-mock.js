/* Mock provider. Schema-shaped output for offline mode and AI_PROVIDER=mock.
   Every result says it is not real AI. No timings, speedups, or benchmarks.
   Example rule text is chosen from the loaded examples file. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RuleMock = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var LABEL = "Mock provider – not real AI";

  function loadDiff() {
    if (typeof module === "object" && module.exports) return require("./diff.js");
    return globalThis.RuleDiff;
  }

  function base(extra) {
    var result = {
      provider: "mock",
      mock: true,
      label: LABEL,
      findings: [],
      scenarios: [],
      clarification: null,
      rule: "",
      explanation: "",
      targetArea: "",
      references: "",
      performanceNotes: "",
      testIdeas: "",
      assumptions: "",
      optimization: null,
      before: "",
      after: ""
    };
    if (extra) Object.keys(extra).forEach(function (key) { result[key] = extra[key]; });
    return result;
  }

  function examplesOf(input) {
    if (input && Array.isArray(input.examples)) return input.examples;
    return [];
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function pickExample(list, story) {
    var text = String(story || "").toLowerCase();
    if (/variance\s*%|percent|blank when|budget is 0/.test(text)) return byId(list, "ex02");
    if (/fx|amount eur|currency|exchange/.test(text) && /dynamic cell|dcr/.test(text)) return byId(list, "ex07");
    if (/fx|amount eur|currency|exchange/.test(text)) return byId(list, "ex06");
    if (/offset|prior period|previous period/.test(text)) return byId(list, "ex08");
    if (/continue/.test(text)) return byId(list, "ex05");
    if (/stet/.test(text)) return byId(list, "ex04");
    if (/sum\(/.test(text) || /uniform/.test(text)) return byId(list, "ex11");
    if (/label/.test(text)) return byId(list, "ex12");
    if (/2026-07/.test(text) && /forecast/.test(text)) return byId(list, "ex03");
    if (/marker/.test(text)) return byId(list, "ex10");
    if (/variance/.test(text)) return byId(list, "ex01");
    var title = list.filter(function (example) {
      return text.indexOf(String(example.title || "").toLowerCase()) >= 0;
    })[0];
    return title || null;
  }

  function roleHint(dimensions) {
    if (!dimensions || !dimensions.length) return "";
    return " Role is only a hint. Jedox has no special measures dimension type.";
  }

  function targetOf(rule) {
    var line = String(rule || "").split("\n").filter(function (row) {
      return row.trim() && row.trim().indexOf("//") !== 0 && row.indexOf("=") >= 0;
    })[0] || "";
    var eq = line.indexOf("=");
    return eq >= 0 ? line.slice(0, eq).trim() : "";
  }

  function fillFromExample(example, input) {
    var refs = example.cube;
    return base({
      rule: example.rule,
      explanation: example.explanation + roleHint(input && input.dimensions),
      targetArea: targetOf(example.rule),
      references: "Cube " + example.cube + ". Names come from the demo metadata file.",
      performanceNotes: "Draft only. " + (example.explanation || ""),
      testIdeas: "Try a base period such as 2026-09, a zero Budget (shown as an empty cell), and consolidated FY2026.",
      assumptions: "Fictional FDH_DEMO data. " + (example.verified || "Not executed in Jedox.")
    });
  }

  function clarification(list, reason) {
    var choices = list.map(function (example) { return example.title; });
    return base({
      clarification: {
        reason: reason,
        questions: [
          {
            id: "which",
            prompt: "Which calculation should the draft follow?",
            choices: choices
          },
          {
            id: "consolidation",
            prompt: "Should consolidated periods such as FY2026 be calculated by the rule or aggregated?",
            choices: ["Aggregated", "Rule (C:)"]
          }
        ]
      }
    });
  }

  function answerExample(list, answers) {
    var which = answers && (answers.which || answers.q1);
    if (!which) return null;
    var text = String(which).toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].title).toLowerCase() === text) return list[i];
    }
    return pickExample(list, which);
  }

  function sameBlank(value) {
    if (value == null) return true;
    var text = String(value).trim().toLowerCase();
    return text === "" || text === "0" || text === "blank" || text === "empty" || text === "null";
  }

  function scenariosFor(rule) {
    var text = String(rule || "");
    var rows = [];
    if (/Variance %/.test(text) && /Budget/.test(text)) {
      rows.push({
        title: "Actual 10, Budget 4 → Variance % 1.5",
        status: "passed",
        detail: "Simulated on fictional numbers. (10 − 4) / 4 = 1.5.",
        source: "simulated"
      });
      rows.push({
        title: "Budget 0 → Variance % blank",
        status: "passed",
        detail: "A zero Budget is shown as an empty cell. That match is not a failure.",
        source: "simulated"
      });
    } else if (/Variance/.test(text) && /Actual/.test(text) && /Budget/.test(text)) {
      rows.push({
        title: "Actual 10, Budget 4 → Variance 6",
        status: "passed",
        detail: "Simulated on fictional numbers. 10 − 4 = 6.",
        source: "simulated"
      });
      rows.push({
        title: "Budget 0 and Actual 0 → Variance blank",
        status: "passed",
        detail: "Both inputs are empty cells. 0 and a blank cell are the same here, so this is not a failure.",
        source: "simulated"
      });
    } else if (/PALO\.DATA/.test(text) || /FX_RATE/.test(text)) {
      rows.push({
        title: "Amount 100, USD rate 0.9000 → Amount EUR 90",
        status: "passed",
        detail: "Simulated with the fictional USD rate from the examples file. Not executed in Jedox.",
        source: "simulated"
      });
      rows.push({
        title: "Amount 0 → Amount EUR blank",
        status: "passed",
        detail: "A zero amount is shown as an empty cell. That is not a failure.",
        source: "simulated"
      });
    }
    rows.push({
      title: "Consolidated FY2026",
      status: "not_verifiable",
      detail: "Consolidation cannot be confirmed without a Jedox connection.",
      source: "simulated"
    });
    rows.forEach(function (row) {
      if (row.status === "failed" && sameBlank(row.detail)) row.status = "passed";
    });
    return rows;
  }

  function factorRepeated(rule) {
    var calls = [];
    var re = /PALO\.DATA\s*\([^)]*\)/g;
    var match;
    while ((match = re.exec(rule))) calls.push(match[0].replace(/\s+/g, ""));
    if (calls.length < 2 || calls[0] !== calls[1]) return null;
    var call = (rule.match(/PALO\.DATA\s*\([^)]*\)/) || [""])[0];
    var factored = rule.replace(
      /(\[[^\]]+\])\s*\*\s*PALO\.DATA\s*\([^)]*\)\s*\+\s*\1\s*\*\s*PALO\.DATA\s*\([^)]*\)\s*\*\s*0\.1/,
      "$1 * " + call + " * 1.1"
    );
    if (factored === rule) return null;
    return factored;
  }

  function restrict(rule, dimension, element) {
    var needle = "'" + dimension + "':'" + element + "'";
    if (rule.indexOf(needle) >= 0) return rule;
    var eq = rule.indexOf("=");
    var target = eq >= 0 ? rule.slice(0, eq) : rule;
    if (target.indexOf("'" + dimension + "'") >= 0) return rule;
    if (target.replace(/\s+/g, "") === "[]") {
      return "['" + dimension + "':'" + element + "']" + rule.slice(target.length);
    }
    var at = target.lastIndexOf("]");
    if (at < 0) return rule;
    return rule.slice(0, at) + ",'" + dimension + "':'" + element + "']" + rule.slice(at + 1);
  }

  function applyChip(rule, chip) {
    var name = String(chip || "").toLowerCase();
    if (name === "only actuals") return restrict(rule, "Version", "Actual");
    if (name === "budget versions") return restrict(rule, "Version", "Budget");
    if (name === "exclude intercompany") {
      return "// FDH_DEMO has no intercompany element. Name the element to exclude it.\n" + rule;
    }
    if (name === "reduce calculations") return factorRepeated(rule) || rule;
    return rule;
  }

  function analyze(input) {
    var rule = String((input && input.rule) || "");
    var findings = [];
    var optimization = null;
    var factored = factorRepeated(rule);
    if (factored) {
      findings.push({
        code: "MOCK_FACTOR",
        group: "optimization",
        severity: "info",
        source: "ai",
        title: "Repeated lookup can be written once",
        message: "Mock reading only: the same PALO.DATA call is written twice. The draft multiplies once. This is not a measured speedup and not a real model opinion."
      });
      optimization = {
        before: rule,
        after: factored,
        note: "Same fictional inputs. Review the draft before using it. No rule has been executed in Jedox."
      };
    }
    if (/=\s*N:/.test(rule)) {
      findings.push({
        code: "MOCK_PREFIX",
        group: "logic",
        severity: "info",
        source: "ai",
        title: "Prefer B: for base cells",
        message: "N: is the older form. The mock draft would write B: when the rule should run on base cells and aggregate."
      });
    }
    return base({
      findings: findings,
      scenarios: scenariosFor(rule),
      optimization: optimization,
      explanation: "Mock provider only. Static checks are the parser; sentences in this card are not a live model."
    });
  }

  function generate(input) {
    input = input || {};
    var list = examplesOf(input);
    var story = String(input.story || "").trim();
    var chosen = answerExample(list, input.answers) || pickExample(list, story);
    if (!input.cube || story.length < 12) {
      return clarification(list, "The cube or the story is missing.");
    }
    if (!chosen) return clarification(list, "The story does not name a calculation the demo pack can draft.");
    if (input.answers && input.answers.consolidation === "Rule (C:)") {
      var drafted = fillFromExample(chosen, input);
      drafted.rule = drafted.rule.replace(/=\s*B:/, "= C:").replace(/=\s*IF/, "= C: IF");
      drafted.assumptions += " You asked for a C: rule so consolidated cells are calculated, not aggregated.";
      return drafted;
    }
    return fillFromExample(chosen, input);
  }

  function refine(input) {
    input = input || {};
    var before = String(input.rule || "");
    var chips = input.chips || [];
    var after = before;
    chips.forEach(function (chip) { after = applyChip(after, chip); });
    var instruction = String(input.instruction || "").trim();
    if (instruction && /actual/i.test(instruction)) after = applyChip(after, "only actuals");
    if (instruction && /budget/i.test(instruction)) after = applyChip(after, "budget versions");
    if (instruction && /intercompany/i.test(instruction)) after = applyChip(after, "exclude intercompany");
    if (instruction && /simpler|explain/i.test(instruction)) {
      /* The rule stays; the explanation is the change. */
    }
    var diff = loadDiff();
    return base({
      rule: after,
      before: before,
      after: after,
      explanation: chips.indexOf("simpler explanation") >= 0 || /simpler|explain/i.test(instruction)
        ? "Mock summary: the rule writes a calculated element from other elements in the same cube. It has not been run in Jedox."
        : "Mock edit from the selected chips. Not a live model.",
      optimization: before === after ? null : {
        before: before,
        after: after,
        note: "Side-by-side draft. No timing is reported because none was measured."
      },
      diff: diff ? diff.diffLines(before, after) : []
    });
  }

  return {
    id: "mock",
    LABEL: LABEL,
    analyze: function (input) { return Promise.resolve(analyze(input)); },
    generate: function (input) { return Promise.resolve(generate(input)); },
    refine: function (input) { return Promise.resolve(refine(input)); },
    analyzeSync: analyze,
    generateSync: generate,
    refineSync: refine,
    sameBlank: sameBlank
  };
});
