//chartGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

// Dependency free SVG charts: bar, line, area, sparkline, pie and donut. Colours come from the theme (--series-1 ... --series-8,
// see the stylesheet), nothing is styled inline, so a strict Content-Security-Policy works.

import { resolveElement } from "../../core/dom.js";
import { getLocale, translate } from "../../core/i18n.js";

const NS = "http://www.w3.org/2000/svg";
const SERIES_COLORS = 8;
const MARGIN = { top: 40, right: 20, bottom: 50, left: 55 };

const svgEl = (tag, attrs = {}, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (text != null) node.textContent = text;
    return node;
};

const seriesClass = index => `s${(index % SERIES_COLORS) + 1}`;
// A colour given by the caller goes in the `color` attribute (the shapes paint with currentColor); otherwise the class picks it from the theme.
const seriesProps = (series, index) => (series.color ? { color: series.color } : { class: seriesClass(index) });
const formatNumber = n => Number.isInteger(n) ? String(n) : String(+n.toFixed(2));

// Rounded axis maximum and tick step, so ticks land on readable numbers.
function niceScale(span, ticks = 5) {
    if (span <= 0) return { span: 1, step: 1 / ticks };
    const rough = span / ticks;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map(m => m * magnitude).find(s => s >= rough);
    return { span: step * Math.ceil(span / step - 1e-9), step };
}

/* ------------------TIME AXIS------------------- */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TIME_STEPS = [SECOND, 5 * SECOND, 15 * SECOND, 30 * SECOND, MINUTE, 5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 3 * HOUR, 6 * HOUR,
    12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY, 365 * DAY];

/** Tick positions (ms) at round times between `from` and `to`, about `count` of them. */
export function timeTicks(from, to, count = 6) {
    const step = TIME_STEPS.find(s => (to - from) / s <= count) ?? TIME_STEPS.at(-1);
    // Ticks of a day or more start at midnight of the local day, shorter ones at a multiple of the step.
    const offset = step >= DAY ? new Date(from).getTimezoneOffset() * MINUTE : 0;
    const ticks = [];
    for (let t = Math.ceil((from - offset) / step) * step + offset; t <= to; t += step) ticks.push(t);
    return { ticks, step };
}

function timeFormatter(step) {
    const locale = getLocale();
    const options = step < MINUTE ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
        : step < DAY ? { hour: "2-digit", minute: "2-digit" }
            : step < 90 * DAY ? { month: "short", day: "numeric" }
                : { month: "short", year: "numeric" };
    const format = new Intl.DateTimeFormat(locale, options);
    return t => format.format(t);
}

const toTime = value => (value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value));

/* ------------------PARTS------------------- */

function addLegend(svg, entries, width, height, ctx) {
    let x = MARGIN.left;
    const y = height - 12;
    entries.forEach(({ name, props, series }) => {
        const group = svgEl("g", { class: "chart-legend-item", tabindex: 0, role: "button", "aria-pressed": "true", "aria-label": name });
        group.append(svgEl("rect", { x, y: y - 9, width: 10, height: 10, class: `chart-swatch ${props.class ?? ""}`.trim(), ...(props.color ? { color: props.color } : {}) }));
        group.append(svgEl("text", { x: x + 14, y, class: "chart-legend" }, name));
        if (series != null) {
            const toggle = () => {
                const hidden = group.getAttribute("aria-pressed") === "true";
                group.setAttribute("aria-pressed", hidden ? "false" : "true");
                group.classList.toggle("is-off", hidden);
                for (const node of svg.querySelectorAll(`[data-series="${series}"]`)) node.classList.toggle("chart-hidden", hidden);
                ctx.tooltip.hide();
            };
            group.addEventListener("click", toggle);
            group.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggle();
                }
            });
        }
        svg.append(group);
        x += 14 + name.length * 7 + 14;
    });
}

