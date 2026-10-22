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

test("download button labels keep Download separate from the filename", { timeout: 120000 }, async function () {
  assert.ok(fs.existsSync(path.join(site, "downloads/index.html")), "Run mkdocs build before this test.");
  const executablePath = chromePath();
  assert.ok(executablePath, "Chrome is required to measure download button labels.");
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
    for (const width of [1440, 320]) {
      await page.setViewport({ width: width, height: 900, deviceScaleFactor: 1 });
      await page.goto("http://127.0.0.1:" + port + "/downloads/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector('a.md-button.download[download="dim_account.csv"]', { timeout: 15000 });
      const measured = await page.evaluate(function () {
        function breaksOnlyAtSeparators(name) {
          const raw = name.textContent;
          const lines = name.innerText.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
          if (lines.join("") !== raw) {
            return "lines " + JSON.stringify(lines) + " do not rebuild " + raw;
          }
          let pos = 0;
          for (let i = 0; i < lines.length - 1; i += 1) {
            pos += lines[i].length;
            const prev = raw.charAt(pos - 1);
            const next = raw.charAt(pos);
            if (prev !== "_" && prev !== "." && next !== "_" && next !== ".") {
              return lines.join(" / ");
            }
          }
          return "";
        }
        const doc = document.scrollingElement || document.documentElement;
        const buttons = Array.from(document.querySelectorAll("a.md-button.download"));
        const target = document.querySelector('a.md-button.download[download="dim_account.csv"]');
        const verb = target.querySelector(".download-verb");
        const name = target.querySelector(".download-name");
        const verbStyle = getComputedStyle(verb);
        const nameStyle = getComputedStyle(name);
        const verbRect = verb.getBoundingClientRect();
        const nameRect = name.getBoundingClientRect();
        const problems = [];
        buttons.forEach(function (button) {
          const file = button.getAttribute("download");
          const buttonName = button.querySelector(".download-name");
          const buttonVerb = button.querySelector(".download-verb");
          const right = button.getBoundingClientRect().right;
          if (right > window.innerWidth + 1) problems.push(file + " runs off at " + Math.round(right));
          if (buttonVerb && getComputedStyle(buttonVerb).display !== "none" && buttonVerb.getClientRects().length > 1) {
            problems.push(file + " splits Download: " + JSON.stringify(buttonVerb.innerText));
          }
          if (buttonName) {
            const broken = breaksOnlyAtSeparators(buttonName);
            if (broken) problems.push(file + " wraps mid-word: " + broken);
          }
        });
        return {
          scrollWidth: doc.scrollWidth,
          innerWidth: window.innerWidth,
          verbText: verb.textContent,
          nameText: name.textContent,
          whiteSpace: verbStyle.whiteSpace,
          overflowWrap: nameStyle.overflowWrap,
          verbDisplay: verbStyle.display,
          marginRight: parseFloat(verbStyle.marginRight),
          gap: nameRect.left - verbRect.right,
          verbLines: verb.getClientRects().length,
          nameWidth: nameRect.width,
          problems: problems
        };
      });
      assert.equal(measured.whiteSpace, "nowrap", width + "px Download word should not wrap");
      assert.equal(measured.overflowWrap, "anywhere", width + "px filename overflow-wrap");
      assert.equal(measured.verbText, "Download ", width + "px verb text");
      assert.equal(measured.nameText, "dim_account.csv", width + "px filename");
      assert.ok(
        measured.scrollWidth <= measured.innerWidth,
        width + "px page overflows " + measured.scrollWidth + " > " + measured.innerWidth
      );
      assert.deepEqual(measured.problems, [], width + "px " + measured.problems.join("; "));
      if (width === 1440) {
        assert.notEqual(measured.verbDisplay, "none", "Download stays visible on desktop");
        assert.equal(measured.verbLines, 1, "Download is one line at 1440");
        assert.ok(measured.marginRight > 0, "Download keeps a gap before the filename");
        assert.ok(measured.gap >= 3, "1440px label runs together, gap " + measured.gap);
      } else {
        assert.equal(measured.verbDisplay, "none", "Download is hidden at 320");
        assert.ok(measured.nameWidth > 20, "filename stays visible at 320");
      }
    }
  } finally {
    await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});
