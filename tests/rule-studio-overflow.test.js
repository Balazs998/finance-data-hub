const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const site = path.join(root, "site");
const RULE = JSON.parse(fs.readFileSync(path.join(root, "tests/rules/inefficient.json"), "utf8"))
  .cases.find(function (item) { return item.id === "perf-02"; }).rule;

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

test("a long one-line rule stays within the viewport", { timeout: 120000 }, async function () {
  assert.ok(fs.existsSync(path.join(site, "jedox/rule-studio/index.html")), "Run mkdocs build before this test.");
  const executablePath = chromePath();
  assert.ok(executablePath, "Chrome is required to measure document scrollWidth.");
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
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width: width, height: 900, deviceScaleFactor: 1 });
      await page.goto("http://127.0.0.1:" + port + "/jedox/rule-studio/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector(".cm-content", { timeout: 15000 });
      await page.evaluate(function (rule) {
        const cube = document.getElementById("rs-cube");
        cube.value = "PnL_FX";
        cube.dispatchEvent(new Event("change"));
        const editor = document.querySelector(".cm-content");
        editor.focus();
        document.execCommand("insertText", false, rule);
      }, RULE);
      await page.waitForFunction(function () {
        const lines = document.getElementById("rs-lines");
        return lines && lines.textContent !== "0 lines";
      }, { timeout: 5000 });
      await page.click("#rs-analyze");
      await page.waitForFunction(function () {
        const labels = Array.from(document.querySelectorAll("#rs-results .rs-label")).map(function (el) { return el.textContent; });
        return labels.indexOf("Original") >= 0 && labels.indexOf("Improved") >= 0;
      }, { timeout: 15000 });
      const measured = await page.evaluate(function () {
        const doc = document.scrollingElement || document.documentElement;
        const blocks = Array.from(document.querySelectorAll("#rs-results .rs-grid2.equal .rs-code"));
        const groups = Array.from(document.querySelectorAll("#rs-results .rs-fg"));
        const openGroup = groups.filter(function (el) { return el.open; })[0];
        const closedGroup = groups.filter(function (el) { return !el.open; })[0];
        const closedChevron = getComputedStyle(closedGroup.querySelector("summary"), "::after");
        const closedTransform = closedChevron.transform;
        const chevronDisplay = closedChevron.display;
        const openTransform = getComputedStyle(openGroup.querySelector("summary"), "::after").transform;
        const tab = document.getElementById("t-test");
        if (tab.focus.length >= 0) tab.focus({ focusVisible: true });
        const ring = getComputedStyle(tab);
        const tile = Array.from(document.querySelectorAll(".rs-tile")).find(function (el) {
          return el.textContent.indexOf("Performance risk") >= 0;
        });
        const wide = Array.from(document.body.querySelectorAll("*")).filter(function (el) {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
        }).slice(0, 6).map(function (el) {
          const rect = el.getBoundingClientRect();
          return (el.id || el.className || el.tagName) + " right=" + Math.round(rect.right);
        });
        return {
          scrollWidth: doc.scrollWidth,
          innerWidth: window.innerWidth,
          wide: wide,
          blocks: blocks.map(function (el) {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              overflowX: style.overflowX,
              maxWidth: style.maxWidth,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              right: rect.right
            };
          }),
          parentMinWidth: getComputedStyle(blocks[0].parentElement).minWidth,
          openTransform: openTransform,
          closedTransform: closedTransform,
          chevronDisplay: chevronDisplay,
          outlineWidth: ring.outlineWidth,
          outlineStyle: ring.outlineStyle,
          outlineColor: ring.outlineColor,
          performance: tile ? tile.innerText.replace(/\s+/g, " ") : ""
        };
      });
      assert.ok(
        measured.scrollWidth <= measured.innerWidth,
        width + "px document scrollWidth " + measured.scrollWidth + " > viewport " + measured.innerWidth + " " + measured.wide.join("; ")
      );
      assert.equal(measured.blocks.length, 2, width + "px should show Original and Improved");
      measured.blocks.forEach(function (block) {
        assert.equal(block.overflowX, "auto", width + "px code block overflow-x");
        assert.ok(block.scrollWidth > block.clientWidth, width + "px code block should scroll the long line");
        assert.ok(block.right <= measured.innerWidth + 1, width + "px code block extends past the viewport");
      });
      assert.equal(measured.parentMinWidth, "0px");
      assert.notEqual(measured.chevronDisplay, "none");
      assert.notEqual(measured.openTransform, measured.closedTransform, "chevron should rotate when the group opens");
      assert.equal(measured.outlineWidth, "2px");
      assert.equal(measured.outlineStyle, "solid");
      assert.equal(measured.outlineColor, "rgb(56, 189, 248)");
      assert.match(measured.performance, /Low/);
    }
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const motion = await page.evaluate(function () {
      const summary = document.querySelector("#rs-results .rs-fg > summary");
      return getComputedStyle(summary, "::after").transitionDuration;
    });
    assert.equal(motion, "0s");
  } finally {
    await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});
