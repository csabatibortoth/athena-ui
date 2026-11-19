import { generateThemePicker } from "/athena/theme.js";
import { generatePageHeader, generateCard, generateStat } from "/athena/components.js";
import { generateButton, generateField } from "/athena/forms.js";
import { generateChart } from "/athena/chart.js";
import { getLocale } from "/athena/i18n.js";
import { el } from "/athena/dom.js";
import { block, code } from "/util.js";

const TOKENS = [["--athena-accent", "Accent colour", "color"], ["--athena-radius", "Corner radius", "range"], ["--athena-space-2", "Gap", "range"]];

export default async function themes(context, { app, manager, setLanguage }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Themes, modes and tokens",
        description: "A theme is two blocks of CSS variables (light and dark). The person picks a theme and a mode, the choice is remembered in the browser, and nothing flashes on the next visit."
    });

    const picker = block(root, "Pick a look", "Light, dark, or like the system. The previews are drawn with the colours of each theme.");
    generateThemePicker({ parent: picker, manager });

    const live = block(root, "Change the tokens live", "These set CSS custom properties on <html> (that is allowed under a strict Content-Security-Policy). Everything on the page follows.");
    const controls = el("div", { class: "demo-row" });
    live.append(controls);
    const root$ = document.documentElement;
    const reset = () => { for (const [name] of TOKENS) root$.style.removeProperty(name); };
    const colour = el("input", { attrs: { type: "color", value: "#2f6db5", "aria-label": "Accent colour" } });
    colour.addEventListener("input", () => root$.style.setProperty("--athena-accent", colour.value));
    const radius = el("input", { attrs: { type: "range", min: "0", max: "20", value: "6", "aria-label": "Corner radius" } });
    radius.addEventListener("input", () => root$.style.setProperty("--athena-radius", `${radius.value}px`));
    const gap = el("input", { attrs: { type: "range", min: "2", max: "16", value: "8", "aria-label": "Gap" } });
    gap.addEventListener("input", () => root$.style.setProperty("--athena-space-2", `${gap.value}px`));
    controls.append(el("label", {}, "Accent ", colour), el("label", {}, "Radius ", radius), el("label", {}, "Gap ", gap));
    generateButton({ parent: controls, text: "Reset", variant: "secondary", onclick: () => { reset(); colour.value = "#2f6db5"; radius.value = "6"; gap.value = "8"; } });
    code(live, ":root { --athena-accent: #8e44ad; --athena-radius: 2px; }   /* a rule of yours, not in a layer, always wins */");

    const sample = block(root, "A sample", "Components that read the tokens.");
    const grid = el("div", { class: "demo-grid" });
    sample.append(grid);
    generateStat({ parent: grid, label: "Open alerts", value: 3, tone: "warn", note: "two new today" });
    generateCard({ parent: grid, title: "A card", content: [el("p", { text: "Text in the colour of the theme." }), el("span", { class: "badge badge-info", text: "badge" })] });
    const swatches = el("div", { class: "demo-swatches" });
    for (const name of ["bg", "surface", "accent", "success", "warning", "danger", "info"]) swatches.append(el("div", { class: `demo-swatch demo-swatch-${name}`, text: name }));
    grid.append(swatches);
    generateChart({ parent: sample, type: "bar", title: "Series colours follow the theme", width: 520, height: 240, labels: ["A", "B", "C", "D"], series: [{ name: "One", data: [3, 5, 2, 4] }, { name: "Two", data: [2, 3, 4, 1] }, { name: "Three", data: [4, 1, 3, 5] }] });

    const language = block(root, "Language", "The texts of Athena UI itself (buttons, validation messages, table and dialog texts) follow the language. The texts of this demo stay English.");
    const field = generateField({ parent: language, name: "language", label: "Language", type: "select", options: [{ value: "en", text: "English" }, { value: "hu", text: "Magyar" }], value: getLocale().split("-")[0] });
    field.element.addEventListener("change", () => setLanguage(field.getValue()));
}
