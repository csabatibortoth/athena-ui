// The API of the Athena UI demo: hosts (a long list for the tables), metrics (a stream for the charts) and a small sign in with a session cookie.
// Everything is in memory and made up: there is no database, no real account and nothing secret in here. Node built-ins only.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/* ------------------HOSTS: 100,000 made up machines, always the same ones------------------- */

export const HOST_COUNT = 100000;
const OS = ["Linux", "Windows", "macOS", "FreeBSD"];
const REGIONS = ["eu-west", "eu-north", "us-east", "us-west", "ap-south"];
const SORTABLE = new Set(["id", "name", "os", "region", "cpu", "memory", "status", "lastSeen"]);
const START = Date.UTC(2026, 10, 19, 12, 0, 0);

// A small seeded generator: the same index gives the same host on every start and on every instance
function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let hosts = null;
function allHosts() {
    if (hosts) return hosts;
    hosts = Array.from({ length: HOST_COUNT }, (_, index) => {
        const random = seeded(index + 1);
        const cpu = Math.round(random() * 1000) / 10;
        const name = `host-${String(index + 1).padStart(5, "0")}`;
        const os = OS[Math.floor(random() * OS.length)];
        const region = REGIONS[Math.floor(random() * REGIONS.length)];
        return {
            id: index + 1,
            name,
            os,
            region,
            cpu,
            memory: Math.round(random() * 1000) / 10,
            status: cpu > 90 ? "bad" : cpu > 75 ? "warn" : "ok",
            lastSeen: START - Math.floor(random() * 3600) * 1000,
            search: `${name} ${os} ${region}`.toLowerCase()
        };
    });
    return hosts;
}

const sortedCache = new Map();
function ordered(sort, dir) {
    const key = `${sort}:${dir}`;
    if (!sortedCache.has(key)) {
        const list = allHosts();
        const sign = dir === "desc" ? -1 : 1;
        sortedCache.set(key, [...list].sort((a, b) => sign * (typeof a[sort] === "number" ? a[sort] - b[sort] : String(a[sort]).localeCompare(String(b[sort]))) || a.id - b.id));
    }
    return sortedCache.get(key);
}

