// The server of the Athena UI demo. Node built-ins only: static files, a small API (api.mjs) and strict security headers.
//   node demo/server.mjs            from the repository (Athena UI is served from ../src)
//   npm start                       in the package that demo/scripts/build-package.mjs makes (Athena UI is in public/athena)

import { createServer } from "node:http";
import { existsSync, statSync, createReadStream, readFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { handleApi } from "./api.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = resolve(process.env.PUBLIC_DIR ?? join(here, "public"));
const ATHENA = resolve(process.env.ATHENA_DIR ?? (existsSync(join(PUBLIC, "athena")) ? join(PUBLIC, "athena") : join(here, "..", "src")));
const VERSION = JSON.parse(readFileSync(existsSync(join(here, "package.json")) ? join(here, "package.json") : join(here, "..", "package.json"), "utf8")).version;

// The commit of the package (build-package.mjs writes it). A demo run from the sources has none.
const BUILD = existsSync(join(here, "build.json")) ? JSON.parse(readFileSync(join(here, "build.json"), "utf8")).commit : null;

const TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8"
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".md"]);

// The page needs nothing that a strict policy forbids: that is one of the things this demo shows.
export const SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Frame-Options": "DENY"
};

const compressed = new Map();   // file + mtime -> gzip buffer

// A path from the URL to a file under a root, or null. No way out of the folder, no hidden files.
export function resolveFile(root, urlPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        return null;
    }
    if (decoded.includes("\0")) return null;
    const file = normalize(join(root, decoded));
    if (file !== root && !file.startsWith(root + sep)) return null;
    // no hidden files (.git, .env): only the part below the root counts, the root itself may be anywhere
    if (file.slice(root.length).split(sep).some(part => part.startsWith("."))) return null;
    return file;
}

function serveFile(request, response, file) {
    const stats = statSync(file);
    const type = extname(file).toLowerCase();
    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const headers = {
        "Content-Type": TYPES[type] ?? "application/octet-stream",
        ETag: etag,
        "Cache-Control": type === ".html" || file.endsWith("app.js") ? "no-cache" : "public, max-age=300"
    };
    if (request.headers["if-none-match"] === etag) {
        response.writeHead(304, headers);
        response.end();
        return;
    }
    const gzip = COMPRESSIBLE.has(type) && /\bgzip\b/.test(request.headers["accept-encoding"] ?? "") && stats.size > 512;
    if (gzip) {
        const key = `${file}:${stats.mtimeMs}`;
        if (!compressed.has(key)) compressed.set(key, gzipSync(readFileSync(file)));
        const body = compressed.get(key);
        response.writeHead(200, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Content-Length": body.length });
        response.end(request.method === "HEAD" ? undefined : body);
        return;
    }
    response.writeHead(200, { ...headers, "Content-Length": stats.size });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
}

export function createDemoServer({ log = console.log } = {}) {
    // Behind the proxy of Azure App Service the request is https while this process sees http
    const trustProxy = Boolean(process.env.WEBSITE_SITE_NAME) || process.env.TRUST_PROXY === "1";
    return createServer(async (request, response) => {
        const started = Date.now();
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(name, value);
        const forwarded = trustProxy ? request.headers["x-forwarded-proto"] : undefined;
        const secure = forwarded === "https" || Boolean(request.socket.encrypted);
        const ip = (trustProxy ? String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim().replace(/:\d+$/, "") : "") || request.socket.remoteAddress || "unknown";
        response.on("finish", () => log(`${request.method} ${new URL(request.url, "http://x").pathname} ${response.statusCode} ${Date.now() - started}ms`));
        try {
            const path = new URL(request.url, "http://local").pathname;
            if (path === "/api/version") {
                response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
                response.end(JSON.stringify({ demo: VERSION, build: BUILD, node: process.version }));
                return;
            }
            if (await handleApi(request, response, { secure, ip })) return;
            if (request.method !== "GET" && request.method !== "HEAD") {
                response.writeHead(405, { Allow: "GET, HEAD, POST" });
                response.end();
                return;
            }
            // /athena/... is the library, everything else is the demo; an unknown path without an extension is the page (the router uses the hash anyway)
            const [root, rest] = path.startsWith("/athena/") ? [ATHENA, path.slice(7)] : [PUBLIC, path === "/" ? "/index.html" : path];
            let file = resolveFile(root, rest);
            if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
            if (!file || !existsSync(file) || !statSync(file).isFile()) {
                if (!extname(path) && !path.startsWith("/athena/")) file = join(PUBLIC, "index.html");
                else {
                    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
                    response.end("Not found");
                    return;
                }
            }
            serveFile(request, response, file);
        } catch (error) {
            console.error(error);
            if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Something went wrong.");
        }
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const port = Number(process.env.PORT ?? process.env.WEBSITES_PORT ?? 3000);
    const server = createDemoServer();
    server.listen(port, "0.0.0.0", () => console.log(`Athena UI demo ${VERSION} on port ${port} (Athena UI from ${ATHENA})`));
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
}
