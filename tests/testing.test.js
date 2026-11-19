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

test("createSafeBuilder: only the allowed tags and attributes get through", async t => {
    const JSDOM = await findJsdom();
    if (!JSDOM) return t.skip("no jsdom found");
    const dom = installDom(JSDOM);
    const warn = console.warn;
    console.warn = () => {};
    try {
        const { createSafeBuilder } = await import("../src/libs/core/dom.js");
        const h = createSafeBuilder({ tags: ["div", "a", "span"], attributes: ["class", "href"] });
        const node = h("div", { class: "x", attrs: { href: "#a", title: "no", "data-id": "7", "aria-label": "ok", id: "no" } }, h("span", { text: "hi" }));
        assert.equal(node.getAttribute("title"), null);
        assert.equal(node.getAttribute("href"), "#a");
        assert.equal(node.getAttribute("data-id"), "7");
        assert.equal(node.getAttribute("aria-label"), "ok");
        assert.equal(node.textContent, "hi");
        assert.throws(() => h("img"), TypeError);
        assert.throws(() => h("script"), TypeError);
        // the rules of el() still apply on top of the list
        const link = createSafeBuilder({ attributes: ["href", "onclick"] })("a", { attrs: { href: "javascript:alert(1)", onclick: "x()" } });
        assert.equal(link.getAttribute("href"), null);
        assert.equal(link.getAttribute("onclick"), null);
    } finally {
        console.warn = warn;
        dom.uninstall();
    }
});

test("HTMLElementGenerator and HTMLControlGenerator work from Athena without jQuery", async t => {
    const JSDOM = await findJsdom();
    if (!JSDOM) return t.skip("no jsdom found");
    const dom = installDom(JSDOM);
    const error = console.error;
    console.error = () => {};
    try {
        const { HTMLElementGenerator, supportedElements } = await import("../src/libs/core/elementGenerator.js");
        const { HTMLControlGenerator, registerControl } = await import("../src/libs/core/controls.js");
        const { registerHungarianInputControls } = await import("../src/libs/core/hungarianControls.js");
        // elements
        assert.deepEqual([...supportedElements].slice(0, 3), ["div", "span", "p"]);
        let seen = null;
        const box = HTMLElementGenerator({ elementType: "div", parent: "wrapper", id: "box", class: "c", text: "<b>x</b>", data: 7, onclick: d => { seen = d; } });
        assert.equal(box.parentElement.id, "wrapper");
        assert.equal(box.textContent, "<b>x</b>");
        box.click();
        assert.equal(seen, 7);
        assert.equal(HTMLElementGenerator({ elementType: "marquee" }), null);
        assert.equal(HTMLElementGenerator(undefined), null);
        const image = HTMLElementGenerator({ elementType: "img", parent: "wrapper", src: "a.png", alt: "A" });
        assert.equal(image.getAttribute("alt"), "A");
        // controls
        const changes = [];
        HTMLControlGenerator({ inputType: "text", parent: "wrapper", id: "t", class: "k", value: "v", onchange() { changes.push("t"); } });
        const text = document.getElementById("t");
        assert.equal(text.value, "v");
        assert.equal(text.className, "k");
        text.dispatchEvent(new window.Event("change"));
        assert.deepEqual(changes, ["t"]);
        HTMLControlGenerator({ inputType: "checkbox", parent: "wrapper", id: "c", checked: true });
        assert.equal(document.getElementById("c").checked, true);
        HTMLControlGenerator({ inputType: "select", parent: "wrapper", id: "s", items: [{ value: "a", text: "A" }, { value: "b", text: "B", selected: true }] });
        assert.equal(document.getElementById("s").value, "b");
        const clicks = [];
        HTMLControlGenerator({ inputType: "ul", parent: "wrapper", id: "u", items: [{ id: "i1", text: "one", onclick() { clicks.push("one"); } }, { id: "i2", text: "two" }], onclick() { clicks.push("list"); } });
        document.getElementById("i1").click();
        document.getElementById("i2").click();
        assert.deepEqual(clicks, ["one", "list"]);
        // an unknown parent puts it in a div on the body; no parent is an error; a wrong type is an error
        HTMLControlGenerator({ inputType: "text", parent: "nowhere", id: "orphan" });
        assert.equal(document.getElementById("orphan").parentElement.parentElement, document.body);
        const before = document.querySelectorAll("input").length;
        HTMLControlGenerator({ inputType: "text" });
        HTMLControlGenerator({ inputType: "banana", parent: "wrapper" });
        assert.equal(document.querySelectorAll("input").length, before);
        // create: the plain element without jQuery, a jQuery object with it
        const plain = HTMLControlGenerator.create({ inputType: "number", id: "n", min: 1, max: 5 });
        assert.equal(plain.tagName, "INPUT");
        assert.equal(plain.max, "5");
        assert.equal(HTMLControlGenerator.create({ inputType: "banana" }), undefined);
        globalThis.jQuery = element => ({ jquery: "4.0.0", 0: element, length: 1 });
        const wrapped = HTMLControlGenerator.create({ inputType: "text", id: "w" });
        assert.equal(wrapped.jquery, "4.0.0");
        assert.equal(wrapped[0].id, "w");
        delete globalThis.jQuery;
        // register: a factory can return an element or a jQuery object
        HTMLControlGenerator.register("pair", options => { const s = document.createElement("span"); s.id = options.id; return s; });
        assert.equal(HTMLControlGenerator.create({ inputType: "pair", id: "p" }).id, "p");
        registerControl("jq", options => ({ jquery: "x", 0: Object.assign(document.createElement("i"), { id: options.id }) }));
        assert.equal(HTMLControlGenerator.create({ inputType: "jq", id: "q" }).id, "q");
        // the Hungarian addon
        registerHungarianInputControls();
        const pin = HTMLControlGenerator.create({ inputType: "hunPIN", id: "pin", value: "123456789", inputClass: "seg" });
        assert.equal(pin.querySelectorAll("input").length, 3);
        assert.deepEqual([...pin.querySelectorAll("input")].map(i => i.value), ["123", "456", "789"]);
        assert.equal(pin.querySelectorAll("input")[0].max, "999");
        assert.equal(pin.querySelectorAll("span").length, 2);
        const tid = HTMLControlGenerator.create({ inputType: "hunTID", id: "tid", value: "1234567812" });
        assert.deepEqual([...tid.querySelectorAll("input")].map(i => i.value), ["12345678", "1", "2"]);
    } finally {
        console.error = error;
        dom.uninstall();
    }
});

test("showDialog works in jsdom through installDom (a stand-in for showModal)", async t => {
    const JSDOM = await findJsdom();
    if (!JSDOM) return t.skip("no jsdom found");
    const dom = installDom(JSDOM);
    try {
        const { showDialog, confirmDialog } = await import("../src/libs/hephaestus/dialogGenerator/dialogGenerator.js");
        const dialog = showDialog({ title: "T", content: "hello", size: "small", buttons: [{ text: "Yes", value: "y" }] });
        assert.equal(dialog.element.tagName, "DIALOG");
        assert.ok(dialog.element.hasAttribute("open"));
        assert.equal(document.querySelector(".dialog-title").textContent, "T");
        document.querySelector(".dialog-footer button").click();
        assert.equal(await dialog, "y");
        assert.equal(document.querySelector("dialog"), null);
        const asked = confirmDialog("Sure?");
        document.querySelector("dialog").dispatchEvent(new window.Event("cancel", { cancelable: true }));
        assert.equal(await asked, false);
    } finally {
        dom.uninstall();
    }
});
