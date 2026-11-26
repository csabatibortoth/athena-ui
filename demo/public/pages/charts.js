import { generateChart } from "/athena/chart.js";
import { generatePageHeader } from "/athena/components.js";
import { generateButton } from "/athena/forms.js";
import { el } from "/athena/dom.js";
import { api, block, code } from "/util.js";

export default async function charts(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({ parent: root, title: "Charts", description: "SVG, no dependencies, coloured by the theme (--series-1 to --series-8), with a table of values for everyone who cannot use the picture." });

    // ------------------------------------------------------------ streaming
    const live = block(root, "A chart that streams", "A point arrives every second. Drag over the plot to zoom into that time, double click to zoom out; on the plot the + and - keys zoom and the arrows move. Hover (or Tab to a point) for the values. The legend hides a series.");
    const chart = generateChart({
        parent: live, type: "line", width: 1000, height: 340, title: "Load of the last five minutes",
        times: [Date.now() - 1000], series: [{ name: "CPU %", data: [0] }, { name: "Memory %", data: [0] }, { name: "Network MB/s", data: [0] }],
        maxPoints: 300, zoom: true, table: true
    });
    const bar = el("div", { class: "demo-row" });
    live.append(bar);
    let paused = false;
    const pause = generateButton({ parent: bar, text: "Pause", variant: "secondary", onclick: () => { paused = !paused; pause.setText(paused ? "Resume" : "Pause"); } });
    generateButton({ parent: bar, text: "Zoom out", variant: "secondary", onclick: () => chart.resetZoom() });
    code(live, "chart.push({ x: Date.now(), values: [cpu, memory, network] }, { maxPoints: 300 });   // drawn at most once per frame");

    let since = Date.now() - 300000;
    async function poll() {
        if (paused || document.hidden) return;
        try {
            const { points, now } = await api(`/api/metrics?since=${since}`);
            since = now;
            for (const point of points) chart.push({ x: point.t, values: [point.cpu, point.memory, point.network] }, { maxPoints: 300 });
        } catch { /* the next poll tries again */ }
    }
    poll();
    const timer = setInterval(poll, 1000);

    // ------------------------------------------------------------ the other kinds
    const kinds = block(root, "Bars, areas and rings", "");
    const two = el("div", { class: "demo-two" });
    kinds.append(two);
    generateChart({
        parent: two, type: "bar", title: "Hosts by region", width: 520, height: 300, labels: ["eu-west", "eu-north", "us-east", "us-west", "ap-south"],
        series: [{ name: "Linux", data: [820, 540, 910, 430, 380] }, { name: "Windows", data: [410, 260, 520, 300, 190] }], table: true
    });
    generateChart({
        parent: two, type: "area", title: "Requests per hour", width: 520, height: 300, labels: Array.from({ length: 12 }, (_, index) => `${index * 2}:00`),
        series: [{ name: "Requests", data: [120, 80, 60, 90, 340, 520, 610, 580, 640, 420, 260, 150] }]
    });
    generateChart({
        parent: two, type: "donut", title: "Systems", width: 520, height: 300, labels: ["Linux", "Windows", "macOS", "FreeBSD"],
        series: [{ name: "Hosts", data: [58, 27, 11, 4] }]
    });
    generateChart({
        parent: two, type: "pie", title: "Status", width: 520, height: 300, labels: ["ok", "warn", "bad"], series: [{ name: "Hosts", data: [78, 16, 6] }]
    });

    // ------------------------------------------------------------ gaps, time format, points, responsive
    const gappy = block(root, "Gaps, your own time format, no dots", "A missing value breaks the line (gaps), the tooltip writes the time the way you ask (timeFormat), dots are off (points: false) and the chart is as wide as its place (responsive).");
    const start = Date.UTC(2026, 0, 1, 8);
    const half = [41, 44, 52, 49, null, null, 58, 61, 55, null, 47, 50];
    generateChart({
        parent: gappy, type: "line", title: "Temperature with a broken sensor", height: 280, responsive: true,
        times: half.map((_, index) => start + index * 1800000), series: [{ name: "°C", data: half }],
        gaps: true, points: false, timeFormat: { hour: "2-digit", minute: "2-digit" }, table: true
    });
    code(gappy, `generateChart({ type: "line", times, series, gaps: true, points: false, responsive: true,\n  timeFormat: { hour: "2-digit", minute: "2-digit" } });`);

    const small = block(root, "Sparklines", "A small line for a table cell or a tile: no axes, still readable by a screen reader.");
    const row = el("div", { class: "demo-row" });
    small.append(row);
    for (const [name, data] of [["Requests", [3, 5, 4, 8, 6, 9, 12, 10]], ["Errors", [4, 3, 3, 2, 3, 1, 1, 0]], ["Latency", [30, 32, 31, 45, 80, 60, 40, 35]]]) {
        row.append(el("span", { text: `${name} ` }));
        generateChart({ parent: row, type: "sparkline", series: [{ name, data }], ariaLabel: `${name}: ${data.join(", ")}` });
    }

    return () => {
        clearInterval(timer);
        chart.destroy();
    };
}
