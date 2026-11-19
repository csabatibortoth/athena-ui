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

test("el: text stays text, code attributes and unsafe addresses are refused", async t => {
    const JSDOM = await findJsdom();
    if (!JSDOM) return t.skip("no jsdom found");
    const dom = installDom(JSDOM);
    const warn = console.warn;
    console.warn = () => {};
    try {
        const { el } = await import("../src/libs/core/dom.js");
        const node = el("div", {
            text: "<img src=x onerror=alert(1)>",
            attrs: { onclick: "alert(1)", style: "color:red", title: "ok", srcdoc: "<b>" }
        }, ["a", [el("b", { text: "<i>" }), null, false, 0]]);
        assert.equal(node.querySelector("img"), null);
        assert.equal(node.textContent, "<img src=x onerror=alert(1)>a<i>0");
        assert.equal(node.getAttribute("onclick"), null);
        assert.equal(node.getAttribute("style"), null);
        assert.equal(node.getAttribute("srcdoc"), null);
        assert.equal(node.getAttribute("title"), "ok");
        for (const bad of ["javascript:alert(1)", " JaVa\tScRiPt:alert(1)", "data:text/html,x", "//evil.example/x"]) {
            assert.equal(el("a", { attrs: { href: bad } }).getAttribute("href"), null, bad);
        }
        for (const good of ["https://example.org", "#top", "/path", "mailto:a@b.c"]) {
            assert.equal(el("a", { attrs: { href: good } }).getAttribute("href"), good);
        }
        assert.throws(() => el("div", { on: { click: "alert(1)" } }), TypeError);
        assert.throws(() => el("div", { prop: { innerHTML: "<b>" } }), TypeError);
        let clicked = 0;
        el("button", { on: { click: () => clicked++ } }).click();
        assert.equal(clicked, 1);
    } finally {
        console.warn = warn;
        dom.uninstall();
    }
});

test("createThemeManager: saves the choice, follows the system, ignores unknown ids", async t => {
    const JSDOM = await findJsdom();
    if (!JSDOM) return t.skip("no jsdom found");
    const dom = installDom(JSDOM);
    try {
        const { createThemeManager } = await import("../src/libs/core/theme.js");
        const themes = [{ id: "ocean" }, { id: "forest" }];
        const storage = new Map();
        const store = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
        const root = document.documentElement;
        const manager = createThemeManager({ themes, storageKey: "k", storage: store });
        assert.equal(root.dataset.theme, "ocean");
        assert.equal(root.dataset.mode, "light");   // jsdom has no matchMedia: "system" is light
        const seen = [];
        const stop = manager.onChange(state => seen.push(`${state.theme}/${state.mode}/${state.dark}`));
        assert.equal(manager.setTheme("forest"), true);
        assert.equal(manager.setMode("dark"), true);
        assert.equal(manager.setTheme("nope"), false);
        assert.equal(manager.setMode("nope"), false);
        assert.equal(root.dataset.theme, "forest");
        assert.equal(root.dataset.mode, "dark");
        assert.deepEqual(JSON.parse(storage.get("k")), { theme: "forest", mode: "dark" });
        assert.deepEqual(seen, ["ocean/system/false", "forest/system/false", "forest/dark/true"]);
        stop();
        manager.destroy();
        // A saved value that is not valid falls back to the defaults
        storage.set("k", "{not json");
        const again = createThemeManager({ themes, storageKey: "k", storage: store });
        assert.deepEqual(again.appearance(), { theme: "ocean", mode: "system", dark: false });
        again.destroy();
        assert.throws(() => createThemeManager({ themes: [] }));
    } finally {
        dom.uninstall();
    }
});
