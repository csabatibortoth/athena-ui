// The gzip size of every entry point with everything it imports, against scripts/size-budget.json.
//   npm run size              fails when an entry is over its budget (or has none)
//   npm run size -- --write   sets the budgets to the sizes of now plus 10 % (a decision: look at the diff)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budgetFile = join(root, "scripts", "size-budget.json");
const { exports } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/** The file and everything it imports statically (relative imports only: the library has no dependency). */
function graph(file, seen = new Set()) {
    if (seen.has(file)) return seen;
    seen.add(file);
    for (const [, path] of readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)\b(?:[^"';]*?\bfrom\b)?\s*["'](\.[^"']+)["']/gm)) graph(resolve(dirname(file), path), seen);
    return seen;
}

const sizes = {};
for (const [name, target] of Object.entries(exports)) {
    const path = typeof target === "string" ? target : target.default;
    if (!path.endsWith(".js") || path.includes("*")) continue;
    const files = [...graph(join(root, path))].sort();
    sizes[name] = gzipSync(files.map(file => readFileSync(file)).join("\n")).length;
}

if (process.argv.includes("--write")) {
    writeFileSync(budgetFile, `${JSON.stringify(Object.fromEntries(Object.entries(sizes).map(([name, size]) => [name, Math.ceil(size * 1.1 / 500) * 500])), null, 4)}\n`);
}
const budgets = JSON.parse(readFileSync(budgetFile, "utf8"));
let failed = 0;
for (const [name, size] of Object.entries(sizes)) {
    const ok = size <= budgets[name];
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "OVER"} ${name.padEnd(18)} ${String(size).padStart(7)} of ${budgets[name] ?? "no budget"} bytes (gzip)`);
}
if (failed) {
    console.error(`${failed} entry point(s) over the size budget`);
    process.exit(1);
}
