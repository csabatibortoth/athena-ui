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
const key = (node, name, extra = {}) => node.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...extra }));
const type = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
};
const pointer = (node, name, clientX) => node.dispatchEvent(new PointerEvent(name, { clientX, pointerId: 1, bubbles: true, cancelable: true }));
const $1 = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

window.addEventListener("error", event => results.push(`FAIL uncaught error: ${event.message}`));
window.addEventListener("unhandledrejection", event => results.push(`FAIL unhandled rejection: ${event.reason}`));

const A = await import("../../src/athena-ui.js");
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
    $$(".toast-container, .dialog-backdrop, #myModal").forEach(node => node.remove());
    document.body.focus();
}

/* ------------------API------------------- */

test("every public function is exported and global", () => {
    const names = ["generateForm", "generateButton", "generateField", "showToast", "confirmDialog", "generateTabs", "createRouter",
        "generateAutocomplete", "generateMultiSelect", "generateFileUpload", "generateStepper", "generateDateRange", "generateRichText",
        "createRichText", "generateWysiwyg", "createWysiwyg", "generateDropZone", "createDropZone", "sanitizeHtml", "setSession", "translate", "toCsv", "setTheme", "generateChangePasswordForm", "generateTable", "generateChart"];
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
    equal($1(".dialog").getAttribute("aria-modal"), "true");
    key($1(".dialog"), "Escape");
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
    const backdrop = $1(".dialog-backdrop");
    assert(promise.element.classList.contains("dialog-large") && promise.element.classList.contains("mine"), "classes missing");
    assert(!backdrop.hasAttribute("style"), "the backdrop has an inline style");
    equal(getComputedStyle(backdrop).display, "block");
    assert(promise.element.getBoundingClientRect().width > 480, "large dialog is not wider than 480px");
    promise.close("done");
    equal(await promise, "done");
    assert(!$1(".dialog-backdrop"), "dialog still open");
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
    key($1(".dialog"), "Escape");
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

test("accordion, dropdown, pagination, sidebar", () => {
    const accordion = A.generateAccordion({ parent: "wrapper", items: [{ title: "1", content: "c1", open: true }, { title: "2", content: "c2" }] });
    const heads = $$(".accordion-header", accordion.element);
    heads[1].click();
    assert(heads[0].getAttribute("aria-expanded") === "false" && heads[1].getAttribute("aria-expanded") === "true", "single open");

    let picked = "";
    const dropdown = A.generateDropdown({ parent: "wrapper", label: "Menu", items: [{ label: "One", onclick: item => { picked = item.label; } }, { divider: true }, { label: "Two", disabled: true }] });
    $1(".dropdown-toggle", dropdown.element).click();
    assert(!$1("[role=menu]", dropdown.element).hidden, "dropdown closed");
    $1("[role=menuitem]", dropdown.element).click();
    assert(picked === "One" && $1("[role=menu]", dropdown.element).hidden, "pick");

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
    await reset();
    try {
        await fn();
        results.push(`ok   ${name}`);
    } catch (error) {
        results.push(`FAIL ${name}: ${error.message}`);
    }
}
document.title = "finished";
document.body.insertAdjacentHTML("beforeend", `<pre id="results">${results.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
