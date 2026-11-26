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
const sanitizerRunId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const sanitizerProbePrefix = "/__sanitizer_resource_probe/";
const sanitizerResourcePolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-src 'self'; media-src 'self'; object-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'";

if (!chromePath) {
    console.error("No Chrome / Chromium / Edge found. Set CHROME_PATH to the browser executable.");
    process.exit(2);
}

const server = createServer((request, response) => {
    const pathname = decodeURIComponent(request.url.split("?")[0]);
    const legacyProbe = pathname === "/__sanitizer_resource_probe";
    if (pathname.startsWith(sanitizerProbePrefix) || legacyProbe) {
        const key = legacyProbe ? `${pathname}${request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : ""}` : pathname;
        const counts = sanitizerResourceRequests.get(key) ?? {};
        counts[request.method] = (counts[request.method] ?? 0) + 1;
        sanitizerResourceRequests.set(key, counts);
        response.setHeader("Cache-Control", "no-store");
        if (legacyProbe || pathname.includes("control-image")) {
            response.setHeader("Content-Type", "image/gif");
            response.end(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
        } else if (pathname.includes("control-frame") || /(?:iframe-src|link-preload)/.test(pathname)) {
            response.setHeader("Content-Type", "text/html");
            response.end("<!doctype html><title>probe control</title><p>same-origin frame control</p>");
        } else if (pathname.includes("control-stylesheet") || pathname.includes("link-stylesheet")) {
            response.setHeader("Content-Type", "text/css");
            response.end("body { color: inherit; }");
        } else {
            response.setHeader("Content-Type", "application/octet-stream");
            response.end(Buffer.from([0]));
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
            ? sanitizerResourcePolicy
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
const browser = await launch();
try {
    const page = await browser.newPage({ front: true });
    try {
        const origin = `http://127.0.0.1:${port}`;
        const controls = ["image", "frame", "stylesheet"].map(kind => `${sanitizerProbePrefix}${sanitizerRunId}-control-${kind}`);
        await page.send("Page.navigate", { url: `${origin}/tests/browser/sanitizer-resource-control.html?run=${sanitizerRunId}` });
        await until(async () => (await page.eval(`document.title`).catch(() => "")) === "sanitizer-control-finished", { timeout: 10000, interval: 100, message: "the sanitizer request-counter control to finish" });
        await page.waitForNetworkIdle();
        const positiveControlCounts = controls.map(path => sanitizerResourceRequests.get(path)?.GET ?? 0);
        const positiveControlEvents = controls.map(path => page.networkRequests.filter(item => new URL(item.url).pathname === path).length);
        if (positiveControlCounts.some(count => count !== 1) || positiveControlEvents.some(count => count !== 1)) {
            throw new Error(`sanitizer positive control was inconclusive: server counts [${positiveControlCounts.join(", ")}], browser events [${positiveControlEvents.join(", ")}]`);
        }

        await page.send("Page.navigate", { url: `${origin}/tests/browser/sanitizer-resource-probe.html?run=${sanitizerRunId}` });
        await until(async () => (await page.eval(`typeof window.runSanitizerProbe === "function"`).catch(() => false)), { timeout: 10000, interval: 100, message: "the sanitizer resource probe fixture to load" });
        const caseNames = await page.eval(`window.sanitizerProbeCases.map(([name]) => name)`);
        const probeFailures = [];
        for (let index = 0; index < caseNames.length; index++) {
            const mode = "single";
            const result = await page.eval(`window.runSanitizerProbe(${index}, ${JSON.stringify(mode)})`);
            await page.waitForNetworkIdle();
            for (const path of result.paths) {
                const serverCount = Object.values(sanitizerResourceRequests.get(path) ?? {}).reduce((sum, count) => sum + count, 0);
                const browserCount = page.networkRequests.filter(item => new URL(item.url).pathname === path).length;
                if (serverCount !== 0 || browserCount !== 0) probeFailures.push(`${result.name} (${mode}): observed ${serverCount} server request(s), ${browserCount} Chromium request event(s) at ${path}`);
            }
            probeFailures.push(...result.failures);
        }
        const combined = await page.eval(`window.runSanitizerProbe(0, "combined")`);
        await page.waitForNetworkIdle();
        for (const path of combined.paths) {
            const serverCount = Object.values(sanitizerResourceRequests.get(path) ?? {}).reduce((sum, count) => sum + count, 0);
            const browserCount = page.networkRequests.filter(item => new URL(item.url).pathname === path).length;
            if (serverCount !== 0 || browserCount !== 0) probeFailures.push(`combined: observed ${serverCount} server request(s), ${browserCount} Chromium request event(s) at ${path}`);
        }
        probeFailures.push(...combined.failures);
        const probeResult = probeFailures.length
            ? `FAIL sanitizer: ${probeFailures.join(" | ")}`
            : `PASS sanitizer: positive control counted image, frame, and stylesheet requests; ${caseNames.length} independent cases and the combined payload produced no requests and passed output/DOM assertions`;

        // Run the complete suite after the dedicated fixture checks as an additional bounded settling period.
        await page.send("Page.navigate", { url });
        await until(async () => (await page.eval(`document.title`).catch(() => "")) === "finished", { timeout, interval: 500, message: "the tests to finish" });
        text = await page.eval(`document.getElementById("results")?.textContent ?? ""`);
        const legacyProbeKey = "/__sanitizer_resource_probe?from=strict-suite";
        const legacyRequestCount = Object.values(sanitizerResourceRequests.get(legacyProbeKey) ?? {}).reduce((sum, count) => sum + count, 0);
        const legacyBrowserCount = page.networkRequests.filter(item => new URL(item.url).pathname === "/__sanitizer_resource_probe").length;
        if (legacyRequestCount !== 0 || legacyBrowserCount !== 0) {
            text += `\nFAIL sanitizer: strict-suite probe observed ${legacyRequestCount} server request(s), ${legacyBrowserCount} Chromium request event(s)`;
        }
        text += `\n${probeResult}`;
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