const publicHost = ({ search, ...host }) => host;
const clampInt = (value, min, max, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

/** The hosts as a page ({ rows, total }) or, with a cursor, as the next slice ({ rows, nextCursor }). */
export function listHosts(query) {
    const sort = SORTABLE.has(query.get("sort")) ? query.get("sort") : "id";
    const dir = query.get("dir") === "desc" ? "desc" : "asc";
    const pageSize = clampInt(query.get("pageSize"), 1, 200, 25);
    const filter = (query.get("filter") ?? "").trim().toLowerCase().slice(0, 60);
    let list = ordered(sort, dir);
    if (filter) list = list.filter(host => host.search.includes(filter));
    if (query.has("cursor")) {
        const start = clampInt(query.get("cursor"), 0, list.length, 0);
        const end = Math.min(start + pageSize, list.length);
        return { rows: list.slice(start, end).map(publicHost), nextCursor: end < list.length ? end : null, total: list.length };
    }
    const page = clampInt(query.get("page"), 0, Math.ceil(list.length / pageSize), 0);
    return { rows: list.slice(page * pageSize, (page + 1) * pageSize).map(publicHost), total: list.length };
}

/* ------------------METRICS: a made up signal that depends only on the time------------------- */

export function metricAt(t) {
    const noise = (salt) => (seeded(Math.floor(t / 1000) * 31 + salt)() - 0.5);
    const cpu = 45 + 25 * Math.sin(t / 17000) + 10 * Math.sin(t / 3100) + 8 * noise(1);
    const memory = 60 + 12 * Math.sin(t / 41000) + 3 * noise(2);
    const network = Math.max(0, 30 + 20 * Math.sin(t / 9000 + 1) + 15 * noise(3));
    return { t, cpu: +Math.min(Math.max(cpu, 1), 99).toFixed(1), memory: +memory.toFixed(1), network: +network.toFixed(1) };
}

export function metricsSince(since, now = Date.now()) {
    const first = Math.max(Math.floor(since / 1000) * 1000 + 1000, now - 300000);
    const points = [];
    for (let t = first - (first % 1000); t <= now && points.length < 600; t += 1000) points.push(metricAt(t));
    return { now, points };
}

/* ------------------SIGN IN: two made up accounts, sessions in memory, an HttpOnly cookie------------------- */

const digest = text => createHash("sha256").update(String(text)).digest();
const ACCOUNTS = new Map([
    ["demo", { password: digest("demo-pass"), name: "Demo User", roles: ["viewer"] }],
    ["admin", { password: digest("admin-pass"), name: "Admin User", roles: ["viewer", "admin"] }]
]);
export const DEMO_ACCOUNTS = [{ username: "demo", password: "demo-pass", roles: ["viewer"] }, { username: "admin", password: "admin-pass", roles: ["viewer", "admin"] }];

const COOKIE = "athena_demo";
const SESSION_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 2000;
const sessions = new Map();     // id -> { username, expires }
const attempts = new Map();     // ip -> { count, resetAt }
const created = [];             // hosts added through the form dialog (in memory, at most 200)

function sessionFrom(request) {
    const raw = /(?:^|;\s*)athena_demo=([\w-]+)/.exec(request.headers.cookie ?? "")?.[1];
    const session = raw && sessions.get(raw);
    if (!session) return null;
    if (session.expires < Date.now()) {
        sessions.delete(raw);
        return null;
    }
    session.expires = Date.now() + SESSION_MS;          // sliding
    return { id: raw, ...session };
}

function userOf(session) {
    const account = session && ACCOUNTS.get(session.username);
    return account ? { username: session.username, name: account.name, roles: account.roles } : null;
}

export function resetForTests() {
    sessions.clear();
    attempts.clear();
    created.length = 0;
}

/* ------------------HTTP------------------- */

const json = (response, status, body, headers = {}) => {
    const text = JSON.stringify(body);
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(text), ...headers });
    response.end(text);
};

async function readJson(request, limit = 10240) {
    if (!/^application\/json\b/i.test(request.headers["content-type"] ?? "")) throw Object.assign(new Error("Send JSON."), { status: 415 });
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
        size += chunk.length;
        if (size > limit) throw Object.assign(new Error("The request is too large."), { status: 413 });
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
        throw Object.assign(new Error("That is not valid JSON."), { status: 400 });
    }
}

// A form post from another site cannot carry the cookie (SameSite=Strict), and this checks the Origin as well
function sameOrigin(request, secure) {
    const origin = request.headers.origin;
    if (!origin) return true;
    return origin === `${secure ? "https" : "http"}://${request.headers.host}`;
}

/**
 * Handles /api/... Returns true when the request was an API request (and was answered).
 * @param {import("node:http").IncomingMessage} request
 * @param {import("node:http").ServerResponse} response
 * @param {{secure: boolean, ip: string}} context
 */