// One tooltip per chart, drawn inside the SVG and moved with attributes (no inline style). Shows on hover and on keyboard focus.
function createTooltip(svg, width) {
    const group = svgEl("g", { class: "chart-tooltip", "aria-hidden": "true" });
    const box = svgEl("rect", { class: "chart-tooltip-box", rx: 4 });
    const text = svgEl("text", { class: "chart-tooltip-text" });
    group.append(box, text);
    const show = (x, y, lines) => {
        text.replaceChildren(...lines.map((line, i) => svgEl("tspan", { x: 8, dy: i ? 15 : 0 }, line)));
        group.classList.add("is-visible");
        let w = 80;
        let h = lines.length * 15 + 8;
        try {
            const bbox = text.getBBox();
            w = bbox.width + 16;
            h = bbox.height + 10;
        } catch { /* not rendered: the estimate stays */ }
        text.setAttribute("y", 15);
        const left = Math.min(Math.max(x - w / 2, 2), Math.max(width - w - 2, 2));
        const top = Math.max(y - h - 10, 2);
        box.setAttribute("width", w);
        box.setAttribute("height", h);
        group.setAttribute("transform", `translate(${left} ${top})`);
    };
    const hide = () => group.classList.remove("is-visible");
    svg.append(group);
    return { show, hide, group };
}

// Makes a shape react to the pointer and the keyboard focus. It is focusable and named, so the values can be read without a mouse.
function addTip(ctx, node, x, y, lines) {
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", lines.join(", "));
    node.setAttribute("role", "img");
    const show = () => ctx.tooltip.show(x, y, lines);
    node.addEventListener("pointerenter", show);
    node.addEventListener("focus", show);
    node.addEventListener("pointerleave", ctx.tooltip.hide);
    node.addEventListener("blur", ctx.tooltip.hide);
}

// Draws grid, ticks and axes for the value range [min, min + scale.span].
function addAxes(svg, { labels, min, scale, width, height, timeAxis }) {
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;
    const y = value => MARGIN.top + plotH - ((value - min) / scale.span) * plotH;
    const ticks = Math.round(scale.span / scale.step);
    for (let i = 0; i <= ticks; i++) {
        const v = min + i * scale.step;
        svg.append(svgEl("line", { x1: MARGIN.left, x2: MARGIN.left + plotW, y1: y(v), y2: y(v), class: "chart-grid" }));
        svg.append(svgEl("text", { x: MARGIN.left - 8, y: y(v) + 4, "text-anchor": "end", class: "chart-tick" }, formatNumber(v)));
    }
    const band = plotW / Math.max(labels.length, 1);
    let x;
    if (timeAxis) {
        x = t => MARGIN.left + ((t - timeAxis.from) / (timeAxis.to - timeAxis.from || 1)) * plotW;
        const { ticks: stops, step } = timeTicks(timeAxis.from, timeAxis.to);
        const format = timeFormatter(step);
        for (const t of stops) {
            svg.append(svgEl("line", { x1: x(t), x2: x(t), y1: MARGIN.top + plotH, y2: MARGIN.top + plotH + 4, class: "chart-axis" }));
            svg.append(svgEl("text", { x: x(t), y: MARGIN.top + plotH + 18, "text-anchor": "middle", class: "chart-tick" }, format(t)));
        }
    } else {
        x = i => MARGIN.left + band * (i + 0.5);
        // Many labels would overlap: show about every n-th.
        const every = Math.max(1, Math.ceil(labels.length / Math.max(Math.floor(plotW / 60), 1)));
        labels.forEach((label, i) => {
            if (i % every === 0) svg.append(svgEl("text", { x: x(i), y: MARGIN.top + plotH + 18, "text-anchor": "middle", class: "chart-tick" }, label));
        });
    }
    svg.append(svgEl("line", { x1: MARGIN.left, x2: MARGIN.left, y1: MARGIN.top, y2: MARGIN.top + plotH, class: "chart-axis" }));
    // The category axis sits at zero when the range includes it, so negative bars hang below it.
    const baseline = y(Math.min(Math.max(0, min), min + scale.span));
    svg.append(svgEl("line", { x1: MARGIN.left, x2: MARGIN.left + plotW, y1: baseline, y2: baseline, class: "chart-axis" }));
    return { band, y, x, baseline };
}

function valueRange(series, zero = true) {
    const values = series.flatMap(s => s.data).filter(Number.isFinite);
    let min = zero ? Math.min(0, ...values) : Math.min(...values);
    const max = Math.max(zero ? 0 : -Infinity, ...values);
    const scale = niceScale(max - min);
    if (!zero) min = Math.floor(min / scale.step) * scale.step;   // start the axis at a round number
    return { min, scale: niceScale(max - min) };
}

