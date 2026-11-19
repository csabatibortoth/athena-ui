// Makes the folder that is deployed to Azure App Service: demo/dist
//
//   dist/package.json      "start": "node server.mjs", Node 24, no dependencies (so Azure has nothing to install or build)
//   dist/server.mjs, api.mjs
//   dist/public/           the pages of the demo
//   dist/public/athena/    Athena UI itself, copied from src/ of this repository: the demo always shows the code that is being deployed
//
//   node demo/scripts/build-package.mjs [outputFolder]

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const demo = join(root, "demo");
const out = resolve(process.argv[2] ?? join(demo, "dist"));
const library = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// Never delete something that is not an output folder: it has to be called dist, or be inside the demo folder
if (!out.endsWith("dist") && !out.startsWith(demo)) throw new Error(`Refusing to clear ${out}: the output folder has to be called dist`);
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(join(demo, "server.mjs"), join(out, "server.mjs"));
cpSync(join(demo, "api.mjs"), join(out, "api.mjs"));
cpSync(join(demo, "public"), join(out, "public"), { recursive: true });
// The library: the whole src folder, except the example page that is not part of the package
cpSync(join(root, "src"), join(out, "public", "athena"), {
    recursive: true,
    filter: source => !/[\\/]src[\\/](example\.js|index\.html)$/.test(source)
});
cpSync(join(root, "LICENSE"), join(out, "LICENSE"));

writeFileSync(join(out, "package.json"), JSON.stringify({
    name: "athena-ui-demo",
    version: library.version,
    private: true,
    description: `Demo of Athena UI ${library.version}`,
    type: "module",
    main: "server.mjs",
    scripts: { start: "node server.mjs" },
    engines: { node: ">=24" },
    license: "MIT"
}, null, 2) + "\n");

// A short list of what is in the package, for the log of the deployment
const files = [];
(function walk(folder) {
    for (const name of readdirSync(folder)) {
        const path = join(folder, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(relative(out, path));
    }
})(out);
const size = files.reduce((sum, file) => sum + statSync(join(out, file)).size, 0);
console.log(`demo package ${library.version}: ${files.length} files, ${(size / 1024).toFixed(0)} kB in ${out}`);
