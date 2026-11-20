// Browser tests for Athena UI. Run with `npm run test:browser` (see run.mjs).

const results = [];
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (condition, message = "assertion failed") => {
    if (!condition) throw new Error(message);
};
const equal = (actual, expected, message = "") => {
    if (actual !== expected) throw new Error(`${message} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`.trim());
};
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
// Waits for two animation frames (a scroll event, then the handler's frame); the timer is a fallback.
const frame = () => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
    setTimeout(resolve, 500);
});
// What the browser sends to a modal <dialog> when Esc is pressed
const escape = dialog => dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
const key = (node, name, extra = {}) => node.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...extra }));
const type = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
};
const pointer = (node, name, clientX) => node.dispatchEvent(new PointerEvent(name, { clientX, pointerId: 1, bubbles: true, cancelable: true }));
const $1 = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// The page runs under a strict Content-Security-Policy (see run.mjs). Every violation the browser reports is attributed to the test that was running.
const violations = [];
// These tests feed the sanitizer markup that is hostile on purpose (onclick and onerror attributes, a style attribute, a <style> element). The sanitizer
// reads it in an inert document and none of it runs or reaches the page, but Chrome still reports the inline handler or style it meets while parsing.
// Only those three kinds of report are let through, and only for these tests.
const INERT_PARSE_REPORT = /^(script-src-attr|style-src-attr|style-src-elem)/;
const HOSTILE_INPUT = new Set(["wysiwyg: source view round trips and sanitizes", "rich text: unsafe markup never survives", "rich text: paste is sanitized, empty content reads as empty"]);
document.addEventListener("securitypolicyviolation", event => violations.push(`${event.violatedDirective} blocked ${event.blockedURI || "inline"} ${event.sample ?? ""}`.trim()));

window.addEventListener("error", event => results.push(`FAIL uncaught error: ${event.message}`));
window.addEventListener("unhandledrejection", event => results.push(`FAIL unhandled rejection: ${event.reason}`));

const A = await import("../../src/athena-ui.js");
A.setMotion("reduce");     // no motion in the tests: a dialog that fades out would still be in the page for a moment. The motion tests turn it on.
const navCalls = [];
const submitted = [];
await A.init({
    theme: { id: 0 },
    config: { registration_enabled: true, login_enabled: true, login_remember_me: true },
    menuItems: {
        headerMenu: [
            { id: "menu-plain", class: "menu-item", text: "", inner_text: "Plain" },
            { id: "menu-more", class: "menu-item", text: "", inner_text: "More", children: [{ inner_text: "Sub A" }, { inner_text: "Sub B", disabled: true }, { inner_text: "Sub C" }] }
        ],
        footerMenu: []
    },
    nav: name => { if (typeof name === "string") navCalls.push(name); },
    register: data => submitted.push(data),
    login: data => submitted.push(data)
});

async function reset() {
    A.clearWrapper();
    $$(".toast-container, dialog.dialog, #myModal").forEach(node => node.remove());
    document.body.focus();
}

/* ------------------API------------------- */

test("importing the ES module has no side effects: nothing on globalThis", () => {
    for (const name of ["generateTable", "generateChart", "showDialog", "HTMLControlGenerator", "AthenaUI", "Cookies", "el"]) {
        assert(!(name in globalThis), `${name} was put on globalThis`);
    }
});

test("every entry point loads and exports what it says", async () => {
    const expected = {
        table: "generateTable", chart: "generateChart", dialog: "showFormDialog", menu: "generateMenu", navigation: "generateDropdown", forms: "generateSignInForm",
        widgets: "createWidgetGrid", code: "createCodeEditor", feedback: "showToast", components: "generatePageHeader", inputs: "generateDateTimeRange", router: "createRouter", session: "createAuthState", theme: "createThemeManager",
        i18n: "translate", format: "formatDuration", validation: "validateValue", sanitize: "sanitizeHtml", csv: "toCsv", dom: "createSafeBuilder", controls: "HTMLControlGenerator"
    };
    for (const [entry, name] of Object.entries(expected)) {
        const module = await import(`../../src/${entry}.js`);
        assert(typeof module[name] === "function", `${entry}.js does not export ${name}`);
        assert(module[name] === A[name], `${entry}.js and athena-ui.js export different ${name}`);
    }
    assert(typeof (await import("../../src/session.js")).Cookies?.get === "function", "session.js exports Cookies");
});

test("every public function is exported and global (classic build)", async () => {
    await import("../../src/classic.js");
    const names = ["generateForm", "generateButton", "generateField", "showToast", "confirmDialog", "generateTabs", "createRouter",
        "generateAutocomplete", "generateMultiSelect", "generateFileUpload", "generateStepper", "generateDateRange", "generateRichText",
        "createRichText", "generateWysiwyg", "createWysiwyg", "generateDropZone", "createDropZone", "sanitizeHtml", "setSession", "translate", "toCsv", "setTheme", "generateChangePasswordForm", "generateTable", "generateChart", "HTMLElementGenerator", "HTMLControlGenerator", "registerHungarianInputControls"];
    for (const name of names) assert(typeof A[name] === "function" && typeof globalThis[name] === "function", `${name} missing`);
});

/* ------------------FORM BUILDER------------------- */

test("form: validation blocks the submit and focuses the first invalid field", async () => {
    const calls = [];
    const form = A.generateForm({ parent: "wrapper", fields: [{ name: "name", label: "Name", required: true, minLength: 2 }], onSubmit: v => calls.push(v) });
    form.element.requestSubmit();
    await tick();
    equal(calls.length, 0);
    assert($1(".field-error", form.fields.name.element).textContent.includes("required"));
    equal(document.activeElement, $1("input", form.fields.name.element));
    equal($1("input", form.fields.name.element).getAttribute("aria-invalid"), "true");
});

test("form: every field type reads and writes its value", async () => {
    const calls = [];
    const form = A.generateForm({
        parent: "wrapper",
        fields: [
            { name: "name", required: true }, { name: "pw", type: "password", required: true },
            { name: "pw2", type: "password", match: "pw" }, { name: "age", type: "number", min: 18 },
            { name: "bio", type: "textarea" }, { name: "c", type: "select", options: ["a", "b"], placeholder: "pick", required: true },
            { name: "plan", type: "radio", options: ["x", "y"], value: "x" }, { name: "tags", type: "checkboxes", options: ["t1", "t2"] },
            { name: "on", type: "switch", value: true }, { name: "terms", type: "checkbox", required: true },
            { name: "multi", type: "multiselect", options: ["m1", "m2"] }, { name: "auto", type: "autocomplete", options: ["Alpha", "Beta"] },
            { name: "period", type: "daterange" }, { name: "notes", type: "richtext" }
        ],
        onSubmit: v => calls.push(v)
    });
    form.setValues({ name: "Al", pw: "secret", pw2: "different", age: 20, c: "b", terms: true });
    form.element.requestSubmit();
    await tick();
    assert(calls.length === 0 && $1(".field-error", form.fields.pw2.element).textContent.includes("do not match"), "match rule");
    form.setValues({ pw2: "secret", tags: ["t2"], multi: ["m1"], auto: "Beta", period: { from: "2026-01-01", to: "2026-01-31" }, notes: "<p>Hello <b>there</b></p>" });
    form.element.requestSubmit();
    await tick(20);
    const v = calls[0];
    assert(v, "not submitted");
    assert(v.name === "Al" && v.age === 20 && v.c === "b" && v.plan === "x" && v.on === true && v.terms === true, "basic values");
    equal(JSON.stringify(v.tags), '["t2"]');
    equal(JSON.stringify(v.multi), '["m1"]');
    equal(v.auto, "Beta");
    equal(JSON.stringify(v.period), '{"from":"2026-01-01","to":"2026-01-31"}');
    equal(v.notes, "<p>Hello <strong>there</strong></p>");
});

test("form: a rejected onSubmit shows a message and releases the button", async () => {
    const form = A.generateForm({ parent: "wrapper", fields: [{ name: "a" }], onSubmit: async () => { throw new Error("Server said no"); } });
    form.element.requestSubmit();
    await tick(20);
    equal($1(".form-message", form.element).textContent, "Server said no");
    assert(!form.submitButton.element.disabled, "button stuck");
    form.setErrors({ a: "Taken" });
    equal($1(".field-error", form.fields.a.element).textContent, "Taken");
});

test("form: daterange and richtext fields validate", async () => {
    const form = A.generateForm({ parent: "wrapper", fields: [{ name: "period", type: "daterange", required: true }, { name: "notes", type: "richtext", required: true }], onSubmit: () => {} });
    form.setValues({ period: { from: "2026-01-01", to: "" } });
    const errors = form.validate();
    assert(errors.period?.includes("required"), "half a range counts as empty");
    assert(errors.notes?.includes("required"), "empty rich text is required");
    form.setValues({ period: { from: "2026-02-01", to: "2026-01-01" } });
    assert(form.validate().period?.includes("must not be before"), "reversed range");
});

test("button: loading blocks clicks", () => {
    let clicks = 0;
    const button = A.generateButton({ parent: "wrapper", text: "Go", onclick: () => clicks++ });
    button.element.click();
    button.setLoading(true);
    button.element.click();
    button.setLoading(false);
    button.element.click();
    equal(clicks, 2);
    assert(!$1(".spinner", button.element), "spinner left behind");
});

/* ------------------FEEDBACK AND DIALOGS------------------- */

test("toast, alert, progress", () => {
    const toast = A.showToast({ message: "hi", type: "error", duration: 0 });
    equal($1(".toast").getAttribute("role"), "alert");
    toast.close();
    assert(!$1(".toast"), "toast not closed");
    const progress = A.generateProgress({ parent: "wrapper", value: 50 });
    equal($1("[role=progressbar]", progress.element).getAttribute("aria-valuenow"), "50");
    progress.setValue(250);
    equal($1(".progress-fill", progress.element).style.width, "100%");
});

test("dialogs: confirm, Esc, prompt validation, backdrop semantics", async () => {
    let promise = A.confirmDialog("Sure?", { title: "T" });
    await tick();
    assert($1(".dialog").contains(document.activeElement), "focus not inside");
    assert($1(".dialog").matches(":modal"), "not a modal dialog");
    escape($1(".dialog"));
    equal(await promise, false);
    promise = A.confirmDialog("Sure?");
    await tick();
    $1(".dialog-footer button:last-child").click();
    equal(await promise, true);
    promise = A.promptDialog("Name?", { validate: value => (value ? "" : "need") });
    await tick();
    $1(".dialog-footer button:last-child").click();
    await tick();
    equal($1(".dialog .field-error").textContent, "need");
    $1(".dialog input").value = "Zed";
    $1(".dialog-footer button:last-child").click();
    equal(await promise, "Zed");
});

test("dialogs: size, class, handle and no inline style", async () => {
    const promise = A.showDialog({ title: "Wide", content: "x", size: "large", class: "mine" });
    assert(promise.element.classList.contains("dialog-large") && promise.element.classList.contains("mine"), "classes missing");
    equal(promise.element.tagName, "DIALOG");
    assert(promise.element.open && promise.element.matches(":modal"), "opened as a modal dialog (top layer)");
    assert(!promise.element.hasAttribute("style"), "the dialog has an inline style");
    assert(promise.element.getBoundingClientRect().width > 480, "large dialog is not wider than 480px");
    promise.close("done");
    equal(await promise, "done");
    assert(!$1("dialog.dialog"), "dialog still open");
});

test("dropdown: icon only with an aria-label, caret and toggle class", () => {
    const dropdown = A.generateDropdown({ parent: "wrapper", icon: "⋮", ariaLabel: "More", toggleClass: "mine", caret: true, items: [{ label: "A" }] });
    const button = $1(".dropdown-toggle", dropdown.element);
    equal(button.getAttribute("aria-label"), "More");
    assert(button.classList.contains("mine") && button.classList.contains("dropdown-icon-only"), "classes missing");
    equal($1(".dropdown-caret", button).getAttribute("aria-hidden"), "true");
});

test("table: cell and row classes, focusable rows, render nodes, one page hides the pager", () => {
    const opened = [];
    const table = A.generateTable({
        parent: "wrapper", id: "hooks", pageSize: 5, focusableRows: true, density: "compact", rowLabel: row => `Row ${row.n}`,
        cellClass: (row, col) => (col.key === "n" && row.n > 1 ? "big" : null),
        rowClass: row => (row.n === 1 ? ["first", "x"] : null),
        onRowClick: row => opened.push(row.n),
        columns: [{ key: "n", align: "right" }, { key: "t", render: row => { const b = document.createElement("b"); b.textContent = row.t; return b; } }],
        rows: [{ n: 1, t: "<i>a</i>" }, { n: 2, t: "b" }]
    });
    const rows = $$("tbody tr", table.element);
    assert(rows[0].classList.contains("first") && rows[0].classList.contains("x"), "rowClass");
    assert(!rows[1].classList.contains("first"), "rowClass leaked");
    assert($$("td", rows[1])[0].classList.contains("big") && !$$("td", rows[0])[0].classList.contains("big"), "cellClass");
    assert($$("td", rows[0])[0].classList.contains("athena-align-right"), "align");
    equal($1("td b", rows[0]).textContent, "<i>a</i>");
    equal(rows[0].getAttribute("aria-label"), "Row 1");
    equal(rows[0].tabIndex, 0);
    key(rows[1], "Enter");
    key(rows[0], " ");
    equal(opened.join(), "2,1");
    assert($1(".athena-table-pager", table.element).hidden, "pager should be hidden for one page");
    assert($1("table", table.element).classList.contains("athena-table-compact"), "density");
});

test("table: virtual list that starts empty fills the window when it gets rows and room", async () => {
    const table = A.generateTable({ parent: "wrapper", id: "empty-first", columns: [{ key: "id" }], virtual: { height: 300, rowHeight: 30 }, rows: [] });
    table.setRows(Array.from({ length: 500 }, (_, i) => ({ id: i })));
    const count = () => $$("tbody tr:not(.athena-table-spacer)", table.element).length;
    for (let i = 0; i < 40 && count() < 10; i++) await tick(50);
    assert(count() >= 10, "window too small: " + count());
});

test("handles: parent as element, id or selector; update and destroy", () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="slot-a" class="slot"><span class="inner"></span></div><div id="slot-b"></div>');
    const byId = A.generateStat({ parent: "slot-b", label: "L", value: 1 });
    const bySelector = A.generateStat({ parent: "#slot-a > .inner", label: "L", value: 2 });
    const byElement = A.generateStat({ parent: $1("#slot-b"), label: "L", value: 3 });
    assert($1("#slot-b").contains(byId.element) && $1("#slot-b").contains(byElement.element), "id / element parent");
    assert($1("#slot-a .inner").contains(bySelector.element), "selector parent");
    bySelector.update({ value: 9 });
    equal($1(".stat-value", bySelector.element).textContent, "9");
    const chart = A.generateChart({ parent: "#slot-a", type: "bar", labels: ["a"], series: [{ data: [1] }] });
    assert($1("#slot-a").contains(chart.element), "chart in selector parent");
    chart.update({ series: [{ data: [5] }] });
    assert($1("#slot-a svg") && $$("#slot-a svg").length === 1, "chart updated in place");
    const tabs = A.generateTabs({ parent: $1("#slot-b"), tabs: [{ id: "t", label: "T", content: "x" }] });
    tabs.destroy();
    assert(!$1("#slot-b .tab-list"), "destroy removes the element");
    A.generateTable({ parent: "#slot-b", id: "sel-table", columns: [{ key: "a" }], rows: [{ a: 1 }] }).destroy();
    assert(!$1("#sel-table"), "table destroy");
});

test("showConfirm: danger style and typeToConfirm", async () => {
    let promise = A.showConfirm({ title: "Delete", message: "Really?", confirmText: "Delete", danger: true, typeToConfirm: "prod" });
    await tick();
    const confirm = $1(".dialog-footer button:last-child");
    assert(confirm.classList.contains("button-danger"), "danger style");
    assert($1(".dialog .confirm-input").matches(":focus") || $1(".dialog").contains(document.activeElement), "focus in the dialog");
    confirm.click();
    await tick();
    equal($1(".dialog .field-error").textContent, "The text does not match.");
    $1(".dialog .confirm-input").value = "prod";
    confirm.click();
    equal(await promise, true);
    promise = A.showConfirm({ message: "Sure?" });
    await tick();
    escape($1(".dialog"));
    equal(await promise, false);
});

test("showFormDialog: a failed save keeps the dialog open, field errors, then it closes", async () => {
    let calls = 0;
    const dialog = A.showFormDialog({
        title: "Add", intro: "Name it", size: "small", submitText: "Add",
        fields: [{ name: "name", label: "Name", required: true }],
        onSubmit: (values, form) => {
            calls++;
            if (calls === 1) throw new Error("Server said no");
            if (calls === 2) { form.setErrors({ name: "Already taken" }); throw new Error("Fix the name"); }
        }
    });
    assert(dialog.element.classList.contains("dialog-small"), "size");
    equal($1(".dialog-intro", dialog.element).textContent, "Name it");
    const input = $1("input[name=name], input", dialog.form.fields.name.element);
    input.value = "x";
    dialog.form.element.requestSubmit();
    for (let i = 0; i < 40 && !$1(".form-message", dialog.element).textContent; i++) await tick(25);
    equal($1(".form-message", dialog.element).textContent, "Server said no");
    assert($1(".dialog"), "dialog closed after an error");
    dialog.form.element.requestSubmit();
    for (let i = 0; i < 40 && calls < 2; i++) await tick(25);
    await tick(50);
    equal($1(".field-error", dialog.form.fields.name.element).textContent, "Already taken");
    assert($1(".dialog"), "dialog closed after an error 2");
    input.value = "y";
    dialog.form.element.requestSubmit();
    equal(await dialog, true);
    assert(!$1(".dialog"), "dialog still open after a save");
    const cancelled = A.showFormDialog({ fields: [{ name: "a" }], onSubmit() {} });
    $1(".form-actions button[type=button]", cancelled.element).click();
    equal(await cancelled, false);
});

test("theme picker: choosing a theme and a mode sets the attributes, previews follow", () => {
    const root = document.documentElement;
    const saved = { theme: root.dataset.theme, mode: root.dataset.mode };
    const manager = A.createThemeManager({ themes: [{ id: "ocean", name: "Ocean", description: "Blue" }, { id: "forest", name: "Forest" }], storageKey: "athena.test.appearance" });
    const picker = A.generateThemePicker({ parent: "wrapper", manager });
    const radio = value => $1(`input[value=${value}]`, picker.element);
    assert(radio("ocean").checked && radio("system").checked, "defaults checked");
    radio("forest").click();
    equal(root.dataset.theme, "forest");
    radio("dark").click();
    equal(root.dataset.mode, "dark");
    equal($1(".theme-preview", picker.element).dataset.mode, "dark");
    equal($1(".theme-preview", picker.element).dataset.theme, "ocean");
    equal($$(".theme-picker-option", picker.element).length, 5);
    picker.destroy();
    manager.destroy();
    localStorage.removeItem("athena.test.appearance");
    root.dataset.theme = saved.theme ?? "";
    root.dataset.mode = saved.mode ?? "";
    if (!saved.theme) delete root.dataset.theme;
    if (!saved.mode) delete root.dataset.mode;
});

test("table: data source with pages, sort, filter, errors and row actions", async () => {
    const all = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: i % 2 ? "odd " + (i + 1) : "even " + (i + 1) }));
    const calls = [];
    let fail = false;
    const removed = [];
    const table = A.generateTable({
        parent: "wrapper", id: "remote", pageSize: 10, filter: true, filterDelay: 10,
        columns: [{ key: "id" }, { key: "name" }],
        rowActions: [{ label: "Delete", danger: true, onclick: row => removed.push(row.id), ariaLabel: row => "Delete " + row.id }, { label: "Never", onclick() {}, hidden: row => row.id > 0 }],
        dataSource: async query => {
            calls.push(JSON.stringify(query));
            if (fail) throw new Error("Server down");
            let rows = all.filter(r => r.name.includes(query.filter));
            if (query.sort) rows = [...rows].sort((a, b) => (a[query.sort.key] > b[query.sort.key] ? 1 : -1) * (query.sort.descending ? -1 : 1));
            return { rows: rows.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize), total: rows.length };
        }
    });
    const rowsOf = () => $$("#remote tbody tr");
    const until = async check => { for (let i = 0; i < 60 && !check(); i++) await tick(25); assert(check(), "timed out: " + calls.join(" | ")); };
    assert(table.element.hasAttribute("aria-busy") || rowsOf().length, "loading or loaded");
    await until(() => rowsOf().length === 10 && !table.element.hasAttribute("aria-busy"));
    equal($1("td", rowsOf()[0]).textContent, "1");
    equal($$("td button", rowsOf()[0]).length, 1);
    equal($1("td button", rowsOf()[0]).getAttribute("aria-label"), "Delete 1");
    $1("td button", rowsOf()[2]).click();
    equal(removed.join(), "3");
    assert(!$1("#remote .athena-table-pager").hidden, "pager visible for 5 pages");
    $$("#remote .athena-table-pager button")[1].click();
    await until(() => $1("td", rowsOf()[0]).textContent === "11");
    $$("#remote thead th.sortable")[0].click();
    await until(() => JSON.parse(calls.at(-1)).sort?.key === "id" && JSON.parse(calls.at(-1)).page === 0);
    $$("#remote thead th.sortable")[0].click();
    await until(() => $1("td", rowsOf()[0]).textContent === "45");   // descending by id
    type($1("#remote .athena-table-filter"), "odd");
    await until(() => JSON.parse(calls.at(-1)).filter === "odd" && !table.element.hasAttribute("aria-busy"));
    equal(rowsOf().length, 10);
    type($1("#remote .athena-table-filter"), "zzz");
    await until(() => rowsOf().length === 1 && $1("td", rowsOf()[0]).classList.contains("athena-table-empty"));
    assert($1("#remote .athena-table-pager").hidden, "pager hidden when empty");
    fail = true;
    await table.reload();
    await until(() => $1("#remote .athena-table-error"));
    equal($1("#remote .athena-table-error").textContent.startsWith("Server down"), true);
    fail = false;
    $1("#remote .athena-table-error button").click();
    await until(() => $1("#remote .athena-table-empty"));
});

