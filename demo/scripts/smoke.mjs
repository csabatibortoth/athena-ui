// Checks a running demo (the deployed one, or a local one):  node demo/scripts/smoke.mjs <url> [expected version]
// It waits up to three minutes for the site to answer with the expected version (a new deployment needs a moment to start),
// then looks at the page, the library files and the security headers. Exit code 1 when something is wrong.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] ?? "").replace(/\/+$/, "");
const expected = process.argv[3] ?? JSON.parse(readFileSync(join(here, "..", "..", "package.json"), "utf8")).version;
if (!/^https?:\/\//.test(base)) {
    console.error("Usage: node demo/scripts/smoke.mjs <url> [expected version]");
    process.exit(1);
}
// in a GitHub Actions deployment: the commit that was deployed (the same version can be deployed from two commits)
const commit = (process.env.GITHUB_SHA ?? "").slice(0, 7);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); console.log(`${ok ? "ok  " : "FAIL"} ${message}`); };

// 1. wait for the new version
let version = null;
let build = null;
for (let attempt = 1; attempt <= 36; attempt++) {
    try {
        const response = await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(10000) });
        if (response.ok) {
            ({ demo: version, build = null } = await response.json());
            if (version === expected && (!commit || build === commit)) break;
        }
    } catch { /* not up yet */ }
    console.log(`waiting for ${base} to run version ${expected} (attempt ${attempt}, found ${version ?? "nothing"})`);
    await wait(5000);
}
check(version === expected, `the site runs version ${expected} (found ${version ?? "nothing"})`);
if (commit) check(build === commit, `the site runs commit ${commit} (found ${build ?? "nothing"})`);

// 2. the page, the library, the API
const page = await fetch(`${base}/`);
const html = await page.text();
check(page.status === 200 && /Athena UI demo/.test(html), "the page is served");
for (const path of ["/app.js", "/demo.css", "/athena/athena-ui.js", "/athena/res/themes/default/style.css", "/athena/res/themes/appearance.css", "/athena/table.js"]) {
    check((await fetch(`${base}${path}`)).status === 200, `${path} is served`);
}
const hosts = await (await fetch(`${base}/api/hosts?pageSize=3`)).json().catch(() => ({}));
check(hosts.total === 100000 && hosts.rows?.length === 3, "the API answers (100,000 hosts)");

// 3. the headers (https only on the real site)
const csp = page.headers.get("content-security-policy") ?? "";
check(/script-src 'self'/.test(csp) && /style-src 'self'/.test(csp) && !/unsafe-/.test(csp), "the Content-Security-Policy is strict");
check(page.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
check(Boolean(page.headers.get("referrer-policy")), "a Referrer-Policy is set");
if (base.startsWith("https://")) {
    check((await fetch(base.replace("https://", "http://"), { redirect: "manual" })).status !== 200, "plain http is not served as the page (use 'HTTPS Only' in Azure)");
    const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "demo", password: "demo-pass" }) });
    const cookie = login.headers.get("set-cookie") ?? "";
    check(/HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=Strict/i.test(cookie), "the session cookie is HttpOnly, Secure and SameSite=Strict");
}

if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
}
console.log("\nThe demo is up.");