export async function handleApi(request, response, context) {
    const url = new URL(request.url, "http://local");
    if (!url.pathname.startsWith("/api/")) return false;
    const route = url.pathname.slice(5);
    const method = request.method;
    try {
        if (route === "health" && method === "GET") return json(response, 200, { status: "ok", hosts: HOST_COUNT, time: Date.now() }), true;
        if (route === "hosts" && method === "GET") return json(response, 200, listHosts(url.searchParams)), true;
        if (route === "metrics" && method === "GET") return json(response, 200, metricsSince(clampInt(url.searchParams.get("since"), 0, Number.MAX_SAFE_INTEGER, 0))), true;
        if (route === "accounts" && method === "GET") return json(response, 200, DEMO_ACCOUNTS), true;
        if (route === "me" && method === "GET") {
            // 200 with null when nobody is signed in: asking is not an error, and the browser would log a 401 on every page
            return json(response, 200, userOf(sessionFrom(request))), true;
        }

        if (method === "POST") {
            if (!sameOrigin(request, context.secure)) return json(response, 403, { error: "Wrong origin." }), true;

            if (route === "login") {
                const now = Date.now();
                const entry = attempts.get(context.ip);
                if (!entry || entry.resetAt < now) attempts.set(context.ip, { count: 1, resetAt: now + 60000 });
                else if (++entry.count > 10) return json(response, 429, { error: "Too many attempts. Wait a minute." }, { "Retry-After": "60" }), true;
                if (attempts.size > 5000) attempts.clear();
                const { username, password } = await readJson(request);
                const account = typeof username === "string" ? ACCOUNTS.get(username) : undefined;
                // Always compare something, so a wrong user name and a wrong password take the same time
                const ok = timingSafeEqual(digest(password ?? ""), account?.password ?? digest("x")) && Boolean(account);
                if (!ok) return json(response, 401, { error: "Wrong user name or password.", fields: { password: "Wrong user name or password." } }), true;
                if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
                const id = randomBytes(32).toString("base64url");
                sessions.set(id, { username, expires: now + SESSION_MS });
                const cookie = `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${context.secure ? "; Secure" : ""}`;
                return json(response, 200, userOf({ username }), { "Set-Cookie": cookie }), true;
            }
            if (route === "logout") {
                const session = sessionFrom(request);
                if (session) sessions.delete(session.id);
                return json(response, 200, { ok: true }, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${context.secure ? "; Secure" : ""}` }), true;
            }

            const user = userOf(sessionFrom(request));
            if (route === "hosts") {
                if (!user) return json(response, 401, { error: "Sign in to add a host." }), true;
                const { name } = await readJson(request);
                if (typeof name !== "string" || !/^[a-z0-9-]{3,40}$/.test(name)) {
                    return json(response, 422, { error: "Check the name.", fields: { name: "Use 3 to 40 lower case letters, digits or hyphens." } }), true;
                }
                if (allHosts().some(host => host.name === name) || created.some(host => host.name === name)) {
                    return json(response, 409, { error: "That name is taken.", fields: { name: "A host with this name exists already." } }), true;
                }
                if (created.length >= 200) return json(response, 507, { error: "The demo keeps at most 200 added hosts." }), true;
                const host = { id: HOST_COUNT + created.length + 1, name, addedBy: user.username };
                created.push(host);
                return json(response, 201, host), true;
            }
            if (route === "password") {
                if (!user) return json(response, 401, { error: "Sign in first." }), true;
                const { currentPassword, newPassword } = await readJson(request);
                const account = ACCOUNTS.get(user.username);
                if (typeof currentPassword !== "string" || !timingSafeEqual(digest(currentPassword), account.password)) {
                    return json(response, 422, { error: "Check the passwords.", fields: { currentPassword: "That is not your current password." } }), true;
                }
                if (typeof newPassword !== "string" || newPassword.length < 8) {
                    return json(response, 422, { error: "Check the passwords.", fields: { newPassword: "Use at least 8 characters." } }), true;
                }
                // The demo does not change anything: the accounts are fixed.
                return json(response, 200, { ok: true, note: "Nothing was changed: the demo accounts are fixed." }), true;
            }
        }

        if (route === "admin/stats" && method === "GET") {
            const user = userOf(sessionFrom(request));
            if (!user) return json(response, 401, { error: "Not signed in." }), true;
            if (!user.roles.includes("admin")) return json(response, 403, { error: "Only an administrator may see this." }), true;
            return json(response, 200, { hosts: HOST_COUNT, added: created.length, sessions: sessions.size, node: process.version, uptime: Math.round(process.uptime()) }), true;
        }

        return json(response, route.split("/")[0] ? 404 : 400, { error: "Unknown request." }), true;
    } catch (error) {
        return json(response, error.status ?? 500, { error: error.status ? error.message : "Something went wrong." }), true;
    }
}
