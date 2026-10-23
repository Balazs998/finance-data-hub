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

test("the email builder preview drawer stays inside the phone viewport", { timeout: 120000 }, async function () {
  assert.ok(fs.existsSync(path.join(site, "jedox/email-builder/index.html")), "Run mkdocs build before this test.");
  const executablePath = chromePath();
  assert.ok(executablePath, "Chrome is required to measure the preview drawer.");
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
    for (const width of [320, 384, 390]) {
      await page.setViewport({ width: width, height: 900, deviceScaleFactor: 1 });
      await page.goto("http://127.0.0.1:" + port + "/jedox/email-builder/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("#email-script-view .email-line", { timeout: 15000 });
      await page.evaluate(function () { document.getElementById("email-builder-sticky").click(); });
      await page.waitForSelector("#email-builder.is-panel-open #email-panel", { visible: true, timeout: 5000 });
      await page.evaluate(function () { document.getElementById("tab-script").click(); });
      await page.waitForSelector("#panel-script:not([hidden]) .email-caption", { timeout: 5000 });
      const measured = await page.evaluate(function () {
        const doc = document.scrollingElement || document.documentElement;
        const panel = document.getElementById("email-panel");
        const panelStyle = getComputedStyle(panel);
        const code = document.getElementById("email-script-view");
        const codeStyle = getComputedStyle(code);
        const actions = panel.querySelector(".email-actions");
        const actionStyle = getComputedStyle(actions);
        function box(el) {
          const rect = el.getBoundingClientRect();
          return { right: rect.right, left: rect.left, width: rect.width };
        }
        return {
          scrollWidth: doc.scrollWidth,
          innerWidth: window.innerWidth,
          maxWidth: panelStyle.maxWidth,
          boxSizing: panelStyle.boxSizing,
          codeOverflowX: codeStyle.overflowX,
          codeScrollWidth: code.scrollWidth,
          codeClientWidth: code.clientWidth,
          flexWrap: actionStyle.flexWrap,
          panel: box(panel),
          tabs: box(panel.querySelector(".email-ptabs")),
          intro: box(document.querySelector("#panel-script .email-caption")),
          code: box(code),
          copy: box(document.getElementById("email-copy"))
        };
      });
      assert.ok(
        measured.scrollWidth <= measured.innerWidth,
        width + "px preview drawer overflows the page " + measured.scrollWidth + " > " + measured.innerWidth
      );
      assert.equal(measured.boxSizing, "border-box", width + "px drawer box-sizing");
      assert.equal(measured.maxWidth, width + "px", width + "px drawer max-width");
      assert.equal(measured.codeOverflowX, "auto", width + "px code panel overflow-x");
      assert.ok(
        measured.codeScrollWidth > measured.codeClientWidth,
        width + "px code panel should scroll the long script line"
      );
      assert.equal(measured.flexWrap, "wrap", width + "px button row flex-wrap");
      ["panel", "tabs", "intro", "code", "copy"].forEach(function (name) {
        const item = measured[name];
        assert.ok(item.left >= -1, width + "px " + name + " starts at " + item.left);
        assert.ok(
          item.right <= measured.innerWidth + 1,
          width + "px " + name + " runs off the right edge at " + Math.round(item.right)
        );
      });
    }
  } finally {
    await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});
