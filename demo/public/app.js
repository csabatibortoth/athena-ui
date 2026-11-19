// The Athena UI demo: a shell (header menu, router, theme manager, sign in state) and a page for every group of components.
// The pages are loaded when they are first visited, and they import only the entry points they use (athena-ui-js/table, /dialog, ...).

import { config, createApp, createRouter, createThemeManager, createAuthState, generateMenu, setLocale, showToast, el } from "/athena/athena-ui.js";
import { api } from "/util.js";

const app = await createApp({
    root: "#app",
    theme: { id: 0 },
    config: { generateHeadercontent: false, generateFooter: false, generateWrappercontent: false, header_title_text: "Athena UI demo" }
});

/* ------------------the state shared by the pages------------------- */

const manager = createThemeManager({
    themes: [
        { id: "athena", name: "Athena", description: "The plain blue and grey of Athena UI" },
        { id: "contrast", name: "High contrast", description: "Black and white with strong borders" },
        { id: "ocean", name: "Ocean", description: "A theme of this demo: two blocks of tokens" }
    ],
    storageKey: "athena.demo.appearance",
    themeColorVariable: "--athena-surface"
});
const auth = createAuthState({ restore: () => api("/api/me").catch(() => null) });
await auth.restore();

const shared = { api, auth, manager, menu: null, router: null, app, refresh: () => router.navigate(router.current()?.path ?? "/") };

/* ------------------the menu------------------- */

const brand = el("a", { class: "demo-brand", attrs: { href: "#/" } }, "Athena UI", el("span", { class: "demo-version", text: `v${config.version}` }));
app.header.append(brand);

const pages = [
    { id: "/", label: "Overview", icon: "⌂" },
    { id: "/tables", label: "Tables", icon: "▤" },
    { id: "/charts", label: "Charts", icon: "∿" },
    { id: "/forms", label: "Forms", icon: "✎" },
    { id: "/dialogs", label: "Dialogs", icon: "❐" },
    { id: "/navigation", label: "Navigation", icon: "☰" },
    { id: "/motion", label: "Motion", icon: "↯" },
    { id: "/themes", label: "Themes", icon: "◐" },
    { id: "/about", label: "About", icon: "ⓘ" }
];

function menuItems() {
    const items = pages.map(page => ({ ...page, href: `#${page.id}` }));
    const user = auth.getUser();
    items.push(user
        ? { id: "user", label: user.name, avatar: { name: user.name }, align: "end", children: [
            { id: "/account", label: "Account", href: "#/account" },
            ...(auth.hasRole("admin") ? [{ id: "/admin", label: "Administration", href: "#/admin" }] : []),
            { id: "sign-out", label: "Sign out" }
        ] }
        : { id: "/account", label: "Sign in", icon: "⎆", href: "#/account", align: "end" });
    return items;
}

shared.menu = generateMenu({
    parent: app.header,
    items: menuItems(),
    layout: "responsive",
    followHash: true,
    label: "Pages",
    onNavigate: async item => {
        if (item.id !== "sign-out") return;
        await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
        auth.signOut();
        showToast({ message: "You are signed out.", type: "info" });
        location.hash = "#/";
    }
});
auth.onChange(() => shared.menu.update({ items: menuItems() }));

app.container.append(el("footer", { class: "demo-footer" },
    "Athena UI ", config.version, " · MIT · ",
    el("a", { attrs: { href: "https://github.com/csabatibortoth/athena-ui", rel: "noopener noreferrer", target: "_blank" }, text: "GitHub" }), " · ",
    el("a", { attrs: { href: "https://www.npmjs.com/package/athena-ui-js", rel: "noopener noreferrer", target: "_blank" }, text: "npm" }),
    " · everything on this page runs under a strict Content-Security-Policy"));

/* ------------------the router------------------- */

let cleanup = null;
const page = name => async context => {
    cleanup?.();
    cleanup = null;
    const module = await import(`/pages/${name}.js`);
    cleanup = (await module.default(context, shared)) ?? null;
};

const router = createRouter({
    outlet: "wrapper",
    focusContent: true,
    scrollTop: true,
    transition: true,          // a page change is a view transition: the old page cross-fades into the new one (not under reduced motion)
    titlePrefix: "Athena UI demo · ",
    auth: auth.routerRules({ loginPath: "/account", homePath: "/", forbiddenPath: "/forbidden" }),
    routes: {
        "/": { handler: page("overview"), title: "Overview" },
        "/tables": { handler: page("tables"), title: "Tables" },
        "/charts": { handler: page("charts"), title: "Charts" },
        "/forms": { handler: page("forms"), title: "Forms" },
        "/dialogs": { handler: page("dialogs"), title: "Dialogs" },
        "/navigation": { handler: page("navigation"), title: "Navigation" },
        "/motion": { handler: page("motion"), title: "Motion" },
        "/themes": { handler: page("themes"), title: "Themes" },
        "/about": { handler: page("about"), title: "About" },
        "/account": { handler: page("account"), title: "Account" },
        "/admin": { handler: page("admin"), title: "Administration", auth: true, roles: ["admin"] },
        "/forbidden": { handler: page("forbidden"), title: "Not allowed" }
    },
    notFound: page("notfound")
});
shared.router = router;
router.onChange(context => shared.menu.select(context.path));   // the active item, also for the first page and for pages the menu has no link to
router.start();

// A language switch changes the texts of Athena UI itself (buttons, messages): the demo texts stay English
shared.setLanguage = language => {
    setLocale(language);
    shared.refresh();
};