/* ------------------DRAWERS------------------- */

function drawBar(svg, ctx) {
    const { labels, series, width, height } = ctx;
    const { min, scale } = valueRange(series);
    const { band, y } = addAxes(svg, { labels, min, scale, width, height });
    const groupWidth = band * 0.8;
    const barWidth = groupWidth / series.length;
    series.forEach((s, si) => s.data.forEach((value, i) => {
        const x = MARGIN.left + band * i + (band - groupWidth) / 2 + barWidth * si;
        const top = Math.min(y(value), y(0));
        const bar = svgEl("rect", {
            x, y: top, width: Math.max(barWidth - 2, 1), height: Math.abs(y(0) - y(value)),
            "data-series": si, ...seriesProps(s, si)
        });
        bar.setAttribute("class", `chart-bar ${bar.getAttribute("class") ?? ""}`.trim());
        addTip(ctx, bar, x + barWidth / 2, top, [`${s.name ?? ""} ${labels[i] ?? ""}`.trim(), formatNumber(value)]);
        svg.append(bar);
    }));
}

function drawLine(svg, ctx) {
    const { labels, series, width, height, times, area, options } = ctx;
    const { min, scale } = valueRange(series, area || options.zero !== false);
    const timeAxis = times ? { from: Math.min(...times), to: Math.max(...times) } : null;
    const { y, x, baseline } = addAxes(svg, { labels, min, scale, width, height, timeAxis });
    const positionX = i => (times ? x(times[i]) : x(i));
    const timeFormat = timeAxis ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "medium" }) : null;
    series.forEach((s, si) => {
        const base = seriesProps(s, si);
        const points = s.data.map((v, i) => [positionX(i), y(v)]).filter(([, py], i) => Number.isFinite(s.data[i]) && Number.isFinite(py));
        const group = svgEl("g", { "data-series": si, ...base });
        if (area && points.length) {
            const outline = [`M${points[0][0]},${baseline}`, ...points.map(p => `L${p.join(",")}`), `L${points.at(-1)[0]},${baseline}`, "Z"];
            group.append(svgEl("path", { d: outline.join(" "), class: "chart-area" }));
        }
        group.append(svgEl("polyline", { points: points.map(p => p.join(",")).join(" "), class: "chart-line", fill: "none" }));
        s.data.forEach((value, i) => {
            if (!Number.isFinite(value)) return;
            const dot = svgEl("circle", { cx: positionX(i), cy: y(value), r: 4, class: "chart-point" });
            const when = timeAxis ? timeFormat.format(times[i]) : (labels[i] ?? "");
            addTip(ctx, dot, positionX(i), y(value), [`${s.name ?? ""} ${when}`.trim(), formatNumber(value)]);
            group.append(dot);
        });
        svg.append(group);
    });
}

// A small line without axes, legend or title: for a table cell or a stat tile. Its tooltips still work.
function drawSparkline(svg, ctx) {
    const { series, width, height } = ctx;
    const s = series[0];
    const values = s.data.filter(Number.isFinite);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 3;
    const x = i => pad + (s.data.length === 1 ? (width - 2 * pad) / 2 : (i / (s.data.length - 1)) * (width - 2 * pad));
    const y = v => height - pad - (max === min ? (height - 2 * pad) / 2 : ((v - min) / (max - min)) * (height - 2 * pad));
    const points = s.data.map((v, i) => [x(i), y(v)]).filter((_, i) => Number.isFinite(s.data[i]));
    const group = svgEl("g", { "data-series": 0, ...seriesProps(s, 0) });
    group.append(svgEl("polyline", { points: points.map(p => p.join(",")).join(" "), class: "chart-line", fill: "none" }));
    const last = points.at(-1);
    if (last) {
        const dot = svgEl("circle", { cx: last[0], cy: last[1], r: 2.5, class: "chart-point" });
        addTip(ctx, dot, last[0], last[1], [formatNumber(values.at(-1))]);
        group.append(dot);
    }
    svg.append(group);
}

