import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { checkPackage, importsOf, packedFiles } from "../scripts/check-package.mjs";

describe("the npm package", () => {
    const packed = packedFiles();

    test("holds every file the entry points name and import (2.3.0 and 2.4.0 went out without the widget and code folders)", () => {
        assert.deepEqual(checkPackage(packed), []);
    });

    test("the check itself notices a folder that is missing", () => {
        const without = new Set([...packed].filter(file => !file.startsWith("src/libs/hephaestus/widgetGrid/")));
        const problems = checkPackage(without);
        assert.ok(problems.some(problem => problem.includes("widgetGrid.js")), problems.join("\n"));
        const noEntry = new Set([...packed].filter(file => file !== "src/code.js"));
        assert.ok(checkPackage(noEntry).some(problem => problem.includes("src/code.js")));
    });

    test("every place that names the version names the one of package.json (the README said 2.7.1 up to 2.11.0)", () => {
        const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
        const { version } = JSON.parse(read("package.json"));
        const lock = JSON.parse(read("package-lock.json"));
        assert.deepEqual([lock.version, lock.packages[""].version], [version, version], "package-lock.json");
        assert.equal(/^Current version: \*\*(.+?)\*\*/m.exec(read("README.md"))?.[1], version, "README.md, Current version");
        assert.equal(/^ ### (\S+)/m.exec(read("README.md").split("## Releases")[1])?.[1], version, "README.md, the newest release notes");
        assert.equal(/^\/\/Version: (\S+)/m.exec(read("src/athena-ui.js"))?.[1], version, "src/athena-ui.js");
        assert.equal(/version: "(.+?)"/.exec(read("src/libs/config/config.js"))?.[1], version, "config.js");
    });

    test("it finds static, re-exported and dynamic imports", () => {
        const imports = importsOf("src/athena-ui.js");
        assert.ok(imports.includes("src/libs/hephaestus/widgetGrid/widgetGrid.js"), "export * from");
        assert.ok(imports.includes("src/libs/config/config.js"), "import ... from");
    });

    test("what is not source stays out of the package", () => {
        for (const file of packed) {
            assert.ok(!/^(demo|tests|\.github|node_modules)\//.test(file), `${file} should not be published`);
        }
        assert.ok(!packed.has("src/example.js"));
    });
});
