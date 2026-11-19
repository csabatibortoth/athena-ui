import { generateTable } from "/athena/table.js";
import { generatePageHeader, generateFacts } from "/athena/components.js";
import { generateButton } from "/athena/forms.js";
import { showDialog } from "/athena/dialog.js";
import { formatRelativeTime, formatNumber } from "/athena/format.js";
import { el } from "/athena/dom.js";
import { api, block, code, statusNode } from "/util.js";

// The columns of the hosts, for all the tables of this page
const columns = [
    { key: "id", label: "#", width: 80, align: "right" },
    { key: "name", label: "Host", width: 150 },
    { key: "os", label: "System", width: 110 },
    { key: "region", label: "Region", width: 110 },
    { key: "cpu", label: "CPU", width: 90, align: "right", format: value => `${value} %` },
    { key: "memory", label: "Memory", width: 100, align: "right", format: value => `${value} %` },
    { key: "status", label: "Status", width: 90, render: row => statusNode(row.status) },
    { key: "lastSeen", label: "Last seen", width: 140, format: value => formatRelativeTime(value) }
];

// What a data source does: ask the API for the page, the order and the filter the table tells it about
const hosts = ({ cursorMode = false } = {}) => async ({ page, pageSize, cursor, sort, filter }) => {
    const query = new URLSearchParams({ page, pageSize, sort: sort?.key ?? "id", dir: sort?.descending ? "desc" : "asc", filter });
    if (cursorMode) query.set("cursor", cursor ?? 0);
    return api(`/api/hosts?${query}`);
};

export default async function tables(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root,
        title: "Tables",
        description: "One table component, many sizes of data: the rows are asked for from a server, in pages, as 'Load more', or as one long list that scrolls."
    });
    const tone = (row, column) => (column.key === "cpu" ? `tone-${row.status}` : null);
    const details = row => showDialog({
        title: row.name,
        size: "small",
        content: generateFacts({ items: [
            { term: "System", description: row.os }, { term: "Region", description: row.region },
            { term: "CPU", description: `${row.cpu} %` }, { term: "Memory", description: `${row.memory} %` },
            { term: "Last seen", description: formatRelativeTime(row.lastSeen) }
        ] }).element,
        buttons: [{ text: "Close", value: true, autofocus: true }]
    });

    const pages = block(root, "Rows by page", "100,000 hosts, but the browser only ever has one page. Sort with the headers (also with the keyboard), filter in the box, open a row with Enter.");
    generateTable({
        parent: pages, id: "hosts-pages", caption: "Hosts", columns, pageSize: 10, filter: true, filterDelay: 250, density: "compact",
        dataSource: hosts(), cellClass: tone, focusableRows: true, rowLabel: row => `Host ${row.name}`, onRowClick: details,
        rowActions: [{ label: "Details", onclick: details, ariaLabel: row => `Details of ${row.name}` }]
    });
    code(pages, `generateTable({\n  columns, pageSize: 10, filter: true,\n  dataSource: ({ page, pageSize, sort, filter }) => fetchJson(\`/api/hosts?page=\${page}&...\`),   // { rows, total }\n  rowActions: [{ label: "Details", onclick: showDetails }]\n});`);

    const more = block(root, "Load more", "The same list with a cursor: the answer says where the next slice starts, and the rows are appended.");
    generateTable({ parent: more, id: "hosts-cursor", columns: columns.slice(0, 6), pageSize: 8, dataSource: hosts({ cursorMode: true }), cellClass: tone, density: "compact" });

    const long = block(root, "One list of 100,000 rows", "Only the rows in view are in the page, and the server is asked for them in chunks of 100 while you scroll. Drag the scroll bar far away: the chunks in between are never asked for.");
    generateTable({
        parent: long, id: "hosts-virtual", caption: "All hosts", columns, filter: true, filterDelay: 250,
        virtual: { height: 360, rowHeight: 34 }, chunkSize: 100, dataSource: hosts(), cellClass: tone
    });

    const local = block(root, "Rows in the browser", "The classic table: selection, inline editing (double click, or Enter and F2), column resizing, CSV export.");
    const rows = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, task: `Task ${index + 1}`, owner: ["Anna", "Béla", "Cecília"][index % 3], hours: (index * 7) % 13 + 1 }));
    const table = generateTable({
        parent: local, id: "local", columns: [{ key: "id", label: "#", width: 60 }, { key: "task", label: "Task", editable: true, width: 200 }, { key: "owner", label: "Owner", width: 120 }, { key: "hours", label: "Hours", editable: true, align: "right", width: 90 }],
        rows, selectable: true, resizableColumns: true, pageSize: 6, filter: true,
        onSelectionChange: selected => { count.textContent = `${selected.length} selected`; }
    });
    const bar = el("div", { class: "demo-row" });
    const count = el("span", { text: "0 selected" });
    generateButton({ parent: bar, text: "Export CSV", variant: "secondary", onclick: () => table.exportCsv("tasks.csv") });
    bar.append(count, el("span", { text: `${formatNumber(rows.length)} rows` }));
    local.append(bar);
}
