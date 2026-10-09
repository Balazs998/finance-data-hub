/* Rebuild docs/javascripts/codemirror-bundle.js and stamp the MIT notices
   from the packages that esbuild actually includes. */
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const here = __dirname;
const root = path.resolve(here, "../..");
const outfile = path.join(root, "docs/javascripts/codemirror-bundle.js");
const licenseFile = path.join(root, "docs/javascripts/LICENSE-codemirror.txt");

function packageName(input) {
  const normalized = input.split(path.sep).join("/");
  const match = normalized.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  return match ? match[1] : "";
}

function readLicense(dir) {
  const file = ["LICENSE", "LICENSE.md", "LICENCE"].map(function (name) {
    return path.join(dir, name);
  }).find(function (candidate) {
    return fs.existsSync(candidate);
  });
  if (!file) throw new Error("No LICENSE file in " + dir);
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function copyrightLine(text, name) {
  const line = text.split("\n").find(function (row) {
    return row.startsWith("Copyright");
  });
  if (!line) throw new Error("No copyright line in " + name);
  return line.trim();
}

function mitBody(text, name) {
  const start = text.indexOf("Permission is hereby granted");
  if (start < 0) throw new Error(name + " is not the MIT licence text");
  return text.slice(start).trim();
}

async function main() {
  const result = await esbuild.build({
    absWorkingDir: here,
    entryPoints: ["entry.js"],
    bundle: true,
    minify: true,
    format: "iife",
    legalComments: "none",
    outfile: outfile,
    metafile: true,
  });

  const names = [];
  Object.keys(result.metafile.inputs).forEach(function (input) {
    const name = packageName(input);
    if (name && names.indexOf(name) < 0) names.push(name);
  });
  names.sort();
  if (!names.length) throw new Error("The bundle includes no packages");

  const bodies = [];
  const blocks = names.map(function (name) {
    const dir = path.join(here, "node_modules", name);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    const text = readLicense(dir);
    const body = mitBody(text, name);
    if (bodies.indexOf(body) < 0) bodies.push(body);
    return name + " " + pkg.version + "\n" + copyrightLine(text, name);
  });
  if (bodies.length !== 1) {
    throw new Error("Bundled packages do not share one MIT text");
  }

  const notice = [
    "CodeMirror 6 and the dependencies bundled in codemirror-bundle.js.",
    "Each package is under the MIT License. Copyright lines are copied from that package's LICENSE file.",
    "",
    blocks.join("\n\n"),
    "",
    "MIT License",
    "",
    bodies[0],
    ""
  ].join("\n");

  fs.writeFileSync(licenseFile, notice);
  const code = fs.readFileSync(outfile, "utf8");
  fs.writeFileSync(outfile, "/*!\n" + notice + "*/\n" + code);
  process.stdout.write("Bundled " + names.length + " packages into " + outfile + "\n");
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