test("table: data source with a cursor appends rows", async () => {
    const cursors = [];
    A.generateTable({
        parent: "wrapper", id: "cursor", pageSize: 3, columns: [{ key: "n" }],
        dataSource: async ({ cursor }) => {
            cursors.push(cursor);
            const start = cursor ?? 0;
            return { rows: [start, start + 1, start + 2].map(n => ({ n })), nextCursor: start + 3 < 9 ? start + 3 : null };
        }
    });
    const count = () => $$("#cursor tbody tr").length;
    for (let i = 0; i < 60 && count() < 3; i++) await tick(25);
    equal(count(), 3);
    $1("#cursor .athena-table-pager button").click();
    for (let i = 0; i < 60 && count() < 6; i++) await tick(25);
    equal(count(), 6);
    $1("#cursor .athena-table-pager button").click();
    for (let i = 0; i < 60 && count() < 9; i++) await tick(25);
    equal(count(), 9);
    assert($1("#cursor .athena-table-pager").hidden, "no more to load");
    equal(cursors.join(), ",3,6");
});

test("charts: types, theme colours, tooltip, legend toggle, time axis, table of values, no inline style", async () => {
    const host = document.getElementById("wrapper");
    host.insertAdjacentHTML("beforeend", '<div id="charts"></div>');
    const common = { parent: "charts", labels: ["a", "b", "c"], series: [{ name: "One", data: [1, 5, 3] }, { name: "Two", data: [2, 2, 8] }] };
    for (const type of ["bar", "line", "area", "pie", "donut"]) {
        const chart = A.generateChart({ ...common, type, title: type, id: "c-" + type });
        assert(chart.matches("svg.athena-chart"), type + " svg");
        equal(chart.getAttribute("role"), "img");
        assert(chart.getAttribute("aria-label").length > 0, "aria-label");
        equal(chart.querySelectorAll("[style]").length, 0, type + " has an inline style");
        assert(chart.querySelector(".s1"), type + " uses series classes");
    }
    // theme colours: a series colour comes from --series-N
    document.documentElement.style.setProperty("--series-1", "rgb(1, 2, 3)");
    equal(getComputedStyle($1("#c-bar .chart-bar.s1")).fill, "rgb(1, 2, 3)");
    document.documentElement.style.removeProperty("--series-1");
    // area draws a path under the line
    assert($1("#c-area .chart-area") && $1("#c-line .chart-area") === null, "area only in the area chart");
    // tooltip on focus and hover, named points
    const point = $1("#c-line .chart-point");
    equal(point.getAttribute("tabindex"), "0");
    assert(point.getAttribute("aria-label").includes("One"), "point name");
    point.dispatchEvent(new Event("focus"));
    assert($1("#c-line .chart-tooltip").classList.contains("is-visible"), "tooltip shown");
    assert($1("#c-line .chart-tooltip-text").textContent.includes("1"), "tooltip text");
    point.dispatchEvent(new Event("blur"));
    assert(!$1("#c-line .chart-tooltip").classList.contains("is-visible"), "tooltip hidden");
    // legend toggles a series
    const entry = $1("#c-bar .chart-legend-item");
    entry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert($$("#c-bar .chart-hidden").length === 3 && entry.getAttribute("aria-pressed") === "false", "series hidden");
    key(entry, "Enter");
    equal($$("#c-bar .chart-hidden").length, 0);
    // sparkline: small, no axes, no legend
    const spark = A.generateChart({ parent: "charts", type: "sparkline", series: [{ data: [3, 1, 4, 1, 5] }], id: "spark" });
    equal(spark.getAttribute("width"), "120");
    assert(!$1("#spark .chart-axis") && !$1("#spark .chart-legend-item"), "sparkline is bare");
    // time axis: points at their real distance, labels at round times
    const t0 = Date.UTC(2026, 10, 19, 10, 0, 0);
    const timed = A.generateChart({ parent: "charts", type: "line", id: "timed", table: true, title: "Load",
        times: [t0, t0 + 60000, t0 + 3600000], series: [{ name: "cpu", data: [1, 2, 3] }] });
    const xs = $$("#timed .chart-point").map(c => Number(c.getAttribute("cx")));
    assert(xs[2] - xs[1] > (xs[1] - xs[0]) * 20, "points follow the real time: " + xs.join());
    assert($$("#timed .chart-tick").length > 6, "time ticks");
    // table of values
    const details = timed.dataTable;
    assert(details && details.matches("details.chart-data"), "data table");
    equal($$("tbody tr", details).length, 3);
    equal($1("tbody tr td", details).textContent, "1");
    // update redraws in place, destroy takes svg and table away
    const before = $$("#charts svg").length;
    timed.update({ series: [{ name: "cpu", data: [9, 8, 7] }] });
    equal($$("#charts svg").length, before);
    equal($1("#timed ~ details tbody td").textContent, "9");
    document.getElementById("timed").element.destroy();
    assert(!$1("#timed") && !$1("#charts details"), "destroy takes both away");
    $1("#charts").remove();
});

test("menu: links and buttons, active item, navigation only by people, group with keyboard, user avatar", async () => {
    const calls = [];
    const menu = A.generateMenu({
        parent: "wrapper", layout: "responsive", followHash: true, label: "Main",
        onNavigate: (item, event) => { calls.push(item.id); event.preventDefault(); },
        items: [
            { id: "home", label: "Home", icon: "H", href: "#/home" },
            { id: "tools", label: "Tools", children: [{ id: "a", label: "Tool A", href: "#/a" }, { id: "b", label: "Tool B", disabled: true }, { id: "c", label: "Tool C" }] },
            { id: "user", label: "Anna Kiss", avatar: { name: "Anna Kiss" }, align: "end", children: [{ id: "out", label: "Sign out" }] }
        ]
    });
    const nav = menu.element;
    equal(nav.tagName, "NAV");
    equal(nav.getAttribute("aria-label"), "Main");
    assert(nav.classList.contains("athena-menu-responsive"), "layout class");
    equal($1("[data-id=home]", nav).tagName, "A");
    equal($1("[data-id=home]", nav).getAttribute("href"), "#/home");
    equal($1("[data-id=tools]", nav).tagName, "BUTTON");
    equal($1("[data-id=home] .menu-icon", nav).getAttribute("aria-hidden"), "true");
    equal($1(".menu-avatar", nav).textContent, "AK");
    equal(calls.length, 0, "onNavigate was called while building");
    // select() marks the item, but does not navigate
    menu.select("home");
    equal($1("[data-id=home]", nav).getAttribute("aria-current"), "page");
    equal(calls.length, 0, "select() navigated");
    // follows the hash
    location.hash = "#/a";
    for (let i = 0; i < 40 && menu.getActive() !== "a"; i++) await tick(25);
    equal(menu.getActive(), "a");
    assert($1("[data-id=tools]", nav).closest("li").classList.contains("has-active"), "group of the active child");
    equal(calls.length, 0);
    location.hash = "";
    await tick(60);   // let the hashchange of the reset pass, so a router of a later test does not see it
    // a person clicking
    $1("[data-id=home]", nav).click();
    equal(calls.join(), "home");
    // group: opens with the arrow key, skips disabled, Esc closes and returns the focus
    const toggle = $1("[data-id=tools]", nav);
    equal(toggle.getAttribute("aria-expanded"), "false");
    toggle.focus();
    key(toggle, "ArrowDown");
    equal(toggle.getAttribute("aria-expanded"), "true");
    equal(document.activeElement.getAttribute("data-id"), "a");
    key(document.activeElement, "ArrowDown");
    equal(document.activeElement.getAttribute("data-id"), "c", "the disabled item is skipped");
    key(document.activeElement, "Escape");
    equal(toggle.getAttribute("aria-expanded"), "false");
    equal(document.activeElement, toggle);
    toggle.click();
    $1("[data-id=c]", nav).click();
    equal(calls.join(), "home,c");
    equal(toggle.getAttribute("aria-expanded"), "false", "choosing closes the group");
    // arrow keys along the top level
    const home = $1("[data-id=home]", nav);
    home.focus();
    key(home, "ArrowRight");
    equal(document.activeElement, toggle);
    menu.update({ items: [{ id: "only", label: "Only" }] });
    equal($$(".menu-item", nav).length, 1);
    menu.destroy();
    assert(!document.querySelector("nav.athena-menu"), "destroyed");
});

test("menu: groups inside groups, keyboard in and out, active path, badges", async () => {
    const calls = [];
    const menu = A.generateMenu({
        parent: "wrapper", active: "deep",
        onNavigate: item => calls.push(item.id),
        items: [
            { id: "inbox", label: "Inbox", badge: 120, badgeLabel: "120 unread" },
            { id: "quiet", label: "Quiet", badge: 0 },
            { id: "more", label: "More", children: [
                { id: "one", label: "One" },
                { id: "sub", label: "Sub", children: [{ id: "deep", label: "Deep" }, { id: "deeper", label: "Deeper", children: [{ id: "deepest", label: "Deepest" }] }] }
            ] }
        ]
    });
    const nav = menu.element;
    equal($1("[data-id=inbox] .menu-badge", nav).textContent, "99+");
    equal($1("[data-id=inbox]", nav).getAttribute("aria-label"), "Inbox, 120 unread");
    assert(!$1("[data-id=quiet] .menu-badge", nav), "0 shows no badge");
    menu.setBadge("quiet", { text: 3, tone: "bad" });
    assert($1("[data-id=quiet] .menu-badge-bad", nav), "badge set later");
    menu.setBadge("quiet", null);
    assert(!$1("[data-id=quiet] .menu-badge", nav), "badge removed");
    // every group around the active item is marked
    assert($1("[data-id=more]", nav).closest("li").classList.contains("has-active"), "level 1");
    assert($1("[data-id=sub]", nav).closest("li").classList.contains("has-active"), "level 2");
    equal($1("[data-id=deep]", nav).getAttribute("aria-current"), "page");
    // keyboard: open the first level, go into the second, into the third, and back out
    const more = $1("[data-id=more]", nav);
    more.focus();
    key(more, "ArrowDown");
    equal(document.activeElement.getAttribute("data-id"), "one");
    key(document.activeElement, "ArrowDown");
    const sub = document.activeElement;
    equal(sub.getAttribute("data-id"), "sub");
    equal(sub.getAttribute("aria-haspopup"), "menu");
    key(sub, "ArrowRight");
    equal(sub.getAttribute("aria-expanded"), "true");
    equal(document.activeElement.getAttribute("data-id"), "deep");
    key(document.activeElement, "ArrowDown");
    const deeper = document.activeElement;
    equal(deeper.getAttribute("data-id"), "deeper");
    key(deeper, "ArrowRight");
    equal(document.activeElement.getAttribute("data-id"), "deepest");
    // ArrowLeft closes only the innermost group and returns to its toggle
    key(document.activeElement, "ArrowLeft");
    equal(document.activeElement, deeper);
    equal(deeper.getAttribute("aria-expanded"), "false");
    equal(sub.getAttribute("aria-expanded"), "true", "the outer group stays open");
    key(deeper, "ArrowLeft");
    equal(document.activeElement, sub);
    equal(more.getAttribute("aria-expanded"), "true");
    // choosing a deep item closes everything, returns the focus to the top toggle, and navigates
    key(sub, "ArrowRight");
    $1("[data-id=deep]", nav).click();
    equal(calls.join(), "deep");
    equal(more.getAttribute("aria-expanded"), "false");
    equal(sub.getAttribute("aria-expanded"), "false");
    equal(document.activeElement, more);
    // Escape closes the innermost group first
    more.click();
    $1("[data-id=sub]", nav).click();
    equal($1("[data-id=sub]", nav).getAttribute("aria-expanded"), "true");
    key($1("[data-id=deep]", nav), "Escape");
    equal($1("[data-id=sub]", nav).getAttribute("aria-expanded"), "false");
    equal(more.getAttribute("aria-expanded"), "true");
    menu.destroy();
});

test("table: data source with virtual scrolling asks for chunks while scrolling", async () => {
    const asked = [];
    let failChunk = null;
    const table = A.generateTable({
        parent: "wrapper", id: "rv", chunkSize: 50, virtual: { height: 200, rowHeight: 30 }, filter: true, filterDelay: 10,
        columns: [{ key: "id" }, { key: "name" }],
        dataSource: async ({ page, pageSize, sort, filter }) => {
            asked.push(page);
            if (failChunk === page) throw new Error("Chunk failed");
            const total = filter ? 120 : 10000;
            const rows = Array.from({ length: Math.min(pageSize, total - page * pageSize) }, (_, i) => ({ id: page * pageSize + i, name: (filter ? filter + " " : "row ") + (page * pageSize + i) }));
            return { rows: sort?.descending ? rows.reverse() : rows, total };
        }
    });
    const scroller = $1("#rv .athena-table-scroll");
    const rendered = () => $$("#rv tbody tr:not(.athena-table-spacer)");
    const until = async check => { for (let i = 0; i < 80 && !check(); i++) await tick(25); assert(check(), "timed out, asked " + asked.join()); };
    await until(() => rendered().length > 0 && !rendered()[0].classList.contains("athena-table-placeholder"));
    equal($1("#rv table").getAttribute("aria-rowcount"), "10001");
    assert(scroller.scrollHeight >= 10000 * 30, "scroll height of all the rows: " + scroller.scrollHeight);
    assert(rendered().length < 40, "only a window in the DOM");
    equal($1("td", rendered()[0]).textContent, "0");
    // scrolling far away: the rows around it are asked for, nothing in between
    scroller.scrollTop = 30 * 5000;
    scroller.dispatchEvent(new Event("scroll"));
    await until(() => rendered().some(tr => $1("td", tr).textContent === "5000"));
    assert(asked.includes(100), "chunk of row 5000 was asked: " + asked.join());
    assert(!asked.includes(50) && !asked.includes(60), "chunks in between were skipped: " + asked.join());
    // a chunk that fails shows a message with Retry, then recovers
    failChunk = 152;
    scroller.scrollTop = 30 * 7600;
    scroller.dispatchEvent(new Event("scroll"));
    await until(() => $1("#rv .athena-table-status button"));
    assert(!$1("#rv .athena-table-status").hidden, "status visible");
    failChunk = null;
    $1("#rv .athena-table-status button").click();
    await until(() => rendered().some(tr => $1("td", tr).textContent === "7600"));
    assert($1("#rv .athena-table-status").hidden, "status hidden after the retry");
    // filter and sort start again from the top with a new total
    type($1("#rv .athena-table-filter"), "x");
    await until(() => $1("#rv table").getAttribute("aria-rowcount") === "121");
    equal(scroller.scrollTop, 0);
    $$("#rv thead th.sortable")[0].click();
    $$("#rv thead th.sortable")[0].click();
    await until(() => rendered().length > 0 && $1("td", rendered()[0]).textContent === "49");
});

test("charts: zoom with the keyboard, the pointer and code; long series; streaming push", async () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="zc"></div>');
    const t0 = Date.UTC(2026, 10, 19, 0, 0, 0);
    const n = 2000;
    const times = Array.from({ length: n }, (_, i) => t0 + i * 60000);
    const data = Array.from({ length: n }, (_, i) => Math.sin(i / 50) * 10 + (i === 1000 ? 40 : 0));
    const zooms = [];
    const chart = A.generateChart({ parent: "zc", id: "zoomable", type: "line", zoom: true, times, series: [{ name: "wave", data }], onZoom: r => zooms.push(r) });
    // a long series: few DOM nodes, no dots, the peak is kept
    assert($$("#zoomable .chart-point").length === 0, "no dots for a long series");
    const points = $1("#zoomable .chart-line").getAttribute("points").split(" ").length;
    assert(points < 1200, "decimated to the width of the plot: " + points);
    assert($$("#zoomable .chart-tick").length > 5, "ticks");
    const peakY = Math.min(...$1("#zoomable .chart-line").getAttribute("points").split(" ").map(p => Number(p.split(",")[1])));
    assert(peakY < 100, "the single peak survives the decimation: " + peakY);
    // keyboard: + zooms in, arrows pan, 0 resets
    const hit = $1("#zoomable .chart-hit");
    equal(hit.getAttribute("tabindex"), "0");
    key(hit, "+");
    const z1 = chart.getZoom();
    assert(z1 && z1.to - z1.from < (n * 60000) * 0.6, "zoomed in");
    equal(zooms.length, 1);
    assert($1("#zoomable .chart-reset"), "reset button while zoomed");
    key($1("#zoomable .chart-hit"), "ArrowRight");
    const z2 = chart.getZoom();
    assert(z2.from > z1.from, "panned right");
    key($1("#zoomable .chart-hit"), "0");
    equal(chart.getZoom(), null);
    assert(!$1("#zoomable .chart-reset"), "no reset button when not zoomed");
    // by code, and the axis follows: fewer points, so the dots come back
    chart.zoom(t0 + 10 * 60000, t0 + 30 * 60000);
    equal($$("#zoomable .chart-point").length > 0, true, "dots when few points are in view");
    // dragging over the plot
    chart.resetZoom();
    const box = $1("#zoomable .chart-hit").getBoundingClientRect();
    const fire = (type, x) => $1("#zoomable .chart-hit").dispatchEvent(new PointerEvent(type, { clientX: x, clientY: box.top + 20, pointerId: 3, bubbles: true, button: 0 }));
    fire("pointerdown", box.left + box.width * 0.25);
    fire("pointermove", box.left + box.width * 0.5);
    assert(!$1("#zoomable .chart-selection").hasAttribute("display"), "selection shown while dragging");
    fire("pointerup", box.left + box.width * 0.5);
    const dragged = chart.getZoom();
    assert(dragged && dragged.from > t0 + n * 60000 * 0.2 && dragged.to < t0 + n * 60000 * 0.55, "zoomed to the dragged range");
    // double click resets
    $1("#zoomable .chart-hit").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    equal(chart.getZoom(), null);
    // streaming: pushes are batched, old points drop out
    const live = A.generateChart({ parent: "zc", id: "live", type: "area", maxPoints: 5, times: [t0, t0 + 1000], series: [{ name: "v", data: [1, 2] }] });
    for (let i = 0; i < 20; i++) live.push({ x: t0 + (i + 2) * 1000, values: i });
    const data5 = () => $$("#live ~ details tbody tr").length;
    for (let i = 0; i < 60 && !$1("#live").getAttribute("aria-label").includes("v"); i++) await tick(25);
    await tick(250);
    const svgNow = document.getElementById("live");
    assert(svgNow, "chart still there");
    equal($$("#live .chart-point").length, 5, "only the last 5 points are kept");
    equal(svgNow.querySelector(".chart-point").getAttribute("aria-label").includes("15"), true, "the oldest kept point is number 15");
    void data5;
    live.destroy();
    chart.destroy();
    $1("#zc").remove();
});

