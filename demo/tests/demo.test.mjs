// The server and the API of the demo, started on a free port. Node's test runner, no other dependency.

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { createDemoServer, resolveFile, SECURITY_HEADERS } from "../server.mjs";
import { HOST_COUNT, listHosts, metricAt, metricsSince, resetForTests } from "../api.mjs";
import { join, resolve } from "node:path";

let server;
let base;
before(async () => {
    server = createDemoServer({ log: () => {} });
    await new Promise(done => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => resetForTests());

const get = (path, options = {}) => fetch(base + path, options);
const post = (path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const login = async (username = "demo", password = "demo-pass") => {
    const response = await post("/api/login", { username, password });
    return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] };
};

describe("static files and headers", () => {
    test("the page and the library are served with the strict security headers", async () => {
        for (const path of ["/", "/app.js", "/athena/athena-ui.js", "/athena/res/themes/default/style.css", "/athena/res/themes/appearance.css", "/athena/theme-boot.js"]) {
            const response = await get(path);
            assert.equal(response.status, 200, path);
            for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(response.headers.get(name), value, `${path} ${name}`);
        }
        const csp = SECURITY_HEADERS["Content-Security-Policy"];
        assert.match(csp, /script-src 'self'/);
        assert.match(csp, /style-src 'self'/);
        assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    });

    test("types, compression, caching and conditional requests", async () => {
        const js = await get("/athena/athena-ui.js", { headers: { "Accept-Encoding": "gzip" } });
        assert.match(js.headers.get("content-type"), /text\/javascript/);
        assert.equal(js.headers.get("content-encoding"), "gzip");
        const etag = js.headers.get("etag");
        assert.ok(etag);
        assert.equal((await get("/athena/athena-ui.js", { headers: { "If-None-Match": etag } })).status, 304);
        assert.match((await get("/demo.css")).headers.get("content-type"), /text\/css/);
        assert.equal((await get("/")).headers.get("cache-control"), "no-cache");
        assert.equal((await get("/", { method: "HEAD" })).status, 200);
    });

    test("an unknown page is the app (the router uses the hash), an unknown file is a 404, other methods are refused", async () => {
        const page = await get("/some/page");
        assert.equal(page.status, 200);
        assert.match(await page.text(), /Athena UI demo/);
        assert.equal((await get("/missing.js")).status, 404);
        assert.equal((await get("/athena/nothing.js")).status, 404);
        assert.equal((await fetch(base + "/", { method: "DELETE" })).status, 405);
        assert.equal((await fetch(base + "/", { method: "PUT" })).status, 405);
    });

    test("no way out of the folders, no hidden files", async () => {
        const root = resolve("/srv/public");
        assert.equal(resolveFile(root, "/../secret.txt"), null);
        assert.equal(resolveFile(root, "/..%2fsecret.txt"), null);
        assert.equal(resolveFile(root, "/%2e%2e/secret.txt"), null);
        assert.equal(resolveFile(root, "/a/../../secret"), null);
        assert.equal(resolveFile(root, "/.env"), null);
        assert.equal(resolveFile(root, "/.git/config"), null);
        assert.equal(resolveFile(root, "/bad%00.js"), null);
        assert.equal(resolveFile(root, "/%E0%A4%A"), null);
        assert.equal(resolveFile(root, "/ok/file.js"), join(root, "ok", "file.js"));
        for (const path of ["/../package.json", "/%2e%2e/package.json", "/athena/../server.mjs", "/athena/%2e%2e/%2e%2e/package.json", "/.env"]) {
            const response = await get(path);
            const text = await response.text();
            assert.ok(!/"name": "athena-ui-js"/.test(text) && !/createDemoServer/.test(text), `${path} leaked a file`);
        }
    });
});

describe("hosts", () => {
    test("a page, the total, sorting and a filter", async () => {
        const first = await (await get("/api/hosts?page=0&pageSize=5")).json();
        assert.equal(first.total, HOST_COUNT);
        assert.deepEqual(first.rows.map(row => row.id), [1, 2, 3, 4, 5]);
        assert.ok(!("search" in first.rows[0]), "the search key stays on the server");
        const again = await (await get("/api/hosts?page=0&pageSize=5")).json();
        assert.deepEqual(first, again, "always the same hosts");
        const busiest = await (await get("/api/hosts?pageSize=3&sort=cpu&dir=desc")).json();
        assert.ok(busiest.rows[0].cpu >= busiest.rows[1].cpu && busiest.rows[1].cpu >= busiest.rows[2].cpu);
        const filtered = await (await get("/api/hosts?pageSize=200&filter=freebsd")).json();
        assert.ok(filtered.total > 0 && filtered.total < HOST_COUNT);
        assert.ok(filtered.rows.every(row => row.os === "FreeBSD"));
        assert.equal((await (await get("/api/hosts?filter=" + "x".repeat(500))).json()).total, 0);
    });

    test("a cursor gives the next slice, and null at the end", () => {
        const one = listHosts(new URLSearchParams("cursor=0&pageSize=10"));
        assert.equal(one.rows.length, 10);
        assert.equal(one.nextCursor, 10);
        const last = listHosts(new URLSearchParams(`cursor=${HOST_COUNT - 5}&pageSize=10`));
        assert.equal(last.rows.length, 5);
        assert.equal(last.nextCursor, null);
    });

    test("bad numbers are clamped, an unknown sort key is ignored", () => {
        assert.equal(listHosts(new URLSearchParams("pageSize=99999")).rows.length, 200);
        assert.equal(listHosts(new URLSearchParams("pageSize=-5")).rows.length, 1);
        assert.equal(listHosts(new URLSearchParams("page=abc&pageSize=x")).rows[0].id, 1);
        assert.equal(listHosts(new URLSearchParams("sort=__proto__")).rows[0].id, 1);
        assert.equal(listHosts(new URLSearchParams("page=999999999&pageSize=10")).rows.length, 0);
    });
});

describe("metrics", () => {
    test("the signal depends only on the time, and a request is capped", () => {
        assert.deepEqual(metricAt(1700000000000), metricAt(1700000000000));
        const now = 1700000400000;
        const { points } = metricsSince(0, now);
        assert.ok(points.length <= 300 + 1 && points.length > 100, `${points.length} points`);
        assert.ok(points.every(point => point.cpu >= 1 && point.cpu <= 99));
        assert.equal(metricsSince(now, now).points.length, 0);
    });

    test("over HTTP", async () => {
        const body = await (await get(`/api/metrics?since=${Date.now() - 5000}`)).json();
        assert.ok(body.points.length >= 3 && body.points.length <= 6);
        assert.equal((await get("/api/metrics?since=junk")).status, 200);
    });
});

describe("sign in", () => {
    test("a good login sets an HttpOnly, SameSite=Strict cookie, and /api/me knows who it is", async () => {
        const { response, cookie } = await login();
        assert.equal(response.status, 200);
        const header = response.headers.get("set-cookie");
        assert.match(header, /HttpOnly/);
        assert.match(header, /SameSite=Strict/);
        assert.match(header, /Path=\//);
        assert.doesNotMatch(header, /Secure/, "plain http in the test");
        assert.deepEqual(await response.json(), { username: "demo", name: "Demo User", roles: ["viewer"] });
        const me = await get("/api/me", { headers: { Cookie: cookie } });
        assert.equal(me.status, 200);
        assert.equal((await me.json()).username, "demo");
        assert.equal(await (await get("/api/me")).json(), null, "nobody is signed in: 200 and null");
        assert.equal(await (await get("/api/me", { headers: { Cookie: "athena_demo=forged" } })).json(), null);
    });

    test("a wrong password or user is refused the same way, and names the field", async () => {
        const wrongPassword = await login("demo", "nope");
        const wrongUser = await login("nobody", "demo-pass");
        assert.equal(wrongPassword.response.status, 401);
        assert.equal(wrongUser.response.status, 401);
        assert.deepEqual(await wrongPassword.response.json(), await wrongUser.response.json());
        assert.equal(wrongPassword.cookie, undefined);
        assert.equal((await post("/api/login", { username: 1, password: {} })).status, 401);
        assert.equal((await post("/api/login", {})).status, 401);
    });

    test("too many attempts are slowed down", async () => {
        let status;
        for (let i = 0; i < 12; i++) status = (await login("demo", "wrong")).response.status;
        assert.equal(status, 429);
    });

    test("logout ends the session on the server", async () => {
        const { cookie } = await login();
        const out = await post("/api/logout", {}, { Cookie: cookie });
        assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
        assert.equal(await (await get("/api/me", { headers: { Cookie: cookie } })).json(), null, "the old cookie is dead");
    });

    test("a post from another origin, with another content type, too large or not JSON is refused", async () => {
        assert.equal((await post("/api/login", { username: "demo", password: "demo-pass" }, { Origin: "https://evil.example" })).status, 403);
        assert.equal((await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" })).status, 415);
        assert.equal((await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nope" })).status, 400);
        assert.equal((await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "x".repeat(20000) }) })).status, 413);
        const sameOrigin = await post("/api/login", { username: "demo", password: "demo-pass" }, { Origin: base });
        assert.equal(sameOrigin.status, 200);
    });
});

describe("behind the proxy of Azure App Service", () => {
    test("the session cookie is Secure when the proxy says the request was https, and the X-Forwarded-For address is the one that is rate limited", async () => {
        process.env.TRUST_PROXY = "1";
        const proxied = createDemoServer({ log: () => {} });
        delete process.env.TRUST_PROXY;
        await new Promise(done => proxied.listen(0, "127.0.0.1", done));
        const url = `http://127.0.0.1:${proxied.address().port}`;
        try {
            // the browser sends the https address as its Origin, while the proxy sends the request on to this server as http with the same Host
            const host = new URL(url).host;
            const wrongOrigin = await fetch(url + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", Origin: `http://${host}` }, body: JSON.stringify({ username: "demo", password: "demo-pass" }) });
            assert.equal(wrongOrigin.status, 403, "the Origin has to match the address the browser used (https)");
            const ok = await fetch(url + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", Origin: `https://${host}` }, body: JSON.stringify({ username: "demo", password: "demo-pass" }) });
            assert.equal(ok.status, 200);
            assert.match(ok.headers.get("set-cookie"), /; Secure/);
            // the limit counts per client address, not per proxy: other clients are not locked out by one
            for (let i = 0; i < 12; i++) await fetch(url + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" }, body: JSON.stringify({ username: "demo", password: "wrong" }) });
            const blocked = await fetch(url + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" }, body: JSON.stringify({ username: "demo", password: "demo-pass" }) });
            assert.equal(blocked.status, 429);
            const other = await fetch(url + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.7:51234" }, body: JSON.stringify({ username: "demo", password: "demo-pass" }) });
            assert.equal(other.status, 200, "another address is not blocked");
        } finally {
            proxied.close();
        }
    });

    test("without the proxy settings the headers of a client are not believed", async () => {
        const response = await post("/api/login", { username: "demo", password: "demo-pass" }, { "X-Forwarded-Proto": "https", "X-Forwarded-For": "1.2.3.4" });
        assert.doesNotMatch(response.headers.get("set-cookie"), /; Secure/);
    });
});

describe("what needs a role", () => {
    test("adding a host needs a session, and the server checks the name", async () => {
        assert.equal((await post("/api/hosts", { name: "host-new" })).status, 401);
        const { cookie } = await login();
        const bad = await post("/api/hosts", { name: "Bad Name!" }, { Cookie: cookie });
        assert.equal(bad.status, 422);
        assert.ok((await bad.json()).fields.name);
        const taken = await post("/api/hosts", { name: "host-00001" }, { Cookie: cookie });
        assert.equal(taken.status, 409);
        const ok = await post("/api/hosts", { name: "host-new-1" }, { Cookie: cookie });
        assert.equal(ok.status, 201);
        assert.equal((await post("/api/hosts", { name: "host-new-1" }, { Cookie: cookie })).status, 409, "now taken");
    });

    test("the admin numbers are for the admin role only", async () => {
        assert.equal((await get("/api/admin/stats")).status, 401);
        const viewer = await login("demo", "demo-pass");
        assert.equal((await get("/api/admin/stats", { headers: { Cookie: viewer.cookie } })).status, 403);
        const admin = await login("admin", "admin-pass");
        const stats = await get("/api/admin/stats", { headers: { Cookie: admin.cookie } });
        assert.equal(stats.status, 200);
        assert.equal((await stats.json()).hosts, HOST_COUNT);
    });

    test("changing the password checks the old one and the length of the new one, and changes nothing", async () => {
        assert.equal((await post("/api/password", { currentPassword: "a", newPassword: "b" })).status, 401);
        const { cookie } = await login();
        const wrong = await post("/api/password", { currentPassword: "wrong", newPassword: "long-enough-1" }, { Cookie: cookie });
        assert.equal(wrong.status, 422);
        assert.ok((await wrong.json()).fields.currentPassword);
        const short = await post("/api/password", { currentPassword: "demo-pass", newPassword: "short" }, { Cookie: cookie });
        assert.ok((await short.json()).fields.newPassword);
        assert.equal((await post("/api/password", { currentPassword: "demo-pass", newPassword: "long-enough-1" }, { Cookie: cookie })).status, 200);
        assert.equal((await login("demo", "demo-pass")).response.status, 200, "the old password still works");
    });
});

describe("the rest of the API", () => {
    test("health, version, and answers for what does not exist", async () => {
        assert.equal((await (await get("/api/health")).json()).status, "ok");
        assert.match((await (await get("/api/version")).json()).node, /^v\d+/);
        assert.equal((await get("/api/nothing")).status, 404);
        assert.equal((await get("/api/")).status, 400);
        assert.equal((await post("/api/nothing", {})).status, 404);
        const response = await get("/api/health");
        assert.equal(response.headers.get("cache-control"), "no-store");
    });
});
