// The real thing, after check:package (which only reads the file list): packs the library, installs the tarball in an empty folder and imports
// every entry point of the "exports" map the way an application would. Run it with `npm run smoke:package` (takes about half a minute).
//
// 2.3.0 and 2.4.0 were published without some folders; this fails for such a package before it is published.
//   - every entry point must resolve through the exports map;
//   - every entry point must import (theme-boot.js only resolves: it is a script for the page that touches the document);
//   - every entry point must export something (classic.js exports nothing by design: it sets up globals).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const NO_EXPORTS = new Set(["./classic"]);
const RESOLVE_ONLY = new Set(["./theme-boot.js"]);

const entries = Object.keys(pkg.exports).filter(key => key !== "./package.json" && !key.includes("*"));

const work = mkdtempSync(join(tmpdir(), "athena-smoke-"));
try {
    const packOutput = execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
    const tarball = join(work, JSON.parse(packOutput)[0].filename);

    const app = join(work, "app");
    execFileSync("mkdir", [app]);
    writeFileSync(join(app, "package.json"), JSON.stringify({ name: "smoke-app", private: true, type: "module" }));
    execFileSync("npm", ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: app, stdio: ["ignore", "inherit", "inherit"] });

    const checker = join(app, "check.mjs");
    writeFileSync(checker, `
        const entries = ${JSON.stringify(entries)};
        const resolveOnly = new Set(${JSON.stringify([...RESOLVE_ONLY])});
        const noExports = new Set(${JSON.stringify([...NO_EXPORTS])});
        const specifier = key => (key === "." ? ${JSON.stringify(pkg.name)} : ${JSON.stringify(pkg.name)} + "/" + key.slice(2));
        const problems = [];
        for (const key of entries) {
            const name = specifier(key);
            try {
                import.meta.resolve(name);
                if (resolveOnly.has(key)) continue;
                const module = await import(name);
                if (!noExports.has(key) && Object.keys(module).length === 0) problems.push(name + " exports nothing");
            } catch (error) {
                problems.push(name + ": " + (error && error.message || error));
            }
        }
        try { import.meta.resolve(${JSON.stringify(pkg.name + "/themes/tokens.css")}); } catch (error) { problems.push("themes/* does not resolve: " + error.message); }
        if (problems.length) { console.error(problems.map(p => "- " + p).join("\\n")); process.exit(1); }
        console.log("All " + entries.length + " entry points of the installed package import.");
    `);
    execFileSync(process.execPath, [checker], { cwd: app, stdio: "inherit" });
} catch (error) {
    process.exitCode = 1;
    if (error.status === undefined) console.error(error.message);
} finally {
    rmSync(work, { recursive: true, force: true });
}
