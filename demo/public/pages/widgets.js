import { createWidgetGallery, createWidgetGrid, registerWidget } from "/athena/widgets.js";
import { generatePageHeader, generateStat } from "/athena/components.js";
import { generateChart } from "/athena/chart.js";
import { generateButton } from "/athena/forms.js";
import { el } from "/athena/dom.js";
import { block, code } from "/util.js";

const STORAGE_KEY = "athena-demo-dashboard";
let registered = false;

// Three kinds of widget. A widget is only a function that draws into the body it is given (and cleans up after itself).
function registerTypes() {
    if (registered) return;
    registered = true;

    registerWidget("stat", {
        title: "Statistic", description: "One number with a note", defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, defaultConfig: { label: "Hosts online", value: 1280, note: "of 100,000" },
        configForm: [{ name: "label", label: "Label", type: "text" }, { name: "value", label: "Value", type: "number" }, { name: "note", label: "Note", type: "text" }],
        render(context) {
            let stat = generateStat({ parent: context.element, label: context.config.label, value: Number(context.config.value).toLocaleString(), note: context.config.note });
            return {
                update(next) {
                    context.element.replaceChildren();
                    stat = generateStat({ parent: context.element, label: next.config.label, value: Number(next.config.value).toLocaleString(), note: next.config.note });
                },
                destroy() { stat = null; }
            };
        }
    });

    registerWidget("chart", {
        title: "Chart", description: "Bars, a line or a pie", defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, defaultConfig: { type: "bar" },
        configForm: [{ name: "type", label: "Kind", type: "select", options: [{ value: "bar", text: "Bars" }, { value: "line", text: "Line" }, { value: "pie", text: "Pie" }] }],
        render(context) {
            const draw = () => {
                context.element.replaceChildren();
                const box = el("div", {});
                context.element.append(box);
                const { width, height } = context.size;
                return generateChart({
                    parent: box, type: context.config.type, width: Math.max(220, width - 24), height: Math.max(140, height - 24), labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                    series: [{ name: "Visits", data: [12, 19, 8, 15, 22] }]
                });
            };
            let chart = draw();
            return {
                update() { chart.destroy(); chart = draw(); },
                destroy() { chart.destroy(); }
            };
        },
        resize(context) { context.element.dispatchEvent(new CustomEvent("widget-resized")); }
    });

    registerWidget("clock", {
        title: "Clock", description: "The time of this device", defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 }, defaultConfig: { seconds: true },
        configForm: [{ name: "seconds", label: "Show seconds", type: "checkbox" }],
        render(context) {
            const time = el("p", { class: "widget-clock" });
            context.element.append(time);
            const show = () => { time.textContent = new Date().toLocaleTimeString([], context.config.seconds ? undefined : { hour: "2-digit", minute: "2-digit" }); };
            show();
            const timer = setInterval(show, 1000);
            return { update: show, destroy() { clearInterval(timer); } };
        }
    });
}

const FIRST = [
    { id: "hosts", type: "stat", x: 0, y: 0, w: 3, h: 2 },
    { id: "alerts", type: "stat", x: 3, y: 0, w: 3, h: 2, title: "Alerts", config: { label: "Open alerts", value: 7, note: "2 critical" } },
    { id: "time", type: "clock", x: 6, y: 0, w: 3, h: 2 },
    { id: "visits", type: "chart", x: 0, y: 2, w: 6, h: 4, title: "Visits this week" },
    { id: "pinned", type: "clock", x: 9, y: 0, w: 3, h: 2, title: "Pinned (locked)", locked: true }
];

export default async function widgets(context, { app }) {
    registerTypes();
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Widgets",
        description: "A dashboard you can build: add, configure, move, resize, lock, undo and save. Everything also works with the keyboard."
    });

    const bar = block(root, "Edit the dashboard", "Switch edit mode on. Drag a new widget from the list onto the dashboard (or click it). Drag a widget by its handle (onto another: they swap), resize by its edges and corners. Keyboard: focus the handle, Space picks it up, arrow keys move it, Shift and arrow keys resize it, Enter drops it, Escape cancels.");
    const row = el("div", { class: "demo-row", attrs: { id: "widget-bar" } });
    bar.append(row);
    const shelf = el("div", { attrs: { id: "widget-gallery" } });
    bar.append(shelf);
    const stage = el("div", { attrs: { id: "dashboard" } });
    root.append(stage);

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { saved = null; }
    const grid = createWidgetGrid({
        element: stage, label: "Demo dashboard", editable: false, collision: "swap",
        breakpoints: { wide: { minWidth: 900, columns: 12 }, narrow: { minWidth: 0, columns: 6 } },
        ...(saved ? { layout: saved } : { widgets: FIRST }),
        onChange(layout) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
            sync();
        }
    });

    const gallery = createWidgetGallery({ element: shelf, grid, types: ["stat", "chart", "clock"] });
    const edit = generateButton({ parent: row, text: "Edit mode: off", variant: "secondary", onclick: () => { grid.setEditable(!grid.isEditable()); sync(); } });
    const add = type => generateButton({ parent: row, text: `Add ${type}`, variant: "secondary", onclick: () => grid.addWidget(type) });
    ["stat", "chart", "clock"].forEach(add);
    const undo = generateButton({ parent: row, text: "Undo", variant: "secondary", onclick: () => grid.undo() });
    const redo = generateButton({ parent: row, text: "Redo", variant: "secondary", onclick: () => grid.redo() });
    generateButton({
        parent: row, text: "Reset", variant: "secondary", onclick: () => {
            localStorage.removeItem(STORAGE_KEY);
            grid.setLayout({ version: 1, widgets: [] });
            for (const entry of FIRST) grid.addWidget(entry.type, entry);
        }
    });
    function sync() {
        edit.element.textContent = `Edit mode: ${grid.isEditable() ? "on" : "off"}`;
        undo.element.disabled = !grid.canUndo();
        redo.element.disabled = !grid.canRedo();
    }
    sync();

    const how = block(root, "How it is made", "A widget type is registered once: a function that draws into a body and cleans up after itself. The layout is plain JSON, saved here in localStorage.");
    code(how, `registerWidget("clock", {
    defaultSize: { w: 3, h: 2 },
    configForm: [{ name: "seconds", label: "Show seconds", type: "checkbox" }],
    render(context) {
        const time = el("p");
        context.element.append(time);
        const timer = setInterval(() => time.textContent = new Date().toLocaleTimeString(), 1000);
        return { destroy: () => clearInterval(timer) };
    }
});
const grid = createWidgetGrid({ element: "dashboard", widgets: [{ type: "clock", x: 0, y: 0 }], editable: true, onChange: layout => save(layout) });`);

    return () => {
        gallery.destroy();
        grid.destroy();
    };
}
