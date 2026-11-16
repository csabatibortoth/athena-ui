import * as ui from "./athena-ui.js";

const {
    init, setTheme, setLocale, getLocale, createRouter, translate,
    generateLoginForm, generateRegistrationForm, generateLostPasswordForm, generateChangePasswordForm,
    generateChart, generateTable, generateForm, generateButton, generateField,
    showToast, generateAlert, generateSpinner, generateProgress, alertDialog, confirmDialog, promptDialog,
    generateTabs, generateBreadcrumbs, generatePagination, generateAccordion, generateDropdown, generateSidebar,
    generateCard, generateBadge, generateAvatar, generateStat, generateGrid, generateTooltip, generateLink, generateSection,
    generateAutocomplete, generateMultiSelect, generateFileUpload, generateStepper, generateDateRange, generateRichText,
    setSession, getSession, logout, isLoggedIn
} = ui;

const COUNTRIES = ["Austria", "Belgium", "Croatia", "Czechia", "Denmark", "Finland", "France", "Germany", "Hungary", "Italy", "Poland", "Slovakia", "Spain", "Sweden"];
const section = text => generateSection({ parent: "wrapper", title: text, level: 3 });

const pages = {
    "/login": () => generateLoginForm(),
    "/register": () => generateRegistrationForm(),
    "/lost-password": () => generateLostPasswordForm(),
    "/change-password": () => generateChangePasswordForm(),

    "/charts": () => {
        const labels = ["Q1", "Q2", "Q3", "Q4"];
        const grid = generateGrid({ parent: "wrapper", columns: 2 });
        generateChart({ parent: grid, type: "bar", title: "Revenue", labels, series: [{ name: "2025", data: [12, 19, 8, 15] }, { name: "2026", data: [14, 17, 12, 21] }] });
        generateChart({ parent: grid, type: "line", title: "Growth", labels, series: [{ name: "Users", data: [-3, 4, 9, 14] }] });
        generateChart({ parent: grid, type: "pie", title: "Share", labels: ["A", "B", "C"], series: [{ data: [50, 30, 20] }], width: 400 });
        generateChart({ parent: grid, type: "donut", title: "Share", labels: ["A", "B", "C"], series: [{ data: [50, 30, 20] }], width: 400 });
    },

    "/tables": () => {
        const rows = [
            { name: "Anna", age: 31, city: "Budapest" }, { name: "Béla", age: 27, city: "Szeged" },
            { name: "Csilla", age: 45, city: "Pécs" }, { name: "Dani", age: 22, city: "Győr" },
            { name: "Emma", age: 38, city: "Debrecen" }
        ];
        const selection = document.createElement("p");
        const table = generateTable({
            caption: "Users (double click Name or Age to edit)",
            columns: [{ key: "name", label: "Name", editable: true }, { key: "age", label: "Age", editable: true }, { key: "city", label: "City" }],
            rows, filter: true, pageSize: 3, selectable: true,
            onSelectionChange: selected => { selection.textContent = `${selected.length} selected`; },
            onEdit: (row, key, value) => showToast({ message: `${key} of ${row.name} is now ${value}`, type: "success" })
        });
        generateButton({ parent: "wrapper", text: "Export CSV", variant: "secondary", onclick: () => table.exportCsv("users.csv") });
        document.getElementById("wrapper").append(selection);
        section("Resizable columns and virtual scrolling (10 000 rows)");
        generateTable({
            id: "big-table", caption: "Drag a header edge, or focus it and use the arrow keys", resizableColumns: true, filter: true, virtual: { height: 320, rowHeight: 34 },
            columns: [{ key: "id", label: "#", width: 80 }, { key: "name", label: "Name", width: 220 }, { key: "email", label: "Email", width: 280 }, { key: "score", label: "Score", width: 100 }],
            rows: Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}`, email: `user${i + 1}@example.com`, score: (i * 37) % 101 }))
        });
    },

    "/forms": () => {
        generateForm({
            parent: "wrapper",
            id: "demo-form",
            submitText: "Save",
            resetText: "Reset",
            fields: [
                { name: "name", label: "Name", required: true, minLength: 2, help: "At least 2 characters" },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "password", label: "Password", type: "password", required: true, minLength: 6 },
                { name: "password2", label: "Repeat password", type: "password", required: true, match: "password" },
                { name: "age", label: "Age", type: "number", min: 18, max: 120 },
                { name: "birthday", label: "Birthday (native date picker)", type: "date" },
                { name: "bio", label: "About you", type: "textarea", rows: 3, maxLength: 200 },
                { name: "country", label: "Country", type: "select", placeholder: "Choose...", options: COUNTRIES, required: true },
                { name: "plan", label: "Plan", type: "radio", options: ["Free", "Pro", "Team"], value: "Free" },
                { name: "interests", label: "Interests", type: "checkboxes", options: ["Music", "Sports", "Travel"] },
                { name: "visited", label: "Visited countries", type: "multiselect", options: COUNTRIES },
                { name: "home", label: "Home country (autocomplete)", type: "autocomplete", options: COUNTRIES },
                { name: "period", label: "Stay (date range)", type: "daterange", required: true },
                { name: "notes", label: "Notes (rich text)", type: "richtext", placeholder: "Write something..." },
                { name: "news", label: "Send me the newsletter", type: "switch", value: true },
                { name: "terms", label: "I accept the terms", type: "checkbox", required: true }
            ],
            onSubmit: async values => {
                await new Promise(resolve => setTimeout(resolve, 800));
                if (values.name.toLowerCase() === "admin") throw new Error("The name \"admin\" is reserved.");
                showToast({ title: "Saved", message: JSON.stringify(values), type: "success", duration: 6000 });
            }
        });
    },

    "/feedback": () => {
        const wrapper = "wrapper";
        section("Toasts");
        for (const type of ["info", "success", "warning", "error"]) {
            generateButton({ parent: wrapper, text: type, variant: "secondary", onclick: () => showToast({ title: type, message: `This is a ${type} toast`, type }) });
        }
        section("Alerts");
        generateAlert({ parent: wrapper, type: "info", title: "Heads up", message: "An inline alert." });
        generateAlert({ parent: wrapper, type: "error", message: "Something failed.", dismissible: true });
        section("Spinner and progress");
        generateSpinner({ parent: wrapper });
        const progress = generateProgress({ parent: wrapper, label: "Progress", value: 35 });
        generateProgress({ parent: wrapper, label: "Indeterminate" });
        let percent = 35;
        generateButton({ parent: wrapper, text: "+10%", variant: "secondary", onclick: () => { percent = (percent + 10) % 110; progress.setValue(percent); } });
        section("Dialogs");
        generateButton({ parent: wrapper, text: "alert", variant: "secondary", onclick: () => alertDialog("Hello!", { title: "Alert" }) });
        generateButton({
            parent: wrapper, text: "confirm", variant: "danger",
            onclick: async () => showToast(await confirmDialog("Delete the item?", { title: "Confirm", confirmText: "Delete", danger: true }) ? "Deleted" : "Cancelled")
        });
        generateButton({
            parent: wrapper, text: "prompt", variant: "secondary",
            onclick: async () => {
                const value = await promptDialog("Your name", { title: "Prompt", validate: v => v.trim() ? "" : translate("validation.required") });
                showToast(value === null ? "Cancelled" : `Hello ${value}`);
            }
        });
        section("Buttons");
        generateButton({ parent: wrapper, text: "Primary" });
        generateButton({ parent: wrapper, text: "Secondary", variant: "secondary" });
        generateButton({ parent: wrapper, text: "Danger", variant: "danger" });
        generateButton({ parent: wrapper, text: "Link", variant: "link" });
        generateButton({ parent: wrapper, text: "Loading", loading: true });
        generateButton({ parent: wrapper, text: "Disabled", disabled: true });
    },

    "/navigation": () => {
        const wrapper = "wrapper";
        generateBreadcrumbs({ parent: wrapper, items: [{ label: "Home", href: "#/" }, { label: "Library", href: "#/navigation" }, { label: "Navigation" }] });
        section("Tabs");
        generateTabs({ parent: wrapper, tabs: [
            { id: "a", label: "First", content: "Content of the first tab" },
            { id: "b", label: "Second", content: () => "Rendered when first shown" },
            { id: "c", label: "Disabled", content: "-", disabled: true }
        ] });
        section("Accordion");
        generateAccordion({ parent: wrapper, items: [
            { title: "What is Athena UI?", content: "A small framework.", open: true },
            { title: "Is it accessible?", content: "Keyboard and ARIA support is built in." }
        ] });
        section("Dropdown");
        generateDropdown({ parent: wrapper, label: "Actions", items: [
            { label: "Edit", onclick: () => showToast("Edit") }, { label: "Duplicate", onclick: () => showToast("Duplicate") },
            { divider: true }, { label: "Delete", onclick: () => showToast({ message: "Delete", type: "error" }) }
        ] });
        section("Pagination");
        const text = document.createElement("p");
        text.textContent = "Page 1";
        generatePagination({ parent: wrapper, total: 200, pageSize: 10, onChange: page => { text.textContent = `Page ${page}`; } });
        document.getElementById(wrapper).append(text);
        section("Sidebar");
        generateSidebar({ parent: wrapper, active: "overview", onSelect: item => showToast(item.label), items: [
            { id: "overview", label: "Overview", icon: "▣" },
            { id: "reports", label: "Reports", icon: "▤", children: [{ id: "daily", label: "Daily" }, { id: "monthly", label: "Monthly" }] },
            { id: "settings", label: "Settings", icon: "⚙" }
        ] });
    },

    "/components": () => {
        const wrapper = "wrapper";
        section("Stats");
        const stats = generateGrid({ parent: wrapper, columns: 3 });
        generateStat({ parent: stats, label: "Revenue", value: "$12.4k", delta: 8.2 });
        generateStat({ parent: stats, label: "Errors", value: 14, delta: -30, invertDelta: true });
        generateStat({ parent: stats, label: "Users", value: 1280, delta: 0 });
        section("Cards");
        const cards = generateGrid({ parent: wrapper, columns: 3 });
        for (const n of [1, 2, 3]) {
            generateCard({ parent: cards, title: `Card ${n}`, content: "Some card content.", footer: () => generateLink({ text: "Read more", onclick: () => showToast(`Card ${n}`) }) });
        }
        section("Badges, avatars, tooltip");
        for (const variant of ["neutral", "info", "success", "warning", "error"]) generateBadge({ parent: wrapper, text: variant, variant, pill: true });
        generateAvatar({ parent: wrapper, name: "Ada Lovelace" });
        generateAvatar({ parent: wrapper, name: "Csaba Tóth", size: "large" });
        generateAvatar({ parent: wrapper, name: "Broken Image", src: "missing.png" });
        const hover = generateButton({ parent: wrapper, text: "Hover me", variant: "secondary" });
        generateTooltip(hover.element, "A tooltip");
        section("Links");
        generateLink({ parent: wrapper, text: "External link", href: "https://github.com/csabatibortoth/athena-ui", external: true });
    },

    "/inputs": () => {
        const wrapper = "wrapper";
        section("Autocomplete");
        generateAutocomplete({ parent: wrapper, label: "Country", options: COUNTRIES });
        section("Multi select");
        generateMultiSelect({ parent: wrapper, label: "Countries", options: COUNTRIES, value: ["Hungary"] });
        section("Remote autocomplete");
        generateAutocomplete({
            parent: wrapper, label: "Async source (300 ms delay)", minChars: 2,
            options: async query => { await new Promise(r => setTimeout(r, 300)); return COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase())); }
        });
        section("Date range");
        generateDateRange({ parent: wrapper, label: "Period", from: "2026-01-01" });
        section("Rich text");
        const rich = generateRichText({ parent: wrapper, label: "Description", placeholder: "Write something...", value: "<p>Select text and use the toolbar. <strong>Safe HTML</strong> only.</p>" });
        generateButton({ parent: wrapper, text: "Show HTML", variant: "secondary", onclick: () => alertDialog(rich.getValue() || "(empty)", { title: "HTML" }) });
        section("File upload (collects files, no server)");
        generateFileUpload({ parent: wrapper, accept: ".png,.jpg,image/*,.pdf", maxSize: 2 * 1024 * 1024, onSelect: files => showToast(`${files.length} file(s) added`) });
        section("Stepper");
        let nameField;
        generateStepper({
            parent: wrapper,
            steps: [
                {
                    title: "Name",
                    content: () => (nameField = generateField({ parent: document.createElement("div"), name: "name", label: "Your name", required: true })).element,
                    validate: () => nameField.validate() || true
                },
                { title: "Details", content: "Nothing to fill here." },
                { title: "Done", content: "Press finish." }
            ],
            onFinish: () => showToast({ message: `Welcome ${nameField.getValue()}`, type: "success" })
        });
    },

    "/session": () => {
        const wrapper = "wrapper";
        const status = document.createElement("p");
        const refresh = () => { status.textContent = isLoggedIn() ? `Logged in as ${getSession().user.name}` : "Logged out"; };
        generateButton({ parent: wrapper, text: "Log in as demo (remembered)", onclick: () => { setSession({ user: { name: "demo" }, token: "t", remember: true }); refresh(); } });
        generateButton({ parent: wrapper, text: "Log out", variant: "secondary", onclick: () => { logout(); refresh(); } });
        document.getElementById(wrapper).append(status);
        refresh();
    }
};

const router = createRouter({
    routes: { "/": () => generateAlert({ parent: "wrapper", title: "Athena UI", message: "Pick a page from the menu." }), ...pages },
    notFound: () => generateAlert({ parent: "wrapper", type: "error", message: "Page not found" })
});

// Submenus: a menu item with children opens a list
const submenu = (label, children) => ({ id: `menu-${label}`, class: "menu-item", text: "", inner_text: label, children: children.map(inner_text => ({ inner_text })) });
const item = label => ({ id: `menu-${label}`, class: "menu-item", text: "", inner_text: label });
let darkTheme = false;

init({
    theme: { id: 0 },
    config: { login_enabled: true, registration_enabled: true, lost_password_enabled: true, change_password_enabled: true, login_remember_me: true, header_title_text: "Athena UI" },
    menuItems: {
        headerMenu: [
            submenu("Account", ["Login", "Register", "Lost password", "Change password", "Session"]),
            submenu("Data", ["Charts", "Tables"]),
            submenu("Library", ["Forms", "Feedback", "Navigation", "Components", "Inputs"]),
            item("Theme"), item("Language")
        ],
        footerMenu: []
    },
    nav: name => {
        if (name === "Theme") {
            darkTheme = !darkTheme;
            setTheme({ id: darkTheme ? 1 : 0 });
        } else if (name === "Language") {
            setLocale(getLocale() === "en" ? "hu" : "en");
            showToast({ message: `Language: ${getLocale()}` });
            router.navigate(router.current()?.path ?? "/");
        } else if (name) {
            router.navigate(`/${name.toLowerCase().replace(" ", "-")}`);
        }
    },
    login: data => showToast({ message: `login ${data.username} remember=${data.remember}`, type: "success" }),
    register: data => showToast({ message: `register ${data.username} ${data.email}`, type: "success" }),
    lostPassword: data => showToast({ message: `reset link for ${data.email}`, type: "success" }),
    changePassword: () => showToast({ message: "password changed", type: "success" })
}).then(() => router.start());
