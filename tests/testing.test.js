import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { installDom, tick, until } from "../src/testing.js";

// jsdom is not a dependency of Athena UI: look for one next to the repositories, skip when there is none.
async function findJsdom() {
    for (const base of [process.cwd(), "../../heimdall-monitoring-system/ui"]) {
        try {
            const require = createRequire(pathToFileURL(`${process.cwd()}/${base}/`).href.replace(/\/\/\/?$/, "/") + "x.js");
            return (await import(pathToFileURL(require.resolve("jsdom")).href)).JSDOM;
        } catch { /* try the next place */ }
    }
    return null;
}

test("until: returns the value, and fails with a reason on timeout", async () => {
    let n = 0;
    assert.equal(await until(() => (++n > 3 ? "ok" : null)), "ok");
    await assert.rejects(until(() => false, { timeout: 30, message: "never" }), /never/);
    await tick();
});

test("installDom: components run in jsdom without noise", async t => {
    const JSDOM = await findJsdom();
    if (!JSDOM) return t.skip("no jsdom found");
    const dom = installDom(JSDOM);
    try {
        const { generateDropdown } = await import("../src/libs/hephaestus/navigationGenerator/navigationGenerator.js");
        const dropdown = generateDropdown({ parent: "#wrapper", icon: "x", ariaLabel: "More", items: [{ label: "A" }] });
        assert.equal(document.querySelector("#wrapper .dropdown-toggle").getAttribute("aria-label"), "More");
        dropdown.destroy();
        assert.equal(document.querySelector(".dropdown"), null);
    } finally {
        dom.uninstall();
    }
});
