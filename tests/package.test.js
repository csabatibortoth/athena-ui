import assert from "node:assert/strict";
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
