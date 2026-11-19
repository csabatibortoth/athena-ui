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
    const startA = $("#rt thead th")[0].offsetWidth;
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
    await frame();
    await frame();
    const first = Number(rendered()[0].textContent.match(/^\d+/)[0]);
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
