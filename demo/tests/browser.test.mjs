// The demo in a real browser (headless Chrome / Chromium / Edge), under the strict Content-Security-Policy the server sends.
// One browser for all the tests, driven through the DevTools protocol (cdp.mjs). Every test fails on an exception, a console error or warning,
// a policy violation or a failed request. Skipped when no browser is found (set CHROME_PATH).

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createDemoServer } from "../server.mjs";
import { chromePath, launch, until } from "../../tests/cdp.mjs";

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
        // The tests give real clicks and keys: they run like a person who asked for less motion (a view transition in a browser that draws no frames
        // would keep its overlay over the page). The Motion test switches the motion on again.
        await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
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
        ["/", "Athena UI"], ["/tables", "Tables"], ["/charts", "Charts"], ["/widgets", "Widgets"], ["/board", "Board"], ["/code", "Code"], ["/motion", "Motion"], ["/forms", "Forms"], ["/dialogs", "Dialogs and feedback"], ["/navigation", "Navigation"],
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

describe("no page scrolls sideways", { skip }, () => {
    const routes = ["/", "/tables", "/charts", "/forms", "/dialogs", "/navigation", "/widgets", "/board", "/code", "/motion", "/themes", "/about", "/account"];
    // the last run has a wide font: how wide text is differs from machine to machine, and a page must not depend on it
    for (const [width, font] of [[320, ""], [375, ""], [768, ""], [1440, ""], [320, "monospace"]]) {
        test(`at ${width} px${font ? ` with a ${font} font` : ""}`, { timeout: 240000 }, async () => {
            const wide = [];
            for (const route of routes) {
                await withPage(route, async page => {
                    await page.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
                    await page.waitFor(`document.querySelector(".page-title")`, { timeout: 90000 });
                    if (font) await page.eval(`(() => { const sheet = new CSSStyleSheet(); sheet.replaceSync("*, *::before { font-family: ${font} !important }"); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; })()`);
                    await new Promise(resolve => setTimeout(resolve, 600));
                    const over = await page.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
                    if (over > 0) wide.push(`${route}: ${over}px`);
                });
            }
            assert.deepEqual(wide, []);
        });
    }
});

