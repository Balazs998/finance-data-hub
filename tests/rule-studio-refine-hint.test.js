const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const site = path.join(root, "site");

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find(function (item) { return fs.existsSync(item); });
}

function puppeteer() {
  const prefix = path.join(__dirname, ".browser");
  const entry = path.join(prefix, "node_modules", "puppeteer-core");
  try {
    return require(entry);
  } catch (error) {
    execFileSync("npm", ["install", "--prefix", prefix, "puppeteer-core@24.22.3"], { stdio: "inherit" });
    return require(entry);
  }
}

function startServer() {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2"
  };
  return new Promise(function (resolve) {
    const server = http.createServer(function (request, response) {
      const url = new URL(request.url, "http://127.0.0.1");
      let file = path.join(site, decodeURIComponent(url.pathname));
      if (file.endsWith(path.sep)) file = path.join(file, "index.html");
      fs.readFile(file, function (error, data) {
        if (error) {
          response.writeHead(404);
          response.end("missing");
          return;
        }
        response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
        response.end(data);
      });
    });
    server.listen(0, "127.0.0.1", function () { resolve(server); });
  });
}

function hintCount() {
  const hint = "In this demo, only the chips change the rule. Typed requests need the live model.";
  const text = document.body.innerText;
  let count = 0;
  let from = 0;
  while (from < text.length) {
    const at = text.indexOf(hint, from);
    if (at < 0) break;
    count += 1;
    from = at + hint.length;
  }
  return count;
}

test("the refine hint stays on the page once", { timeout: 120000 }, async function () {
  assert.ok(fs.existsSync(path.join(site, "jedox/rule-studio/index.html")), "Run mkdocs build before this test.");
  const executablePath = chromePath();
  assert.ok(executablePath, "Chrome is required to count the visible hint.");
  const puppeteerCore = puppeteer();
  const server = await startServer();
  const browser = await puppeteerCore.launch({
    executablePath: executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  try {
    const port = server.address().port;
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(function () {
      window.FDH_RULE_STUDIO = { endpoint: "", turnstileSiteKey: "" };
    });
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto("http://127.0.0.1:" + port + "/jedox/rule-studio/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".cm-content", { timeout: 15000 });
    await page.evaluate(function () { document.getElementById("t-gen").click(); });

    async function visibleHints() {
      return page.evaluate(hintCount);
    }

    assert.equal(await visibleHints(), 1, "hint before refine");

    await page.evaluate(function () {
      const editor = document.querySelector(".cm-content");
      editor.focus();
      document.execCommand("insertText", false, "['Account':'Revenue'] = B: ['Account':'Sales']");
      document.getElementById("rs-instruction").value = "also limit the period";
      document.getElementById("rs-refine").click();
    });
    await page.waitForFunction(function () {
      return document.getElementById("rs-live").textContent.indexOf("Refine draft ready.") >= 0;
    }, { timeout: 5000 });
    assert.equal(await visibleHints(), 1, "hint after one refine");

    await page.evaluate(function () { document.getElementById("rs-refine").click(); });
    await page.waitForFunction(function () {
      const diff = document.getElementById("rs-refine-diff");
      return diff && !diff.hidden && diff.textContent.indexOf("Mock edit from the selected chips.") >= 0;
    }, { timeout: 5000 });
    assert.equal(await visibleHints(), 1, "hint after a second refine");

    await page.evaluate(function () {
      document.getElementById("rs-story").value = "Calculate Variance as Actual minus Budget on base cells.";
      document.getElementById("rs-target").value = "PnL";
      document.getElementById("rs-generate").click();
    });
    await page.waitForFunction(function () {
      const draft = document.getElementById("rs-draft");
      return draft && !draft.hidden && draft.textContent.indexOf("Variance") >= 0;
    }, { timeout: 5000 });
    await page.evaluate(function () { document.getElementById("rs-refine").click(); });
    await page.waitForFunction(function () {
      return document.getElementById("rs-live").textContent.indexOf("Refine draft ready.") >= 0;
    }, { timeout: 5000 });
    assert.equal(await visibleHints(), 1, "hint after generate and refine");

    await page.evaluate(function () { document.getElementById("rs-refine").click(); });
    await page.waitForFunction(function () {
      const draft = document.getElementById("rs-draft");
      return draft && draft.textContent.indexOf("Mock edit from the selected chips.") >= 0;
    }, { timeout: 5000 });
    assert.equal(await visibleHints(), 1, "hint after a further refine of the draft");
  } finally {
    await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});
