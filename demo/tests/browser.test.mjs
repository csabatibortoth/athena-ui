// The demo in a real browser (headless Chrome / Chromium / Edge), under the strict Content-Security-Policy the server sends.
// One browser for all the tests, driven through the DevTools protocol (cdp.mjs). Every test fails on an exception, a console error or warning,
// a policy violation or a failed request. Skipped when no browser is found (set CHROME_PATH).

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createDemoServer } from "../server.mjs";
import { chromePath, launch, until } from "./cdp.mjs";

const skip = chromePath ? false : "no Chrome / Chromium / Edge found (set CHROME_PATH)";
let server;
let base;
let browser;
before(async () => {
    server = createDemoServer({ log: () => {} });
    await new Promise(done => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${server.address().port}`;
    if (!skip) browser = await launch();
}, { timeout: 90000 });
after(async () => {
    await browser?.close();
    server.close();
});

let counter = 0;
// A page of its own, opened at a route (the query makes it a new document every time), and closed afterwards
async function withPage(route, body) {
    const page = await browser.newPage();
    try {
        // Every test starts as a new visitor: the browser is shared, so cookies and saved settings are cleared
        await page.send("Network.clearBrowserCookies");
        await page.send("Storage.clearDataForOrigin", { origin: base, storageTypes: "all" });
        await page.goto(`${base}/?t=${++counter}#${route}`);
        await body(page);
        assert.deepEqual(page.problems, [], `the page had problems:\n${page.problems.join("\n")}`);
    } finally {
        await page.close();
    }
}
const title = page => page.eval(`document.querySelector(".page-title")?.textContent`);

describe("every page draws, without a single error, under the strict policy", { skip }, () => {
    const pages = [
        ["/", "Athena UI"], ["/tables", "Tables"], ["/charts", "Charts"], ["/forms", "Forms"], ["/dialogs", "Dialogs and feedback"], ["/navigation", "Navigation"],
        ["/themes", "Themes, modes and tokens"], ["/about", "About this demo"], ["/account", "Account"],
        ["/admin", "Account"],                  // not signed in: the router sends the visitor to the sign in page
        ["/nowhere", "Page not found"]
    ];
    for (const [route, expected] of pages) {
        test(route, { timeout: 240000 }, () => withPage(route, async page => {
            await page.waitFor(`document.querySelector(".page-title")?.textContent === ${JSON.stringify(expected)}`, { timeout: 90000 });
            await page.waitFor(`document.querySelector(".athena-menu")`);
            await new Promise(resolve => setTimeout(resolve, 1200));   // the pages that poll or stream get a few ticks
            assert.match(await page.eval(`document.title`), /^Athena UI demo/, "the title of the document");
        }));
    }
});

describe("what a person does", { skip }, () => {
    test("sign in: a wrong password is told in the form, a right one opens the page that was asked for, and the cookie is out of reach of scripts", { timeout: 240000 }, () => withPage("/admin", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Account"`, { timeout: 90000 });
        assert.match(await page.eval("location.hash"), /^#\/account\?next=%2Fadmin/, "sent to sign in, with the place to come back to");
        await page.waitFor(`document.querySelector("input[name=username]")`);
        await page.fill("input[name=username]", "admin");
        await page.fill("input[name=password]", "not-the-password");
        await page.eval(`document.querySelector("form.athena-form").requestSubmit()`);
        await page.waitFor(`document.querySelector(".form-message")?.textContent.includes("Wrong user name or password")`);
        await page.fill("input[name=password]", "admin-pass");
        await page.eval(`document.querySelector("form.athena-form").requestSubmit()`);
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Administration"`, { timeout: 60000 });
        assert.equal(await page.eval("location.hash"), "#/admin", "back where the person wanted to go");
        await page.waitFor(`document.querySelector(".menu-avatar")`);
        assert.ok(!(await page.eval("document.cookie")).includes("athena_demo"), "the session cookie is HttpOnly");
        await page.waitFor(`document.body.textContent.includes("Server numbers") && document.body.textContent.includes("Node.js")`);
        // sign out through the user menu
        await page.eval(`document.querySelector("[data-id=user]").click()`);
        await page.clickText("Sign out");
        await page.waitFor(`!document.querySelector(".menu-avatar") && location.hash === "#/"`);
        page.problems.length = 0;   // the sign in attempt with the wrong password is a 401 of the server, which Chrome may log as a failed request
    }));

    test("a viewer is turned away from the admin page by the router, and the server says no as well", { timeout: 240000 }, () => withPage("/account", async page => {
        await page.waitFor(`document.querySelector("input[name=username]")`);
        await page.fill("input[name=username]", "demo");
        await page.fill("input[name=password]", "demo-pass");
        await page.eval(`document.querySelector("form.athena-form").requestSubmit()`);
        await page.waitFor(`document.body.textContent.includes("You are signed in")`);
        await page.eval(`location.hash = "#/admin"`);
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Not allowed"`);
        const status = await page.eval(`fetch("/api/admin/stats", { credentials: "same-origin" }).then(r => r.status)`);
        assert.equal(status, 403, "the server checks the role too");
        page.problems.length = 0;   // the 403 is on purpose
    }));

    test("dialogs: opens as a modal, Esc closes it, the focus returns; typing the name confirms a deletion", { timeout: 240000 }, () => withPage("/dialogs", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Dialogs and feedback"`, { timeout: 90000 });
        await page.clickText("Open small");
        await page.waitFor(`document.querySelector("dialog.dialog[open]")?.matches(":modal")`);
        assert.ok(await page.eval(`document.activeElement.closest("dialog") !== null`), "the focus is inside the dialog");
        assert.ok(await page.eval(`getComputedStyle(document.querySelector("dialog.dialog")).width === "360px" || document.querySelector("dialog.dialog").getBoundingClientRect().width <= 360.5`), "the small width");
        await page.press("Escape", "Escape", 27);
        await page.waitFor(`!document.querySelector("dialog.dialog[open]")`);
        assert.ok((await page.eval(`document.activeElement.textContent`)).includes("Open small"), "the focus went back to the button");

        await page.clickText("Delete (type to confirm)");
        await page.waitFor(`document.querySelector("dialog.dialog[open] .confirm-input")`);
        await page.clickText("Delete", "dialog.dialog");
        await page.waitFor(`document.querySelector("dialog.dialog .field-error")?.textContent === "The text does not match."`);
        await page.fill("dialog.dialog .confirm-input", "host-00042");
        await page.clickText("Delete", "dialog.dialog");
        await page.waitFor(`!document.querySelector("dialog.dialog[open]") && document.querySelector(".toast-container")?.textContent.includes("Deleted")`);
    }));

    test("the form dialog keeps what the server says: not signed in, then a bad name", { timeout: 240000 }, () => withPage("/dialogs", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Dialogs and feedback"`, { timeout: 90000 });
        await page.clickText("Add a host");
        await page.waitFor(`document.querySelector("dialog.dialog[open] input")`);
        await page.fill("dialog.dialog input", "host-brand-new");
        await page.eval(`document.querySelector("dialog.dialog form").requestSubmit()`);
        await page.waitFor(`document.querySelector("dialog.dialog .form-message")?.textContent.includes("Sign in to add a host")`);
        assert.ok(await page.eval(`Boolean(document.querySelector("dialog.dialog[open]"))`), "the dialog stays open after an error");
        await page.press("Escape", "Escape", 27);
        await page.waitFor(`!document.querySelector("dialog.dialog[open]")`);
        page.problems.length = 0;   // the 401 is on purpose
    }));

    test("tables: a page from the server, a filter, and 100,000 rows that scroll", { timeout: 240000 }, () => withPage("/tables", async page => {
        await page.waitFor(`document.querySelector("#hosts-pages tbody tr td")?.textContent === "1"`, { timeout: 90000 });
        assert.equal(await page.eval(`document.querySelectorAll("#hosts-pages tbody tr").length`), 10, "one page of ten");
        await page.fill("#hosts-pages .athena-table-filter", "freebsd");
        await page.waitFor(`[...document.querySelectorAll("#hosts-pages tbody tr")].length > 0 && [...document.querySelectorAll("#hosts-pages tbody tr")].every(tr => tr.children[2]?.textContent === "FreeBSD")`);
        // the long list: only a window is in the page, and a far away place is asked for
        await page.waitFor(`document.querySelector("#hosts-virtual tbody tr td")?.textContent === "1"`, { timeout: 90000 });
        const rows = await page.eval(`document.querySelectorAll("#hosts-virtual tbody tr").length`);
        assert.ok(rows < 60, `only a window of rows: ${rows}`);
        await page.eval(`(() => { const box = document.querySelector("#hosts-virtual .athena-table-scroll"); box.scrollTop = 34 * 50000; box.dispatchEvent(new Event("scroll")); })()`);
        await page.waitFor(`[...document.querySelectorAll("#hosts-virtual tbody tr td:first-child")].some(td => td.textContent === "50001")`, { timeout: 60000 });
        assert.ok(await page.eval(`document.querySelector("#hosts-virtual .athena-table-scroll").scrollHeight > 34 * 99000`), "the scroll bar is as long as the whole list");
    }));

    test("charts: the live chart grows, zooms with the keyboard and hides a series", { timeout: 240000 }, () => withPage("/charts", async page => {
        await page.waitFor(`document.querySelector("svg .chart-line")`, { timeout: 90000 });
        // The line has its 300 points soon, and then it moves: the newest row of the table of values is a new time every second
        const newest = () => page.eval(`document.querySelector("details.chart-data tbody tr:last-child th")?.textContent`);
        await page.waitFor(`document.querySelector("details.chart-data tbody tr:last-child th")?.textContent`);
        const first = await newest();
        await until(async () => (await newest()) !== first, { timeout: 60000, message: "a new point" });
        await page.eval(`document.querySelector("svg .chart-hit").focus()`);
        await page.press("+", "Equal", 187);
        await page.waitFor(`document.querySelector("svg .chart-reset")`);
        await page.press("0", "Digit0", 48);
        await page.waitFor(`!document.querySelector("svg .chart-reset")`);
        await page.eval(`document.querySelector("svg .chart-legend-item").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
        assert.ok(await page.eval(`document.querySelector("svg .chart-hidden") !== null`), "a series is hidden");
    }));

    test("themes: a theme and a mode are chosen, kept, and applied before the page is drawn on the next visit", { timeout: 240000 }, () => withPage("/themes", async page => {
        await page.waitFor(`document.querySelector(".theme-picker")`, { timeout: 90000 });
        await page.click(`.theme-picker-theme [data-id=ocean]`);
        await page.click(`.theme-picker-mode [data-id=dark]`);
        await page.waitFor(`document.documentElement.dataset.theme === "ocean" && document.documentElement.dataset.mode === "dark"`);
        assert.equal(await page.eval(`getComputedStyle(document.body).backgroundColor`), "rgb(8, 24, 30)", "the dark colours of the ocean theme");
        await page.goto(`${base}/?again#/about`);
        assert.equal(await page.eval(`document.documentElement.dataset.theme + "/" + document.documentElement.dataset.mode`), "ocean/dark", "remembered");
        await page.waitFor(`document.querySelector(".page-title")`);
        await page.eval(`localStorage.clear()`);
    }));

    test("navigation: the menu with groups inside groups works with the keyboard", { timeout: 240000 }, () => withPage("/navigation", async page => {
        await page.waitFor(`document.querySelector("[data-id=reports]")`, { timeout: 90000 });
        await page.eval(`document.querySelector("[data-id=reports]").focus()`);
        await page.press("ArrowDown", "ArrowDown", 40);
        await page.waitFor(`document.activeElement?.dataset.id === "daily"`);
        await page.press("ArrowDown", "ArrowDown", 40);
        await page.press("ArrowDown", "ArrowDown", 40);
        await page.waitFor(`document.activeElement?.dataset.id === "export"`);
        await page.press("ArrowRight", "ArrowRight", 39);
        await page.waitFor(`document.activeElement?.dataset.id === "csv"`);
        await page.press("ArrowLeft", "ArrowLeft", 37);
        await page.waitFor(`document.activeElement?.dataset.id === "export"`);
        await page.press("Escape", "Escape", 27);
        await page.waitFor(`document.querySelector("[data-id=reports]").getAttribute("aria-expanded") === "false"`);
    }));
});