test("router: auth rules, roles, guard, hooks and onChange", async () => {
    const wrapper = document.getElementById("wrapper");
    const log = [];
    let signedIn = false;
    let roles = [];
    const page = name => () => { wrapper.textContent = name; log.push("page:" + name); };
    const router = A.createRouter({
        mode: "hash", outlet: "wrapper", focusContent: true,
        auth: { isSignedIn: () => signedIn, hasRole: role => roles.includes(role), loginPath: "/login", homePath: "/home", forbiddenPath: "/denied" },
        onRender: ctx => log.push("render:" + ctx.path),
        onShown: ctx => log.push("shown:" + ctx.path),
        routes: {
            "/home": page("home"),
            "/login": { handler: page("login"), guestOnly: true },
            "/denied": page("denied"),
            "/account": { handler: page("account"), auth: true },
            "/admin": { handler: page("admin"), auth: true, roles: ["admin"] },
            "/custom": { handler: page("custom"), guard: ctx => (ctx.query.ok === "1" ? undefined : "/home") },
            "/stay": { handler: page("stay"), guard: () => false }
        }
    });
    const seen = [];
    const stop = router.onChange(ctx => seen.push(ctx.path));
    const go = async path => {
        location.hash = path;
        for (let i = 0; i < 40; i++) { await tick(25); if (router.current() && "#" + router.current().path === location.hash.split("?")[0] && wrapper.textContent) break; }
        await tick(30);
    };
    router.start();
    await go("/account");
    // not signed in: sent to the login page with the place to come back to
    equal(router.current().path, "/login");
    equal(location.hash, "#/login?next=%2Faccount");
    equal(wrapper.textContent, "login");
    // signed in: a guest only page sends them home, the account opens
    signedIn = true;
    await go("/login");
    equal(router.current().path, "/home");
    await go("/account");
    equal(wrapper.textContent, "account");
    // roles
    await go("/admin");
    equal(router.current().path, "/denied");
    roles = ["admin"];
    await go("/admin");
    equal(wrapper.textContent, "admin");
    // the own guard: redirect, and false stays where it is
    await go("/custom");
    equal(router.current().path, "/home");
    await go("/custom?ok=1");
    equal(wrapper.textContent, "custom");
    await go("/stay");
    equal(wrapper.textContent, "custom", "guard returning false keeps the page");
    // hooks and the focus
    assert(log.includes("render:/account") && log.includes("shown:/account"), "hooks: " + log.join());
    equal(document.activeElement, wrapper, "the outlet got the focus");
    assert(seen.includes("/admin") && seen.includes("/home"), "onChange: " + seen.join());
    stop();
    router.stop();
    location.hash = "";
    await tick(60);
    wrapper.removeAttribute("tabindex");
});

test("small parts: page header, facts, empty state, loading, stat tone and note, format helpers", async () => {
    const header = A.generatePageHeader({ parent: "wrapper", title: "<b>Hosts</b>", description: "All of them", breadcrumbs: [{ label: "Home", href: "#/" }, { label: "Hosts" }],
        actions: [A.generateButton({ text: "Add" }).element] });
    equal(header.element.tagName, "HEADER");
    equal($1("h1", header.element).textContent, "<b>Hosts</b>");
    assert(!$1("h1 b", header.element), "title is text");
    equal($$(".breadcrumb-item", header.element).length, 2);
    equal($1(".page-actions button", header.element).textContent, "Add");
    header.setDescription("");
    assert($1(".page-description", header.element).hidden, "empty description hidden");
    const facts = A.generateFacts({ parent: "wrapper", inline: true, items: [{ term: "OS", description: "Linux" }, { term: "Tags", description: [A.generateBadge({ text: "a" })] }] });
    equal($$("dt", facts.element).length, 2);
    equal($1("dd", facts.element).textContent, "Linux");
    facts.update({ items: [{ term: "Only", description: "<i>x</i>" }] });
    equal($1("dd", facts.element).textContent, "<i>x</i>");
    let clicked = 0;
    const empty = A.generateEmptyState({ parent: "wrapper", title: "Nothing here", message: "Add one", icon: "∅", action: { text: "Add host", onclick: () => clicked++ } });
    equal($1(".empty-title", empty.element).textContent, "Nothing here");
    $1("button", empty.element).click();
    equal(clicked, 1);
    const loading = A.generateLoading({ parent: "wrapper" });
    equal(loading.element.getAttribute("role"), "status");
    equal($1(".loading-text", loading.element).textContent, "Loading...");
    const stat = A.generateStat({ parent: "wrapper", label: "CPU", value: 91, tone: "bad", note: "of 100" });
    assert(stat.element.classList.contains("is-bad"), "tone class");
    equal($1(".stat-note", stat.element).textContent, "of 100");
    assert($1(".stat-value", stat.element).textContent.startsWith("91"), "value");
    assert($1(".stat-value", stat.element).textContent.includes("("), "tone word for screen readers");
    stat.update({ value: 12, tone: "ok", note: "" });
    assert(stat.element.classList.contains("is-ok") && !stat.element.classList.contains("is-bad"), "tone changed");
    assert($1(".stat-note", stat.element).hidden, "empty note hidden");
    // format helpers
    equal(A.formatDuration(350), "350 ms");
    assert(A.formatDuration(7500000).startsWith("2 hr"), "duration: " + A.formatDuration(7500000));
    const now = Date.UTC(2026, 10, 19, 12, 0, 0);
    equal(A.formatRelativeTime(now - 2 * 60000, now), "2 minutes ago");
    equal(A.formatRelativeTime(now + 3 * 86400000, now), "in 3 days");
    equal(A.formatRelativeTime(now - 86400000, now), "yesterday");
    equal(A.formatNumber(1234567.891), "1,234,567.89");
    assert(A.formatDate(Date.UTC(2026, 10, 19, 12)).includes("2026"), "date");
    equal(A.formatRelativeTime("nonsense"), "");
});

test("date and time range: presets fill the inputs, custom edits clear the preset, getRange moves with the clock", async () => {
    const seen = [];
    const range = A.generateDateTimeRange({ parent: "wrapper", label: "Time", onChange: v => seen.push(v.preset) });
    const [select, from, to] = range.inputs;
    equal(from.type, "datetime-local");
    equal(select.options.length, 6);
    select.value = "1h";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    equal(seen.join(), "1h");
    const a = new Date(from.value);
    const b = new Date(to.value);
    assert(Math.abs((b - a) - 3600000) < 61000, "one hour apart: " + (b - a));
    const r1 = range.getRange();
    assert(Math.abs(r1.to.getTime() - Date.now()) < 5000, "ends now");
    await tick(30);
    assert(range.getRange().to.getTime() > r1.to.getTime(), "a preset moves with the clock");
    // editing an input makes it a custom range
    from.value = "2026-01-01T08:00";
    from.dispatchEvent(new Event("change", { bubbles: true }));
    equal(seen.join(), "1h,");
    equal(select.value, "");
    equal(range.getValue().preset, "");
    equal(range.getRange().from.getFullYear(), 2026);
    // reversed range is reported
    to.value = "2025-12-31T08:00";
    to.dispatchEvent(new Event("change", { bubbles: true }));
    assert(range.validate().length > 0, "reversed range reported");
    assert($1(".field-error", range.element.parentElement).textContent.length > 0, "error text shown");
    range.setValue({ preset: "7d" });
    equal(select.value, "7d");
    assert(Math.abs(new Date(to.value) - new Date(from.value) - 7 * 86400000) < 61000, "7 days");
    equal(A.toLocalInput(new Date(2026, 10, 19, 9, 5)), "2026-11-19T09:05");
    equal(A.fromLocalInput("nope"), null);
    range.destroy();
});

test("auth: sign in form with autocomplete tokens, server errors, auth state in memory", async () => {
    let attempt = 0;
    const form = A.generateSignInForm({
        parent: "wrapper", remember: true,
        onSubmit: async values => {
            attempt++;
            if (attempt === 1) throw new Error("Wrong password");
            if (attempt === 2) throw Object.assign(new Error("Check the fields"), { fields: { username: "Unknown user" } });
            submitted.push(values);
        }
    });
    const inputs = name => $1("[name=" + name + "]", form.element);
    equal(form.element.tagName, "FORM");
    equal(inputs("username").getAttribute("autocomplete"), "username");
    equal(inputs("password").getAttribute("autocomplete"), "current-password");
    equal(inputs("password").type, "password");
    equal(inputs("remember").type, "checkbox");
    inputs("username").value = "anna";
    inputs("password").value = "secret!!";
    form.element.requestSubmit();
    for (let i = 0; i < 40 && !$1(".form-message", form.element).textContent; i++) await tick(25);
    equal($1(".form-message", form.element).textContent, "Wrong password");
    form.element.requestSubmit();
    for (let i = 0; i < 40 && !$1(".field-error", form.fields.username.element).textContent; i++) await tick(25);
    equal($1(".field-error", form.fields.username.element).textContent, "Unknown user");
    form.element.requestSubmit();
    for (let i = 0; i < 40 && attempt < 3; i++) await tick(25);
    await tick(30);
    equal(submitted.at(-1).password, "secret!!", "the password is sent as typed, not hashed");
    form.destroy();

    const signUp = A.generateSignUpForm({ parent: "wrapper", onSubmit: values => { submitted.push(values); } });
    equal(signUp.fields.password.element.querySelector("input").getAttribute("autocomplete"), "new-password");
    $1("[name=username]", signUp.element).value = "bela";
    $1("[name=email]", signUp.element).value = "bela@example.org";
    $1("[name=password]", signUp.element).value = "longenough1";
    $1("[name=confirmPassword]", signUp.element).value = "different11";
    signUp.element.requestSubmit();
    await tick(40);
    assert($1(".field-error", signUp.fields.confirmPassword.element).textContent.length > 0, "confirmation mismatch");
    $1("[name=confirmPassword]", signUp.element).value = "longenough1";
    signUp.element.requestSubmit();
    await tick(60);
    assert(!("confirmPassword" in submitted.at(-1)) && submitted.at(-1).email === "bela@example.org", "the confirmation is not sent");
    signUp.destroy();

    const change = A.generatePasswordChangeForm({ parent: "wrapper", username: "anna", onSubmit() {} });
    equal($1("[name=username]", change.element).hidden, true);
    equal($1("[name=newPassword]", change.element).getAttribute("autocomplete"), "new-password");
    change.destroy();
    equal($1("[name=email]", A.generatePasswordResetForm({ parent: "wrapper", onSubmit() {} }).element).type, "email");

    // the state of who is signed in lives in memory: nothing is written to a cookie or the storage
    const cookiesBefore = document.cookie;
    const auth = A.createAuthState({ restore: async () => ({ name: "Anna", roles: ["admin"] }) });
    const changes = [];
    auth.onChange(user => changes.push(user?.name ?? null));
    assert(!auth.isSignedIn(), "nobody at the start");
    await auth.restore();
    assert(auth.isSignedIn() && auth.hasRole("admin") && !auth.hasRole("root"), "restored from the server answer");
    auth.signOut();
    auth.signIn({ name: "Bela", role: "viewer" });
    assert(auth.hasRole("viewer"), "single role");
    equal(changes.join(), "Anna,,Bela");
    equal(document.cookie, cookiesBefore, "no cookie written");
    const failing = A.createAuthState({ restore: async () => { throw new Error("offline"); } });
    equal(await failing.restore(), null);
    assert(typeof auth.routerRules().isSignedIn === "function", "router rules");
});

test("appearance.css: themes and modes change the tokens, also on a preview element", async () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../../src/res/themes/appearance.css", location.href).href;
    document.head.append(link);
    await new Promise((resolve, reject) => { link.onload = resolve; link.onerror = () => reject(new Error("appearance.css did not load")); });
    const root = document.documentElement;
    const saved = { theme: root.dataset.theme, mode: root.dataset.mode };
    const manager = A.createThemeManager({ themes: [{ id: "athena" }, { id: "contrast" }], storageKey: "athena.test.appearance2" });
    const token = (node, name) => getComputedStyle(node).getPropertyValue(name).trim();
    manager.setTheme("athena");
    manager.setMode("light");
    equal(token(root, "--athena-bg"), "#fff");
    manager.setMode("dark");
    equal(token(root, "--athena-bg"), "#16181d");
    equal(getComputedStyle(document.body).backgroundColor, "rgb(22, 24, 29)");
    manager.setTheme("contrast");
    equal(token(root, "--athena-accent"), "#ffe14d");
    equal(token(root, "--series-1"), "#80d8ff");
    // an element with the two attributes has its own tokens (this is what the preview of the picker uses)
    const probe = document.createElement("div");
    probe.dataset.theme = "athena";
    probe.dataset.mode = "light";
    document.body.append(probe);
    equal(token(probe, "--athena-bg"), "#fff", "a light panel on a dark page");
    probe.remove();
    manager.destroy();
    localStorage.removeItem("athena.test.appearance2");
    link.remove();
    if (saved.theme) root.dataset.theme = saved.theme; else delete root.dataset.theme;
    if (saved.mode) root.dataset.mode = saved.mode; else delete root.dataset.mode;
});

test("text from data is only ever inserted as text, in every component that takes strings", async () => {
    // If any of these became markup there would be an <img src="x"> (or a <b>, <i>) in the page, and the handler would be reported by the CSP check.
    const H = '<img src="x" onerror="window.__pwned=1"><b>bold</b>';
    const bad = () => ({ hostile: H });
    void bad;
    const parent = "wrapper";
    const calls = {
        generateButton: () => A.generateButton({ parent, text: H }),
        generateField: () => A.generateField({ parent, name: "a", label: H, help: H, placeholder: H }),
        generateFieldSelect: () => A.generateField({ parent, name: "b", type: "select", label: H, options: [{ value: "1", text: H }], placeholder: H }),
        generateFieldChoices: () => A.generateField({ parent, name: "c", type: "radio", label: H, options: [{ value: H, text: H }] }),
        generateForm: () => A.generateForm({ parent, submitText: H, fields: [{ name: "d", label: H }] }),
        generateTabs: () => A.generateTabs({ parent, tabs: [{ id: "t1", label: H, content: H }, { id: "t2", label: H, content: H }] }),
        generateAccordion: () => A.generateAccordion({ parent, items: [{ title: H, content: H, open: true }] }),
        generateDropdown: () => A.generateDropdown({ parent, label: H, items: [{ label: H }] }),
        generateBreadcrumbs: () => A.generateBreadcrumbs({ parent, items: [{ label: H, href: "#/" }, { label: H }] }),
        generateSidebar: () => A.generateSidebar({ parent, items: [{ id: "s1", label: H, children: [{ id: "s2", label: H }] }] }),
        generateMenu: () => A.generateMenu({ parent, items: [{ id: "m1", label: H, icon: H, badge: H, avatar: { name: H }, children: [{ id: "m2", label: H }] }] }),
        generateCard: () => A.generateCard({ parent, title: H, content: H }),
        generateSection: () => A.generateSection({ parent, title: H, content: H }),
        generateBadge: () => A.generateBadge({ parent, text: H }),
        generateAvatar: () => A.generateAvatar({ parent, name: H }),
        generateStat: () => A.generateStat({ parent, label: H, value: H, note: H }),
        generateLink: () => A.generateLink({ parent, text: H, href: "#/" }),
        generatePageHeader: () => A.generatePageHeader({ parent, title: H, description: H, breadcrumbs: [{ label: H }] }),
        generateFacts: () => A.generateFacts({ parent, items: [{ term: H, description: H }] }),
        generateEmptyState: () => A.generateEmptyState({ parent, title: H, message: H, icon: H, action: { text: H, onclick() {} } }),
        generateLoading: () => A.generateLoading({ parent, text: H }),
        generateAlert: () => A.generateAlert({ parent, message: H, title: H }),
        generateProgress: () => A.generateProgress({ parent, label: H, value: 5 }),
        generateTable: () => A.generateTable({ parent, caption: H, emptyText: H, columns: [{ key: "a", label: H }], rows: [{ a: H }, { a: H }],
            rowActions: [{ label: H, onclick() {} }], filter: true }),
        generateTableEmpty: () => A.generateTable({ parent, emptyText: H, columns: [{ key: "a", label: H }], rows: [] }),
        generateChart: () => A.generateChart({ parent, type: "bar", title: H, labels: [H], series: [{ name: H, data: [1] }], table: true }),
        generateChartPie: () => A.generateChart({ parent, type: "pie", title: H, labels: [H, H], series: [{ name: H, data: [1, 2] }] }),
        generateStepper: () => A.generateStepper({ parent, steps: [{ title: H, content: H }] }),
        generateAutocomplete: () => A.generateAutocomplete({ parent, label: H, options: [H] }),
        generateMultiSelect: () => A.generateMultiSelect({ parent, label: H, options: [{ value: "1", text: H }], value: ["1"] }),
        generateDateTimeRange: () => A.generateDateTimeRange({ parent, label: H }),
        generateDateRange: () => A.generateDateRange({ parent, label: H }),
        generateThemePicker: () => A.generateThemePicker({ parent, themeLabel: H, modeLabel: H,
            manager: A.createThemeManager({ themes: [{ id: "x", name: H, description: H }], storageKey: "athena.test.xss" }) }),
        generateTooltip: () => A.generateTooltip(A.generateButton({ parent, text: "t" }).element, H),
        generateSignIn: () => A.generateSignInForm({ parent, submitText: H, onSubmit() {} }),
        generateDropZone: () => A.generateDropZone({ parent, label: H }),
        generateFileUpload: () => A.generateFileUpload({ parent, label: H })
    };
    const failed = [];
    for (const [name, make] of Object.entries(calls)) {
        try {
            make();
        } catch (error) {
            failed.push(name + ": " + error.message);
        }
    }
    assert(!failed.length, "could not build: " + failed.join(" | "));
    A.showToast({ title: H, message: H });
    const dialogs = [
        A.showDialog({ title: H, content: [H, H], buttons: [{ text: H, value: 1 }] }),
        A.showConfirm({ title: H, message: H, confirmText: H, cancelText: H, typeToConfirm: H }),
        A.showFormDialog({ title: H, intro: H, fields: [{ name: "z", label: H }], submitText: H, cancelText: H, onSubmit() {} })
    ];
    A.alertDialog(H, { title: H, okText: H });
    A.promptDialog(H, { title: H, placeholder: H });
    await tick(30);
    assert(!document.querySelector("img[src=x]"), "a string became an <img>");
    assert(!document.querySelector("b"), "a string became a <b>");
    equal(window.__pwned, undefined, "a handler ran");
    // and it IS on the page, as text
    const text = document.body.textContent;
    assert(text.includes('<img src="x" onerror="window.__pwned=1"><b>bold</b>'), "the text is not shown");
    for (const dialog of dialogs) dialog.close?.(null);
    localStorage.removeItem("athena.test.xss");
});

test("Cookies: set, get, remove, encoding, expiry and the attributes", () => {
    const { Cookies } = A;
    Cookies.set("athena_t1", "a b;c=d&é", { sameSite: "strict" });
    equal(Cookies.get("athena_t1"), "a b;c=d&é");
    assert("athena_t1" in Cookies.get(), "all cookies include it");
    Cookies.set("athena_t2", "x", { expires: 1 });
    equal(Cookies.get("athena_t2"), "x");
    // The page may run in virtual time (see run.mjs), whose clock is ahead of the real one: the date has to be clearly in the past
    Cookies.set("athena_t2", "y", { expires: new Date(0) });
    equal(Cookies.get("athena_t2"), undefined, "a past date removes it");
    Cookies.remove("athena_t1");
    equal(Cookies.get("athena_t1"), undefined);
    equal(Cookies.get("never_set"), undefined);
});

