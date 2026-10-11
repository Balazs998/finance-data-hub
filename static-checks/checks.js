/* Static checks for Jedox business rules. Pure JavaScript: the browser
   page and the Cloudflare worker both load this file. Findings from here
   always use source "static". Nothing in this file calls the network. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RuleChecks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var TRIG = { ACOS: 1, ASIN: 1, ATAN: 1, COS: 1, SIN: 1, TAN: 1 };
  var AGG = { SUM: 1, MIN: 1, MAX: 1, AVERAGE: 1 };
  var SYNTAX_FN = { OFFSET: { min_args: 1, max_args: 1, name: "OFFSET" } };

  function finding(code, group, severity, message, line) {
    var item = {
      code: code,
      group: group,
      severity: severity,
      source: "static",
      message: message
    };
    if (line) item.line = line;
    return item;
  }

  function lineAt(text, index) {
    var line = 1;
    for (var i = 0; i < index && i < text.length; i++) {
      if (text.charAt(i) === "\n") line += 1;
    }
    return line;
  }

  function stripComments(text) {
    var out = "";
    var i = 0;
    var quote = null;
    while (i < text.length) {
      var c = text.charAt(i);
      var n = text.charAt(i + 1);
      if (quote) {
        out += c;
        if (c === "\\") {
          out += n;
          i += 2;
          continue;
        }
        if (c === quote) quote = null;
        i += 1;
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        out += c;
        i += 1;
        continue;
      }
      if (c === "/" && n === "/") {
        while (i < text.length && text.charAt(i) !== "\n") i += 1;
        continue;
      }
      if (c === "/" && n === "*") {
        i += 2;
        while (i < text.length && !(text.charAt(i) === "*" && text.charAt(i + 1) === "/")) {
          if (text.charAt(i) === "\n") out += "\n";
          i += 1;
        }
        i += 2;
        continue;
      }
      out += c;
      i += 1;
    }
    return out;
  }

  function scanStructure(text) {
    var quote = null;
    var stack = [];
    var pairs = { "(": ")", "[": "]", "{": "}" };
    var close = { ")": "(", "]": "[", "}": "{" };
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) {
        if (c === "\\") {
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        continue;
      }
      if (pairs[c]) stack.push(c);
      else if (close[c]) {
        if (!stack.length || stack[stack.length - 1] !== close[c]) {
          return { error: "bracket" };
        }
        stack.pop();
      }
    }
    if (quote === "'") return { error: "quote", which: "single" };
    if (quote === '"') return { error: "quote", which: "double" };
    if (stack.length) return { error: "bracket", open: stack[stack.length - 1] };
    return { error: null };
  }

  function skipString(text, i) {
    var q = text.charAt(i);
    i += 1;
    while (i < text.length) {
      if (text.charAt(i) === "\\") {
        i += 2;
        continue;
      }
      if (text.charAt(i) === q) return i + 1;
      i += 1;
    }
    return i;
  }

  function stringValue(token) {
    if (!token || token.length < 2) return null;
    var q = token.charAt(0);
    if ((q !== "'" && q !== '"') || token.charAt(token.length - 1) !== q) return null;
    return token.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  function matchClose(text, openIndex, openCh, closeCh) {
    var depth = 0;
    var quote = null;
    for (var i = openIndex; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) {
        if (c === "\\") {
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        continue;
      }
      if (c === openCh) depth += 1;
      else if (c === closeCh) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return text.length - 1;
  }

  function splitTop(text, sep) {
    var parts = [];
    var quote = null;
    var depth = 0;
    var start = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) {
        if (c === "\\") {
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        continue;
      }
      if (c === "(" || c === "[" || c === "{") depth += 1;
      else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
      else if (c === sep && depth === 0) {
        parts.push(text.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(text.slice(start));
    return parts;
  }

  function readStringToken(text, i) {
    var start = i;
    i = skipString(text, i);
    return { token: text.slice(start, i), end: i };
  }

  function parseItems(body) {
    if (!body || !String(body).trim()) return [];
    return splitTop(body, ",").map(function (part) {
      var text = part.trim();
      var dim = null;
      var dimMatch = text.match(/^'([^']*)'\s*:/);
      if (dimMatch) dim = dimMatch[1];
      var elements = [];
      var list = text.match(/\{\s*([^}]*)\}/);
      if (list) {
        splitTop(list[1], ",").forEach(function (bit) {
          var value = stringValue(bit.trim());
          if (value != null) elements.push(value);
        });
      } else {
        var after = dim ? text.replace(/^'[^']*'\s*:/, "").trim() : text;
        var one = stringValue(after);
        if (one != null) elements.push(one);
      }
      return {
        text: text,
        dim: dim,
        elements: elements,
        hasOffset: /OFFSET\s*\(/i.test(text),
        current: /!'/.test(text)
      };
    }).filter(function (item) { return item.text.length > 0; });
  }

  function parseAreas(text) {
    var areas = [];
    var i = 0;
    while (i < text.length) {
      var c = text.charAt(i);
      if (c === "'" || c === '"') {
        var read = readStringToken(text, i);
        var j = read.end;
        while (j < text.length && /\s/.test(text.charAt(j))) j += 1;
        if (text.charAt(j) === ":") {
          j += 1;
          while (j < text.length && /\s/.test(text.charAt(j))) j += 1;
          if (text.charAt(j) === "'" || text.charAt(j) === '"') {
            var cubeRead = readStringToken(text, j);
            var k = cubeRead.end;
            while (k < text.length && /\s/.test(text.charAt(k))) k += 1;
            if (text.charAt(k) === "[") {
              var endDb = matchClose(text, k, "[", "]");
              areas.push({
                kind: "dcr",
                database: stringValue(read.token),
                cube: stringValue(cubeRead.token),
                items: parseItems(text.slice(k + 1, endDb)),
                raw: text.slice(i, endDb + 1)
              });
              i = endDb + 1;
              continue;
            }
          }
        } else if (text.charAt(j) === "[") {
          var endCube = matchClose(text, j, "[", "]");
          areas.push({
            kind: "dcr",
            database: null,
            cube: stringValue(read.token),
            items: parseItems(text.slice(j + 1, endCube)),
            raw: text.slice(i, endCube + 1)
          });
          i = endCube + 1;
          continue;
        }
        i = read.end;
        continue;
      }
      if (c === "[") {
        var marker = text.charAt(i + 1) === "[";
        var openAt = marker ? i + 1 : i;
        var end = matchClose(text, openAt, "[", "]");
        areas.push({
          kind: marker ? "marker" : "cell",
          database: null,
          cube: null,
          items: parseItems(text.slice(openAt + 1, end)),
          raw: text.slice(i, marker ? end + 2 : end + 1)
        });
        i = end + (marker ? 2 : 1);
        continue;
      }
      i += 1;
    }
    return areas;
  }

  function findCalls(text) {
    var calls = [];
    var i = 0;
    while (i < text.length) {
      var c = text.charAt(i);
      if (c === "'" || c === '"') {
        i = skipString(text, i);
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var start = i;
        i += 1;
        while (i < text.length && /[A-Za-z0-9_.]/.test(text.charAt(i))) i += 1;
        var name = text.slice(start, i);
        var j = i;
        while (j < text.length && /\s/.test(text.charAt(j))) j += 1;
        if (text.charAt(j) === "(") {
          var end = matchClose(text, j, "(", ")");
          var inner = text.slice(j + 1, end);
          calls.push({
            name: name,
            args: splitTop(inner, ",").map(function (part) { return part.trim(); }).filter(function (part) {
              return part.length > 0;
            }),
            raw: text.slice(start, end + 1),
            index: start
          });
        }
        continue;
      }
      i += 1;
    }
    return calls;
  }

  function splitRules(text) {
    var rules = [];
    var i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/.test(text.charAt(i))) i += 1;
      if (i >= text.length) break;
      var start = i;
      var depth = 0;
      var quote = null;
      var eq = -1;
      for (var j = i; j < text.length; j++) {
        var c = text.charAt(j);
        if (quote) {
          if (c === "\\") {
            j += 1;
            continue;
          }
          if (c === quote) quote = null;
          continue;
        }
        if (c === "'" || c === '"') {
          quote = c;
          continue;
        }
        if (c === "(" || c === "[" || c === "{") depth += 1;
        else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
        else if (c === "=" && depth === 0) {
          var prev = text.charAt(j - 1);
          var next = text.charAt(j + 1);
          if (prev === "!" || prev === "<" || prev === ">" || next === "=") continue;
          eq = j;
          break;
        }
      }
      if (eq < 0) {
        rules.push({ target: text.slice(start).trim(), expr: "", prefix: "", index: start });
        break;
      }
      var target = text.slice(start, eq).trim();
      var k = eq + 1;
      depth = 0;
      quote = null;
      var exprEnd = text.length;
      for (; k < text.length; k++) {
        var ch = text.charAt(k);
        if (quote) {
          if (ch === "\\") {
            k += 1;
            continue;
          }
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === "'" || ch === '"') {
          quote = ch;
          continue;
        }
        if (ch === "(" || ch === "[" || ch === "{") depth += 1;
        else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
        else if (ch === "\n" && depth <= 0) {
          exprEnd = k;
          break;
        }
      }
      var expr = text.slice(eq + 1, exprEnd).trim();
      var prefix = "";
      var prefixMatch = expr.match(/^([A-Za-z]):\s*/);
      if (prefixMatch) {
        prefix = prefixMatch[1].toUpperCase();
        expr = expr.slice(prefixMatch[0].length);
      }
      rules.push({ target: target, expr: expr, prefix: prefix, index: start });
      i = exprEnd + 1;
    }
    return rules;
  }

  function addNames(node, into) {
    if (node == null) return;
    if (typeof node === "string") {
      var labelled = node.match(/^(.+?)\s*\((?:string|base|consolidated)[^)]*\)$/i);
      if (labelled) {
        into.add(labelled[1]);
        if (/string/i.test(node)) into.strings = into.strings || [];
        return;
      }
      if (node.indexOf("..") >= 0) return;
      if (/codes|from|used|style|dictionary/i.test(node)) return;
      if (node.length && node.length < 80) into.add(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(function (item) { addNames(item, into); });
      return;
    }
    if (typeof node === "object") {
      Object.keys(node).forEach(function (key) {
        if (key !== "base" && key !== "rule" && key !== "consolidated" && key.indexOf("..") < 0 && key.length < 80) {
          into.add(key);
        }
        addNames(node[key], into);
      });
    }
  }

  function stringTypeNames(node, into) {
    if (node == null) return;
    if (typeof node === "string") {
      var labelled = node.match(/^(.+?)\s*\(string[^)]*\)$/i);
      if (labelled) into.add(labelled[1]);
      return;
    }
    if (Array.isArray(node)) node.forEach(function (item) { stringTypeNames(item, into); });
    else if (typeof node === "object") {
      Object.keys(node).forEach(function (key) { stringTypeNames(node[key], into); });
    }
  }

  function elementsFor(metadata, cube, dimension) {
    if (!metadata || !metadata.elements || !dimension) return null;
    var specific = metadata.elements[dimension + " (" + cube + ")"];
    var node = specific || metadata.elements[dimension];
    if (!node) return null;
    var names = new Set();
    addNames(node, names);
    return names;
  }

  function indexPack(pack) {
    var byName = {};
    (pack.functions || []).forEach(function (fn) {
      byName[String(fn.name || "").toUpperCase()] = fn;
    });
    (pack.control_functions || []).forEach(function (fn) {
      var name = String(fn.title || "").replace(/\(.*/, "").toUpperCase();
      if (name && !byName[name]) {
        byName[name] = { name: name, min_args: 0, max_args: 0, unverified: !!fn.unverified };
      }
    });
    Object.keys(SYNTAX_FN).forEach(function (name) {
      if (!byName[name]) byName[name] = SYNTAX_FN[name];
    });
    return byName;
  }

  function cubeDims(metadata, cube) {
    if (!metadata || !metadata.cubes || !cube) return null;
    return metadata.cubes[cube] || null;
  }

  function coverageOf(target) {
    var compact = target.replace(/\s+/g, "");
    if (compact === "[]" || compact === "") return { all: true, dims: {} };
    var dims = {};
    parseAreas(target).forEach(function (area) {
      if (area.kind === "dcr") return;
      area.items.forEach(function (item) {
        if (!item.dim) return;
        if (!dims[item.dim]) dims[item.dim] = new Set();
        if (item.hasOffset || item.current || !item.elements.length) dims[item.dim].add("*");
        item.elements.forEach(function (el) { dims[item.dim].add(el); });
      });
    });
    return { all: false, dims: dims };
  }

  function covers(earlier, later) {
    if (earlier.all) return !later.all || true;
    if (later.all) return false;
    var dims = Object.keys(earlier.dims);
    for (var i = 0; i < dims.length; i++) {
      var dim = dims[i];
      if (!later.dims[dim]) return false;
      var wide = earlier.dims[dim];
      var narrow = later.dims[dim];
      if (wide.has("*")) continue;
      var ok = true;
      narrow.forEach(function (el) {
        if (el === "*" || !wide.has(el)) ok = false;
      });
      if (!ok) return false;
    }
    return true;
  }

  function hasExcelEquals(expr) {
    var quote = null;
    for (var i = 0; i < expr.length; i++) {
      var c = expr.charAt(i);
      if (quote) {
        if (c === "\\") {
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        continue;
      }
      if (c === "=") {
        var prev = expr.charAt(i - 1);
        var next = expr.charAt(i + 1);
        if (prev === "!" || prev === "<" || prev === ">" || next === "=") continue;
        return true;
      }
    }
    return false;
  }

  function argIsExpression(arg) {
    var quote = null;
    var depth = 0;
    for (var i = 0; i < arg.length; i++) {
      var c = arg.charAt(i);
      if (quote) {
        if (c === "\\") {
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        continue;
      }
      if (c === "(") return true;
      if (c === "+" || c === "-" || c === "*" || c === "/" || c === "|") {
        if (!(c === "-" && depth === 0 && i === 0)) return true;
      }
    }
    return false;
  }

  function normalizeCall(raw) {
    return raw.replace(/\s+/g, "");
  }

  function unquoteArg(arg) {
    var value = stringValue(arg.trim());
    return value;
  }

  function pushUnique(list, item) {
    var key = item.code + "|" + item.group + "|" + item.severity;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code + "|" + list[i].group + "|" + list[i].severity === key) return;
    }
    list.push(item);
  }

  function checkRule(rule, options) {
    options = options || {};
    var original = String(rule || "");
    var text = stripComments(original);
    var pack = options.pack || { functions: [] };
    var metadata = options.metadata || {};
    var cube = options.cube || "";
    var version = options.version || (pack.jedox_version || "2026.1");
    var findings = [];
    var fns = indexPack(pack);
    var structure = scanStructure(text);
    if (structure.error === "quote") {
      return {
        findings: [finding(
          "QUOTE_UNBALANCED",
          "syntax",
          "error",
          structure.which === "double" ? "Unclosed double quote" : "Unclosed single quote",
          1
        )]
      };
    }
    if (structure.error === "bracket") {
      var missing = structure.open === "(" ? ")" : structure.open === "{" ? "}" : "]";
      return {
        findings: [finding(
          "BRACKET_UNBALANCED",
          "syntax",
          "error",
          "Missing " + missing + (missing === "]" ? " in target" : ""),
          1
        )]
      };
    }

    var rules = splitRules(text);
    var stringNames = new Set();
    stringTypeNames(metadata.elements, stringNames);

    rules.forEach(function (one, ruleIndex) {
      var line = lineAt(original, one.index);
      if (one.prefix === "N") {
        pushUnique(findings, finding(
          "LEGACY_PREFIX",
          "syntax",
          "info",
          "N: is the older form of the cell type restriction. Prefer B: for base cells or C: for consolidated cells. Check the exact N: behaviour in your Jedox.",
          line
        ));
      } else if (one.prefix && one.prefix !== "B" && one.prefix !== "C") {
        pushUnique(findings, finding(
          "UNKNOWN_PREFIX",
          "syntax",
          "error",
          "Cell type restriction must be B: or C: (N: is the older form)",
          line
        ));
      }

      if (!one.target.replace(/\s+/g, "") || one.target.replace(/\s+/g, "") === "[]") {
        pushUnique(findings, finding(
          "BROAD_TARGET",
          "performance",
          "warning",
          "Empty target covers the whole cube; restrict the target area",
          line
        ));
      }

      var areas = parseAreas(one.target + " " + one.expr);
      areas.forEach(function (area) {
        var counts = {};
        var firstElems = {};
        area.items.forEach(function (item) {
          if (!item.dim) return;
          counts[item.dim] = (counts[item.dim] || 0) + 1;
          if (!firstElems[item.dim]) firstElems[item.dim] = [];
          item.elements.forEach(function (el) { firstElems[item.dim].push(el); });
        });
        Object.keys(counts).forEach(function (dim) {
          if (counts[dim] < 2) return;
          var listed = (firstElems[dim] || []).map(function (el) { return "'" + el + "'"; }).join(",");
          pushUnique(findings, finding(
            "DOUBLE_RESTRICTION",
            "syntax",
            "error",
            "Dimension " + dim + " restricted twice; use ['" + dim + "':{" + listed + "}]",
            line
          ));
        });

        if (area.kind === "dcr") {
          var missingDim = area.items.filter(function (item) { return !item.dim; });
          if (missingDim.length) {
            var sample = missingDim[0];
            var guessDim = "Measure";
            var cubeName = area.cube || "cube";
            var dims = cubeDims(metadata, area.cube) || [];
            var bare = sample.elements[0];
            if (bare) {
              dims.forEach(function (dim) {
                var names = elementsFor(metadata, area.cube, dim);
                if (names && names.has(bare)) guessDim = dim;
              });
            }
            pushUnique(findings, finding(
              "DCR_DIMENSION_REQUIRED",
              "syntax",
              "error",
              "Each DCR item must name its dimension: '" + cubeName + "'['" + guessDim + "':'" + (bare || "") + "']",
              line
            ));
          }
          if (area.items.some(function (item) { return item.hasOffset; })) {
            pushUnique(findings, finding(
              "OFFSET_IN_DCR",
              "syntax",
              "error",
              "OFFSET works only in static cell references, not DCR",
              line
            ));
          }
          if (area.database && metadata.database && area.database !== metadata.database) {
            pushUnique(findings, finding(
              "UNKNOWN_DATABASE",
              "syntax",
              "error",
              "Database " + area.database + " not in metadata",
              line
            ));
            pushUnique(findings, finding(
              "OTHER_DATABASE_REF",
              "performance",
              "warning",
              "Reference to another OLAP database is not DDE-supported; large areas fall back to slower engines",
              line
            ));
          }
        }

        var hostCube = area.kind === "dcr" ? area.cube : cube;
        var hostDims = cubeDims(metadata, hostCube);
        if (hostDims && area.kind !== "dcr") {
          area.items.forEach(function (item) {
            if (!item.dim) return;
            if (hostDims.indexOf(item.dim) < 0) {
              var elsewhere = [];
              Object.keys(metadata.cubes || {}).forEach(function (name) {
                if (name !== cube && (metadata.cubes[name] || []).indexOf(item.dim) >= 0) elsewhere.push(name);
              });
              var prefer = elsewhere.indexOf("PnL_FX") >= 0 ? "PnL_FX" : elsewhere[0];
              pushUnique(findings, finding(
                "UNKNOWN_DIMENSION",
                "syntax",
                "error",
                cube + " has no " + item.dim + " dimension (" + hostDims.join(", ") + ")" +
                  (prefer ? "; use cube " + prefer : ""),
                line
              ));
              return;
            }
            var known = elementsFor(metadata, hostCube, item.dim);
            if (!known) return;
            item.elements.forEach(function (el) {
              if (!known.has(el)) {
                pushUnique(findings, finding(
                  "UNKNOWN_ELEMENT",
                  "syntax",
                  "error",
                  "Element '" + el + "' not in dimension " + item.dim,
                  line
                ));
              }
            });
          });
        }
      });

      if (one.prefix === "B" && /\/\s*(\[|[A-Za-z_(])/.test(one.expr)) {
        pushUnique(findings, finding(
          "RATIO_ON_BASE",
          "logic",
          "warning",
          "B: ratio is summed at consolidated levels (FY2026, groups); ratios need no prefix or C:",
          line
        ));
      }

      if (hasExcelEquals(one.expr)) {
        pushUnique(findings, finding(
          "EXCEL_OPERATOR",
          "syntax",
          "error",
          "Use == for comparison, not =",
          line
        ));
      }

      var calls = findCalls(one.expr);
      var seenCalls = {};
      calls.forEach(function (call) {
        var upper = call.name.toUpperCase();
        var fn = fns[upper];
        if (!fn) {
          pushUnique(findings, finding(
            "UNKNOWN_FUNCTION",
            "syntax",
            "error",
            call.name + " is not a supported rule function in " + version,
            line
          ));
          return;
        }
        if (fn.unverified) {
          pushUnique(findings, finding(
            "UNVERIFIED_FUNCTION",
            "syntax",
            "check",
            call.name + " is not confirmed for this knowledge pack. Check the call in your Jedox.",
            line
          ));
          return;
        }
        var unverifiedFields = fn.unverified_fields || [];
        if (upper === "PALO.DATA" || upper === "PALO.MARKER") {
          var db = unquoteArg(call.args[0] || "");
          var targetCube = unquoteArg(call.args[1] || "");
          if (db && metadata.database && db !== metadata.database) {
            pushUnique(findings, finding(
              "UNKNOWN_DATABASE",
              "syntax",
              "error",
              "Database " + db + " not in metadata",
              line
            ));
            pushUnique(findings, finding(
              "OTHER_DATABASE_REF",
              "performance",
              "warning",
              "Reference to another OLAP database is not DDE-supported; large areas fall back to slower engines - consider a marker on Amount",
              line
            ));
          }
          var resolvedCube = targetCube || cube;
          var dims = cubeDims(metadata, resolvedCube);
          if (dims && (db === "" || db == null || db === metadata.database || (db && db !== metadata.database))) {
            var need = 2 + dims.length;
            if (call.args.length !== need && (db === "" || db == null || db === metadata.database)) {
              var missing = [];
              if (call.args.length < need) missing = dims.slice(call.args.length - 2);
              var code = upper === "PALO.DATA" ? "PALO_DATA_ARITY" : "PALO_MARKER_ARITY";
              var message = resolvedCube + " has " + dims.length + " dimension" + (dims.length === 1 ? "" : "s");
              if (upper === "PALO.DATA" && resolvedCube === "FX_RATE") {
                message += " (" + dims.join(", ") + ")";
              }
              message += "; " + upper + " needs " + need + " arguments, got " + call.args.length;
              if (missing.length === 1) message += " (" + missing[0] + " missing)";
              pushUnique(findings, finding(code, "syntax", "error", message, line));
            }
          }
          if (upper === "PALO.MARKER" && call.args.some(argIsExpression)) {
            pushUnique(findings, finding(
              "MARKER_EXPRESSION_ARG",
              "syntax",
              "error",
              "PALO.MARKER accepts only constants and variables, no expressions",
              line
            ));
          }
        } else if (fn.max_args != null && call.args.length > fn.max_args) {
          pushUnique(findings, finding(
            "FUNCTION_ARITY",
            "syntax",
            "error",
            call.name + " expects " + (fn.min_args === fn.max_args ? String(fn.max_args) : fn.min_args + " to " + fn.max_args) + " arguments, got " + call.args.length,
            line
          ));
        } else if (fn.min_args != null && call.args.length < fn.min_args) {
          if (unverifiedFields.indexOf("min_args") >= 0) {
            pushUnique(findings, finding(
              "ARITY_UNVERIFIED",
              "syntax",
              "check",
              "The docs do not say whether " + call.name + " accepts " + call.args.length + " argument(s). Check the call in your Jedox.",
              line
            ));
          } else {
            pushUnique(findings, finding(
              "FUNCTION_ARITY",
              "syntax",
              "error",
              call.name + " expects " + fn.min_args + " arguments, got " + call.args.length,
              line
            ));
          }
        }

        if (upper === "NOW") {
          pushUnique(findings, finding(
            "VOLATILE_NOW",
            "performance",
            "warning",
            "NOW()-dependent results are not cached",
            line
          ));
        } else if (fn.dde_supported === false && upper !== "NOW") {
          pushUnique(findings, finding(
            "DDE_UNSUPPORTED_FUNCTION",
            "performance",
            "info",
            TRIG[upper] ? "Trigonometric functions are not DDE-supported" : call.name + " is not DDE-supported",
            line
          ));
        }

        if (AGG[upper]) {
          var nonUniform = call.args.some(function (arg) {
            var bits = parseAreas(arg).filter(function (area) { return area.kind !== "dcr"; });
            return bits.some(function (area) {
              return area.items.filter(function (item) { return item.dim || item.elements.length; }).length >= 2;
            });
          });
          if (nonUniform) {
            pushUnique(findings, finding(
              "NON_UNIFORM_LOOKUP",
              "performance",
              "warning",
              "Non-uniform lookups inside " + upper + " are not supported by DDE",
              line
            ));
          }
        }

        if (upper === "PALO.DATA" || upper === "PALO.MARKER") {
          var key = normalizeCall(call.raw);
          seenCalls[key] = (seenCalls[key] || 0) + 1;
        }
      });

      Object.keys(seenCalls).forEach(function (key) {
        if (seenCalls[key] < 2) return;
        pushUnique(findings, finding(
          "REPEATED_SUBEXPRESSION",
          "optimization",
          "info",
          "PALO.DATA(\"FDH_DEMO\",\"FX_RATE\",...) repeated; factor to ['Measure':'Amount'] * PALO.DATA(...) * 1.1",
          line
        ));
      });

      var cross = 0;
      areas.forEach(function (area) {
        if (area.kind === "dcr" && area.cube && area.cube !== cube) cross += 1;
      });
      calls.forEach(function (call) {
        var upper = call.name.toUpperCase();
        if (upper !== "PALO.DATA" && upper !== "PALO.MARKER") return;
        var targetCube = unquoteArg(call.args[1] || "");
        if (targetCube && targetCube !== cube) cross += 1;
      });
      if (cross >= 2) {
        pushUnique(findings, finding(
          "CROSS_CUBE_COUNT",
          "performance",
          "info",
          cross + " cross-cube references",
          line
        ));
      }

      var markerAreas = areas.filter(function (area) { return area.kind === "marker"; });
      if (markerAreas.length) {
        var unmarkedCells = areas.filter(function (area) { return area.kind === "cell" && area.raw !== "[]"; });
        var arithmetic = /[+\-]/.test(one.expr.replace(/\[\[.*?\]\]/g, ""));
        var markedNames = [];
        markerAreas.forEach(function (area) {
          area.items.forEach(function (item) { item.elements.forEach(function (el) { markedNames.push(el); }); });
        });
        if (arithmetic && unmarkedCells.length) {
          var marked = markedNames[0] || "marked source";
          var other = "";
          unmarkedCells.forEach(function (area) {
            area.items.forEach(function (item) {
              item.elements.forEach(function (el) { if (!other) other = el; });
            });
          });
          pushUnique(findings, finding(
            "MARKER_NONZERO_RESULT",
            "logic",
            "warning",
            "Result is not 0 when only the marked " + marked + " is 0" +
              (other ? " (" + other + "-only cells, e.g. 2026-09, are skipped)" : "") +
              "; mark both or remove the marker",
            line
          ));
        } else {
          pushUnique(findings, finding(
            "UNNEEDED_MARKER",
            "performance",
            "info",
            "Simple rule is DDE-compliant; marker likely ignored and unnecessary unless an analyzed issue exists",
            line
          ));
        }
      }

      if (stringNames.size) {
        var targetAreas = parseAreas(one.target);
        var stringTarget = false;
        targetAreas.forEach(function (area) {
          area.items.forEach(function (item) {
            item.elements.forEach(function (el) {
              if (stringNames.has(el)) stringTarget = true;
            });
          });
        });
        if (stringTarget) {
          pushUnique(findings, finding(
            "STRING_RESULT_UNCACHED",
            "performance",
            "info",
            "String values produced by rules are not cached. Check the target size in your Jedox.",
            line
          ));
        }
      }
    });

    if (findings.some(function (item) { return item.group === "syntax" && item.severity === "error"; })) {
      findings = findings.filter(function (item) { return item.code !== "STRING_RESULT_UNCACHED"; });
    }

    for (var later = 1; later < rules.length; later++) {
      for (var earlier = 0; earlier < later; earlier++) {
        if (/CONTINUE\s*\(/i.test(rules[earlier].expr)) continue;
        if (covers(coverageOf(rules[earlier].target), coverageOf(rules[later].target))) {
          pushUnique(findings, finding(
            "SHADOWED_RULE",
            "logic",
            "warning",
            "Rule " + (later + 1) + " target is fully covered by earlier rule " + (earlier + 1) + " and never applies; put specific rules first",
            lineAt(original, rules[later].index)
          ));
          break;
        }
      }
    }

    return { findings: findings, rules: rules.length, version: version, cube: cube };
  }

  return {
    checkRule: checkRule,
    stripComments: stripComments,
    parseAreas: parseAreas,
    elementsFor: elementsFor
  };
});
