// Runs the browser tests in headless Chrome / Chromium / Edge.
//
//   npm run test:browser
//
// A small static server serves the repository, Chrome loads tests/browser/index.html, runs every test
// and the results are read from the dumped page. Exit code 1 when a test fails.
//
// Environment:
//   CHROME_PATH   browser executable (default: found in the usual install locations)
//   WITH_JQUERY   1: load jQuery from the jQuery CDN (needs internet access) to check Athena UI together with it. Default: no jQuery.
//   JQUERY_URL    load jQuery from this address instead
//   TEST_TIMEOUT  virtual time budget of the page in ms (default 120000; it passes much faster in real time)

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };

const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"
].filter(Boolean);
const chrome = candidates.find(existsSync);
if (!chrome) {
    console.error("No Chrome / Chromium / Edge found. Set CHROME_PATH to the browser executable.");
    process.exit(2);
}

const server = createServer((request, response) => {
    const file = normalize(join(root, decodeURIComponent(request.url.split("?")[0])));
    if (!file.startsWith(root) || !existsSync(file)) {
        response.statusCode = 404;
        response.end();
        return;
    }
    response.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    // The page runs under a strict policy: no inline script, no inline style attribute, nothing from other origins (jQuery's CDN only
    // when asked for). Athena UI promises to work under it, and the suite fails when the browser reports a violation.
    if (extname(file) === ".html") {
        response.setHeader("Content-Security-Policy",
            "default-src 'none'; script-src 'self' https://code.jquery.com; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'");
    }
    response.end(readFileSync(file));
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const { port } = server.address();

const profile = mkdtempSync(join(tmpdir(), "athena-ui-chrome-"));
const timeout = Number(process.env.TEST_TIMEOUT ?? 120000);
const url = `http://127.0.0.1:${port}/tests/browser/index.html${process.env.JQUERY_URL ? `?jquery=${encodeURIComponent(process.env.JQUERY_URL)}` : process.env.WITH_JQUERY ? "?jquery=cdn" : ""}`;
// Asynchronous on purpose: a blocking spawn would also block the server that Chrome loads the page from.
const run = await new Promise(done => {
    const child = spawn(chrome, [
        "--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${profile}`,
        "--window-size=1200,900", `--virtual-time-budget=${timeout}`, "--enable-logging=stderr", "--v=0", "--dump-dom", url
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), timeout + 30000);
    child.on("close", () => {
        clearTimeout(timer);
        done({ stdout, stderr });
    });
});

server.close();
rmSync(profile, { recursive: true, force: true });

const match = /<pre id="results">([\s\S]*?)<\/pre>/.exec(run.stdout ?? "");
if (!match) {
    console.error("The test page did not report results.", `(chrome: ${chrome}, stdout ${run.stdout.length} bytes)`);
    if (process.env.DEBUG) console.error(run.stderr);
    console.error((run.stderr ?? "").split("\n").filter(line => /CONSOLE|ERROR/i.test(line)).slice(0, 10).join("\n"));
    process.exit(2);
}
const decode = text => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const lines = decode(match[1]).split("\n").filter(Boolean);
const failed = lines.filter(line => line.startsWith("FAIL"));
for (const line of lines) console.log(line);
console.log(`\n${lines.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