test("CSS: Athena is in a cascade layer, so a plain rule of the application wins; tokens and dark mode", () => {
    const table = A.generateTable({ parent: "wrapper", columns: [{ key: "a" }], rows: [{ a: 1 }] });
    const cell = $1("td", table.element);
    equal(getComputedStyle(cell).paddingTop, "6px", "Athena's own padding");
    // a constructed style sheet is allowed by the strict policy of this page; its rules are not in a layer
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("td { padding: 1px; }   :root { --athena-radius: 1px; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    equal(getComputedStyle(cell).paddingTop, "1px", "a rule of the application with a low specificity beats .athena-table td");
    equal(getComputedStyle(document.documentElement).getPropertyValue("--athena-radius").trim(), "1px", "a token is set by the application");
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(item => item !== sheet);
    equal(getComputedStyle(cell).paddingTop, "6px");
    // tokens in use
    const dialog = A.showDialog({ title: "t", content: "x", size: "small" });
    equal(getComputedStyle(dialog.element).getPropertyValue("--dialog-width").trim(), "360px", "dialog width comes from --athena-dialog-small");
    dialog.close();
    // dark mode of the default theme: the attribute switches the colours
    const root = document.documentElement;
    const before = getComputedStyle(root).getPropertyValue("--athena-bg").trim();
    root.dataset.mode = "dark";
    equal(getComputedStyle(root).getPropertyValue("--athena-bg").trim(), "#16181d");
    equal(getComputedStyle(document.body).backgroundColor, "rgb(22, 24, 29)");
    root.dataset.mode = "light";
    equal(getComputedStyle(root).getPropertyValue("--athena-bg").trim(), before);
    delete root.dataset.mode;
});

test("createApp: the layout is built into any element, header and footer are optional", async () => {
    // the page of the tests already has an app from init(): take it away first (one app per page)
    const old = document.getElementById("container");
    const oldParent = old.parentElement;
    old.remove();
    try {
    document.body.insertAdjacentHTML("beforeend", '<section id="part-of-a-page"><h2 id="mine">Mine</h2></section>');
    const app = await A.createApp({ root: "#part-of-a-page", config: { generateHeader: false, generateFooter: false, generateWrappercontent: false } });
    equal(app.element.id, "part-of-a-page");
    assert(app.element.contains(app.container) && app.container.id === "container", "container inside the root");
    assert(app.element.contains(app.wrapper) && app.wrapper.id === "wrapper", "the wrapper is inside the root");
    equal(app.header, null);
    equal(app.footer, null);
    equal($1("#mine").textContent, "Mine", "what was in the root stays");
    A.generateButton({ parent: "wrapper", text: "in the app" });
    assert(app.wrapper.querySelector("button"), "components go into the wrapper by default");
    equal(app.container.parentElement, app.element, "not in the body");
    app.destroy();
    equal(document.getElementById("container"), null);
    $1("#part-of-a-page").remove();
    // with a header
    document.body.insertAdjacentHTML("beforeend", '<div id="app-two"></div>');
    const second = await A.createApp({ root: $1("#app-two"), config: { generateHeader: true, generateFooter: false, generateHeadercontent: false, generateWrappercontent: false } });
    assert(second.header && second.element.contains(second.header), "header inside the root");
    second.destroy();
    $1("#app-two").remove();
    let failed = false;
    try { await A.createApp({ root: "#nothing-here" }); } catch { failed = true; }
    assert(failed, "a missing root is an error");
    } finally {
        document.getElementById("container")?.remove();
        oldParent.append(old);
    }
});

test("charts: a redraw (streaming, zoom) keeps the keyboard focus and the series a person hid", async () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="fc"></div>');
    const t0 = Date.UTC(2026, 10, 19, 0, 0, 0);
    const chart = A.generateChart({ parent: "fc", id: "focus-chart", type: "line", zoom: true, times: [t0, t0 + 1000, t0 + 2000], series: [{ name: "a", data: [1, 2, 3] }, { name: "b", data: [3, 2, 1] }] });
    // the plot has the focus; zooming redraws the chart, and the focus stays on the plot of the new SVG
    const hit = () => $1("#focus-chart .chart-hit");
    hit().focus();
    assert(document.activeElement === hit(), "focus on the plot");
    key(hit(), "+");
    assert(chart.getZoom(), "zoomed");
    assert(document.activeElement === hit(), "the focus is on the plot of the new chart");
    key(hit(), "0");
    assert(document.activeElement === hit() && !chart.getZoom(), "still there after the reset");
    // a legend entry has the focus: it keeps it, and what was hidden stays hidden through a push
    const entry = () => $1("#focus-chart .chart-legend-item[data-legend='1']");
    entry().focus();
    key(entry(), "Enter");
    assert($$("#focus-chart [data-series='1'].chart-hidden").length > 0, "series 1 hidden");
    chart.push({ x: t0 + 3000, values: [4, 0] });
    for (let i = 0; i < 40 && $$("#focus-chart .chart-point").length < 4; i++) await tick(25);
    assert($$("#focus-chart [data-series='1'].chart-hidden").length > 0, "series 1 is still hidden after the redraw");
    equal(entry().getAttribute("aria-pressed"), "false");
    assert(document.activeElement === entry(), "the legend entry still has the focus");
    key(entry(), "Enter");
    assert($$("#focus-chart [data-series='1'].chart-hidden").length === 0, "shown again");
    chart.destroy();
    $1("#fc").remove();
});

test("dropdown: a native popover in the top layer, placed next to the button, keyboard, flips above near the bottom", async () => {
    const host = document.getElementById("wrapper");
    const dropdown = A.generateDropdown({ parent: host, label: "Actions", items: [{ label: "One" }, { label: "Two" }, { divider: true }, { label: "Three" }] });
    const toggle = $1(".dropdown-toggle", dropdown.element);
    const menu = $1("[role=menu]", dropdown.element);
    equal(menu.getAttribute("popover"), "auto");
    equal(toggle.getAttribute("popovertarget"), menu.id, "the browser toggles it");
    assert(!menu.matches(":popover-open") && getComputedStyle(menu).display === "none", "closed: not drawn");
    equal(toggle.getAttribute("aria-expanded"), "false");
    // open with the button: in the top layer, aria-expanded follows (synchronously), the menu sits just below the button
    toggle.click();
    assert(menu.matches(":popover-open"), "opened");
    equal(toggle.getAttribute("aria-expanded"), "true");
    await tick(30);
    const t = toggle.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    assert(Math.abs(m.top - (t.bottom + 4)) < 3 && Math.abs(m.left - t.left) < 3, `next to the button: menu ${Math.round(m.left)},${Math.round(m.top)} button ${Math.round(t.left)},${Math.round(t.bottom)}`);
    equal(getComputedStyle(menu).position, "fixed");
    // the keyboard: arrows move, Esc closes and the focus goes back to the button
    key(toggle, "ArrowDown");
    equal(document.activeElement.textContent, "One");
    key(document.activeElement, "ArrowDown");
    equal(document.activeElement.textContent, "Two");
    key(document.activeElement, "Escape");
    assert(!menu.matches(":popover-open"), "closed by Esc");
    equal(toggle.getAttribute("aria-expanded"), "false");
    equal(document.activeElement, toggle, "the focus is back on the button");
    // open() and close() of the handle
    dropdown.open();
    assert(menu.matches(":popover-open"), "open()");
    dropdown.close();
    assert(!menu.matches(":popover-open"), "close()");
    // right aligned: the right edges line up
    // (in the middle of the window: near an edge the menu is pushed back inside, which is another test)
    const middle = document.createElement("div");
    middle.id = "middle-box";
    host.append(middle);
    middle.style.marginLeft = "600px";
    const right = A.generateDropdown({ parent: middle, label: "Right", align: "right", items: [{ label: "A long enough item to be wider than the button" }] });
    const rightToggle = $1(".dropdown-toggle", right.element);
    rightToggle.click();
    await tick(30);
    const rm = $1("[role=menu]", right.element).getBoundingClientRect();
    assert(Math.abs(rm.right - rightToggle.getBoundingClientRect().right) < 3, "right edges line up");
    right.close();
    // near the left edge of the window a menu that does not fit is pushed back inside
    const edge = A.generateDropdown({ parent: host, label: "Edge", align: "right", items: [{ label: "An item that is far wider than the room to the left of this button" }] });
    $1(".dropdown-toggle", edge.element).click();
    await tick(30);
    assert($1("[role=menu]", edge.element).getBoundingClientRect().left >= 3, "kept inside the window");
    edge.close();
    middle.remove();
    // near the bottom of the window there is no room below: it opens above
    const low = el => { el.style.position = "fixed"; el.style.left = "20px"; el.style.bottom = "6px"; };
    const lowDropdown = A.generateDropdown({ parent: document.body, label: "Low", items: [{ label: "x" }, { label: "y" }, { label: "z" }] });
    low(lowDropdown.element);
    $1(".dropdown-toggle", lowDropdown.element).click();
    await tick(30);
    const lm = $1("[role=menu]", lowDropdown.element).getBoundingClientRect();
    const lt = $1(".dropdown-toggle", lowDropdown.element).getBoundingClientRect();
    assert(lm.bottom <= lt.top + 1, `above the button: menu bottom ${Math.round(lm.bottom)}, button top ${Math.round(lt.top)}`);
    lowDropdown.element.remove();
    // destroy
    dropdown.destroy();
    assert(!document.contains(menu), "destroyed");
});

test("tooltip: a popover that shows on hover and focus, hides on leave, blur and Esc, never on touch", async () => {
    const lane = document.createElement("div");
    document.getElementById("wrapper").append(lane);
    lane.style.marginLeft = "500px";     // away from the edge: near it a centred tooltip is pushed back inside
    const button = A.generateButton({ parent: lane, text: "Help" }).element;
    const tip = A.generateTooltip(button, "Opens the help");
    equal(tip.getAttribute("role"), "tooltip");
    equal(tip.getAttribute("popover"), "manual");
    equal(button.getAttribute("aria-describedby"), tip.id);
    assert(!tip.matches(":popover-open"), "hidden at the start");
    const host = button.closest(".has-tooltip");
    host.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
    assert(!tip.matches(":popover-open"), "a touch does not show it");
    host.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    assert(tip.matches(":popover-open"), "shown on hover");
    await tick(30);
    const b = button.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    assert(t.bottom <= b.top + 1 && Math.abs((t.left + t.width / 2) - (b.left + b.width / 2)) < 3, "above the button, centred");
    host.dispatchEvent(new PointerEvent("pointerleave"));
    assert(!tip.matches(":popover-open"), "hidden on leave");
    // (a headless window does not always have the focus, so the focusin event may not come by itself)
    button.focus();
    button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    assert(tip.matches(":popover-open"), "shown on focus");
    key(button, "Escape");
    assert(!tip.matches(":popover-open"), "Esc hides it");
    button.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    // not cut off by a parent that hides what overflows
    const box = document.createElement("div");
    box.id = "clip";
    document.getElementById("wrapper").append(box);
    const inner = A.generateButton({ parent: box, text: "In a box" }).element;
    const innerTip = A.generateTooltip(inner, "Not cut off");
    inner.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    assert(innerTip.matches(":popover-open") && innerTip.getBoundingClientRect().height > 0, "drawn in the top layer");
    inner.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    box.remove();
    lane.remove();
});

test("dropdown and tooltip without the popover API: the plain fallback (hidden, a click outside, CSS)", async () => {
    // A browser without the popover API is made up by taking the method away for a moment
    const real = HTMLElement.prototype.showPopover;
    HTMLElement.prototype.showPopover = undefined;
    try {
        const dropdown = A.generateDropdown({ parent: "wrapper", label: "Old browser", items: [{ label: "One" }, { label: "Two" }] });
        const toggle = $1(".dropdown-toggle", dropdown.element);
        const menu = $1("[role=menu]", dropdown.element);
        assert(!menu.hasAttribute("popover") && menu.hidden, "a plain, hidden menu");
        assert(!toggle.hasAttribute("popovertarget"), "no popovertarget");
        toggle.click();
        assert(!menu.hidden, "opened by the click");
        equal(toggle.getAttribute("aria-expanded"), "true");
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        assert(menu.hidden, "a click outside closes it");
        equal(toggle.getAttribute("aria-expanded"), "false");
        toggle.click();
        $1("[role=menuitem]", dropdown.element).click();
        assert(menu.hidden && document.activeElement === toggle, "choosing closes it and the focus goes back");
        key(toggle, "ArrowDown");
        assert(!menu.hidden && document.activeElement.textContent === "One", "ArrowDown opens it and goes to the first item");
        key(document.activeElement, "Escape");
        assert(menu.hidden, "Esc closes it");

        const button = A.generateButton({ parent: "wrapper", text: "Old help" }).element;
        const tip = A.generateTooltip(button, "A tooltip");
        assert(!tip.hasAttribute("popover") && tip.classList.contains("tooltip-text"), "a CSS tooltip");
        equal(button.getAttribute("aria-describedby"), tip.id);
    } finally {
        HTMLElement.prototype.showPopover = real;
    }
});

// The motion tests turn the motion on for their own length (the rest of the suite runs with it off)
const withMotion = async (fn, mode = "full") => {
    A.setMotion(mode);
    try {
        await fn();
    } finally {
        A.setMotion("reduce");
    }
};
const waitUntil = async (check, message, ms = 3000) => {
    for (let i = 0; i < ms / 25 && !(await check()); i++) await tick(25);
    assert(await check(), message);
};

test("motion: the preference lives on <html>, the tokens follow it, the functions read it", async () => {
    const root = document.documentElement;
    const seen = [];
    const stop = A.onMotionChange(state => seen.push(state.preference + ":" + state.reduced));
    A.setMotion("full");
    equal(root.dataset.motion, "full");
    equal(A.getMotion(), "full");
    equal(A.prefersReducedMotion(), false);
    equal(A.readDuration("--athena-duration-base"), 200);
    equal(A.readDuration("--athena-duration-slow"), 360);
    A.setMotion("reduce");
    equal(root.dataset.motion, "reduce");
    equal(A.prefersReducedMotion(), true);
    equal(A.readDuration("--athena-duration-base"), 0, "the tokens are 0 under reduced motion");
    equal(A.readDuration("--athena-duration-fast"), 0);
    equal(A.setMotion("sideways"), false, "an unknown value is refused");
    A.setMotion("system");
    assert(!("motion" in root.dataset), "system: no attribute");
    const systemReduced = A.prefersReducedMotion();     // what the system says (the machine of the test decides)
    A.setMotion("reduce");
    stop();
    equal(seen.join(), "full:false,reduce:true,system:" + systemReduced + ",reduce:true");
});

test("motion: animate() runs a Web Animation and resolves at the end; under reduced motion it does nothing", async () => {
    const box = document.createElement("div");
    document.getElementById("wrapper").append(box);
    await withMotion(async () => {
        const running = A.animate(box, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
        equal(box.getAnimations().length, 1, "an animation is running");
        const animation = await running;
        assert(animation && animation.playState === "finished", "it finished: " + animation?.playState);
        // cancelling with a signal: resolves, does not reject
        const controller = new AbortController();
        const cancelled = A.animate(box, [{ translate: "0 0" }, { translate: "40px 0" }], { duration: 2000, signal: controller.signal });
        controller.abort();
        await cancelled;
        equal(box.getAnimations().length, 0, "cancelled");
        // fadeOut removes the element
        const gone = document.createElement("div");
        document.getElementById("wrapper").append(gone);
        await A.fadeOut(gone, { duration: 60 });
        assert(!gone.isConnected, "fadeOut removed it");
    });
    equal(await A.animate(box, [{ opacity: 0 }, { opacity: 1 }], { duration: 5000 }), null, "reduced: nothing");
    equal(box.getAnimations().length, 0);
    const other = document.createElement("div");
    document.getElementById("wrapper").append(other);
    await A.fadeOut(other);
    assert(!other.isConnected, "reduced: fadeOut removes at once");
});

test("motion: transition() waits for the CSS transition (and not longer than it lasts), flip() slides what moved, tween() counts", async () => {
    // a constructed style sheet is allowed by the strict policy of this page
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(".mt { opacity: 1; transition: opacity 90ms linear; } .mt.off { opacity: 0; } .flip-list { display: flex; flex-direction: column; } .flip-list > div { height: 20px; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const box = document.createElement("div");
    box.className = "mt";
    document.getElementById("wrapper").append(box);
    try {
        await withMotion(async () => {
            const t0 = performance.now();
            await A.transition(box, () => box.classList.add("off"));
            const took = performance.now() - t0;
            assert(took >= 60 && took < 1000, "waited for the transition: " + Math.round(took) + " ms");
            equal(A.transitionTime(box), 90);
            // flip: reverse a list, the children that moved are animated, the promise resolves when they are over
            const list = document.createElement("div");
            list.className = "flip-list";
            list.innerHTML = "<div>a</div><div>b</div><div>c</div>";
            document.getElementById("wrapper").append(list);
            const kids = [...list.children];
            const done = A.flip(list, () => list.append(...[...list.children].reverse()), { duration: 150 });
            assert(kids[0].getAnimations().length === 1 && kids[2].getAnimations().length === 1, "the first and the last moved and slide");
            equal(kids[1].getAnimations().length, 0, "the one in the middle did not move");
            await done;
            equal(kids[0].getAnimations().length, 0, "over");
            // a new child fades in
            const fresh = document.createElement("div");
            await A.flip(list, () => list.prepend(fresh), { duration: 60 });
            assert(!fresh.getAnimations().length, "the new one has faded in");
            list.remove();
        });
        // reduced motion: flip only does the change (nothing slides)
        const list2 = document.createElement("div");
        list2.className = "flip-list";
        list2.innerHTML = "<div>a</div><div>b</div>";
        document.getElementById("wrapper").append(list2);
        const first = list2.children[0];
        await A.flip(list2, () => list2.append(first));
        equal(list2.lastElementChild, first, "the change was done");
        equal(first.getAnimations().length, 0, "and nothing slides");
        list2.remove();
    } finally {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(item => item !== sheet);
        box.remove();
    }
});

test("motion: spring, easings, stagger, sequence, parallel, tween", async () => {
    const { easing, duration } = A.spring();
    assert(/^linear\(0, /.test(easing) && easing.endsWith("1)"), "a linear() easing: " + easing.slice(0, 40));
    assert(duration > 150 && duration < 3000, "a duration: " + duration);
    assert(A.spring({ stiffness: 400, damping: 40 }).duration < duration, "a stiffer, damped spring settles sooner");
    equal(A.easings.linear(0.3), 0.3);
    equal(A.easings.easeOutCubic(0), 0);
    equal(A.easings.easeOutCubic(1), 1);
    assert(A.easings.easeOutBack(0.7) > 1 || A.easings.easeOutBack(0.9) > 1, "back overshoots");
    equal(A.staggerDelays(5, 40).join(), "0,40,80,120,160");
    equal(A.staggerDelays(5, 40, "end").join(), "160,120,80,40,0");
    equal(A.staggerDelays(5, 40, "center").join(), "80,40,0,40,80");
    const log = [];
    await A.sequence([async () => { await tick(30); log.push("a"); }, async () => { log.push("b"); }]);
    equal(log.join(), "a,b", "one after the other");
    log.length = 0;
    await A.parallel([async () => { await tick(40); log.push("slow"); }, async () => { log.push("fast"); }]);
    equal(log.join(), "fast,slow", "together");
    const calls = [];
    await A.stagger(["x", "y", "z"], (item, index, delay) => calls.push(item + index + ":" + delay), { step: 10 });
    equal(calls.join(), "x0:0,y1:10,z2:20");
    // tween
    await withMotion(async () => {
        const values = [];
        const running = A.tween({ from: 0, to: 100, duration: 120, onUpdate: value => values.push(value) });
        await running;
        assert(values.length >= 2 && values.at(-1) === 100, "ends on the value: " + values.at(-1));
        assert(values.every((value, index) => index === 0 || value >= values[index - 1]), "never goes back");
        const point = [];
        await A.tween({ from: { x: 0, y: 10 }, to: { x: 4, y: 0 }, duration: 60, onUpdate: value => point.push(value) });
        assert(point.at(-1).x === 4 && point.at(-1).y === 0, "objects too");
        const stopped = [];
        const slow = A.tween({ from: 0, to: 1, duration: 5000, onUpdate: value => stopped.push(value) });
        await tick(60);
        slow.cancel();
        await slow;
        assert(stopped.length > 0 && stopped.at(-1) < 1, "cancelled on the way");
    });
    const jump = [];
    await A.tween({ from: 0, to: 7, duration: 5000, onUpdate: value => jump.push(value) });
    equal(jump.join(), "7", "reduced: one jump to the end");
});

test("motion: viewTransition() uses the API when there is one and motion is wanted", async () => {
    const real = document.startViewTransition;
    const calls = [];
    document.startViewTransition = update => {
        calls.push("start");
        const done = Promise.resolve(update());
        return { updateCallbackDone: done, finished: done };
    };
    try {
        let ran = 0;
        await withMotion(async () => {
            await A.viewTransition(() => { ran++; });
        });
        equal(calls.length, 1, "used in full motion");
        equal(ran, 1);
        await A.viewTransition(() => { ran++; });
        equal(calls.length, 1, "not used under reduced motion");
        equal(ran, 2, "but the update was run");
        let failure = null;
        try {
            await withMotion(() => A.viewTransition(() => { throw new Error("page failed"); }));
        } catch (error) {
            failure = error.message;
        }
        equal(failure, "page failed", "an error of the update comes out");
        document.startViewTransition = undefined;
        await withMotion(async () => { await A.viewTransition(() => { ran++; }); });
        equal(ran, 3, "without the API the update is just run");
    } finally {
        document.startViewTransition = real;
    }
});

test("motion: a dialog and a toast fade out before they are taken away; at once under reduced motion", async () => {
    await withMotion(async () => {
        const dialog = A.showDialog({ title: "Fading", content: "x" });
        assert(getComputedStyle(dialog.element).transitionDuration.includes("0.2s"), "the dialog has a transition: " + getComputedStyle(dialog.element).transitionDuration);
        await tick(300);
        dialog.close("done");
        assert(dialog.element.isConnected && !dialog.element.open, "closed, but still there while it fades");
        equal(await dialog, "done", "the promise does not wait for the fade");
        await waitUntil(() => !dialog.element.isConnected, "taken away after the fade");
        const toast = A.showToast({ message: "Bye", duration: 0 });
        const node = $1(".toast");
        toast.close();
        assert(node.classList.contains("is-leaving") && node.isConnected, "leaving");
        await waitUntil(() => !node.isConnected, "removed after the fade");
    });
    const quick = A.showDialog({ title: "Quick", content: "x" });
    quick.close();
    assert(!quick.element.isConnected, "reduced: removed at once");
    A.showToast({ message: "Quick", duration: 0 }).close();
    assert(!$1(".toast"), "reduced: the toast is gone at once");
});

test("motion: a chart animates its first drawing only, a skeleton shimmers, both stand still under reduced motion", async () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="mc"></div>');
    await withMotion(async () => {
        const chart = A.generateChart({ parent: "mc", id: "m-chart", type: "bar", labels: ["a", "b"], series: [{ data: [3, 5] }] });
        assert($1("#m-chart").classList.contains("athena-chart-animated"), "the first drawing animates");
        equal(getComputedStyle($1("#m-chart .chart-bar")).animationName, "athena-grow");
        equal(getComputedStyle($1("#m-chart .chart-bar")).animationDuration, "0.36s");
        chart.update({ series: [{ data: [4, 6] }] });
        assert(!$1("#m-chart").classList.contains("athena-chart-animated"), "a redraw does not animate again");
        chart.destroy();
        const still = A.generateChart({ parent: "mc", id: "m-still", type: "line", animate: false, labels: ["a", "b"], series: [{ data: [3, 5] }] });
        assert(!$1("#m-still").classList.contains("athena-chart-animated"), "animate: false");
        still.destroy();
        const line = A.generateChart({ parent: "mc", id: "m-line", type: "line", labels: ["a", "b", "c"], series: [{ data: [1, 3, 2] }] });
        equal(getComputedStyle($1("#m-line .chart-line")).animationName, "athena-draw");
        equal($1("#m-line .chart-line").getAttribute("pathLength"), "1");
        line.destroy();
        const skeleton = A.generateSkeleton({ parent: "mc", lines: 3 });
        equal($$(".athena-skeleton-line", skeleton.element).length, 3);
        equal(skeleton.element.getAttribute("role"), "status");
        equal(getComputedStyle($1(".athena-skeleton-line", skeleton.element)).animationName, "athena-shimmer");
        skeleton.destroy();
    });
    const chart = A.generateChart({ parent: "mc", id: "m-reduced", type: "bar", labels: ["a"], series: [{ data: [3] }] });
    equal(getComputedStyle($1("#m-reduced .chart-bar")).animationDuration, "0s", "reduced: the animation has no length");
    chart.destroy();
    const skeleton = A.generateSkeleton({ parent: "mc" });
    equal(getComputedStyle($1(".athena-skeleton-line", skeleton.element)).animationName, "none");
    $1("#mc").remove();
});

test("motion: a theme change cross-fades, the router can use a view transition, a table slides its rows", async () => {
    // the theme manager
    const root = document.documentElement;
    const saved = { theme: root.dataset.theme, mode: root.dataset.mode };
    const manager = A.createThemeManager({ themes: [{ id: "a" }, { id: "b" }], storageKey: "athena.test.motion" });
    await withMotion(async () => {
        manager.setTheme("b");
        assert(root.classList.contains("athena-switching"), "crossfading");
        await waitUntil(() => !root.classList.contains("athena-switching"), "the class goes away again", 2000);
    });
    manager.setMode("dark");
    assert(!root.classList.contains("athena-switching"), "reduced: no cross-fade");
    manager.destroy();
    localStorage.removeItem("athena.test.motion");
    if (saved.theme) root.dataset.theme = saved.theme; else delete root.dataset.theme;
    if (saved.mode) root.dataset.mode = saved.mode; else delete root.dataset.mode;

    // the router
    const real = document.startViewTransition;
    let started = 0;
    document.startViewTransition = update => {
        started++;
        const done = Promise.resolve(update());
        return { updateCallbackDone: done, finished: done };
    };
    const host = document.getElementById("wrapper");
    const router = A.createRouter({ mode: "hash", outlet: "wrapper", transition: true, routes: { "/m1": () => { host.textContent = "page one"; }, "/m2": () => { host.textContent = "page two"; } } });
    try {
        await withMotion(async () => {
            router.start();
            location.hash = "#/m1";
            await waitUntil(() => host.textContent === "page one", "page one is drawn");
            location.hash = "#/m2";
            await waitUntil(() => host.textContent === "page two", "page two is drawn");
            assert(started >= 2, "both changes were view transitions: " + started);
        });
        const before = started;
        location.hash = "#/m1";
        await waitUntil(() => host.textContent === "page one", "reduced: page one again");
        equal(started, before, "reduced: no view transition");
    } finally {
        router.stop();
        document.startViewTransition = real;
        location.hash = "";
        await tick(60);
    }

    // the table
    const table = A.generateTable({ parent: "wrapper", id: "anim-table", animateRows: true, columns: [{ key: "n", label: "N" }], rows: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }] });
    await withMotion(async () => {
        $1("#anim-table thead th").click();     // sort ascending: nothing moves
        $1("#anim-table thead th").click();     // descending: the rows change places
        const moving = $$("#anim-table tbody tr").filter(tr => tr.getAnimations().length > 0);
        assert(moving.length >= 2, "rows slide: " + moving.length);
        equal($1("#anim-table tbody tr td").textContent, "4");
    });
    table.destroy();
});

