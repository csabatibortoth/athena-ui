import { generatePageHeader, generateEmptyState } from "/athena/components.js";

export default async function notfound(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({ parent: root, title: "Page not found" });
    generateEmptyState({ parent: root, icon: "∅", title: `There is no page ${context.path}`, message: "Use the menu, or go to the overview.", action: { text: "Overview", onclick: () => { location.hash = "#/"; } } });
}