function drawPie(svg, ctx) {
    const { labels, series, width, height, donut } = ctx;
    const data = series[0].data.map(v => Math.max(0, v));
    const total = data.reduce((a, b) => a + b, 0);
    const cx = width / 2;
    const cy = MARGIN.top + (height - MARGIN.top - MARGIN.bottom) / 2;
    const r = Math.min(width - MARGIN.left - MARGIN.right, height - MARGIN.top - MARGIN.bottom) / 2;
    const inner = donut ? r * 0.55 : 0;
    const point = (radius, angle) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)].join(",");
    let start = -Math.PI / 2;
    data.forEach((value, i) => {
        if (!total || !value) return;
        const sweep = (value / total) * Math.PI * 2;
        let slice;
        if (sweep >= Math.PI * 2 - 1e-6) {
            // A single full slice cannot be drawn as an arc.
            slice = donut
                ? svgEl("circle", { cx, cy, r: (r + inner) / 2, fill: "none", "stroke-width": r - inner, class: "chart-ring" })
                : svgEl("circle", { cx, cy, r });
        } else {
            const end = start + sweep;
            const large = sweep > Math.PI ? 1 : 0;
            const d = donut
                ? `M${point(r, start)} A${r},${r} 0 ${large} 1 ${point(r, end)} L${point(inner, end)} A${inner},${inner} 0 ${large} 0 ${point(inner, start)} Z`
                : `M${cx},${cy} L${point(r, start)} A${r},${r} 0 ${large} 1 ${point(r, end)} Z`;
            slice = svgEl("path", { d });
        }
        slice.setAttribute("class", `chart-slice ${slice.getAttribute("class") ?? ""} ${seriesClass(i)}`.replace(/\s+/g, " ").trim());
        slice.setAttribute("data-series", i);
        const mid = start + sweep / 2;
        const [tx, ty] = point(r * (donut ? (1 + 0.55) / 2 : 0.6), mid).split(",").map(Number);
        addTip(ctx, slice, tx, ty, [labels[i] ?? "", `${formatNumber(value)} (${Math.round(value / total * 100)}%)`]);
        svg.append(slice);
        start += sweep;
    });
    // The legend of a pie lists the slices, not the series.
    return labels.map((name, i) => ({ name, props: { class: seriesClass(i) }, series: i }));
}

const DRAWERS = {
    bar: drawBar,
    line: drawLine,
    area: (svg, ctx) => drawLine(svg, { ...ctx, area: true }),
    sparkline: drawSparkline,
    pie: drawPie,
    donut: (svg, ctx) => drawPie(svg, { ...ctx, donut: true })
};

/* ------------------TABLE OF VALUES------------------- */

// The same numbers as a table, for screen readers and for people who want to read them off or copy them.
function buildDataTable({ labels, series, times, title, type }) {
    const details = document.createElement("details");
    details.className = "chart-data";
    const summary = document.createElement("summary");
    summary.textContent = translate("showAsTable");
    const table = document.createElement("table");
    table.className = "athena-table chart-data-table";
    if (title) table.createCaption().textContent = title;
    const headRow = table.createTHead().insertRow();
    const names = type === "pie" || type === "donut" ? [series[0].name ?? ""] : series.map((s, i) => s.name ?? `${translate("series")} ${i + 1}`);
    ["", ...names].forEach((name, i) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = i ? name : (times ? translate("time") : "");
        headRow.append(th);
    });
    const body = table.createTBody();
    const shown = type === "pie" || type === "donut" ? [series[0]] : series;
    const count = Math.max(...shown.map(s => s.data.length));
    const when = times ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "medium" }) : null;
    for (let i = 0; i < count; i++) {
        const row = body.insertRow();
        const head = document.createElement("th");
        head.scope = "row";
        head.textContent = times ? when.format(times[i]) : (labels[i] ?? "");
        row.append(head);
        for (const s of shown) row.insertCell().textContent = s.data[i] == null ? "" : formatNumber(s.data[i]);
    }
    details.append(summary, table);
    return details;
}