/* ------------------WIDGETS------------------- */

const widgetLog = { rendered: [], destroyed: [], updated: [] };
A.registerWidget("t-note", {
    title: "Note", defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 }, maxSize: { w: 6, h: 4 }, defaultConfig: { text: "hello" },
    configForm: [{ name: "text", label: "Text", type: "text" }],
    render(context) {
        widgetLog.rendered.push(context.id);
        const text = document.createElement("p");
        text.className = "note-text";
        text.textContent = context.config.text;
        context.element.append(text);
        return {
            update(next) { widgetLog.updated.push(next.id); text.textContent = next.config.text; },
            destroy() { widgetLog.destroyed.push(context.id); }
        };
    }
});
const makeGrid = (options = {}) => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="wg"></div>');
    return A.createWidgetGrid({ element: "wg", rowHeight: 80, gap: 12, ...options });
};
const noteAt = (id, x, y, extra = {}) => ({ type: "t-note", id, x, y, ...extra });
const placeOf = (grid, id) => grid.getLayout().widgets.find(widget => widget.id === id).layouts.default;
const ptr = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, pointerId: 7, isPrimary: true }));
const press = (target, name, options = {}) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options }));
const strides = () => {
    const rect = $1("#wg").getBoundingClientRect();
    return { x: (rect.width - 12 * 11) / 12 + 12, y: 92 };
};
const widgetsCleanup = grid => {
    grid.destroy();
    $1("#wg")?.remove();
};

test("widgets: places are classes (no style attribute), widgets render when visible, the registry decides what can be added", async () => {
    widgetLog.rendered.length = 0;
    widgetLog.destroyed.length = 0;
    const grid = makeGrid({ widgets: [noteAt("a", 0, 0), noteAt("b", 3, 0, { title: "Second", config: { text: "two" } })] });
    await waitUntil(() => widgetLog.rendered.length === 2, "both widgets rendered");
    equal($$("#wg [style]").length + ($1("#wg").hasAttribute("style") ? 1 : 0), 0, "no style attribute anywhere");
    const a = $1('[data-widget-id="a"]');
    const b = $1('[data-widget-id="b"]');
    equal(getComputedStyle(a).gridColumnStart, "1");
    equal(getComputedStyle(b).gridColumnStart, "4");
    equal(getComputedStyle(a).gridColumnEnd, "span 3");
    equal(getComputedStyle(a).gridRowEnd, "span 2");
    const container = $1("#wg").getBoundingClientRect();
    assert(Math.abs(a.getBoundingClientRect().width - (container.width - 132) / 12 * 3 - 24) < 2, "a is three columns wide: " + a.getBoundingClientRect().width);
    equal(a.getBoundingClientRect().height, 80 * 2 + 12, "two rows high");
    equal($1(".widget-title", b).textContent, "Second");
    equal($1(".note-text", b).textContent, "two");
    equal($1(".note-text", a).textContent, "hello", "the default config");
    equal(grid.getBreakpoint(), "default");
    let failure = "";
    try { grid.addWidget("nobody"); } catch (error) { failure = error.message; }
    assert(failure.includes("not registered"), "an unknown type is refused: " + failure);
    assert(A.getWidgetTypes().includes("t-note"));
    widgetsCleanup(grid);
    equal(widgetLog.destroyed.sort().join(), "a,b", "destroy cleans up every widget");
});

test("widgets: the keyboard picks up, moves, resizes, drops and cancels; the position is announced; undo and redo", async () => {
    const changes = [];
    const grid = makeGrid({ editable: true, widgets: [noteAt("a", 0, 0), noteAt("b", 3, 0)], onChange: (layout, reason) => changes.push(reason) });
    changes.length = 0;
    await tick(50);
    const live = $1("#wg").nextElementSibling;
    equal(live.getAttribute("role"), "status");
    const handle = $1('[data-widget-id="a"] .widget-handle');
    handle.focus();
    press(handle, " ");
    equal(handle.getAttribute("aria-pressed"), "true");
    assert(live.textContent.includes("picked up"), "announced: " + live.textContent);
    press(handle, "ArrowRight");
    equal(placeOf(grid, "a").x, 1);
    equal(placeOf(grid, "b").y, 2, "b is pushed down, out of the way");
    assert(/Column 2, row 1, 3 wide, 2 high/.test(live.textContent), "the position is read out: " + live.textContent);
    press(handle, "Enter");
    assert(!handle.hasAttribute("aria-pressed"), "dropped");
    equal(changes.join(), "move");
    // undo / redo
    equal(grid.canUndo(), true);
    grid.undo();
    equal(placeOf(grid, "a").x, 0);
    equal(placeOf(grid, "b").y, 0);
    equal(grid.canRedo(), true);
    grid.redo();
    equal(placeOf(grid, "a").x, 1);
    // cancel
    press(handle, " ");
    press(handle, "ArrowRight");
    press(handle, "ArrowRight");
    equal(placeOf(grid, "a").x, 3);
    press(handle, "Escape");
    equal(placeOf(grid, "a").x, 1, "Escape puts it back");
    equal(changes.filter(reason => reason === "move").length, 1, "a cancelled move is not a change");
    // resize: Shift + arrows, within the limits of the type (2..6 wide)
    press(handle, " ");
    for (let i = 0; i < 6; i++) press(handle, "ArrowRight", { shiftKey: true });
    equal(placeOf(grid, "a").w, 6, "at most 6 wide");
    for (let i = 0; i < 6; i++) press(handle, "ArrowLeft", { shiftKey: true });
    equal(placeOf(grid, "a").w, 2, "at least 2 wide");
    press(handle, "Enter");
    assert(changes.includes("resize"), "the drop of a resize says resize: " + changes);
    widgetsCleanup(grid);
});

test("widgets: a locked widget does not move and is not pushed; a move that would land on it is refused", async () => {
    const grid = makeGrid({ editable: true, widgets: [noteAt("a", 0, 0, { locked: true }), noteAt("b", 3, 0)] });
    await tick(50);
    const live = $1("#wg").nextElementSibling;
    const handleA = $1('[data-widget-id="a"] .widget-handle');
    press(handleA, " ");
    assert(!handleA.hasAttribute("aria-pressed"), "a locked widget cannot be picked up");
    const handleB = $1('[data-widget-id="b"] .widget-handle');
    handleB.focus();
    press(handleB, " ");
    press(handleB, "ArrowLeft");
    equal(placeOf(grid, "b").x, 3, "b cannot go onto the locked widget");
    assert(live.textContent.includes("Not possible"), "announced: " + live.textContent);
    press(handleB, "Escape");
    equal(getComputedStyle($1('[data-widget-id="a"] .widget-handle')).display, "none", "no handle on a locked widget");
    grid.lockWidget("a", false);
    assert(getComputedStyle($1('[data-widget-id="a"] .widget-handle')).display !== "none", "the handle is back when it is unlocked");
    widgetsCleanup(grid);
});

test("widgets: the pointer moves by the handle and resizes by the edges, snapping to cells", async () => {
    const changes = [];
    const grid = makeGrid({ editable: true, widgets: [noteAt("a", 0, 0), noteAt("c", 9, 0)], onChange: (layout, reason) => changes.push(reason) });
    changes.length = 0;
    await tick(50);
    const { x: stepX, y: stepY } = strides();
    const handle = $1('[data-widget-id="a"] .widget-handle');
    const start = handle.getBoundingClientRect();
    ptr("pointerdown", handle, start.left + 5, start.top + 5);
    assert($1('[data-widget-id="a"]').classList.contains("is-dragging"), "is dragging");
    ptr("pointermove", handle, start.left + 5 + stepX * 2.2, start.top + 5 + stepY * 1.1);
    equal(placeOf(grid, "a").x, 2, "two columns to the right (snapped)");
    ptr("pointermove", handle, start.left + 5 + stepX * 30, start.top + 5);
    equal(placeOf(grid, "a").x, 9, "stops at the right edge: 12 columns - 3 wide");
    ptr("pointerup", handle, start.left, start.top);
    assert(!$1('[data-widget-id="a"]').classList.contains("is-dragging"));
    equal(changes.join(), "move");
    equal($$("#wg [style]").length, 0, "the drag wrote no style attribute");
    // resize by the south-east corner
    const corner = $1('[data-widget-id="a"] .widget-resize-se');
    const at = corner.getBoundingClientRect();
    ptr("pointerdown", corner, at.left + 3, at.top + 3);
    ptr("pointermove", corner, at.left + 3 + stepX, at.top + 3 + stepY);
    ptr("pointerup", corner, at.left + 3, at.top + 3);
    equal(placeOf(grid, "a").w, 4);
    equal(placeOf(grid, "a").h, 3);
    // the west edge: grows to the left, the right edge stays
    const west = $1('[data-widget-id="a"] .widget-resize-w');
    const edge = west.getBoundingClientRect();
    const right = placeOf(grid, "a").x + placeOf(grid, "a").w;
    ptr("pointerdown", west, edge.left + 2, edge.top + 20);
    ptr("pointermove", west, edge.left + 2 - stepX, edge.top + 20);
    ptr("pointerup", west, edge.left + 2 - stepX, edge.top + 20);
    equal(placeOf(grid, "a").w, 5);
    equal(placeOf(grid, "a").x + placeOf(grid, "a").w, right, "the right edge did not move");
    equal(changes.join(), "move,resize,resize");
    // not editable: nothing happens
    grid.setEditable(false);
    const before = JSON.stringify(grid.getLayout());
    const h2 = $1('[data-widget-id="a"] .widget-handle');
    ptr("pointerdown", h2, 10, 10);
    ptr("pointermove", h2, 10 + stepX * 3, 10);
    ptr("pointerup", h2, 10, 10);
    equal(JSON.stringify(grid.getLayout()), before, "not editable: no move");
    widgetsCleanup(grid);
});

test("widgets: settings dialog, duplicate and remove from the buttons of the edit mode", async () => {
    const changes = [];
    const grid = makeGrid({ editable: true, widgets: [noteAt("a", 0, 0)], onChange: (layout, reason) => changes.push(reason) });
    changes.length = 0;
    await waitUntil(() => $1('[data-widget-id="a"] .note-text'), "rendered");
    $1('[data-widget-id="a"] .widget-action[data-action="settings"]').click();
    await waitUntil(() => $1('dialog.dialog[open] input[name="widgetTitle"]'), "the settings dialog is open");
    const title = $1('dialog.dialog[open] input[name="widgetTitle"]');
    const text = $1('dialog.dialog[open] input[name="text"]');
    equal(title.value, "Note");
    equal(text.value, "hello");
    title.value = "Renamed";
    text.value = "changed";
    $1("dialog.dialog[open] form").requestSubmit();
    await waitUntil(() => $1('[data-widget-id="a"] .widget-title').textContent === "Renamed" && $1('[data-widget-id="a"] .note-text').textContent === "changed", "title and text changed");
    assert(widgetLog.updated.includes("a"), "the widget got update(), not a new render");
    assert(changes.includes("settings"), "reported: " + changes);
    $1('[data-widget-id="a"] .widget-action[data-action="duplicate"]').click();
    equal(grid.getWidgets().length, 2);
    const copy = grid.getLayout().widgets.find(widget => widget.id !== "a");
    equal(copy.title, "Renamed (copy)");
    equal(copy.config.text, "changed");
    const one = placeOf(grid, "a");
    const two = copy.layouts.default;
    assert(two.y >= one.y + one.h || two.x >= one.x + one.w, "the copy does not overlap the original");
    $1(`[data-widget-id="${copy.id}"] .widget-action[data-action="remove"]`).click();
    equal(grid.getWidgets().join(), "a");
    assert(changes.includes("duplicate") || changes.includes("add"), "the copy was reported");
    assert(changes.includes("remove"));
    widgetsCleanup(grid);
});

test("widgets: layouts are plain versioned JSON; a hostile layout is cleaned, unknown types are placeholders", async () => {
    const grid = makeGrid({ widgets: [noteAt("a", 0, 0)] });
    const saved = grid.getLayout();
    equal(saved.version, 1);
    equal(JSON.parse(JSON.stringify(saved)).widgets[0].type, "t-note", "plain JSON");
    const hostile = {
        version: 1,
        widgets: [
            { id: "x1", type: "t-note", title: "<img src=x onerror=alert(1)>", config: JSON.parse('{"text":"ok","__proto__":{"polluted":"yes"}}'), layouts: { default: { x: 0, y: 0, w: 3, h: 2 } } },
            { id: "x1", type: "t-note", layouts: { default: { x: 0, y: 0, w: 3, h: 2 } } },
            { type: "ghost", title: "Ghost", config: { keep: 1 }, layouts: { default: { x: 6, y: 0, w: 3, h: 2 } } },
            { type: "<script>", layouts: {} },
            "text", null,
            { type: "t-note", layouts: { default: { x: "a", y: 0, w: 1, h: 1 } } }
        ]
    };
    const warn = console.warn;
    console.warn = () => {};
    let result;
    try { result = grid.setLayout(hostile); } finally { console.warn = warn; }
    equal(result.loaded, 4);
    equal(result.skipped.length, 3);
    equal(({}).polluted, undefined, "no prototype pollution");
    const widgets = grid.getLayout().widgets;
    equal(new Set(widgets.map(widget => widget.id)).size, 4, "ids are unique");
    const places = widgets.map(widget => ({ id: widget.id, ...widget.layouts.default }));
    for (const one of places) for (const other of places) assert(!A.collides(one, other), "no overlap between " + one.id + " and " + other.id);
    await waitUntil(() => $$("#wg .widget-note").length === 1, "the ghost is a placeholder");
    assert($1("#wg .widget-note").textContent.includes('"ghost"'), $1("#wg .widget-note").textContent);
    equal(widgets.find(widget => widget.type === "ghost").config.keep, 1, "the data of an unknown type is kept");
    equal($$("#wg img").length, 0, "a title is text, not markup");
    assert($$("#wg .widget-title").some(node => node.textContent.includes("<img")), "it is shown as the text it is");
    let failure = "";
    try { grid.setLayout({ version: 2, widgets: [] }); } catch (error) { failure = error.message; }
    assert(failure.includes("version"), "an unknown version is refused: " + failure);
    grid.setLayout(saved);
    equal(grid.getWidgets().join(), "a", "the saved layout loads again");
    equal(grid.canUndo(), false, "loading starts a new history");
    widgetsCleanup(grid);
});

test("widgets: breakpoints give every width a layout; widgets below the fold render only when they are seen", async () => {
    widgetLog.rendered.length = 0;
    const narrow = makeGrid({ breakpoints: { wide: { minWidth: 100000, columns: 12 }, narrow: { minWidth: 0, columns: 4 } }, widgets: [noteAt("a", 0, 0), noteAt("b", 3, 0), noteAt("c", 6, 0)] });
    equal(narrow.getBreakpoint(), "narrow");
    const places = narrow.getLayout().widgets.map(widget => ({ id: widget.id, ...widget.layouts.narrow }));
    for (const one of places) {
        assert(one.x >= 0 && one.x + one.w <= 4, "inside four columns: " + JSON.stringify(one));
        for (const other of places) assert(!A.collides(one, other), "no overlap");
    }
    equal(getComputedStyle($1("#wg")).gridTemplateColumns.split(" ").length, 4, "four columns");
    widgetsCleanup(narrow);

    widgetLog.rendered.length = 0;
    const far = makeGrid({ compact: false, widgets: [noteAt("near", 0, 0), noteAt("far", 0, 40)] });
    await waitUntil(() => widgetLog.rendered.includes("near"), "the visible one is rendered");
    await tick(150);
    assert(!widgetLog.rendered.includes("far"), "the one far below is not rendered yet");
    $1('[data-widget-id="far"]').scrollIntoView();
    await waitUntil(() => widgetLog.rendered.includes("far"), "rendered when scrolled into view");
    window.scrollTo(0, 0);
    widgetsCleanup(far);
});

test("widgets: the grid maths is exported with the grid", () => {
    const items = [{ id: "a", x: 0, y: 0, w: 2, h: 2 }, { id: "b", x: 2, y: 0, w: 2, h: 2 }];
    equal(A.collides(items[0], items[1]), false);
    const moved = A.placeItem(items, "a", { x: 1 }, 4);
    equal(moved.find(item => item.id === "b").y, 2, "the one in the way is pushed down");
    equal(items[0].x, 0, "the argument is not changed");
    equal(JSON.stringify(A.findFreeSpot(items, 2, 2, 4)), JSON.stringify({ x: 0, y: 2 }));
});

/* ------------------CODE------------------- */

