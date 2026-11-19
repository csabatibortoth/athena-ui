import { generateTabs, generateAccordion, generateDropdown, generateBreadcrumbs, generatePagination, generateSidebar } from "/athena/navigation.js";
import { generateMenu } from "/athena/menu.js";
import { generatePageHeader, generateCard } from "/athena/components.js";
import { generateButton } from "/athena/forms.js";
import { showToast } from "/athena/feedback.js";
import { el } from "/athena/dom.js";
import { block } from "/util.js";

export default async function navigation(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Navigation",
        description: "Menus, tabs and friends. Everything is reachable with the keyboard, and the arrow keys, Home, End and Esc do what you expect.",
        breadcrumbs: [{ label: "Demo", href: "#/" }, { label: "Navigation" }]
    });

    // ------------------------------------------------------------ menu
    const menus = block(root, "A menu with groups inside groups", "Tab reaches every item. ArrowDown opens a group, ArrowRight a group inside it, ArrowLeft goes back, Esc closes the innermost group. The bell has a badge.");
    const log = el("p", { text: "Pick an item…" });
    const menu = generateMenu({
        parent: menus, label: "Example menu", active: "overview", onNavigate: item => { log.textContent = `You used: ${item.label}`; },
        items: [
            { id: "overview", label: "Overview", icon: "⌂" },
            { id: "reports", label: "Reports", icon: "▤", children: [
                { id: "daily", label: "Daily" },
                { id: "weekly", label: "Weekly" },
                { id: "export", label: "Export", children: [{ id: "csv", label: "CSV" }, { id: "json", label: "JSON" }, { id: "more", label: "More", children: [{ id: "xml", label: "XML" }, { id: "yaml", label: "YAML" }] }] }
            ] },
            { id: "alerts", label: "Alerts", icon: "🔔", badge: { text: 3, tone: "bad" }, badgeLabel: "3 unread" },
            { id: "disabled", label: "Disabled", disabled: true },
            { id: "me", label: "Anna Kiss", avatar: { name: "Anna Kiss" }, align: "end", children: [{ id: "profile", label: "Profile" }, { id: "out", label: "Sign out" }] }
        ]
    });
    menus.append(log);
    let unread = 3;
    const bump = el("div", { class: "demo-row" });
    menus.append(bump);
    generateButton({ parent: bump, text: "One more alert", variant: "secondary", onclick: () => { unread = unread >= 120 ? 0 : unread + 40; menu.setBadge("alerts", { text: unread, tone: "bad" }); } });
    generateButton({ parent: bump, text: "Select Weekly", variant: "secondary", onclick: () => menu.select("weekly") });

    // ------------------------------------------------------------ tabs, accordion
    const two = el("div", { class: "demo-two" });
    root.append(two);
    const tabs = block(two, "Tabs", "Arrow keys move between tabs; a panel is built when it is first shown.");
    generateTabs({
        parent: tabs,
        tabs: [
            { id: "one", label: "Overview", content: "The first tab." },
            { id: "two", label: "Lazy", content: () => { showToast({ message: "This tab was built just now.", type: "info", duration: 1500 }); return el("p", { text: `Built at ${new Date().toLocaleTimeString()}.` }); } },
            { id: "three", label: "Disabled", content: "Not reachable.", disabled: true }
        ]
    });
    const acc = block(two, "Accordion", "The native <details> element: one open at a time, no script needed for the toggling.");
    generateAccordion({
        parent: acc,
        items: [
            { title: "What is it?", content: "A UI library of plain ES modules.", open: true },
            { title: "What does it need?", content: "Nothing: no dependencies, no build step." },
            { title: "Is it accessible?", content: "Keyboard, ARIA and reduced focus loss are part of every component." }
        ]
    });

    // ------------------------------------------------------------ the rest
    const bits = block(root, "Dropdown, breadcrumbs, pagination, sidebar", "");
    const row = el("div", { class: "demo-row" });
    bits.append(row);
    generateDropdown({ parent: row, label: "Actions", caret: true, items: [{ label: "Edit", onclick: () => showToast({ message: "Edit", duration: 1200 }) }, { divider: true }, { label: "Delete", onclick: () => showToast({ message: "Delete", type: "warning", duration: 1200 }) }, { label: "Locked", disabled: true }] });
    generateDropdown({ parent: row, icon: "⋮", ariaLabel: "More actions", align: "right", items: [{ label: "Share" }, { label: "Rename" }] });
    generateBreadcrumbs({ parent: bits, items: [{ label: "Home", href: "#/" }, { label: "Navigation", href: "#/navigation" }, { label: "Breadcrumbs" }] });
    const pageLabel = el("span", { text: "Page 1" });
    generatePagination({ parent: bits, total: 480, pageSize: 20, onChange: page => { pageLabel.textContent = `Page ${page}`; } });
    bits.append(pageLabel);
    const card = generateCard({ parent: bits, title: "Sidebar", content: "" });
    generateSidebar({
        parent: card.body, active: "inbox",
        items: [{ id: "inbox", label: "Inbox" }, { id: "sent", label: "Sent" }, { id: "folders", label: "Folders", children: [{ id: "work", label: "Work" }, { id: "home", label: "Home" }] }]
    });
}
