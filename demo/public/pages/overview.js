import { config } from "/athena/athena-ui.js";
import { generatePageHeader, generateStat, generateCard, generateFacts } from "/athena/components.js";
import { generateChart } from "/athena/chart.js";
import { formatNumber } from "/athena/format.js";
import { el } from "/athena/dom.js";
import { api, block } from "/util.js";

export default async function overview(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root,
        title: "Athena UI",
        description: "Forms, tables, charts, menus, dialogs, themes and a router in plain ES modules: no dependencies, no build step, a strict Content-Security-Policy.",
        actions: [el("a", { class: "athena-button button-primary", text: "Install from npm", attrs: { href: "https://www.npmjs.com/package/athena-ui-js", target: "_blank", rel: "noopener noreferrer" } })]
    });

    const stats = block(root, "A live look", "The numbers come from the API of this demo, and the chart is fed once a second.");
    const grid = el("div", { class: "demo-grid" });
    stats.append(grid);
    const total = generateStat({ parent: grid, label: "Hosts", value: "…", note: "made up, always the same" });
    const cpu = generateStat({ parent: grid, label: "CPU now", value: "…", note: "all hosts, a made up signal" });
    const warnings = generateStat({ parent: grid, label: "Hosts above 75 % CPU", value: "…", tone: "warn", note: "from the table API" });
    const version = generateStat({ parent: grid, label: "Athena UI", value: config.version, tone: "ok", note: "the version on this page" });
    void version;

    const spark = el("div", { class: "demo-row" });
    stats.append(spark);
    const chart = generateChart({ parent: spark, type: "area", width: 640, height: 220, title: "CPU, the last minute", series: [{ name: "CPU %", data: [0] }], times: [Date.now()], maxPoints: 60, interactive: false });

    let since = Date.now() - 60000;
    async function poll() {
        try {
            const { points, now } = await api(`/api/metrics?since=${since}`);
            since = now;
            for (const point of points) chart.push({ x: point.t, values: point.cpu }, { maxPoints: 60 });
            if (points.length) cpu.update({ value: `${points.at(-1).cpu} %`, tone: points.at(-1).cpu > 85 ? "bad" : points.at(-1).cpu > 70 ? "warn" : "ok" });
        } catch { /* the next poll tries again */ }
    }
    poll();
    const timer = setInterval(() => { if (!document.hidden) poll(); }, 1000);

    api("/api/hosts?pageSize=1").then(({ total: count }) => total.update({ value: formatNumber(count) }));
    // the 200 busiest hosts are the first page of the list sorted by CPU
    api("/api/hosts?pageSize=200&sort=cpu&dir=desc").then(({ rows }) => warnings.update({ value: formatNumber(rows.filter(host => host.cpu > 75).length) + "+", note: "among the 200 busiest" }));

    const what = block(root, "What is on the other pages", "Every page is one group of components, and the code of every demo is the code you would write.");
    const cards = el("div", { class: "demo-grid" });
    what.append(cards);
    for (const [title, text, href] of [
        ["Tables", "Rows from a server by page, by cursor and as one long list of 100,000 rows with virtual scrolling.", "#/tables"],
        ["Charts", "A chart that streams, zooms and has a time axis; bars, areas, donuts and sparklines.", "#/charts"],
        ["Forms", "Every field type, validation, date and time ranges, a wizard, rich text, a drop zone.", "#/forms"],
        ["Dialogs", "Native dialogs, a form dialog that keeps the server's errors, confirmation by typing, toasts.", "#/dialogs"],
        ["Navigation", "Tabs, accordion, dropdown, pagination and a menu with groups inside groups and badges.", "#/navigation"],
        ["Themes", "Light, dark or like the system, three themes, tokens you can change live, two languages.", "#/themes"]
    ]) {
        const card = generateCard({ parent: cards, title, content: [text, " ", el("a", { text: "Open", attrs: { href } })] });
        void card;
    }

    const about = block(root, "On this page", "");
    generateFacts({
        parent: about, inline: true, items: [
            { term: "Athena UI", description: config.version },
            { term: "Loaded from", description: `${location.origin}/athena/` },
            { term: "Dependencies", description: "none" },
            { term: "Content-Security-Policy", description: "script-src 'self'; style-src 'self': no inline script, no inline style" }
        ]
    });

    return () => {
        clearInterval(timer);
        chart.destroy();
    };
}