const codeHost = () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="ed"></div>');
    return $1("#ed");
};
const makeEditor = (options = {}) => A.createCodeEditor({ element: codeHost(), language: "js", ...options });
const keydown = (editor, name, options = {}) => {
    const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options });
    editor.textarea.dispatchEvent(event);
    return event;
};
// types text the way a browser does: beforeinput first (the editor may handle it), then the character and an input event
const typeText = (editor, text) => {
    const area = editor.textarea;
    for (const character of text) {
        const before = new InputEvent("beforeinput", { inputType: "insertText", data: character, bubbles: true, cancelable: true });
        area.dispatchEvent(before);
        if (before.defaultPrevented) continue;
        const { selectionStart: start, selectionEnd: end, value } = area;
        area.value = value.slice(0, start) + character + value.slice(end);
        area.setSelectionRange(start + 1, start + 1);
        area.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: character, bubbles: true }));
    }
};
const backspace = editor => {
    const area = editor.textarea;
    const before = new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true });
    area.dispatchEvent(before);
    if (before.defaultPrevented) return;
    const { selectionStart: start, selectionEnd: end, value } = area;
    const from = start === end ? Math.max(0, start - 1) : start;
    area.value = value.slice(0, from) + value.slice(end);
    area.setSelectionRange(from, from);
    area.dispatchEvent(new InputEvent("input", { inputType: "deleteContentBackward", bubbles: true }));
};
const destroyEditor = editor => {
    editor.destroy();
    $1("#ed")?.remove();
};

test("code: highlightCode builds lines and token spans, code stays text, line numbers and highlighted lines work", () => {
    const pre = A.highlightCode('const a = "x";\n// <img src=x onerror=alert(1)>\nfoo(1)', "js", { lineNumbers: true, highlightLines: [2, "3-3"] });
    document.getElementById("wrapper").append(pre);
    equal(pre.tagName, "PRE");
    assert(pre.classList.contains("athena-code") && pre.classList.contains("has-line-numbers"));
    equal($1("code", pre).className, "language-javascript");
    equal($$(".code-line", pre).length, 3);
    equal($$(".code-line.is-highlighted", pre).length, 2);
    equal($1(".tok-keyword", pre).textContent, "const");
    equal($1(".tok-string", pre).textContent, '"x"');
    equal($$("img", pre).length, 0, "an <img> in a comment is text");
    assert($1(".tok-comment", pre).textContent.includes("<img src=x"));
    assert(getComputedStyle($1(".code-line", pre), "::before").content.includes("counter(line)"), "line numbers are CSS counters, not text");
    assert(!pre.textContent.includes("1const"), "the numbers are not in the text");
    equal(pre.hasAttribute("style") || $$("[style]", pre).length > 0, false, "no style attribute");
    equal($1(".tok-keyword", pre).textContent, "const");
    const colour = getComputedStyle($1(".tok-keyword", pre)).color;
    const plain = getComputedStyle($1("code", pre)).color;
    assert(colour !== plain, "tokens have their own colour: " + colour);
    const unknown = A.highlightCode("x = 1", "nonsense");
    equal($$(".code-line > span", unknown).length, 0, "an unknown language is plain text");
    equal(unknown.textContent, "x = 1");
});

test("code: a code block has the language, the copy button and the code; setCode redraws", async () => {
    const block = A.generateCodeBlock({ parent: "wrapper", code: "select 1;", language: "sql", lineNumbers: true });
    equal($1(".code-block-language", block.element).textContent, "SQL");
    equal(block.getCode(), "select 1;");
    equal($1(".tok-keyword", block.element).textContent, "select");
    const done = await block.copy();
    equal(typeof done, "boolean");
    assert(/Cop/.test($1(".code-block-copy", block.element).textContent), "the button says what happened: " + $1(".code-block-copy", block.element).textContent);
    block.setCode("let x = 1", "ts");
    equal($1(".code-block-language", block.element).textContent, "TypeScript");
    equal($1(".tok-keyword", block.element).textContent, "let");
    equal(A.generateCodeBlock({ parent: "wrapper", code: "x", copy: false }).element.querySelector(".code-block-copy"), null, "copy: false");
    equal($1("pre", block.element).getAttribute("tabindex"), "0", "a scrollable block can be reached with the keyboard");
});

test("code: the diff view shows added and removed lines, hides long unchanged parts, and has a split mode", () => {
    const old = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const changed = old.replace("line 10", "line TEN").replace("line 11\n", "");
    const view = A.createDiffView({ parent: "wrapper", original: old, modified: changed, language: "js", context: 2 });
    equal(view.getStats().added, 1);
    equal(view.getStats().removed, 2);
    equal($$(".code-diff-cell.is-added", view.element).length, 1);
    equal($$(".code-diff-cell.is-removed", view.element).length, 2);
    assert($$(".code-diff-skip", view.element).length === 2, "unchanged lines before and after are folded");
    assert($1(".code-diff-skip", view.element).textContent.includes("unchanged"));
    assert($1(".code-diff-cell.is-added .athena-visually-hidden", view.element).textContent.includes("added"), "a screen reader is told");
    $1(".code-diff-skip", view.element).click();
    equal($$(".code-diff-skip", view.element).length, 0, "everything is shown after the click");
    equal($$(".code-diff-cell.is-equal", view.element).length, 18);
    view.setMode("split");
    equal(view.element.dataset.mode, "split");
    assert($$(".code-diff-row", view.element).every(row => $$(".code-diff-cell", row).length === 2 || row.classList.contains("is-skip")), "two cells per row");
    view.setTexts("same", "same");
    assert($1(".code-diff-empty", view.element), "no differences");
    view.setTexts("a", "b");
    equal(view.getStats().added + view.getStats().removed, 2);
});

test("code editor: a textarea over highlighted lines, the same font and padding, line numbers, current line, position", async () => {
    const editor = makeEditor({ value: "const a = 1;\nfoo(a);\n" });
    equal(editor.getValue(), "const a = 1;\nfoo(a);\n");
    equal($$(".code-line", editor.element).length, 3, "two lines and the empty last one");
    equal($1(".tok-keyword", editor.element).textContent, "const");
    const area = editor.textarea;
    const pre = $1(".code-editor-highlight", editor.element);
    for (const property of ["fontFamily", "fontSize", "lineHeight", "paddingTop", "tabSize", "whiteSpace"]) {
        equal(getComputedStyle(area)[property], getComputedStyle(pre)[property], property + " is the same in the textarea and the highlighted text");
    }
    equal(Math.round(area.getBoundingClientRect().height), Math.round(pre.getBoundingClientRect().height), "same height");
    const textStart = $1(".tok-keyword", pre).getBoundingClientRect().left - pre.getBoundingClientRect().left;
    assert(Math.abs(textStart - parseFloat(getComputedStyle(area).paddingLeft)) < 1.5, "the text starts where the textarea's text starts: " + textStart + " / " + getComputedStyle(area).paddingLeft);
    equal(area.getAttribute("spellcheck"), "false");
    assert(area.getAttribute("aria-label"), "a name");
    assert($1(`#${area.getAttribute("aria-describedby")}`, editor.element).textContent.includes("Escape"), "the way out is described");
    editor.setSelection(14);
    assert($$(".code-line", editor.element)[1].classList.contains("is-current"), "line 2 is the current line");
    assert($1(".code-editor-position", editor.element).textContent.includes("Line 2, column 2"), $1(".code-editor-position", editor.element).textContent);
    equal($$("#ed [style]").length, 0, "no style attribute");
    editor.setLanguage("json");
    editor.setValue("{\"a\": 1}");
    equal($1(".tok-property", editor.element).textContent, '"a"');
    editor.setLanguage("css");
    equal($$(".tok-property", editor.element).length, 0, "a new language is drawn again");
    destroyEditor(editor);
});

test("code editor: Tab indents, Shift+Tab outdents, Escape then Tab leaves, Enter keeps and adds indentation", () => {
    const editor = makeEditor({ value: "a\nb" });
    editor.setSelection(0);
    const tab = keydown(editor, "Tab");
    assert(tab.defaultPrevented, "Tab is taken by the editor");
    equal(editor.getValue(), "    a\nb");
    editor.setSelection(0, editor.getValue().length);
    keydown(editor, "Tab");
    equal(editor.getValue(), "        a\n    b", "all selected lines are indented");
    keydown(editor, "Tab", { shiftKey: true });
    equal(editor.getValue(), "    a\nb", "and outdented");
    keydown(editor, "Escape");
    const leave = keydown(editor, "Tab");
    assert(!leave.defaultPrevented, "Escape, then Tab, goes to the next control");
    assert(keydown(editor, "Tab").defaultPrevented, "and the next Tab indents again");
    editor.setValue("if (x) {");
    editor.setSelection(8);
    keydown(editor, "Enter");
    equal(editor.getValue(), "if (x) {\n    ", "a line that opens a block makes the next one deeper");
    editor.setValue("    foo();");
    editor.setSelection(10);
    keydown(editor, "Enter");
    equal(editor.getValue(), "    foo();\n    ", "the indentation is kept");
    editor.setValue("f({})");
    editor.setSelection(3);
    keydown(editor, "Enter");
    equal(editor.getValue(), "f({\n    \n})", "between a pair, the closing one goes to its own line");
    equal(editor.getSelection().line, 2);
    destroyEditor(editor);
});

test("code editor: brackets and quotes are closed, stepped over, wrapped around a selection and deleted together", () => {
    const editor = makeEditor({ value: "" });
    typeText(editor, "foo(");
    equal(editor.getValue(), "foo()", "the bracket is closed");
    typeText(editor, ")");
    equal(editor.getValue(), "foo()", "typing the closing one steps over it");
    equal(editor.getSelection().start, 5);
    editor.setValue("");
    typeText(editor, '"');
    equal(editor.getValue(), '""');
    backspace(editor);
    equal(editor.getValue(), "", "Backspace between a pair removes both");
    editor.setValue("it");
    editor.setSelection(2);
    typeText(editor, "'");
    equal(editor.getValue(), "it'", "a quote after a word is an apostrophe: not closed");
    editor.setValue("word");
    editor.setSelection(0, 4);
    typeText(editor, "(");
    equal(editor.getValue(), "(word)", "a selection is wrapped");
    equal(editor.getSelection().start, 1);
    equal(editor.getSelection().end, 5, "and stays selected");
    editor.setValue("");
    editor.setLanguage("json");
    typeText(editor, "[");
    equal(editor.getValue(), "[]");
    editor.setLanguage("nonsense");
    editor.setValue("");
    typeText(editor, "(");
    equal(editor.getValue(), "(", "no language, no closing");
    destroyEditor(editor);
});

test("code editor: undo and redo are the editor's own (typing is grouped), comments toggle, lines move", () => {
    const changes = [];
    const editor = makeEditor({ value: "one\ntwo\nthree", onChange: (value, reason) => changes.push(reason) });
    editor.setSelection(3);
    typeText(editor, " more");
    equal(editor.getValue(), "one more\ntwo\nthree");
    keydown(editor, "Enter");
    keydown(editor, "z", { ctrlKey: true });
    equal(editor.getValue(), "one more\ntwo\nthree", "Ctrl+Z took back the Enter, not the typing");
    keydown(editor, "z", { ctrlKey: true });
    equal(editor.getValue(), "one\ntwo\nthree", "the typed word is one step");
    equal(editor.canUndo(), false);
    equal(editor.canRedo(), true);
    keydown(editor, "z", { ctrlKey: true, shiftKey: true });
    equal(editor.getValue(), "one more\ntwo\nthree", "Ctrl+Shift+Z redoes");
    keydown(editor, "y", { ctrlKey: true });
    assert(editor.getValue().includes("\n"), "Ctrl+Y redoes");
    assert(changes.includes("undo") && changes.includes("redo"), "reported: " + changes);
    // comments
    editor.setValue("a();\n  b();\n\nc();");
    editor.setSelection(0, editor.getValue().length);
    keydown(editor, "/", { ctrlKey: true });
    equal(editor.getValue(), "// a();\n//   b();\n\n// c();", "comments go at the start of the lines that have text");
    keydown(editor, "/", { ctrlKey: true });
    equal(editor.getValue(), "a();\n  b();\n\nc();", "toggled back");
    editor.setLanguage("html");
    editor.setValue("<p>x</p>");
    editor.setSelection(0);
    keydown(editor, "/", { ctrlKey: true });
    equal(editor.getValue(), "<!-- <p>x</p> -->", "a language with only block comments wraps the line");
    keydown(editor, "/", { ctrlKey: true });
    equal(editor.getValue(), "<p>x</p>");
    // move lines
    editor.setLanguage("js");
    editor.setValue("1\n2\n3");
    editor.setSelection(2);
    keydown(editor, "ArrowDown", { altKey: true });
    equal(editor.getValue(), "1\n3\n2");
    keydown(editor, "ArrowUp", { altKey: true });
    equal(editor.getValue(), "1\n2\n3");
    equal(editor.getSelection().line, 2, "the caret went along");
    destroyEditor(editor);
});

test("code editor: read-only mode and read-only lines cannot be changed", () => {
    const editor = makeEditor({ value: "locked\nfree\nalso free", readOnlyRanges: [{ from: 1, to: 1 }] });
    assert($$(".code-line", editor.element)[0].classList.contains("is-locked-line"), "locked lines are drawn differently");
    editor.setSelection(3);
    const attempt = new InputEvent("beforeinput", { inputType: "insertText", data: "x", bubbles: true, cancelable: true });
    editor.textarea.dispatchEvent(attempt);
    assert(attempt.defaultPrevented, "typing in a locked line is refused");
    equal(editor.insertText("x"), false);
    editor.setSelection(7);
    const join = new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true });
    editor.textarea.dispatchEvent(join);
    assert(join.defaultPrevented, "Backspace at the start of the next line would join it to the locked one");
    editor.setSelection(11);
    typeText(editor, "!");
    equal(editor.getValue(), "locked\nfree!\nalso free", "other lines can be edited");
    editor.setSelection(0, editor.getValue().length);
    keydown(editor, "Tab");
    equal(editor.getValue().split("\n")[0], "locked", "indenting everything leaves the locked line alone");
    editor.setReadOnlyRanges([]);
    editor.setReadOnly(true);
    assert(editor.element.classList.contains("is-readonly") && editor.textarea.readOnly);
    editor.setSelection(0);
    keydown(editor, "Tab");
    equal(editor.getValue().startsWith("locked"), true, "read only: Tab does nothing");
    equal(editor.insertText("x"), false);
    editor.setReadOnly(false);
    equal(editor.insertText("x"), true);
    destroyEditor(editor);
});

test("code editor: find and replace", () => {
    const editor = makeEditor({ value: "Foo foo FOO bar\nfoo" });
    editor.focus();
    keydown(editor, "f", { ctrlKey: true });
    const bar = $1(".code-find", editor.element);
    assert(bar && !bar.hidden, "the find bar is open");
    const find = $1('input[name="find"]', bar);
    const replace = $1('input[name="replace"]', bar);
    find.value = "foo";
    find.dispatchEvent(new Event("input", { bubbles: true }));
    equal($1(".code-find-count", bar).textContent, "1 of 4", "case-insensitive: four matches, the first is selected");
    equal(editor.getSelection().start, 0);
    find.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    equal(editor.getSelection().start, 4, "Enter goes to the next one");
    $$(".code-find-button", bar).find(button => button.title === "Match case").click();
    equal($1(".code-find-count", bar).textContent.endsWith("of 2"), true, "match case: two matches");
    $$(".code-find-button", bar).find(button => button.title === "Match case").click();
    replace.value = "baz";
    replace.dispatchEvent(new Event("input", { bubbles: true }));
    $$(".code-find-button", bar).find(button => button.title === "Replace").click();
    assert(editor.getValue().includes("baz"), "one replaced: " + editor.getValue());
    $$(".code-find-button", bar).find(button => button.title === "Replace all").click();
    equal(editor.getValue(), "baz baz baz bar\nbaz");
    equal(editor.canUndo(), true);
    keydown(editor, "z", { ctrlKey: true });
    assert(editor.getValue().includes("foo") || editor.getValue().includes("Foo"), "replace all is one undo step");
    // a regular expression, and a broken one
    $$(".code-find-button", bar).find(button => button.title === "Regular expression").click();
    find.value = "(";
    find.dispatchEvent(new Event("input", { bubbles: true }));
    equal(find.getAttribute("aria-invalid"), "true");
    equal($1(".code-find-count", bar).textContent, "Invalid pattern");
    find.value = "ba[rz]";
    find.dispatchEvent(new Event("input", { bubbles: true }));
    equal(find.getAttribute("aria-invalid"), "false");
    // Escape closes and the focus goes back to the text
    find.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert(bar.hidden, "closed");
    equal(document.activeElement, editor.textarea);
    destroyEditor(editor);
});

test("code editor: markers, the status line, and decorations that survive typing", () => {
    const editor = makeEditor({ value: "a\nb\nc", markers: [{ line: 2, message: "Boom", level: "error" }, { line: 3, message: "Careful", level: "warning" }] });
    const lines = () => $$(".code-line", editor.element);
    assert(lines()[1].classList.contains("marker-error") && lines()[2].classList.contains("marker-warning"));
    equal(lines()[0].classList.contains("has-marker"), false);
    editor.setSelection(2);
    assert($1(".code-editor-note", editor.element).textContent.includes("Boom"), "the message of the marker is in the status line");
    editor.setSelection(0);
    equal($1(".code-editor-note", editor.element).textContent, "");
    editor.setSelection(0);
    typeText(editor, "x");
    assert(lines()[1].classList.contains("marker-error"), "the marker is still there after typing");
    editor.setMarkers([]);
    equal($$(".has-marker", editor.element).length, 0);
    destroyEditor(editor);
});

test("code editor: completions come from the application, with the keyboard", async () => {
    const asked = [];
    const editor = makeEditor({
        value: "con", provideCompletions: context => {
            asked.push(context);
            return ["console", "const", "constructor"].filter(word => word.startsWith(context.prefix)).map(label => ({ label, detail: "js" }));
        }
    });
    editor.focus();
    editor.setSelection(3);
    keydown(editor, " ", { ctrlKey: true });
    await waitUntil(() => $1(".code-completions:not([hidden]) li", editor.element), "the list is open");
    equal(asked.at(-1).prefix, "con");
    equal(asked.at(-1).explicit, true);
    equal($$(".code-completions li", editor.element).length, 3);
    equal(editor.textarea.getAttribute("aria-activedescendant"), $1(".code-completion.is-active", editor.element).id);
    keydown(editor, "ArrowDown");
    equal($1(".code-completion.is-active .code-completion-label", editor.element).textContent, "const");
    keydown(editor, "Enter");
    equal(editor.getValue(), "const", "the typed part is replaced by the choice");
    assert($1(".code-completions", editor.element).hidden, "closed");
    keydown(editor, "Backspace");
    editor.setSelection(5);
    keydown(editor, " ", { ctrlKey: true });
    await waitUntil(() => !$1(".code-completions", editor.element).hidden, "open again");
    const escape = keydown(editor, "Escape");
    assert(escape.defaultPrevented && $1(".code-completions", editor.element).hidden, "Escape closes the list first");
    // typing asks by itself
    typeText(editor, "s");
    await waitUntil(() => asked.some(context => context.explicit === false), "asked while typing");
    destroyEditor(editor);
});

test("code editor: wrap, line numbers off, tab size, huge texts stay plain, and the large file is fast enough", () => {
    const wrapped = makeEditor({ value: "x ".repeat(400), wrap: true });
    assert(wrapped.element.classList.contains("code-wrap"));
    equal(wrapped.textarea.getAttribute("wrap"), "soft");
    equal(Math.round(wrapped.textarea.getBoundingClientRect().height), Math.round($1(".code-editor-highlight", wrapped.element).getBoundingClientRect().height), "a wrapped line is as high in both");
    assert(wrapped.textarea.getBoundingClientRect().height > 40, "it wraps");
    destroyEditor(wrapped);

    const bare = makeEditor({ value: "\tx", lineNumbers: false, tabSize: 2 });
    assert(!$1(".code-editor-highlight", bare.element).classList.contains("has-line-numbers"));
    equal(getComputedStyle(bare.textarea).tabSize, "2");
    destroyEditor(bare);

    const huge = makeEditor({ value: "x\n".repeat(200000), maxHighlightLength: 1000 });
    assert($1(".code-editor-highlight", huge.element).classList.contains("is-plain"), "too long: shown without highlighting");
    equal($$(".code-line", huge.element).length, 0);
    destroyEditor(huge);

    const source = "const value = foo(1, 'two', [3, 4]);\n".repeat(5000);
    let started = performance.now();
    const large = makeEditor({ value: source });
    const created = performance.now() - started;
    equal($$(".code-line", large.element).length, 5001);
    large.setSelection(0);
    started = performance.now();
    for (let i = 0; i < 5; i++) typeText(large, "x");
    const perKey = (performance.now() - started) / 5;
    assert(created < 4000, "5,000 lines built in " + Math.round(created) + " ms");
    assert(perKey < 1500, "a key press in 5,000 lines took " + Math.round(perKey) + " ms");
    large.setSelection(source.length);
    started = performance.now();
    typeText(large, "y");
    assert(performance.now() - started < 1500, "a key press at the end took " + Math.round(performance.now() - started) + " ms");
    destroyEditor(large);
});