/**
 * Draws a chart as inline SVG and appends it to its parent.
 *
 * @param {object} options
 * @param {"bar"|"line"|"area"|"sparkline"|"pie"|"donut"} [options.type="bar"]
 * @param {string|Element} [options.parent] element, id or selector, defaults to "wrapper"
 * @param {string} [options.id] id of the svg element
 * @param {string} [options.title] drawn above the chart, and its accessible name
 * @param {string[]} [options.labels] category labels
 * @param {(number|Date|string)[]} [options.times] line and area charts: the time of every value (Date, ms or a date string).
 *        The x axis becomes a time axis with ticks at round times, and the points sit at their real distance.
 * @param {{name?: string, data: number[], color?: string}[]} options.series pie / donut / sparkline use the first series only.
 *        Colours come from the theme (--series-1 ... --series-8); `color` is an override for one series.
 * @param {number} [options.width=600] (a sparkline: 120)
 * @param {number} [options.height=360] (a sparkline: 32)
 * @param {boolean} [options.legend] default: shown for several series, and for pie / donut. Clicking an entry hides / shows its series.
 * @param {boolean} [options.table=false] adds a "Show as table" section with the values below the chart
 * @param {boolean} [options.zero=true] line charts: false lets the value axis start near the smallest value
 * @returns {(SVGElement & {element: SVGElement, update: (options?: object) => void, destroy: () => void})|null}
 *          the SVG element, which also carries the handle ({ element, update(options), destroy() }) of the other
 *          components; null when the options are invalid. `parent` is an element, an id or a selector.
 */
export function generateChart(options = {}) {
    const built = buildChart(options);
    if (!built) return null;
    const host = resolveElement(options.parent ?? "wrapper") ?? document.body;
    host.append(built.svg);
    if (built.table) built.svg.after(built.table);
    return withHandle(built, options);
}

// update(changes) draws the chart again with the old options plus the changes, in the same place.
function withHandle(built, options) {
    let current = built;
    let used = options;
    const { svg } = built;
    const handle = {
        get element() { return current.svg; },
        update(changes = {}) {
            const next = buildChart({ ...used, ...changes });
            if (!next) return current.svg;
            used = { ...used, ...changes };
            current.svg.replaceWith(next.svg);
            current.table?.remove();
            if (next.table) next.svg.after(next.table);
            current = next;
            return withHandle(next, used);
        },
        destroy() {
            current.svg.remove();
            current.table?.remove();
        }
    };
    return Object.defineProperties(svg, {
        element: { get: () => handle.element, configurable: true },
        update: { value: handle.update, configurable: true },
        destroy: { value: handle.destroy, configurable: true },
        dataTable: { get: () => current.table ?? null, configurable: true }
    });
}

function buildChart(options = {}) {
    const { type = "bar", id, title } = options;
    const sparkline = type === "sparkline";
    const width = options.width ?? (sparkline ? 120 : 600);
    const height = options.height ?? (sparkline ? 32 : 360);
    const draw = DRAWERS[type];
    const series = (options.series ?? []).filter(s => Array.isArray(s?.data) && s.data.length);
    if (!draw || !series.length) {
        console.error("Athena UI: generateChart needs a valid type and at least one series with data", options);
        return null;
    }
    const labels = (options.labels ?? []).map(String);
    const count = Math.max(...series.map(s => s.data.length));
    while (labels.length < count) labels.push(String(labels.length + 1));
    const times = options.times && (type === "line" || type === "area") ? options.times.map(toTime) : null;
    if (times && (times.length < count || times.some(Number.isNaN))) {
        console.error("Athena UI: generateChart `times` needs a valid time for every value", options);
        return null;
    }

    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width, height, class: `athena-chart athena-chart-${type}`, role: "img" });
    if (id) svg.id = id;
    const summary = `${title ?? translate(`chart.${type}`)}: ${series.map(s => s.name ?? "").filter(Boolean).join(", ")}`.replace(/: $/, "");
    svg.setAttribute("aria-label", options.ariaLabel ?? summary);
    if (title && !sparkline) svg.append(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "chart-title" }, title));

    // The tooltip is created first, so the shapes can use it, and moved to the end afterwards, so it is drawn on top.
    const tooltip = createTooltip(svg, width);
    const ctx = { labels, series, width, height, times, options, tooltip };
    const pieLegend = draw(svg, ctx);
    if (!sparkline && (options.legend ?? (Boolean(pieLegend) || series.length > 1))) {
        addLegend(svg, pieLegend ?? series.map((s, i) => ({ name: s.name ?? `${translate("series")} ${i + 1}`, props: seriesProps(s, i), series: i })), width, height, ctx);
    }
    svg.append(tooltip.group);
    return { svg, table: options.table ? buildDataTable({ labels, series, times, title, type }) : null };
}
