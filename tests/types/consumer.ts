// Type check of how an application uses Athena UI: this file has to compile against types/ (see tests/types.test.js).
import { generateTable, createApp } from "athena-ui-js";
import { showFormDialog, showConfirm } from "athena-ui-js/dialog";
import { generateChart } from "athena-ui-js/chart";
import { generateMenu } from "athena-ui-js/menu";
import { createThemeManager } from "athena-ui-js/theme";
import { createAuthState } from "athena-ui-js/session";
import { formatDuration } from "athena-ui-js/format";
import { el } from "athena-ui-js/dom";

const table = generateTable({
    parent: "wrapper",
    columns: [{ key: "name", label: "Name" }],
    dataSource: async ({ page, pageSize }) => ({ rows: [{ name: String(page * pageSize) }], total: 100 }),
    rowActions: [{ label: "Delete", danger: true, onclick: row => console.log(row) }]
});
table.destroy();

const saved: Promise<boolean> = showFormDialog({ title: "Add", fields: [{ name: "a" }], onSubmit: async values => { void values; } });
const sure: Promise<boolean> = showConfirm({ message: "Sure?", danger: true, typeToConfirm: "prod" });
const chart = generateChart({ type: "line", series: [{ data: [1, 2] }], zoom: true });
chart?.push({ values: 3 });
const menu = generateMenu({ items: [{ id: "a", label: "A", badge: 3, children: [{ id: "b", label: "B" }] }], onNavigate: item => console.log(item.id) });
menu.select("a");
const manager = createThemeManager({ themes: [{ id: "x" }] });
manager.setMode("dark");
const auth = createAuthState();
const signedIn: boolean = auth.isSignedIn();
const text: string = formatDuration(1000);
const node: HTMLElement = el("div", { class: "x", text: "y" });
const app = createApp({ root: "#app" });
void [saved, sure, signedIn, text, node, app];