test("code editor: tokenizing only the lines around a change gives exactly what tokenizing everything gives (random edits, four languages)", () => {
    const samples = {
        js: "const a = 1; /* one\ntwo */ const b = `x\ny`;\n// line\nfunction f(x) {\n    return x + 'z';\n}\n/* three */\nlet c = \"s\";",
        css: "/* a\nb */\na { color: red; }\n.b::after { content: 'x'; }\n@media (x) {\n  p { margin: 0 }\n}",
        python: 'def f(x):\n    """doc\n    more"""\n    return x  # c\n\nclass A:\n    pass\ns = \'\'\'t\nu\'\'\'',
        html: "<!-- a\nb -->\n<div class=\"x\">\n  <p>t &amp; u</p>\n</div>"
    };
    const pieces = ["/*", "*/", "`", '"', "'", "\n", "//", "x", " ", "'''", '"""', "{", "}", "\n  ", "<!--", "-->", "\\", "#", "(", ")", ";", "<p>", "</p>", "1"];
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const serialize = lines => lines.map(line => line.map(token => `${token.type ?? "_"}:${token.text}`).join("|"));
    for (const [language, source] of Object.entries(samples)) {
        const editor = makeEditor({ value: source, language });
        const code = $1("code", editor.element);
        for (let round = 0; round < 120; round++) {
            const value = editor.getValue();
            const at = Math.floor(random() * (value.length + 1));
            const remove = random() < 0.4 ? Math.floor(random() * 6) : 0;
            const piece = random() < 0.15 ? "" : pieces[Math.floor(random() * pieces.length)];
            editor.setSelection(at, Math.min(value.length, at + remove));
            editor.insertText(piece);
            const drawn = [...code.children].map(line => [...line.childNodes].map(node => (node.nodeType === Node.TEXT_NODE ? `_:${node.data}` : `${node.className.replace("tok-", "")}:${node.textContent}`)).join("|"));
            const expected = serialize(A.tokensToLines(A.tokenize(editor.getValue(), language)));
            if (JSON.stringify(drawn) !== JSON.stringify(expected)) {
                const line = drawn.findIndex((entry, index) => entry !== expected[index]);
                assert(false, `${language}, edit ${round} (${JSON.stringify(piece)} at ${at}, removed ${remove}): line ${line + 1} drawn ${drawn[line]} but ${expected[line]}`);
            }
            equal(drawn.length, editor.getValue().split("\n").length, "one span per line");
        }
        destroyEditor(editor);
    }
});

