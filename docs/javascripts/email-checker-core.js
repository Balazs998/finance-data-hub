/* Checks a pasted Integrator Groovy script for the nine email traps.
   Reads text only. Names it cannot verify become "Check in your Jedox" cards. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailChecker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function load(file, globalName) {
    if (typeof module === "object" && module.exports) return require("./" + file);
    return globalThis[globalName];
  }

  var shared = load("email-shared.js", "EmailShared");
  var messages = load("email-check-messages.js", "EmailCheckMessages");

  var MAX_LINES = 2000;

  var EXAMPLE_SCRIPT = [
    "def src = API.initSource('PnL_Extract')",
    "while (src.nextRow()) {",
    "    rows << [cc: src.getColumnString('CostCenter')]",
    "}",
    "def mail = API.getMailer()",
    "mail.setServer('smtp.example.com')",
    "mail.addRecipient('owner.cc4010@example.com')",
    "mail.setMessage(html)",
    "mail.send()",
    "mail.addRecipient(next)"
  ].join("\n");

  var CLEAN_SCRIPT = [
    "def src = API.initSource(extractName)",
    "if (src == null) throw new IllegalStateException('Could not initialize extract ' + extractName)",
    "while (src.nextRow()) {",
    "    rows.add([cc: src.getColumnString(ccColumn)])",
    "}",
    "src.close()",
    "",
    "boolean testMode = true",
    "String to = testMode ? testTo : r.owner_email",
    "",
    "def mailer = API.getMailer()",
    "for (Map r : recipients) {",
    "    mailer.reset()",
    "    mailer.addRecipient(to)",
    "    mailer.setSubject(email.subject)",
    "    mailer.setHtmlMessage(email.html)",
    "    mailer.send()",
    "}"
  ].join("\n");

  function withoutComments(line) {
    var out = "";
    var quote = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (quote) {
        out += ch;
        if (ch === "\\") {
          out += line.charAt(i + 1) || "";
          i += 1;
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "/" && line.charAt(i + 1) === "/") break;
      if (ch === "'" || ch === '"') quote = ch;
      out += ch;
    }
    return out;
  }

  function codeOnly(line) {
    return withoutComments(line)
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
  }

  function stringLiterals(line) {
    var parts = [];
    var current = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (current) {
        if (ch === "\\") {
          i += 1;
          continue;
        }
        if (ch === current.quote) {
          parts.push(line.slice(current.start, i));
          current = null;
        }
        continue;
      }
      if (ch === "/" && line.charAt(i + 1) === "/") break;
      if (ch === "'" || ch === '"') {
        current = { quote: ch, start: i + 1 };
      }
    }
    return parts;
  }

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
    });
  }

  function ruleIssue(rule, line, extra) {
    var spec = messages.rules[rule];
    var title = spec.title;
    if (extra && extra.title) title = extra.title;
    return {
      rule: rule,
      severity: spec.severity,
      line: line,
      title: title,
      explanation: spec.explanation,
      fix: spec.fix,
      before: spec.before,
      after: spec.after,
      icon: messages.icons[spec.severity],
      label: messages.labels[spec.severity]
    };
  }

  function checkIssue(kind, line, name) {
    return {
      rule: "NAME",
      severity: "check",
      line: line,
      kind: kind,
      name: name,
      title: messages.checkTitle,
      explanation: fill(messages.checks[kind], { name: name }),
      short: fill(messages.checks.short[kind], { name: name }),
      fix: "",
      before: "",
      after: "",
      icon: messages.icons.check,
      label: messages.labels.check
    };
  }

  function push(list, issue) {
    var key = issue.rule + ":" + issue.line + ":" + (issue.name || "") + ":" + issue.title;
    if (list.some(function (item) { return item.rule + ":" + item.line + ":" + (item.name || "") + ":" + item.title === key; })) return;
    list.push(issue);
  }

  function checkDollar(lines, issues) {
    lines.forEach(function (line, index) {
      if (line.indexOf("${") >= 0) push(issues, ruleIssue("EM01", index + 1));
    });
  }

  function checkMarkers(lines, issues) {
    lines.forEach(function (line, index) {
      var names = [];
      stringLiterals(line).forEach(function (literal) {
        var match;
        var re = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
        while ((match = re.exec(literal))) {
          if (!shared.KNOWN_SCRIPT_MARKERS[match[1]]) names.push(match[1]);
        }
      });
      if (names.length) {
        push(issues, ruleIssue("EM02", index + 1, {
          title: "Unknown marker `{{" + names[0] + "}}`"
        }));
      }
    });
  }

  function checkReset(lines, issues) {
    var pendingSend = false;
    var depth = 0;
    var loops = [];
    lines.forEach(function (raw, index) {
      var lineNo = index + 1;
      var code = codeOnly(raw);
      var re = /\{|\}|\.reset\s*\(|\.send\s*\(|\.(?:addRecipient|addCcRecipient|addBccRecipient|setSubject|setHtmlMessage|setMessage)\s*\(|\bfor\s*\(|\bwhile\s*\(|\.each\s*[\({]/g;
      var match;
      var arm = false;
      while ((match = re.exec(code))) {
        var tok = match[0];
        if (tok.charAt(0) === "{") {
          depth += 1;
          if (arm) {
            loops.push({ depth: depth, compose: 0, reset: false, send: false });
            arm = false;
          }
          continue;
        }
        if (tok.charAt(0) === "}") {
          var loop = loops.length ? loops[loops.length - 1] : null;
          if (loop && depth === loop.depth) {
            if (loop.send && loop.compose && !loop.reset) {
              push(issues, ruleIssue("EM03", loop.compose));
            }
            loops.pop();
          }
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (/^(?:for|while)\b|\.each/.test(tok)) {
          arm = true;
          continue;
        }
        if (tok.indexOf(".reset") === 0) {
          pendingSend = false;
          loops.forEach(function (loop) { loop.reset = true; });
          continue;
        }
        if (tok.indexOf(".send") === 0) {
          pendingSend = true;
          loops.forEach(function (loop) { loop.send = true; });
          continue;
        }
        if (pendingSend) push(issues, ruleIssue("EM03", lineNo));
        loops.forEach(function (loop) {
          if (!loop.compose) loop.compose = lineNo;
        });
      }
    });
  }

  function checkSmtp(lines, issues) {
    lines.forEach(function (raw, index) {
      var code = codeOnly(raw);
      var re = /\.(setServer|setSMTPServer|setSender)\s*\(/g;
      var match;
      while ((match = re.exec(code))) {
        push(issues, ruleIssue("EM04", index + 1, {
          title: "`" + match[1] + "()` does nothing since Jedox 24.2"
        }));
      }
    });
  }

  function checkTestMode(lines, issues) {
    var joined = lines.map(codeOnly).join("\n");
    if (!/\.(?:addRecipient|addCcRecipient|addBccRecipient)\s*\(/.test(joined)) return;
    var found = false;
    var offLine = 0;
    var onLine = 0;
    var recipientLine = 0;
    lines.forEach(function (raw, index) {
      var code = withoutComments(raw);
      var setting = /setting\s*\(\s*(['"])TEST_MODE\1\s*,\s*(['"])(true|false)\2/i.exec(code);
      if (setting) {
        found = true;
        if (/^false$/i.test(setting[3])) offLine = offLine || index + 1;
        else onLine = onLine || index + 1;
      }
      var assigned = /(?:boolean\s+)?testMode\s*=\s*(true|false)\b/.exec(code);
      if (assigned) {
        found = true;
        if (assigned[1].toLowerCase() === "false") offLine = offLine || index + 1;
        else onLine = onLine || index + 1;
      }
      if (!recipientLine && /\.(?:addRecipient|addCcRecipient|addBccRecipient)\s*\(/.test(code)) {
        recipientLine = index + 1;
      }
    });
    if (onLine && !offLine) return;
    if (offLine && !onLine) {
      push(issues, ruleIssue("EM05", offLine, { title: messages.rules.EM05.titleOff }));
      return;
    }
    if (!found && recipientLine) push(issues, ruleIssue("EM05", recipientLine));
  }

  function checkSetMessage(lines, issues) {
    lines.forEach(function (raw, index) {
      var code = withoutComments(raw);
      var re = /\.setMessage\s*\(\s*([^)]*)\)/g;
      var match;
      while ((match = re.exec(code))) {
        var arg = match[1];
        if (/html/i.test(arg) || /[<>]/.test(arg)) {
          push(issues, ruleIssue("EM06", index + 1));
        }
      }
    });
  }

  function checkGetSource(lines, issues) {
    lines.forEach(function (raw, index) {
      if (/API\.getSource\s*\(/.test(codeOnly(raw))) push(issues, ruleIssue("EM07", index + 1));
    });
  }

  function checkNull(lines, issues) {
    lines.forEach(function (raw, index) {
      var code = codeOnly(raw);
      var assigned = /(?:def\s+)?([A-Za-z_]\w*)\s*=\s*API\.initSource\s*\(/.exec(code);
      if (!assigned) {
        if (/API\.initSource\s*\(/.test(code)) push(issues, ruleIssue("EM08", index + 1));
        return;
      }
      var name = assigned[1];
      var checked = new RegExp("\\b" + name + "\\s*==\\s*null|null\\s*==\\s*" + name + "\\b|\\b" + name + "\\s*!=\\s*null|null\\s*!=\\s*" + name + "\\b");
      if (checked.test(code)) return;
      for (var j = index + 1; j < lines.length && j < index + 30; j++) {
        var next = codeOnly(lines[j]);
        if (checked.test(next)) return;
        if (new RegExp("\\b" + name + "\\s*\\.").test(next)) {
          push(issues, ruleIssue("EM08", j + 1));
          return;
        }
      }
    });
  }

  function checkMailer(lines, issues, scriptType) {
    if (scriptType !== "function") return;
    lines.forEach(function (raw, index) {
      var code = codeOnly(raw);
      var assigned = /(?:def\s+)?([A-Za-z_]\w*)\s*=\s*(?:\w+\.)?getMailer\s*\(/.exec(code);
      if (!assigned) {
        if (/getMailer\s*\(/.test(code)) push(issues, ruleIssue("EM09", index + 1));
        return;
      }
      var name = assigned[1];
      var checked = new RegExp("\\b" + name + "\\s*==\\s*null|null\\s*==\\s*" + name + "\\b|\\b" + name + "\\s*!=\\s*null|null\\s*!=\\s*" + name + "\\b");
      if (checked.test(code)) return;
      for (var j = index + 1; j < lines.length && j < index + 8; j++) {
        if (checked.test(codeOnly(lines[j]))) return;
      }
      push(issues, ruleIssue("EM09", index + 1));
    });
  }

  function checkNames(lines, issues) {
    var patterns = [
      { kind: "extract", re: /API\.(?:initSource|getSource)\s*\(\s*(['"])([^'"]+)\1/g },
      { kind: "column", re: /\.getColumn(?:String|Value|Double|Int|Long)?\s*\(\s*(['"])([^'"]+)\1/g },
      { kind: "connection", re: /\b(?:readFile|readBinary|readText)\s*\(\s*(['"])([^'"]+)\1/g },
      { kind: "variable", re: /\b(?:setting|getProperty)\s*\(\s*(['"])([^'"]+)\1/g }
    ];
    lines.forEach(function (raw, index) {
      var code = withoutComments(raw);
      patterns.forEach(function (pattern) {
        pattern.re.lastIndex = 0;
        var match;
        while ((match = pattern.re.exec(code))) {
          push(issues, checkIssue(pattern.kind, index + 1, match[2]));
        }
      });
    });
  }

  function checkScript(source, options) {
    var opts = options || {};
    var scriptType = opts.scriptType === "function" ? "function" : "job";
    var text = String(source == null ? "" : source).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!text.trim()) {
      return { empty: true, notGroovy: false, truncated: false, lineLimit: MAX_LINES, scriptType: scriptType, issues: [] };
    }
    var lines = text.split("\n");
    var truncated = lines.length > MAX_LINES;
    if (truncated) lines = lines.slice(0, MAX_LINES);
    if (!/API\s*\./.test(lines.join("\n"))) {
      return { empty: false, notGroovy: true, truncated: truncated, lineLimit: MAX_LINES, scriptType: scriptType, issues: [] };
    }
    var issues = [];
    checkDollar(lines, issues);
    checkMarkers(lines, issues);
    checkReset(lines, issues);
    checkSmtp(lines, issues);
    checkTestMode(lines, issues);
    checkSetMessage(lines, issues);
    checkGetSource(lines, issues);
    checkNull(lines, issues);
    checkMailer(lines, issues, scriptType);
    checkNames(lines, issues);
    var rank = { error: 0, warning: 1, check: 2 };
    issues.sort(function (a, b) {
      if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
      if (a.line !== b.line) return a.line - b.line;
      return String(a.rule).localeCompare(String(b.rule));
    });
    return {
      empty: false,
      notGroovy: false,
      truncated: truncated,
      lineLimit: MAX_LINES,
      scriptType: scriptType,
      issues: issues
    };
  }

  return {
    MAX_LINES: MAX_LINES,
    EXAMPLE_SCRIPT: EXAMPLE_SCRIPT,
    CLEAN_SCRIPT: CLEAN_SCRIPT,
    checkScript: checkScript
  };
});
