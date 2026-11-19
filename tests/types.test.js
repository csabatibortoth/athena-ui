import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("every entry point of package.json has a type definition file that exists", () => {
    for (const [key, target] of Object.entries(pkg.exports)) {
        if (typeof target === "string") continue;
        assert.ok(existsSync(new URL(`../${target.types}`, import.meta.url)), `${key}: ${target.types} is missing (run npm run types)`);
        assert.ok(existsSync(new URL(`../${target.default}`, import.meta.url)), `${key}: ${target.default} is missing`);
    }
    assert.ok(existsSync(new URL(`../${pkg.types}`, import.meta.url)));
});

test("an application written in TypeScript compiles against the definitions", t => {
    const tsc = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
    if (!existsSync(tsc)) return t.skip("typescript is not installed (npm install)");
    const result = spawnSync(process.execPath, [tsc, "-p", "tsconfig.consumer.json"], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
});