describe("what a person does", { skip }, () => {
    test("the newer options are on their pages and work", { timeout: 240000 }, async () => {
        await withPage("/charts", async page => {
            await page.waitFor(`[...document.querySelectorAll(".chart-title")].some(title => title.textContent.includes("broken sensor"))`, { timeout: 90000 });
            assert.equal(await page.eval(`[...document.querySelectorAll("svg")].find(svg => svg.textContent.includes("broken sensor")).querySelectorAll("polyline.chart-line").length`), 3, "two gaps, three pieces");
        });
        await withPage("/tables", async page => {
            await page.waitFor(`document.querySelector("#expanding tbody tr")`, { timeout: 90000 });
            await page.eval(`document.querySelector("#expanding [aria-expanded]").click()`);
            await page.waitFor(`document.querySelector("#expanding tbody").textContent.includes("looked after by")`);
            await page.eval(`[...document.querySelectorAll("button")].find(button => button.textContent === "Hide the owner").click()`);
            await page.waitFor(`![...document.querySelectorAll("#expanding thead th")].some(th => th.textContent.includes("Owner"))`);
        });
        await withPage("/forms", async page => {
            await page.waitFor(`document.getElementById("free-text-result")`, { timeout: 90000 });
            await page.eval(`(() => { const input = document.getElementById("free-text-result").parentElement.querySelector("input"); input.scrollIntoView({ block: "center" }); input.focus(); })()`);
            await page.type("mine");
            await page.press("Enter", "Enter", 13);
            await page.waitFor(`document.getElementById("free-text-result").textContent === "Entered: mine"`);
        });
        await withPage("/code", async page => {
            await page.waitFor(`document.querySelector(".athena-jt-hit")?.textContent === "timeout"`, { timeout: 90000 });
        });
        await withPage("/navigation", async page => {
            await page.waitFor(`document.querySelector(".demo-banner .athena-menu")`, { timeout: 90000 });
            assert.equal(await page.eval(`getComputedStyle(document.querySelector(".demo-banner .athena-menu")).color`), "rgb(255, 255, 255)");
        });
    });

    test("widgets: a statistic fits its widget at the default size", { timeout: 240000 }, () => withPage("/widgets", async page => {
        await page.waitFor(`document.querySelectorAll("#dashboard .widget .stat").length === 2`, { timeout: 90000 });
        const over = await page.eval(`[...document.querySelectorAll("#dashboard .widget .stat")].map(stat => stat.parentElement.scrollHeight - stat.parentElement.clientHeight)`);
        assert.deepEqual(over, [0, 0]);
    }));

    test("widgets on a touch screen: every control is at least 44 px, and the corner resizes", { timeout: 240000 }, () => withPage("/widgets", async page => {
        await page.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 800, deviceScaleFactor: 1, mobile: true });
        await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
        await page.waitFor(`document.querySelectorAll("#dashboard .widget").length === 5`, { timeout: 90000 });
        assert.equal(await page.eval(`matchMedia("(pointer: coarse)").matches`), true, "the emulation is a touch screen");
        // not a click at coordinates: while the emulated phone lays the page out again, the fixed tab bar can be where the button was a moment ago
        await page.eval(`[...document.querySelectorAll("#widget-bar button")].find(button => button.textContent === "Edit mode: off").click()`);
        await page.waitFor(`document.getElementById("dashboard").classList.contains("is-editable")`);
        const small = await page.eval(`[...document.querySelectorAll("#dashboard .widget-handle, #dashboard .widget-action, #dashboard .widget-resize")]
            .map(node => ({ name: node.className, box: node.getBoundingClientRect() })).filter(({ box }) => box.width && (box.width < 44 || box.height < 44)).map(({ name, box }) => name + " " + box.width + "x" + box.height)`);
        assert.deepEqual(small, []);
        const shown = await page.eval(`[...document.querySelector('#dashboard [data-widget-id="hosts"]').querySelectorAll(".widget-resize")].filter(node => node.getBoundingClientRect().width).map(node => node.dataset.dir)`);
        assert.deepEqual(shown, ["se"]);
        const outside = await page.eval(`[...document.querySelectorAll("#dashboard .widget")].filter(widget => [...widget.querySelectorAll(".widget-action, .widget-handle")].some(node => node.getBoundingClientRect().right > widget.getBoundingClientRect().right + 1)).map(widget => widget.dataset.widgetId)`);
        assert.deepEqual(outside, [], "no button is cut off");
    }));

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

    test("popovers: the dropdown opens, a real click outside closes it, Esc returns the focus; a tooltip shows on a real hover", { timeout: 240000 }, () => withPage("/navigation", async page => {
        await page.waitFor(`document.querySelector(".dropdown-toggle")`, { timeout: 90000 });
        const open = () => page.eval(`document.querySelector(".dropdown-menu").matches(":popover-open")`);
        await page.clickText("Actions▾");
        await page.waitFor(`document.querySelector(".dropdown-menu").matches(":popover-open")`);
        assert.equal(await page.eval(`document.querySelector(".dropdown-toggle").getAttribute("aria-expanded")`), "true");
        // the menu sits right below the button, in the window
        const place = await page.eval(`(() => { const t = document.querySelector(".dropdown-toggle").getBoundingClientRect(); const m = document.querySelector(".dropdown-menu").getBoundingClientRect(); return { dy: Math.round(m.top - t.bottom), dx: Math.round(m.left - t.left), inside: m.left >= 0 && m.right <= innerWidth && m.bottom <= innerHeight }; })()`);
        assert.ok(place.dy >= 0 && place.dy < 12 && Math.abs(place.dx) < 4 && place.inside, `placed next to the button: ${JSON.stringify(place)}`);
        // a real click somewhere else is a light dismiss
        await page.click(".page-title");
        await page.waitFor(`!document.querySelector(".dropdown-menu").matches(":popover-open")`);
        assert.equal(await page.eval(`document.querySelector(".dropdown-toggle").getAttribute("aria-expanded")`), "false");
        // click the button again: it opens (and the click on the button is not a click outside that closes it at once)
        await page.clickText("Actions▾");
        await page.waitFor(`document.querySelector(".dropdown-menu").matches(":popover-open")`);
        await page.press("ArrowDown", "ArrowDown", 40);
        await page.waitFor(`document.activeElement?.classList.contains("dropdown-item")`);
        await page.press("Escape", "Escape", 27);
        await page.waitFor(`!document.querySelector(".dropdown-menu").matches(":popover-open")`);
        assert.ok(await page.eval(`document.activeElement === document.querySelector(".dropdown-toggle")`), "the focus is back on the button");
        assert.equal(await open(), false);
        // the tooltip: a real mouse over the button
        const box = await page.eval(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.querySelector(".button-text")?.textContent === "Hover or focus me"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
        await page.waitFor(`document.querySelector(".tooltip-text").matches(":popover-open")`);
        assert.ok(await page.eval(`document.querySelector(".tooltip-text").getBoundingClientRect().bottom <= [...document.querySelectorAll("button")].find(x => x.querySelector(".button-text")?.textContent === "Hover or focus me").getBoundingClientRect().top + 1`), "above the button");
        await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
        await page.waitFor(`!document.querySelector(".tooltip-text").matches(":popover-open")`);
    }));

    test("motion: things move when motion is on, stand still when it is off, and the switch is respected by the page change", { timeout: 240000 }, () => withPage("/motion", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Motion"`, { timeout: 90000 });
        // An animation of 200 ms can be over between two looks: count the calls of Element.animate instead
        await page.eval(`(() => { window.__animated = 0; const real = Element.prototype.animate; Element.prototype.animate = function (...args) { window.__animated++; return real.apply(this, args); }; })()`);
        const animated = () => page.eval("window.__animated");
        // Wait for the effect of a click, never read the counter right after it: under load (this test came right after the browser suite) the handler can
        // run a moment after the click was reported, and the old reads of the counter failed there although the page was right.
        const waitAnimated = (calls, more, what) => page.waitFor(`window.__animated - ${calls} >= ${more}`, { timeout: 15000 }).catch(() => assert.fail(what));
        const items = () => page.eval(`document.querySelectorAll(".motion-item").length`);
        // full motion: the choice is on <html>, the tokens follow
        await page.eval(`(() => { const select = document.querySelector("select[name=motion]"); select.value = "full"; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
        await page.waitFor(`document.documentElement.dataset.motion === "full"`);
        assert.match(await page.eval(`document.getElementById("motion-status").textContent`), /off: everything below moves/);
        assert.equal(await page.eval(`getComputedStyle(document.documentElement).getPropertyValue("--athena-duration-base").trim()`), "200ms");
        // a list: shuffled, the rows slide
        let calls = await animated();
        await page.clickText("Add one");                      // a new row fades in, the others slide down
        await waitAnimated(calls, 1, "the list animates");
        calls = await animated();
        // stagger: every chip has its own animation, one after the other
        await page.clickText("Play");
        await waitAnimated(calls, 8, "eight chips, eight animations");
        calls = await animated();
        // a spring, and a tween that counts
        await page.clickText("Move");
        await waitAnimated(calls, 1, "the spring animates");
        const before = await page.eval(`document.querySelector(".stat-value").textContent`);
        await page.clickText("Count");
        await page.waitFor(`document.querySelector(".stat-value").textContent.trim() !== "0" && document.querySelector(".stat-value").textContent !== ${JSON.stringify(before)}`, { timeout: 15000 });
        // a dialog fades: after Close it is still there for a moment, then gone
        await page.clickText("Open a dialog");
        await page.waitFor(`document.querySelector("dialog.dialog[open]")`);
        await page.press("Escape", "Escape", 27);
        await page.waitFor(`!document.querySelector("dialog.dialog[open]")`);
        await page.waitFor(`!document.querySelector("dialog.dialog")`, { timeout: 5000 });
        // a page change is a view transition when motion is on
        await page.eval(`(() => { window.__transitions = 0; const real = document.startViewTransition.bind(document); document.startViewTransition = update => { window.__transitions++; return real(update); }; })()`);
        await page.eval(`location.hash = "#/about"`);
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "About this demo"`);
        assert.ok((await page.eval("window.__transitions")) >= 1, "the page change was a view transition");

        // reduced motion: nothing moves, and the page change is not a view transition
        await page.eval(`location.hash = "#/motion"`);
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Motion"`);
        await page.eval(`(() => { const select = document.querySelector("select[name=motion]"); select.value = "reduce"; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
        await page.waitFor(`document.documentElement.dataset.motion === "reduce"`);
        assert.match(await page.eval(`document.getElementById("motion-status").textContent`), /ON: nothing below moves/);
        assert.equal(await page.eval(`getComputedStyle(document.documentElement).getPropertyValue("--athena-duration-base").trim()`), "0ms");
        // The page change above ran as a view transition (motion was still on). A click at coordinates can hit nothing then: the overlay of the transition
        // takes it, or the page is still being scrolled to the top. That failed on CI (the new row never came). This half is about what moves, not
        // about clicking, so the buttons are pressed themselves. The wait for the new row below proves that the presses did something.
        await page.waitFor(`!document.documentElement.getAnimations({ subtree: true }).some(animation => String(animation.effect?.pseudoElement ?? "").startsWith("::view-transition"))`, { timeout: 15000 });
        const press = text => page.eval(`[...document.querySelectorAll("button")].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
        calls = await animated();
        const rows = await items();
        await press("Add one");
        await page.waitFor(`document.querySelectorAll(".motion-item").length === ${rows + 1}`, { timeout: 15000 });
        await press("Play");
        await press("Move");
        // "nothing moved" can only be asserted once the click has had its effect: the new row is there; then one more turn of the event loop
        await page.eval(`new Promise(resolve => setTimeout(resolve, 0))`);
        assert.equal(await animated(), calls, "reduced: nothing is animated (no call of Element.animate)");
        const count = await page.eval("window.__transitions");
        await page.eval(`location.hash = "#/about"`);
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "About this demo"`);
        assert.equal(await page.eval("window.__transitions"), count, "reduced: no view transition");
    }));

    test("board: a real drag moves a card, the keyboard moves one, a refused move goes back, a column folds, and the other cards keep the focus when one is added", { timeout: 240000 }, () => withPage("/board", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Board"`, { timeout: 90000 });
        await page.waitFor(`document.querySelectorAll("#board .board-card").length === 6`);
        const lane = id => page.eval(`[...document.querySelectorAll('#board .board-cards[data-column-id="${id}"] .board-card')].map(card => card.dataset.cardId).join()`);
        assert.equal(await lane("todo"), "T-1,T-2,T-3");
        // a real mouse drag of T-1 by its body into the Doing column (about two columns to the right)
        const columnWidth = await page.eval(`document.querySelector('#board .board-column').getBoundingClientRect().width + 16`);
        await page.drag('#board [data-card-id="T-1"]', columnWidth, 10);
        await page.waitFor(`document.querySelectorAll("#board .board-card.is-pending").length === 0`, { timeout: 10000 });
        assert.ok((await lane("doing")).includes("T-1"), `T-1 is in Doing: ${await lane("doing")}`);
        assert.equal(await page.eval(`document.querySelectorAll(".board-card.is-ghost, .board-placeholder").length`), 0, "no ghost and no placeholder are left");
        assert.ok((await page.eval(`document.getElementById("board-log").textContent`)).includes("T-1: todo 1 to doing"), "the application was told");
        // the keyboard: focus T-2, Space picks it up, ArrowRight moves it to Doing, Enter drops it
        await page.eval(`document.querySelector('#board [data-card-id="T-2"]').focus()`);
        await page.press(" ", "Space", 32);
        await page.waitFor(`document.querySelector('#board [data-card-id="T-2"]').classList.contains("is-picked")`);
        await page.press("ArrowRight", "ArrowRight", 39);
        await page.press("Enter", "Enter", 13);
        await page.waitFor(`!document.querySelector('#board [data-card-id="T-2"]').classList.contains("is-picked")`);
        await page.waitFor(`document.querySelectorAll("#board .board-card.is-pending").length === 0`, { timeout: 10000 });
        assert.ok((await lane("doing")).includes("T-2"), `T-2 moved by the keyboard: ${await lane("doing")}`);
        assert.equal(await page.eval(`document.activeElement.dataset.cardId`), "T-2", "the focus stays on the card that moved");
        // a refused move: T-3 (needs a review) to Done: three columns to the right with the keyboard; the server says no after half a second
        await page.eval(`document.querySelector('#board [data-card-id="T-3"]').focus()`);
        await page.press(" ", "Space", 32);
        for (let i = 0; i < 3; i++) await page.press("ArrowRight", "ArrowRight", 39);
        await page.press("Enter", "Enter", 13);
        await page.waitFor(`document.getElementById("board-log").textContent.includes("T-3: the server refused")`, { timeout: 10000 });
        await page.waitFor(`document.querySelectorAll("#board .board-card.is-pending").length === 0`, { timeout: 10000 });
        assert.equal(await lane("todo"), "T-3", "the refused card is back in To do");
        assert.ok((await page.eval(`document.querySelector("#board").nextElementSibling.textContent`)).includes("could not be moved"), "and a screen reader is told");
        // folding a column
        await page.eval(`document.querySelector('#board .board-column[data-column-id="done"] .board-fold').click()`);
        assert.equal(await page.eval(`document.querySelector('#board .board-cards[data-column-id="done"]').hidden`), true);
        // adding a card keeps the elements and the focus of the others
        // (the button is pressed from the script: a real click would move the focus to the button itself)
        await page.eval(`document.querySelector('#board [data-card-id="T-3"]').focus(); window.__kept = document.querySelector('#board [data-card-id="T-3"]'); [...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Add card").click()`);
        await page.waitFor(`document.querySelectorAll("#board .board-card").length === 7`);
        assert.equal(await page.eval(`window.__kept === document.querySelector('#board [data-card-id="T-3"]') && document.activeElement === window.__kept`), true, "the same element, still focused");
    }));

    test("widgets: a real drag moves a widget, a real resize changes its size, the layout is saved and survives a reload", { timeout: 240000 }, () => withPage("/widgets", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Widgets"`, { timeout: 90000 });
        await page.waitFor(`document.querySelectorAll("#dashboard .widget").length === 5`);
        await page.waitFor(`document.querySelector('#dashboard [data-widget-id="hosts"] .stat')`, { timeout: 30000 });
        const column = id => page.eval(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="${id}"]')).gridColumnStart`);
        const span = id => page.eval(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="${id}"]')).gridColumnEnd`);
        const stride = await page.eval(`(() => { const columns = getComputedStyle(document.getElementById("dashboard")).gridTemplateColumns.split(" "); return parseFloat(columns[0]) + 12; })()`);
        assert.equal(await page.eval(`getComputedStyle(document.querySelector('#dashboard .widget-handle')).display`), "none", "no handles until edit mode");
        await page.clickText("Edit mode: off");
        await page.waitFor(`document.getElementById("dashboard").classList.contains("is-editable")`);
        assert.equal(await column("hosts"), "1");
        // a real drag by the handle, one column to the right
        await page.drag('#dashboard [data-widget-id="hosts"] .widget-handle', stride + 4, 0);
        await page.waitFor(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="hosts"]')).gridColumnStart === "2"`);
        // a real resize by the south-east corner, one column wider
        const before = await span("hosts");
        await page.drag('#dashboard [data-widget-id="hosts"] .widget-resize-se', stride + 4, 0);
        await page.waitFor(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="hosts"]')).gridColumnEnd !== ${JSON.stringify(before)}`);
        // saved
        const saved = JSON.parse(await page.eval(`localStorage.getItem("athena-demo-dashboard")`));
        assert.equal(saved.version, 1);
        const hosts = saved.widgets.find(widget => widget.id === "hosts");
        const place = Object.values(hosts.layouts)[0];
        assert.equal(place.x, 1);
        assert.equal(place.w, 4);
        // undo is a button; it puts the size back
        await page.clickText("Undo");
        await page.waitFor(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="hosts"]')).gridColumnEnd === ${JSON.stringify(before)}`);
        await page.clickText("Redo");
        await page.waitFor(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="hosts"]')).gridColumnEnd !== ${JSON.stringify(before)}`);
        // adding a widget with the button
        await page.clickText("Add clock");
        await page.waitFor(`document.querySelectorAll("#dashboard .widget").length === 6`);
        // keyboard: the handle of a widget, Space, ArrowDown ... Enter
        await page.eval(`document.querySelector('#dashboard [data-widget-id="alerts"] .widget-handle').focus()`);
        await page.press(" ", "Space", 32);
        await page.waitFor(`document.querySelector('#dashboard [data-widget-id="alerts"] .widget-handle').getAttribute("aria-pressed") === "true"`);
        await page.press("Escape", "Escape", 27);
        await page.waitFor(`!document.querySelector('#dashboard [data-widget-id="alerts"] .widget-handle').hasAttribute("aria-pressed")`);
        // a locked widget has no handle
        assert.equal(await page.eval(`getComputedStyle(document.querySelector('#dashboard [data-widget-id="pinned"] .widget-handle')).display`), "none");
        // the layout comes back after a reload
        await page.eval(`location.reload()`);
        await page.waitFor(`document.querySelectorAll("#dashboard .widget").length === 6`, { timeout: 90000 });
        assert.equal(await column("hosts"), "2");
    }));

    test("widgets: a widget is dragged from the gallery onto the dashboard with a real mouse", { timeout: 240000 }, () => withPage("/widgets", async page => {
        await page.waitFor(`document.querySelectorAll("#dashboard .widget").length === 5`, { timeout: 90000 });
        await page.waitFor(`document.querySelector("#widget-gallery button")`);
        const [dx, dy] = await page.eval(`(() => { document.getElementById("widget-gallery").scrollIntoView(); const from = document.querySelector('#widget-gallery [data-widget-type="clock"]').getBoundingClientRect(); const to = document.getElementById("dashboard").getBoundingClientRect(); return [to.left + to.width / 2 - (from.left + from.width / 2), to.top + 40 - (from.top + from.height / 2)]; })()`);
        await page.drag('#widget-gallery [data-widget-type="clock"]', dx, dy);
        await page.waitFor(`document.querySelectorAll("#dashboard .widget").length === 6`);
        await new Promise(resolve => setTimeout(resolve, 300));
        assert.equal(await page.eval(`document.querySelectorAll("#dashboard .widget").length`), 6, "one widget, not two");
        assert.equal(await page.eval(`document.querySelector("#dashboard .widget-placeholder")`), null);
    }));

    test("code: real typing in the editor closes brackets and keeps indentation, Tab indents and Escape then Tab leaves, undo works, locked lines refuse", { timeout: 240000 }, () => withPage("/code", async page => {
        await page.waitFor(`document.querySelector(".page-title")?.textContent === "Code"`, { timeout: 90000 });
        await page.waitFor(`document.querySelector("#code-editor textarea") && document.querySelectorAll("#code-editor .code-line").length > 5`, { timeout: 30000 });
        const value = () => page.eval(`document.querySelector("#code-editor textarea").value`);
        // blocks: the language picker redraws the block, the text of a comment stays text
        await page.eval(`(() => { const select = document.querySelector("select[name=language]"); select.value = "html"; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
        await page.waitFor(`document.querySelector("#code-shown .code-block-language")?.textContent === "HTML"`);
        assert.equal(await page.eval(`document.querySelectorAll("#code-shown .tok-tag").length > 0`), true);
        // go to the end of the text (a real click in the editor, then Ctrl+End) and type
        await page.click("#code-editor .code-editor-input");
        await page.press("End", "End", 35, 2);
        const before = await value();
        await page.type("foo(");
        assert.equal((await value()).slice(before.length), "foo()", "the bracket was closed by a real key press");
        await page.type("1");
        await page.press("Enter", "Enter", 13);
        assert.match((await value()).slice(before.length), /foo\(1\)?\n/, "Enter in the middle of a line breaks it");
        // Ctrl+Z takes back the last step, then Ctrl+Z again takes back the typing
        await page.press("z", "KeyZ", 90, 2);
        await page.press("z", "KeyZ", 90, 2);
        assert.ok((await value()).length < before.length + 8, "undo took steps back: " + JSON.stringify((await value()).slice(before.length)));
        // a line that is locked cannot be typed in: put the caret in line 1 and type
        await page.eval(`document.querySelector("#code-editor textarea").setSelectionRange(5, 5)`);
        const locked = await value();
        await page.type("zzz");
        assert.equal((await value()).split("\n")[0], locked.split("\n")[0], "the locked first line did not change");
        // Escape, then Tab, leaves the editor; a Tab without the Escape does not
        await page.eval(`document.querySelector("#code-editor textarea").setSelectionRange(document.querySelector("#code-editor textarea").value.length, document.querySelector("#code-editor textarea").value.length)`);
        await page.press("Tab", "Tab", 9);
        assert.equal(await page.eval(`document.activeElement === document.querySelector("#code-editor textarea")`), true, "Tab stays in the editor");
        await page.press("Escape", "Escape", 27);
        await page.press("Tab", "Tab", 9);
        assert.equal(await page.eval(`document.activeElement !== document.querySelector("#code-editor textarea")`), true, "Escape, then Tab, goes on to the next control");
        // find with a real Ctrl+F
        await page.click("#code-editor .code-editor-input");
        await page.press("f", "KeyF", 70, 2);
        await page.waitFor(`document.querySelector("#code-editor .code-find:not([hidden])")`);
        assert.equal(await page.eval(`document.activeElement.name`), "find");
        // the diff view
        await page.clickText("Split");
        await page.waitFor(`document.querySelector(".code-diff")?.dataset.mode === "split"`);
        assert.equal(await page.eval(`document.querySelectorAll(".code-diff-cell.is-added").length > 0`), true);
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
