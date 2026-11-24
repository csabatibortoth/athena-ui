// Runs the browser tests in headless Chrome / Chromium / Edge.
//
//   npm run test:browser
//
// A small static server serves the repository, Chrome loads tests/browser/index.html, runs every test, and the results are read from the page through
// the DevTools protocol (tests/cdp.mjs). The page runs in real time: animations, transitions and view transitions need frames, which a virtual clock does
// not give. Exit code 1 when a test fails, 2 when there is no browser or the page did not report.
//
// Environment:
//   CHROME_PATH   browser executable (default: found in the usual install locations)
//   WITH_JQUERY   1: load jQuery from the jQuery CDN (needs internet access) to check Athena UI together with it. Default: no jQuery.
//   JQUERY_URL    load jQuery from this address instead
//   TEST_TIMEOUT  how long the page may take to report, in ms (default 240000)
//   DEBUG         1: print what the page logged when it did not report

import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromePath, launch, until } from "../cdp.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };
const sanitizerResourceRequests = new Map();

if (!chromePath) {
    console.error("No Chrome / Chromium / Edge found. Set CHROME_PATH to the browser executable.");
    process.exit(2);
}

const server = createServer((request, response) => {
    const pathname = decodeURIComponent(request.url.split("?")[0]);
    if (pathname === "/__sanitizer_resource_probe") {
        const kind = new URL(request.url, "http://localhost").searchParams.get("kind") ?? "unspecified";
        sanitizerResourceRequests.set(kind, (sanitizerResourceRequests.get(kind) ?? 0) + 1);
        response.setHeader("Cache-Control", "no-store");
        if (kind === "control") {
            response.setHeader("Content-Type", "image/gif");
            response.end(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
        } else {
            response.statusCode = 204;
            response.end();
        }
        return;
    }
    const file = normalize(join(root, pathname));
    if (!file.startsWith(root) || !existsSync(file)) {
        response.statusCode = 404;
        response.end();
        return;
    }
    response.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    // The page runs under a strict policy: no inline script, no inline style attribute, nothing from other origins (jQuery's CDN only
    // when asked for). Athena UI promises to work under it, and the suite fails when the browser reports a violation.
    if (extname(file) === ".html") {
        const policy = pathname.startsWith("/tests/browser/sanitizer-resource-")
            ? "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-src 'self'; media-src 'self'; object-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'"
            : "default-src 'none'; script-src 'self' https://code.jquery.com; style-src 'self'; img-src 'self' data:; frame-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'";
        response.setHeader("Content-Security-Policy", policy);
    }
    response.end(readFileSync(file));
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/tests/browser/index.html${process.env.JQUERY_URL ? `?jquery=${encodeURIComponent(process.env.JQUERY_URL)}` : process.env.WITH_JQUERY ? "?jquery=cdn" : ""}`;
const timeout = Number(process.env.TEST_TIMEOUT ?? 240000);

let text = null;
let logged = [];
let stuck = "";
let sanitizerPositiveControlCount = null;
const browser = await launch();
try {
    const page = await browser.newPage({ front: true });
    try {
        await page.send("Page.navigate", { url: `http://127.0.0.1:${port}/tests/browser/sanitizer-resource-control.html` });
        await until(async () => (await page.eval(`document.title`).catch(() => "")) === "sanitizer-control-finished", { timeout: 10000, interval: 100, message: "the sanitizer request-counter control to finish" });
        sanitizerPositiveControlCount = sanitizerResourceRequests.get("control") ?? 0;
        sanitizerResourceRequests.clear();

        await page.send("Page.navigate", { url: `http://127.0.0.1:${port}/tests/browser/sanitizer-resource-probe.html` });
        await until(async () => (await page.eval(`document.title`).catch(() => "")) === "sanitizer-probe-finished", { timeout: 10000, interval: 100, message: "the sanitizer resource probe to finish" });
        const probeResult = await page.eval(`document.getElementById("results")?.textContent ?? ""`);

        // Run the complete strict-CSP suite after parsing so queued resource requests have time to reach the local counter.
        await page.send("Page.navigate", { url });
        await until(async () => (await page.eval(`document.title`).catch(() => "")) === "finished", { timeout, interval: 500, message: "the tests to finish" });
        text = await page.eval(`document.getElementById("results")?.textContent ?? ""`);
        if (probeResult.startsWith("FAIL")) text += `\n${probeResult}`;
        if (sanitizerPositiveControlCount !== 1) {
            text += `\nFAIL sanitizer: request-counter positive control observed ${sanitizerPositiveControlCount} requests; expected 1`;
        }
        const fetchedKinds = [...sanitizerResourceRequests.entries()]
            .filter(([, count]) => count > 0)
            .map(([kind, count]) => `${kind} (${count})`);
        if (fetchedKinds.length > 0) {
            text += `\nFAIL sanitizer: parsing attacker markup fetched resources: ${fetchedKinds.join(", ")}`;
        }
    } catch {
        logged = page.problems;
        stuck = await Promise.race([page.eval("document.title").catch(() => ""), new Promise(resolve => setTimeout(() => resolve("(the page does not answer: it is busy)"), 5000))]);
    }
    await page.close();
} finally {
    await browser.close();
    server.close();
}

if (!text) {
    console.error("The test page did not report results.", `(chrome: ${chromePath})`);
    if (stuck) console.error(`It was at: ${stuck}`);
    if (process.env.DEBUG) console.error(logged.join("\n"));
    process.exit(2);
}
const lines = text.split("\n").filter(Boolean);
const failed = lines.filter(line => line.startsWith("FAIL"));
for (const line of lines) console.log(line);
console.log(`\n${lines.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
