// Checks that the npm package holds everything it points to: run it with `npm run check:package`.
//
//  - every file named in the "exports" map exists in the package;
//  - every file that an entry point imports (and what those import, and so on) is in the package.
//
// The "files" list of package.json is a whitelist, and a folder that is not on it is silently left out of `npm pack`: 2.3.0 and 2.4.0 went out without
// the folders of the widgets and of the code editor, and `import "athena-ui-js"` failed for everybody. This script reads what `npm pack --dry-run`
// would put in the tarball and follows the imports of the sources through exactly that list.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The files `npm pack` would put in the tarball (paths with forward slashes, relative to the package root). */
export function packedFiles() {
    const output = execSync("npm pack --dry-run --json --ignore-scripts", { cwd: root, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] });
    return new Set(JSON.parse(output)[0].files.map(file => file.path.replace(/\\/g, "/")));
}

const IMPORT = /(?:^|[\s;}])(?:import|export)\s*(?:[^'";]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

/** The relative files a source file imports (static, `export ... from` and import("./x.js")). */
export function importsOf(file) {
    const text = readFileSync(join(root, file), "utf8");
    const found = [];
    for (const match of text.matchAll(IMPORT)) {
        const target = match[1] ?? match[2];
        found.push(normalize(join(dirname(file), target)).replace(/\\/g, "/"));
    }
    return found;
}

/** Problems of the package: an array of strings, empty when it is fine. */
export function checkPackage(packed = packedFiles()) {
    const problems = [];
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const targets = new Set();
    const collect = value => {
        if (typeof value === "string") targets.add(normalize(value).replace(/\\/g, "/"));
        else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(pkg.exports);
    collect(pkg.main);
    collect(pkg.types);
    for (const target of targets) {
        if (target.includes("*")) {
            // a pattern of the exports map ("./src/res/themes/*"): at least one file must match
            const pattern = new RegExp(`^${target.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
            if (![...packed].some(file => pattern.test(file))) problems.push(`nothing in the package matches "${target}"`);
        } else if (!packed.has(target)) problems.push(`"${target}" is named in package.json but is not in the package`);
    }

    // every source the entry points reach
    const seen = new Set();
    const queue = [...targets].filter(target => /^src\/[^/*]+\.js$/.test(target));
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        if (!existsSync(join(root, file))) {
            problems.push(`"${file}" is imported but does not exist`);
            continue;
        }
        if (!packed.has(file)) {
            problems.push(`"${file}" is imported (by an entry point) but is not in the package: add its folder to "files" in package.json`);
            continue;
        }
        if (file.endsWith(".js")) queue.push(...importsOf(file));
    }
    return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const problems = checkPackage();
    if (problems.length) {
        console.error(problems.map(problem => `- ${problem}`).join("\n"));
        process.exit(1);
    }
    console.log(`The package is complete (${relative(root, root) || "."}).`);
}
