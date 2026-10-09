/* Checker wording, page text v0.2 (J-dox signed off).
   This is the only file for the nine check titles, explanations, and fixes.
   Square-bracket notes in the source text are filled in by the checker. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmailCheckMessages = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    labels: { error: "Error", warning: "Warning", check: "Check" },
    icons: { error: "✕", warning: "!", check: "?" },
    legend: {
      error: "Error: the script will fail or send the wrong thing.",
      warning: "Warning: it runs, but something is risky or doesn't do what it looks like.",
      check: "Check: we can't know from here. Look it up in your Jedox."
    },
    empty: "Paste a script first, or try the example.",
    notGroovy: "This doesn't look like an Integrator Groovy script. The checker looks for calls like `API.getMailer()` and `API.initSource()`.",
    tooLong: "That's a long script. The checker reads the first {n} lines.",
    noProblems: {
      heading: "No problems found",
      text: "None of the nine checks found anything. That's a good sign, but the checker only reads the text. Run the job in Jedox in test mode before anyone else gets an email.",
      withChecks: "No errors or warnings. There are still {n} names to check in your Jedox. They're listed below."
    },
    checkTitle: "Check in your Jedox",
    nameGroup: function (kind, count) {
      var n = String(count);
      var one = count === 1;
      if (kind === "variable") {
        return (one ? "1 job variable" : n + " job variables") + " to check in your Jedox. This script reads them with `API.getProperty()`. Make sure each one exists in the job, or that the default in the script is what you want.";
      }
      if (kind === "extract") {
        return (one ? "1 extract" : n + " extracts") + " to check in your Jedox. Make sure an extract with this exact name is in the project.";
      }
      if (kind === "column") {
        return (one ? "1 column name" : n + " column names") + " to check in your Jedox. Open the extract preview and compare the names. The value column's name isn't documented, so check it especially.";
      }
      if (kind === "connection") {
        return (one ? "1 file connection" : n + " file connections") + " to check in your Jedox. Each name must match a File connection in the project. A relative path is read from the local files folder.";
      }
      return n + " names to check in your Jedox.";
    },
    checks: {
      extract: "Extract name `'{name}'` can't be verified here. Check that a Cube Slice extract with exactly this name exists in your project.",
      column: "Column `'{name}'` can't be verified here. Run the extract's preview and check the column is called exactly this. The value column's name isn't documented, so check `'#Value'` too.",
      connection: "Connection `'{name}'` can't be verified here. Check that a File connection with exactly this name exists in your project.",
      variable: "Job variable `'{name}'` can't be verified here. Check it's defined on the job, or that the script has a safe default for it.",
      short: {
        extract: "Extract name `'{name}'` can't be verified here.",
        column: "Column `'{name}'` can't be verified here.",
        connection: "Connection `'{name}'` can't be verified here.",
        variable: "Job variable `'{name}'` can't be verified here."
      }
    },
    rules: {
      EM01: {
        severity: "error",
        title: "`${` will be replaced before your script runs",
        explanation: "Integrator writes its own variables as `${NAME}` and replaces them in job scripts. Groovy does the same inside double-quoted strings. So a `${...}` meant for the email can be swapped out, or make the job fail, before your code sees it.",
        fix: "Use single-quoted strings, and `{{...}}` markers for values that change per email.",
        before: "String subject = \"${cc} actuals for ${period}\"",
        after: "String subject = fillMarkers('{{COST_CENTER}} actuals for {{PERIOD}}', words)"
      },
      EM02: {
        severity: "error",
        title: "Unknown marker `{{[NAME]}}`",
        explanation: "The script fills only the markers it knows. Any other marker stops the job with \"No value for marker\". A typo is enough, like `{{OWNER}}` instead of `{{OWNER_NAME}}`.",
        fix: "Use one of the known markers, spelled exactly. Template: `SUBJECT`, `HEADER_LABEL`, `TITLE`, `PERIOD`, `VERSION`, `GREETING`, `INTRO`, `HEADER_CELLS`, `TABLE_ROWS`, `TOTAL_CELLS`, `NOTE`, `FOOTER`. Subject and wording: `COST_CENTER`, `COST_CENTER_NAME`, `OWNER_NAME`, `OWNER_EMAIL`, `PERIOD`, `VERSION_PLAN`, `VERSION_ACTUAL`.",
        before: "GREETING: 'Hello {{OWNER}},'",
        after: "GREETING: 'Hello {{OWNER_NAME}},'"
      },
      EM03: {
        severity: "warning",
        title: "Missing `reset()` between emails",
        explanation: "`addRecipient()` adds to the list each time, and `reset()` clears the recipients, subject and body. Without `reset()` between emails, the next email can go to the previous person as well, with leftover content.",
        fix: "Call `mailer.reset()` before you set up each new email.",
        before: "mailer.send()\nmailer.addRecipient(next)",
        after: "mailer.send()\nmailer.reset()\nmailer.addRecipient(next)"
      },
      EM04: {
        severity: "warning",
        title: "`[setServer()]` does nothing since Jedox 24.2",
        explanation: "Since Jedox 24.2, the SMTP server and the From address are set centrally in Cloud Console. These calls are still in older examples, but now they only log a deprecation warning. If mail doesn't arrive, check Cloud Console, not the script.",
        fix: "Remove the line. Set the server and the From address in Cloud Console.",
        before: "def mailer = API.getMailer()\nmailer.setServer('smtp.example.com', 'user', 'secret')\nmailer.setSender('reports@example.com')",
        after: "def mailer = API.getMailer()"
      },
      EM05: {
        severity: "warning",
        title: "This script emails real recipients without a test mode",
        titleOff: "Test mode is off by default.",
        explanation: "Whoever runs this job as it is will email every owner for real. A safe script has a test mode that's on by default and sends everything to one test address. You switch it off on purpose, for one run.",
        fix: "Keep `true` as the default and pick the address from the test flag.",
        before: "mailer.addRecipient(r.owner_email)",
        after: "boolean testMode = !setting('TEST_MODE', 'true').equalsIgnoreCase('false')\nString to = testMode ? testTo : r.owner_email\nmailer.addRecipient(to)"
      },
      EM06: {
        severity: "error",
        title: "HTML sent as plain text",
        explanation: "`setMessage()` sends the body as plain text. If you pass it HTML, the reader sees the raw tags instead of your table.",
        fix: "Use `setHtmlMessage()` for an HTML body. `setMessage()` is fine for real plain-text emails.",
        before: "mailer.setMessage(html)",
        after: "mailer.setHtmlMessage(html)"
      },
      EM07: {
        severity: "warning",
        title: "`getSource()` is deprecated",
        explanation: "`API.getSource()` is the old way to read an extract in a Groovy job. Jedox has replaced it with `API.initSource()`.",
        fix: "Switch to `API.initSource()`, and add the null check from EM08 while you're there.",
        before: "def src = API.getSource('PnL_BudgetActual')",
        after: "def src = API.initSource('PnL_BudgetActual')"
      },
      EM08: {
        severity: "error",
        title: "No null check after `initSource()`",
        explanation: "`initSource()` returns `null` when the extract can't be set up, for example when the name is wrong. Without a check, the job fails on the next line with an error that doesn't say what went wrong.",
        fix: "Check the result straight away and stop with a clear message.",
        before: "def src = API.initSource(extractName)\nwhile (src.nextRow()) {",
        after: "def src = API.initSource(extractName)\nif (src == null) throw new IllegalStateException('Could not initialize extract ' + extractName)\nwhile (src.nextRow()) {"
      },
      EM09: {
        severity: "error",
        title: "`getMailer()` only works in a Groovy job",
        explanation: "The mailer is only available in a Groovy job. Inside an Integrator Groovy function, `API.getMailer()` returns `null`, so nothing gets sent and the next mailer call fails.",
        fix: "Move the email code into a Groovy job. If you keep a check in the script, make it fail clearly.",
        before: "def mailer = API.getMailer()\nmailer.addRecipient(to)",
        after: "def mailer = API.getMailer()\nif (mailer == null) throw new IllegalStateException('No mailer: run this as a Groovy job')\nmailer.addRecipient(to)"
      }
    }
  };
});