test("charts: timeFormat, points: false, a lone point has a tooltip, the arrow keys read the values", async () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="cr"></div>');
    const start = 1700000000000;
    const times = [0, 1, 2, 3, 4, 5].map(i => start + i * 60000);
    const handles = {};
    const chart = (id, options) => (handles[id] = A.generateChart({ parent: "cr", id, type: "line", times, interactive: true, table: true, ...options }));
    const tableCell = id => handles[id].dataTable.querySelector("tbody th");
    // timeFormat: a function, or the options of Intl
    chart("t-fn", { timeFormat: ms => "T" + (ms - start) / 60000, series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    assert($1("#t-fn .chart-point").getAttribute("aria-label").includes("T0"), "the tooltip uses the function: " + $1("#t-fn .chart-point").getAttribute("aria-label"));
    equal(tableCell("t-fn").textContent, "T0", "so does the table of values");
    chart("t-intl", { timeFormat: { hour: "2-digit", minute: "2-digit", hour12: false }, series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    assert(/\b\d\d:\d\d$/.test(tableCell("t-intl").textContent), "Intl options: " + tableCell("t-intl").textContent);
    chart("t-default", { series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    assert(tableCell("t-default").textContent.length > 12, "the default is the long form");
    // no dots
    chart("p-on", { series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    chart("p-off", { points: false, series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    equal($$("#p-on .chart-point").length, 6);
    equal($$("#p-off .chart-point").length, 0, "points: false draws no dots");
    assert($1("#p-off .chart-hit"), "the pointer layer is still there");
    // a lone point after a gap: a tooltip of its own, also without dots
    chart("l-1", { gaps: true, points: false, series: [{ name: "v", data: [1, 2, NaN, 4, NaN, 6] }] });
    const lone = $$("#l-1 .chart-lone-point");
    equal(lone.length, 2);
    assert(lone[0].getAttribute("tabindex") === "0" && lone[0].getAttribute("aria-label").includes("4"), "the lone point is named: " + lone[0].getAttribute("aria-label"));
    // the keyboard: arrows move the tooltip from point to point
    chart("k-1", { series: [{ name: "v", data: [10, 20, 30, 40, 50, 60] }] });
    const hit = $1("#k-1 .chart-hit");
    equal(hit.getAttribute("tabindex"), "0", "the plot can be focused without zoom");
    const shown = () => [...document.querySelectorAll("#k-1 text")].filter(t => t.closest(".is-visible")).map(t => t.textContent).join("|");
    key(hit, "ArrowRight");
    assert(shown().includes("10"), "the first point: " + shown());
    key(hit, "ArrowRight");
    assert(shown().includes("20"), "the next point: " + shown());
    key(hit, "End");
    assert(shown().includes("60"), "End: " + shown());
    key(hit, "ArrowRight");
    assert(shown().includes("60"), "stays at the last point: " + shown());
    key(hit, "ArrowLeft");
    assert(shown().includes("50"), "Left: " + shown());
    key(hit, "Home");
    assert(shown().includes("10"), "Home: " + shown());
    key(hit, "Escape");
    equal(shown(), "", "Escape hides it");
    // with zoom the arrows still pan: Alt + arrow reads
    const zooms = [];
    chart("k-2", { zoom: true, onZoom: range => zooms.push(range), series: [{ name: "v", data: [10, 20, 30, 40, 50, 60] }] });
    const hit2 = $1("#k-2 .chart-hit");
    key(hit2, "ArrowRight");
    assert([...document.querySelectorAll("#k-2 .is-visible")].length === 0, "a plain arrow pans, it does not read");
    key($1("#k-2 .chart-hit"), "ArrowRight", { altKey: true });      // the pan drew the chart again: the plot is a new node
    assert([...document.querySelectorAll("#k-2 .is-visible")].length === 1, "Alt + arrow reads");
    equal(zooms.length, 1, "and did not pan again");
});

test("charts: gaps break the line, timeRange sets the axis, format writes the numbers, margin moves the plot, responsive follows the parent", async () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="cg"></div>');
    const start = 1700000000000;
    const times = [0, 1, 2, 3, 4, 5].map(i => start + i * 60000);
    const chart = (id, options) => A.generateChart({ parent: "cg", id, type: "line", times, interactive: true, ...options });

    // gaps
    chart("c-skip", { series: [{ name: "v", data: [1, 2, NaN, 4, 5, 6] }] });
    equal($$("#c-skip .chart-line").length, 1, "without gaps the line goes on over the missing value");
    chart("c-gap", { gaps: true, series: [{ name: "v", data: [1, 2, NaN, 4, NaN, 6] }] });
    equal($$("#c-gap .chart-line").length, 1, "with gaps: one line for the two values that follow each other");
    equal($$("#c-gap .chart-lone-point").length, 2, "and a dot for each value on its own");
    chart("c-gap2", { gaps: true, type: "area", series: [{ name: "v", data: [1, 2, null, 4, 5, 6] }] });
    equal($$("#c-gap2 .chart-area").length, 2, "an area is broken too");

    // the time axis
    const x0 = id => Number($1(`#${id} .chart-point`).getAttribute("cx"));
    chart("c-fit", { series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    chart("c-range", { timeRange: { from: start - 5 * 60000, to: start + 5 * 60000 }, series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    equal(x0("c-fit"), 55, "the data starts at the left edge of the plot");
    assert(x0("c-range") > 150, "with a wider range the data starts later: " + x0("c-range"));

    // the number format and the margin
    chart("c-format", { format: value => `${value} ms`, margin: { top: 10, left: 30 }, series: [{ name: "v", data: [10, 20, 30, 40, 50, 60] }] });
    assert($$("#c-format .chart-tick").some(tick => tick.textContent.endsWith(" ms")), "the axis uses the format");
    assert($1("#c-format .chart-point").getAttribute("aria-label").includes("60 ms") || $$("#c-format .chart-point").some(dot => dot.getAttribute("aria-label").includes(" ms")), "so do the tooltips");
    equal($1("#c-format .chart-hit").getAttribute("x"), "30");
    equal($1("#c-format .chart-hit").getAttribute("y"), "10");
    chart("c-ticks", { format: value => `${value} ms`, tickFormat: value => `~${value}`, series: [{ name: "v", data: [10, 20, 30, 40, 50, 60] }] });
    assert($$("#c-ticks .chart-tick").some(tick => tick.textContent.startsWith("~")) && !$$("#c-ticks .chart-tick").some(tick => tick.textContent.endsWith(" ms")), "tickFormat is for the axis");
    assert($$("#c-ticks .chart-point").some(dot => dot.getAttribute("aria-label").includes(" ms")), "format stays for the values");
    const withTable = chart("c-table", { format: value => `#${value}`, table: true, series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
    assert(withTable.dataTable.textContent.includes("#3"), "and the table of values");

    // responsive
    $1("#cg").replaceChildren();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("#cg { width: 420px; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    try {
        const wide = chart("c-wide", { responsive: true, height: 200, series: [{ name: "v", data: [1, 2, 3, 4, 5, 6] }] });
        equal($1("#c-wide").getAttribute("width"), "420", "as wide as the parent from the start");
        equal($1("#c-wide").getAttribute("height"), "200");
        sheet.replaceSync("#cg { width: 300px; }");
        await waitUntil(() => $1("#c-wide")?.getAttribute("width") === "300", "follows the parent when it gets narrower");
        wide.destroy();
        sheet.replaceSync("#cg { width: 500px; }");
        await tick(150);
        equal($$("#c-wide").length, 0, "destroyed: gone, and nothing draws it again");
    } finally {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(item => item !== sheet);
        $1("#cg")?.remove();
    }
});

test("form: fields that depend on others, labels that follow, nested names, empty values, details of an error at their fields", async () => {
    const calls = [];
    const form = A.generateForm({
        parent: "wrapper", nested: true, submitText: "Send",
        fields: [
            { name: "type", label: "Type", type: "select", options: ["A", "MX"], value: "A" },
            { name: "data.target", label: values => (values.type === "MX" ? "Mail server" : "Address"), required: true, show: values => values.type !== "MX", trim: true },
            { name: "data.exchange", label: "Exchange", required: true, show: values => values.type === "MX" },
            { name: "soa.host", label: "Name server", trim: true, empty: "omit" },
            { name: "ttl", label: "TTL", type: "number", empty: "null" },
            { name: "note", label: "Note", empty: "empty" },
            { name: "again", label: "Again", send: false }
        ],
        onSubmit: values => { calls.push(values); }
    });
    const field = name => form.fields[name];
    equal(field("data.target").element.hidden, false);
    equal(field("data.exchange").element.hidden, true, "the field for MX is not shown for A");
    const labelOf = name => $1(".field-label-text", field(name).element).firstChild.nodeValue;     // the star of a required field is another node
    equal(labelOf("data.target"), "Address");
    const select = $1("select", field("type").element);
    select.value = "MX";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    equal(field("data.target").element.hidden, true);
    equal(field("data.exchange").element.hidden, false, "shown for MX");
    equal(labelOf("data.target"), "Mail server", "the label followed (it is hidden now, but it is kept up to date)");
    // a field that is not shown is not validated: its required rule does not stop the form
    form.element.requestSubmit();
    await tick();
    equal(calls.length, 0, "the exchange is required");
    equal(Object.keys(form.validate()).join(), "data.exchange");
    $1("input", field("data.exchange").element).value = "mail.example.test";
    $1("input", field("soa.host").element).value = "  ns1.example.test  ";
    $1("input", field("again").element).value = "x";
    form.element.requestSubmit();
    await tick();
    equal(JSON.stringify(calls.at(-1)), JSON.stringify({ type: "MX", data: { exchange: "mail.example.test" }, soa: { host: "ns1.example.test" }, ttl: null, note: "" }),
        "nested, trimmed, hidden and not sent fields left out, empty ones as asked: " + JSON.stringify(calls.at(-1)));
    equal(form.getRawValues()["data.target"], "", "the raw values hold everything");
    // the details of an error
    const failing = A.generateForm({
        parent: "wrapper", fields: [{ name: "name", label: "Name" }, { name: "soa.host", label: "Host" }],
        onSubmit: () => { throw Object.assign(new Error("Check the marked fields"), { details: { name: "Taken", "soa.host": "Not a name", other: "Something else" } }); }
    });
    failing.element.requestSubmit();
    await tick(30);
    equal($1(".field-error", failing.fields.name.element).textContent, "Taken");
    equal($1(".field-error", failing.fields["soa.host"].element).textContent, "Not a name");
    equal($1(".form-message", failing.element).textContent, "Check the marked fields: Something else", "what has no field goes to the message");
    const onlyFields = A.generateForm({
        parent: "wrapper", fields: [{ name: "name", label: "Name" }],
        onSubmit: () => { throw Object.assign(new Error("Check the marked fields"), { details: { name: "Taken" } }); }
    });
    onlyFields.element.requestSubmit();
    await tick(30);
    equal($1(".form-message", onlyFields.element).textContent, "Check the marked fields", "when the fields show everything the form only says where to look");
    // without the new options nothing changes
    const plain = A.generateForm({ parent: "wrapper", fields: [{ name: "a", label: "A", value: " x " }, { name: "b", label: "B" }], onSubmit: values => calls.push(values) });
    plain.element.requestSubmit();
    await tick();
    equal(JSON.stringify(calls.at(-1)), JSON.stringify({ a: " x ", b: "" }), "defaults as before");
    // the dialog focuses the first control that is shown
    const dialog = A.showFormDialog({
        title: "Dependent", fields: [{ name: "t", label: "T", show: () => false }, { name: "u", label: "U" }], onSubmit: () => {}
    });
    equal(document.activeElement?.name ?? document.activeElement?.closest?.(".field")?.dataset.name, "u", "the focus is in the first field that is shown");
    dialog.close();
    const seen = [];
    const nestedDialog = A.showFormDialog({ title: "Nested", nested: true, fields: [{ name: "soa.host", label: "Host", value: "ns1" }], onSubmit: values => seen.push(values) });
    nestedDialog.form.element.requestSubmit();
    await tick(30);
    equal(JSON.stringify(seen[0]), JSON.stringify({ soa: { host: "ns1" } }), "showFormDialog passes nested on");
});

test("form: a label function that answers nothing first still gets its caption; setValues takes the nested shape", async () => {
    const form = A.generateForm({
        parent: "wrapper", nested: true,
        fields: [
            { name: "type", label: "Type", type: "select", options: ["A", "MX"], value: "A" },
            { name: "data.value", label: values => (values.type === "MX" ? "Mail server" : values.type === "A" ? "Address" : undefined), required: true },
            { name: "soa.host", label: "Host", show: values => values.type === "MX" }
        ],
        onSubmit: () => {}
    });
    const labelOf = name => $1(".field-label-text", form.fields[name].element);
    assert(labelOf("data.value"), "the caption exists");
    equal(labelOf("data.value").firstChild.nodeValue, "Address");
    const later = A.generateForm({ parent: "wrapper", fields: [{ name: "x", label: values => (values.go ? "Now" : null), }, { name: "go", label: "Go" }] });
    assert($1(".field-label-text", later.fields.x.element), "a function that first answers null still gets a caption");
    equal($1(".field-label-text", later.fields.x.element).textContent, "");
    $1("input", later.fields.go.element).value = "1";
    $1("input", later.fields.go.element).dispatchEvent(new Event("input", { bubbles: true }));
    equal($1(".field-label-text", later.fields.x.element).textContent, "Now", "and writes it when the values change");
    form.setValues({ type: "MX", data: { value: "mail.example.test" }, soa: { host: "ns1" } });
    equal($1("select", form.fields.type.element).value, "MX");
    equal($1("input", form.fields["data.value"].element).value, "mail.example.test", "a nested object sets the field with the dotted name");
    equal($1("input", form.fields["soa.host"].element).value, "ns1");
    equal(labelOf("data.value").firstChild.nodeValue, "Mail server", "setValues arranges the labels and the fields that follow");
    equal(form.fields["soa.host"].element.hidden, false);
    form.setValues({ "data.value": "x" });
    equal($1("input", form.fields["data.value"].element).value, "x", "the dotted name works too");
    const flat = A.generateForm({ parent: "wrapper", fields: [{ name: "a", label: "A" }] });
    flat.setValues({ a: "1", b: { c: 2 } });
    equal($1("input", flat.fields.a.element).value, "1", "without nested an object is not unpacked and unknown names are ignored");
});

test("table: stack shows a narrow table as blocks with the label next to each value, and follows the width of the table", async () => {
    document.getElementById("wrapper").insertAdjacentHTML("beforeend", '<div id="stack-box"></div>');
    document.getElementById("stack-box").style.width = "900px";       // set from script: an inline style attribute is blocked by the CSP of the test page
    const table = A.generateTable({
        parent: "stack-box", id: "stacked", stack: true, caption: "Zones",
        columns: [{ key: "name", label: "Name" }, { key: "type", label: "Type" }],
        rows: [{ name: "example.test", type: "A" }, { name: "mail.example.test", type: "MX" }],
        rowActions: [{ label: "Edit", onclick: () => {} }]
    });
    await tick(60);
    const root = document.getElementById("stacked");
    equal(root.classList.contains("is-stacked"), false, "wide: a normal table");
    equal(getComputedStyle($1("thead", root)).display !== "none", true, "wide: the header is there");
    document.getElementById("stack-box").style.width = "320px";
    await tick(120);
    equal(root.classList.contains("is-stacked"), true, "narrow: stacked");
    equal(getComputedStyle($1("thead", root)).display, "none", "the header is hidden");
    const cell = $1("tbody td[data-label]", root);
    equal(getComputedStyle(cell).display, "flex", "a cell is a flex row");
    equal(getComputedStyle(cell, "::before").content, '"Name"', "the label comes from data-label: " + getComputedStyle(cell, "::before").content);
    assert(root.scrollWidth <= root.clientWidth + 1, "nothing to scroll sideways: " + root.scrollWidth + " > " + root.clientWidth);
    document.getElementById("stack-box").style.width = "900px";
    await tick(120);
    equal(root.classList.contains("is-stacked"), false, "wide again");
    // a number is the breakpoint; not set: never stacked; virtual tables are left alone
    document.getElementById("stack-box").style.width = "700px";
    A.generateTable({ parent: "stack-box", id: "stack-700", stack: 800, columns: [{ key: "a" }], rows: [{ a: 1 }] });
    A.generateTable({ parent: "stack-box", id: "stack-off", columns: [{ key: "a" }], rows: [{ a: 1 }] });
    A.generateTable({ parent: "stack-box", id: "stack-virtual", stack: true, virtual: { height: 200, rowHeight: 30 }, columns: [{ key: "a" }], rows: [{ a: 1 }] });
    await tick(120);
    equal(document.getElementById("stack-700").classList.contains("is-stacked"), true, "stack: 800 stacks a table of 700 px");
    equal(document.getElementById("stack-off").classList.contains("athena-table-stackable"), false, "no option, no change");
    equal(document.getElementById("stack-virtual").classList.contains("athena-table-stackable"), false, "virtual tables are not stacked");
    table.destroy();
});

test("table: a column can render an element (a badge, a link, buttons) and every cell carries the label of its column", () => {
    const clicks = [];
    const table = A.generateTable({
        parent: "wrapper", sortable: false,
        columns: [
            { key: "name", label: "Name", render: row => Object.assign(document.createElement("a"), { href: "#/" + row.name, textContent: row.name }) },
            { key: "state", label: "State", align: "right", render: row => { const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = row.state; return badge; } },
            { key: "n", label: "Number", format: value => "#" + value },
            { key: "go", label: "", render: row => Object.assign(document.createElement("button"), { textContent: "Go", onclick: () => clicks.push(row.name) }) }
        ],
        rows: [{ name: "alpha", state: "up", n: 1 }, { name: "beta", state: "down", n: 2 }]
    });
    const cells = $$("tbody tr:first-child td", table.element);
    equal($1("a", cells[0]).getAttribute("href"), "#/alpha", "an element in a cell");
    equal($1(".badge", cells[1]).textContent, "up");
    equal(cells[2].textContent, "#1", "format still writes text");
    cells[3].querySelector("button").click();
    equal(clicks.join(), "alpha", "and it works");
    equal(cells.map(cell => cell.dataset.label).join("|"), "Name|State|Number|", "the label of the column is on every cell (an empty label, as of a column of buttons, stays empty)");
    assert(cells[1].classList.contains("athena-align-right"));
});

test("modal: focus moves in, Esc closes and restores the focus", () => {
    document.body.insertAdjacentHTML("beforeend", '<div class="modal" id="myModal"><div class="modal-content"><span class="close">x</span><button>in</button></div></div>');
    const opener = A.generateButton({ parent: "wrapper", text: "open" }).element;
    opener.focus();
    A.openModal();
    assert($1("#myModal").contains(document.activeElement), "focus not inside");
    key($1("#myModal"), "Escape");
    assert($1("#myModal").style.display === "none" && document.activeElement === opener, "not closed or focus lost");
});

/* ------------------NAVIGATION------------------- */

test("tabs: lazy content and arrow keys", () => {
    let lazy = 0;
    const tabs = A.generateTabs({ parent: "wrapper", tabs: [{ id: "a", label: "A", content: "AA" }, { id: "b", label: "B", content: () => { lazy++; return "BB"; } }] });
    assert(tabs.getActive() === "a" && lazy === 0);
    key($1("[role=tablist]", tabs.element), "ArrowRight");
    assert(tabs.getActive() === "b" && lazy === 1);
    assert($$("[role=tabpanel]", tabs.element)[0].hidden && !$$("[role=tabpanel]", tabs.element)[1].hidden);
});

test("accordion, dropdown, pagination, sidebar", async () => {
    const accordion = A.generateAccordion({ parent: "wrapper", items: [{ title: "1", content: "c1", open: true }, { title: "2", content: "c2" }] });
    const items = $$("details.accordion-item", accordion.element);
    assert(items[0].open && !items[1].open, "the item marked open starts open");
    $1("summary", items[1]).click();
    for (let i = 0; i < 20 && items[0].open; i++) await tick(10);   // the toggle event comes as a task of its own
    assert(!items[0].open && items[1].open, "single open");
    accordion.toggle(0, true);
    for (let i = 0; i < 20 && items[1].open; i++) await tick(10);
    assert(items[0].open && !items[1].open, "toggle(index, true) opens one and closes the other");
    const several = A.generateAccordion({ parent: "wrapper", multiple: true, items: [{ title: "a", content: "x", open: true }, { title: "b", content: "y", open: true }] });
    assert($$("details[open]", several.element).length === 2, "several open when multiple");

    let picked = "";
    const dropdown = A.generateDropdown({ parent: "wrapper", label: "Menu", items: [{ label: "One", onclick: item => { picked = item.label; } }, { divider: true }, { label: "Two", disabled: true }] });
    const menuOpen = () => $1("[role=menu]", dropdown.element).matches(":popover-open");
    $1(".dropdown-toggle", dropdown.element).click();
    assert(menuOpen(), "dropdown closed");
    $1("[role=menuitem]", dropdown.element).click();
    assert(picked === "One" && !menuOpen(), "pick");

    const pagination = A.generatePagination({ parent: "wrapper", total: 95, pageSize: 10 });
    pagination.setPage(10);
    equal($1("[aria-current=page]", pagination.element).textContent, "10");
    pagination.setTotal(20);
    equal(pagination.getPage(), 2);

    const sidebar = A.generateSidebar({ parent: "wrapper", items: [{ id: "a", label: "A" }, { id: "g", label: "G", children: [{ id: "c", label: "C" }] }], active: "c" });
    assert(!$1(".sidebar-sublist", sidebar.element).hidden, "parent of the active item is closed");
});

test("header menu: submenu opens, picks, closes", async () => {
    const parent = $1("#menu-more .menu-parent");
    assert(parent, "no submenu parent");
    equal(parent.getAttribute("aria-expanded"), "false");
    parent.click();
    equal(parent.getAttribute("aria-expanded"), "true");
    const list = $1("#menu-more .submenu");
    assert(!list.hidden, "submenu hidden");
    key(parent, "ArrowDown");
    equal(document.activeElement.textContent, "Sub A");
    key(list, "ArrowDown");
    equal(document.activeElement.textContent, "Sub C", "disabled entry is skipped");
    $$(".submenu-item", list)[1].click();
    assert(!navCalls.includes("Sub B"), "disabled entry fired");
    key(list, "Enter");
    equal(navCalls.at(-1), "Sub C");
    assert(list.hidden && document.activeElement === parent, "not closed after choosing");
    parent.click();
    key(list, "Escape");
    assert(list.hidden, "Esc did not close");
    parent.click();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    assert(list.hidden, "outside click did not close");
    $1("#menu-plain span").click();
    equal(navCalls.at(-1), "Plain");
});

test("router: params, query, redirect guard, not found", async () => {
    const seen = [];
    const router = A.createRouter({
        routes: { "/": () => seen.push("home"), "/u/:id": c => seen.push(`u${c.params.id}${c.query.x}`), "/priv": () => seen.push("priv"), "/login": () => seen.push("login") },
        beforeEach: c => (c.path === "/priv" ? "/login" : undefined),
        notFound: c => seen.push(`404${c.path}`)
    });
    router.start();
    await tick(20);
    router.navigate("/u/5?x=1");
    await tick(20);
    router.navigate("/nope");
    await tick(20);
    router.navigate("/priv");
    await tick(20);
    router.stop();
    location.hash = "";
    equal(seen.join(","), "home,u51,404/nope,login");
});

/* ------------------INPUTS------------------- */

test("autocomplete: filter, keyboard, async source ignores stale answers", async () => {
    const autocomplete = A.generateAutocomplete({ parent: "wrapper", options: ["Hungary", "Hungary2", "Italy"] });
    type(autocomplete.input, "hun");
    await tick();
    equal($$("[role=option]", autocomplete.element).length, 2);
    key(autocomplete.input, "ArrowDown");
    key(autocomplete.input, "Enter");
    equal(autocomplete.getValue(), "Hungary2");
    const remote = A.generateAutocomplete({ parent: "wrapper", options: async query => { await tick(5); return [`${query}!`]; } });
    type(remote.input, "ab");
    type(remote.input, "abc");
    await tick(40);
    equal($$("[role=option]", remote.element).length, 1);
    equal($1("[role=option]", remote.element).textContent, "abc!");
});

test("multi select: choose, chips, backspace", async () => {
    const select = A.generateMultiSelect({ parent: "wrapper", options: [{ value: "h", text: "Hungary" }, { value: "i", text: "Italy" }] });
    select.input.focus();
    select.input.dispatchEvent(new Event("focus"));   // a headless window does not always have the focus, so the event may not come by itself
    await tick();
    for (const option of $$("[role=option]", select.element)) option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    equal(JSON.stringify(select.getValue()), '["h","i"]');
    equal($$(".chip", select.element).length, 2);
    key(select.input, "Backspace");
    equal(JSON.stringify(select.getValue()), '["h"]');
});

test("stepper: validation blocks, advances, finishes", async () => {
    let finished = false;
    let allow = false;
    const stepper = A.generateStepper({ parent: "wrapper", steps: [{ title: "1", content: "one", validate: () => allow || "Blocked" }, { title: "2", content: "two" }], onFinish: () => { finished = true; } });
    await stepper.next();
    assert(stepper.getCurrent() === 0 && $1(".stepper .field-error").textContent === "Blocked");
    allow = true;
    await stepper.next();
    assert(stepper.getCurrent() === 1 && $1(".stepper-panel:not([hidden])").textContent === "two");
    await stepper.next();
    assert(finished, "not finished");
});

test("file upload: accepts only valid files", () => {
    const upload = A.generateFileUpload({ parent: "wrapper", accept: ".txt", maxSize: 10 });
    upload.add([new File(["hello"], "a.txt", { type: "text/plain" }), new File(["x".repeat(50)], "big.txt", { type: "text/plain" }), new File(["x"], "img.png", { type: "image/png" })]);
    equal(upload.getFiles().length, 1);
    assert($1(".field-error", upload.element).textContent.includes("big.txt"), "size error");
});

test("drop zone: validates dropped files and reports the rest", () => {
    const dropped = [];
    const rejected = [];
    const zone = A.generateDropZone({ parent: "wrapper", accept: ".txt", maxSize: 10, maxFiles: 1, onDrop: files => dropped.push(...files), onReject: items => rejected.push(...items) });
    const data = new DataTransfer();
    for (const file of [new File(["a"], "a.txt"), new File(["b"], "b.txt"), new File(["x"], "c.png"), new File(["x".repeat(50)], "big.txt")]) data.items.add(file);
    zone.element.dispatchEvent(new DragEvent("dragenter", { dataTransfer: data, bubbles: true, cancelable: true }));
    assert(zone.element.classList.contains("dropzone-over"), "over state");
    zone.element.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
    assert(!zone.element.classList.contains("dropzone-over"), "over state cleared");
    equal(dropped.map(file => file.name).join(), "a.txt");
    equal(rejected.length, 3);
    zone.setDisabled(true);
    zone.element.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
    equal(dropped.length, 1, "disabled zone ignores drops");
});

test("wysiwyg: source view round trips and sanitizes", () => {
    const editor = A.generateWysiwyg({ parent: "wrapper", label: "Body", value: "<p>Hi <b>there</b></p>" });
    const toggle = $1(".rt-source", editor.element);
    assert(toggle, "source button");
    toggle.click();
    const source = $1(".rt-source-view", editor.element);
    assert(!source.hidden && editor.editor.hidden, "source open");
    assert(source.value.includes("there") && source.value.startsWith("<p>"), "source shows the HTML");
    source.value = '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>';
    toggle.click();
    equal(editor.getValue(), "<p>ok</p>");
    assert(source.hidden && !editor.editor.hidden, "source closed");
    const form = A.generateForm({ parent: "wrapper", fields: [{ name: "body", type: "wysiwyg" }], onSubmit: () => {} });
    assert($1(".rt-source", form.element), "wysiwyg form field has the source button");
});

test("date range: end picker follows the start, reversed range is reported", async () => {
    const range = A.generateDateRange({ parent: "wrapper", label: "Period", from: "2026-02-01", max: "2026-12-31" });
    const [from, to] = range.inputs;
    equal(to.min, "2026-02-01");
    equal(from.max, "2026-12-31");
    to.value = "2026-01-15";
    to.dispatchEvent(new Event("change", { bubbles: true }));
    assert($1(".field-error", range.element.parentElement).textContent.includes("must not be before"), "reversed range not reported");
    to.value = "2026-03-01";
    to.dispatchEvent(new Event("change", { bubbles: true }));
    equal($1(".field-error", range.element.parentElement).textContent, "");
    equal(JSON.stringify(range.getValue()), '{"from":"2026-02-01","to":"2026-03-01"}');
});

/* ------------------RICH TEXT------------------- */

test("rich text: unsafe markup never survives", () => {
    const rich = A.generateRichText({
        parent: "wrapper", label: "Notes",
        value: '<p onclick="x()" style="color:red">Hi<script>alert(1)<\/script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a> <a href="https://ok.example/">good</a></p><iframe src="//evil"></iframe><style>p{}</style>'
    });
    const html = rich.getValue();
    assert(!/script|onclick|onerror|style|iframe|<img|javascript:/i.test(html), `unsafe markup left: ${html}`);
    assert(html.includes("Hi") && html.includes('href="https://ok.example/"') && html.includes('rel="noopener noreferrer"'), `lost safe content: ${html}`);
    equal(A.sanitizeHtml('<div>a</div><b>b</b>'), "<p>a</p><strong>b</strong>");
    equal(A.sanitizeHtml('<a href="//evil.com">x</a>'), "<a>x</a>");
    equal(rich.editor.getAttribute("aria-labelledby"), $1(".field-label").id);
});

test("rich text: toolbar formats the selection and reports the state", () => {
    const changes = [];
    const rich = A.generateRichText({ parent: "wrapper", value: "<p>Hello world</p>", onChange: html => changes.push(html) });
    rich.editor.focus();
    const range = document.createRange();
    range.selectNodeContents($1("p", rich.editor));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    $1(".rt-bold", rich.element).click();
    equal(rich.getValue(), "<p><strong>Hello world</strong></p>");
    equal($1(".rt-bold", rich.element).getAttribute("aria-pressed"), "true");
    assert(changes.length > 0, "onChange not called");
    $1("[aria-label='Bulleted list']", rich.element).click();
    assert(rich.getValue().includes("<ul>"), `list not created: ${rich.getValue()}`);
});

test("rich text: paste is sanitized, empty content reads as empty", () => {
    const rich = A.generateRichText({ parent: "wrapper", placeholder: "Write..." });
    equal(rich.getValue(), "");
    assert(rich.editor.classList.contains("rt-empty"), "placeholder state");
    rich.editor.focus();
    const range = document.createRange();
    range.selectNodeContents(rich.editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const data = new DataTransfer();
    data.setData("text/html", '<p>pasted</p><script>alert(1)<\/script><span style="color:red" onclick="x()">!</span>');
    data.setData("text/plain", "pasted!");
    rich.editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    const html = rich.getValue();
    assert(html.includes("pasted") && !/script|style|onclick/.test(html), `paste not cleaned: ${html}`);
    assert(!rich.editor.classList.contains("rt-empty"), "still marked empty");
    A.generateRichText({ parent: "wrapper", value: "<p><br></p>" });
});

/* ------------------TABLES------------------- */

test("table: selection, sort, inline edit, csv", () => {
    const edits = [];
    const rows = [{ n: "b", a: 2 }, { n: "a", a: 10 }, { n: "c, d", a: 5 }];
    const table = A.generateTable({ parent: "wrapper", id: "tt", columns: [{ key: "n", label: "N", editable: true }, { key: "a", editable: true }], rows, selectable: true, onEdit: (row, name, value) => edits.push([name, value]) });
    $$("#tt tbody input[type=checkbox]")[0].click();
    equal(table.getSelected().length, 1);
    $1("#tt thead input[type=checkbox]").click();
    equal(table.getSelected().length, 3);
    $$("#tt thead th.sortable")[1].click();
    assert($$("#tt tbody tr")[0].textContent.includes("2") && $$("#tt tbody tr")[2].textContent.includes("10"), "numeric sort");
    const cell = $$("#tt td.editable").find(td => td.textContent === "5");
    cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = $1("#tt .athena-table-edit");
    input.value = "7";
    key(input, "Enter");
    assert(edits.length === 1 && edits[0][1] === 7 && rows[2].a === 7, "inline edit");
    assert(table.toCsv().startsWith("N,a\r\n") && table.toCsv().includes('"c, d"'), "csv");
});

test("table: columns resize with the mouse and the keyboard, double click resets", () => {
    const resized = [];
    const table = A.generateTable({
        parent: "wrapper", id: "rt", resizableColumns: true, onColumnResize: (name, width) => resized.push([name, width]),
        columns: [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C", width: 200 }],
        rows: [{ a: "x", b: "y", c: "z" }]
    });
    const handles = $$("#rt .athena-col-resizer");
    equal(handles.length, 3);
    const startA = $1("#rt thead th").offsetWidth;
    pointer(handles[0], "pointerdown", 100);
    pointer(handles[0], "pointermove", 160);
    pointer(handles[0], "pointerup", 160);
    const after = table.getColumnWidths();
    equal(after.a, startA + 60, "dragged width");
    assert(after.a > 40 && Object.keys(after).length === 3, "all widths frozen");
    equal($1("#rt table").style.tableLayout, "fixed");
    const second = $$("#rt .athena-col-resizer")[1];
    const widthB = table.getColumnWidths().b;
    key(second, "ArrowRight");
    equal(table.getColumnWidths().b, widthB + 10, "keyboard +10");
    key($$("#rt .athena-col-resizer")[1], "ArrowLeft", { shiftKey: true });
    equal(table.getColumnWidths().b, widthB - 40, "keyboard shift -50");
    for (let i = 0; i < 30; i++) key($$("#rt .athena-col-resizer")[1], "ArrowLeft", { shiftKey: true });
    equal(table.getColumnWidths().b, 40, "minimum width");
    assert(resized.length > 3 && resized[0][0] === "a", "onColumnResize");
    $$("#rt .athena-col-resizer")[2].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    equal(table.getColumnWidths().c, 200, "double click restores the configured width");
    // a resizer must not sort the column
    $$("#rt .athena-col-resizer")[0].click();
    assert(!$1("#rt [aria-sort]"), "resizer triggered a sort");
});

test("table: virtual scrolling renders a window and keeps the scroll height", async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `row ${i}` }));
    const table = A.generateTable({ parent: "wrapper", id: "vt", columns: [{ key: "id" }, { key: "name" }], rows, virtual: { height: 200, rowHeight: 30 } });
    const scroller = $1("#vt .athena-table-scroll");
    const rendered = () => $$("#vt tbody tr:not(.athena-table-spacer)");
    assert(rendered().length > 0 && rendered().length < 40, `rendered ${rendered().length} rows`);
    equal($1("#vt table").getAttribute("aria-rowcount"), "5001");
    equal(rendered()[0].getAttribute("aria-rowindex"), "2");
    const total = scroller.scrollHeight;
    assert(total >= 5000 * 30, `scroll height ${total}`);
    scroller.scrollTop = 30 * 2500;
    scroller.dispatchEvent(new Event("scroll"));   // headless Chrome sends it late, sometimes not at all
    const firstRow = () => Number(rendered()[0].textContent.match(/^\d+/)[0]);
    // The scroll event and its animation frame come late in headless Chrome: wait for the window to move.
    for (let i = 0; i < 40 && firstRow() < 2400; i++) await tick(50);
    const first = firstRow();
    assert(first > 2400 && first < 2500, `first rendered row ${first}`);
    assert(rendered().length < 40, "window grew");
    equal(scroller.scrollHeight, total, "scroll height changed");
    equal(scroller.scrollTop, 30 * 2500, "scroll position jumped");
    // sorting re-renders without losing the window
    $$("#vt thead th.sortable")[0].click();
    await frame();
    assert(rendered().length < 40, "sort rendered everything");
    table.setRows(rows.slice(0, 3));
    equal(rendered().length, 3);
    equal(scroller.scrollTop, 0);
});

test("table: virtual scrolling with a filter", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: i % 100 === 0 ? `special ${i}` : `row ${i}` }));
    A.generateTable({ parent: "wrapper", id: "vf", columns: [{ key: "id" }, { key: "name" }], rows, virtual: true, filter: true });
    const filter = $1("#vf .athena-table-filter");
    type(filter, "special");
    await frame();
    equal($$("#vf tbody tr").length, 10);
    equal($1("#vf table").getAttribute("aria-rowcount"), "11");
});

/* ------------------SESSION, FORMS, I18N, THEME------------------- */

test("session: set, get, clear, listeners", () => {
    A.logout();
    let events = 0;
    const off = A.onSessionChange(() => events++);
    A.setSession({ user: { name: "x" }, token: "t", remember: true });
    assert(A.isLoggedIn() && A.getSession().user.name === "x");
    A.logout();
    off();
    assert(!A.isLoggedIn() && events === 2);
});

test("login form: remember me, registration translated", () => {
    A.generateLoginForm();
    assert($1("#loginForm-remember-control"), "no remember checkbox");
    $1("#loginForm-username-control").value = "u";
    $1("#loginForm-remember-control").click();
    $1("#loginForm-submit-login").click();
    assert(submitted.at(-1)?.remember === true && submitted.at(-1)?.username === "u", "login data");
    A.clearWrapper();
    A.setLocale("hu");
    A.generateRegistrationForm();
    equal($1("#registrationForm-username-label").textContent, "Felhasználónév: ");
    A.setLocale("en");
});

test("components render safely", () => {
    A.generateTooltip(A.generateButton({ parent: "wrapper", text: "tt" }).element, "tip");
    assert($1(".has-tooltip > [role=tooltip]"), "tooltip");
    equal(A.generateAvatar({ parent: "wrapper", name: "Ada Lovelace" }).textContent, "AL");
    equal($1(".stat-good", A.generateStat({ parent: "wrapper", label: "E", value: 1, delta: -5, invertDelta: true }).element)?.textContent, "▼ 5%");
    const link = A.generateLink({ parent: "wrapper", text: "x", href: "https://e.com", external: true });
    assert(link.rel === "noopener noreferrer" && link.target === "_blank", "external link");
    const card = A.generateCard({ parent: "wrapper", title: "<b>x</b>", content: "<i>y</i>" });
    assert(!$1("i, b", card.element) && card.element.textContent.includes("<i>y</i>"), "content must be text");
});

test("theme switch replaces the stylesheet", async () => {
    await A.setTheme({ id: 1 });
    equal($$("link[data-athena-theme]").length, 1);
    assert($1("link[data-athena-theme]").href.includes("dark"));
    equal(getComputedStyle(document.documentElement).getPropertyValue("--athena-bg").trim(), "#16181d");
    await A.setTheme({ id: 0 });
    equal(getComputedStyle(document.documentElement).getPropertyValue("--athena-bg").trim(), "#fff");
});

/* ------------------RUN------------------- */

for (const { name, fn } of tests) {
    document.title = `running: ${name}`;     // the runner prints it when the page does not finish
    await reset();
    const seen = violations.length;
    let failure = null;
    try {
        await fn();
    } catch (error) {
        failure = error.message;
    }
    await tick(10);   // the browser reports a violation as a task of its own
    const reported = violations.slice(seen).filter(text => !(HOSTILE_INPUT.has(name) && INERT_PARSE_REPORT.test(text)));
    if (!failure && reported.length) failure = `Content-Security-Policy violation: ${reported.join(" | ")}`;
    results.push(failure ? `FAIL ${name}: ${failure}` : `ok   ${name}`);
}
document.title = "finished";
document.body.insertAdjacentHTML("beforeend", `<pre id="results">${results.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
