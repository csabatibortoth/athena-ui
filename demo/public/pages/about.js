import { config } from "/athena/athena-ui.js";
import { generatePageHeader, generateFacts } from "/athena/components.js";
import { el } from "/athena/dom.js";
import { api, block } from "/util.js";

export default async function about(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({ parent: root, title: "About this demo", description: "What you are looking at, and how it is served." });

    const what = block(root, "The library", "");
    const facts = generateFacts({ parent: what, inline: true, items: [
        { term: "Athena UI", description: config.version },
        { term: "Licence", description: "MIT" },
        { term: "Dependencies", description: "none" },
        { term: "Entry points", description: "athena-ui-js/table, /dialog, /menu, /chart, ... (this demo imports only the ones a page uses)" }
    ] });
    what.append(el("p", {}, el("a", { text: "Source and documentation on GitHub", attrs: { href: "https://github.com/csabatibortoth/athena-ui", target: "_blank", rel: "noopener noreferrer" } }), " · ",
        el("a", { text: "Migration from 1.x", attrs: { href: "https://github.com/csabatibortoth/athena-ui/blob/master/docs/migration-2.0.md", target: "_blank", rel: "noopener noreferrer" } })));

    const server = block(root, "The server", "This page was sent with the headers below. They are asked for with a HEAD request just now.");
    const table = el("pre", { class: "demo-code", text: "…" });
    server.append(table);
    try {
        const response = await fetch("/", { method: "HEAD" });
        const wanted = ["content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "x-frame-options", "content-encoding", "cache-control"];
        table.textContent = wanted.filter(name => response.headers.has(name)).map(name => `${name}: ${response.headers.get(name)}`).join("\n");
    } catch {
        table.textContent = "The headers could not be read.";
    }
    const versions = await api("/api/version").catch(() => null);
    if (versions) generateFacts({ parent: server, inline: true, items: [{ term: "Demo", description: versions.demo }, { term: "Node.js", description: versions.node }] });

    const ideas = block(root, "What to try", "");
    ideas.append(el("ul", {}, ...[
        "Tab through the page: every control is reachable, and the focus is always visible.",
        "Open a dialog and press Esc. The focus returns to the button.",
        "Scroll the 100,000 row table to the far end with the scroll bar.",
        "Zoom into the streaming chart by dragging, then press 0.",
        "Switch to the dark mode and reload: no flash of the wrong colours.",
        "Turn JavaScript off (or look at the page source): the page says what it needs."
    ].map(text => el("li", { text }))));
}
