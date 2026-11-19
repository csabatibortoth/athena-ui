# Athena UI

A small UI framework for development and education purposes (jQuery is optional). It generates a page
layout (header, menu, content wrapper, footer) from a single `init()` call, loads its own libraries
and theme, and ships the building blocks of a multipurpose application: forms, tables, charts,
feedback, navigation, a router and more.

Current version: **1.3.0**

[Quick start](#usage) · [API](#api) · [Components](#charts) · [Themes](#themes) · [Tests](#tests) · [Release notes](#releases)

## Status

1.0.0 is the first stable release. From here on the exported API of `src/athena-ui.js` follows
[semantic versioning](https://semver.org/): breaking changes only come with a new major version.
Known limits are listed below, so you can judge whether it fits your project:

- Rich text uses the deprecated `document.execCommand`. Content is sanitized in the browser, but sanitize it on the server too.
- The session cookie is readable from JavaScript. It is a UI state, not a security boundary: authenticate on the server.
- Virtual table rows have to be a fixed height, one line per cell (set it with `virtual.rowHeight`; the CSS variable `--row-height` follows).
- Translations: English and Hungarian.
- jQuery is optional since 1.3.0. The older generators (`generateLoginForm`, the layout and the header / footer menu built from `menuItems`) still work, and
  they no longer need it. Everything new (`generateMenu`, the sign in forms, dialogs, charts, tables, ...) is plain DOM.

## Features

- Generated page layout: container, header (logo, title, menu), wrapper, footer (menu, copyright text)
- Menus built from your own item lists, with a navigation callback
- Login, registration and lost password forms with optional SHA-256 password hashing
- SVG charts (bar, line, area, sparkline, pie, donut) with a time axis, tooltips, zoom, a clickable legend, a table of values and streaming, without extra dependencies
- Tables with sortable columns, filter box, pagination, row selection, inline editing, resizable columns, virtual scrolling for thousands of rows, rows loaded from a server (pages, "Load more", or scrolling through a data source), row actions and CSV export
- Navigation menu (`generateMenu`): real links and buttons, groups of any depth, badges, a user menu with an avatar, tabs at the bottom on a phone
- Sign in, sign up and password forms that password managers understand, and a signed-in state that lives in memory only
- Themes and modes (light / dark / like the system) with a theme manager, a picker and a no-flash boot script
- Form dialogs, confirmations (also "type the name to confirm"), date and time ranges with presets, page header, facts list, empty and loading states
- Safe DOM building (`el`, `createSafeBuilder`): text stays text, no event attributes, no inline style
- Form builder: text, number, date, textarea, select, radio / checkbox groups, switch, autocomplete, multi select, with validation
- Buttons, toasts, alerts, spinner, progress bar, alert / confirm / prompt dialogs
- Tabs, accordion, dropdown, sidebar, breadcrumbs, pagination and a hash / history router
- Cards, grid, badges, avatars, KPI tiles, tooltips, links, sections
- File upload with progress, drag-and-drop area, stepper (wizard), date range picker, rich text and WYSIWYG editor
- Menus with submenus
- Session handling (login state in a cookie), change password form
- Default and dark theme (switchable at runtime), responsive, translations (English, Hungarian), keyboard and ARIA support
- Modal open / close helpers
- Themes loaded at runtime, custom stylesheets supported
- Written as ES modules, no build step

## Requirements

- jQuery is optional (v4.0.0, only if your own code or an older application uses it). Athena UI itself does not need it.
- A browser with ES module support
- The page has to be served over HTTP(S). Modules do not load from `file://`.

Bundled as git submodules (third party):

| Library | Version | Used for |
| --- | --- | --- |
| [crypto-js](https://github.com/brix/crypto-js) | 4.2.0 | password hashing |
| [js-cookie](https://github.com/js-cookie/js-cookie) | 3.0.8 | cookie handling |

## Installation

```sh
git clone --recurse-submodules https://github.com/csabatibortoth/athena-ui.git
```

In an existing clone, or after updating:

```sh
git submodule update --init
```

Serve the `src` folder with any static web server and open `index.html` to see the example.

## Usage

```html
<!-- jQuery is not needed -->
<script type="module">
    import { init, clearWrapper, generateLoginForm } from "./athena-ui.js";

    init({
        theme: { id: 0 },
        config: { header_title_text: "My App", login_enabled: true },
        menuItems: {
            headerMenu: [
                { id: "menu-home", class: "menu-item", text: "", inner_text: "Home" },
                { id: "menu-login", class: "menu-item", text: "", inner_text: "Login" }
            ],
            footerMenu: []
        },
        nav: page => {
            if (page === "Login") {
                clearWrapper();
                generateLoginForm();
            }
        },
        login: ({ username, password }) => console.log(`${username} logged in`)
    });
</script>
```

`init()` returns a Promise that resolves with the effective configuration once the libraries and
the theme are loaded and the layout is generated.

### init options

| Option | Description |
| --- | --- |
| `theme` | `{ id }` of a theme registered in `res/themes/themes.js`, or `{ href }` of a custom stylesheet. Defaults to the default theme. |
| `config` | Settings overriding the defaults, see [Configuration](#configuration). |
| `menuItems` | `{ headerMenu, footerMenu }`, arrays of `{ id, class, text, inner_text }`. Placeholder items are generated without it. |
| `nav` | Called without arguments when the wrapper is generated, and with the `inner_text` of the item on menu clicks. |
| `login` | Called with `{ username, password }` when the login button is clicked and `login_enabled` is set. |
| `register` | Called with `{ username, email, password }` when a valid registration form is submitted and `registration_enabled` is set. |
| `lostPassword` | Called with `{ email }` when a valid lost password form is submitted and `lost_password_enabled` is set. |
| `changePassword` | Called with `{ currentPassword, newPassword }` when a valid change password form is submitted and `change_password_enabled` is set. |

### Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `header_title_text` | `"Athena UI"` | Title in the header |
| `header_img_url` | | Header logo URL |
| `copyright` | placeholder text | Footer text, the version is appended |
| `version` | `"1.3.0"` | Version shown in the footer |
| `bordered` | `true` | Draw a border around the layout blocks |
| `generateHeader`, `generateFooter` | `true` | Generate the header / footer block |
| `generateHeadercontent`, `generateFooterContent`, `generateWrappercontent` | `true` | Generate the content of the block |
| `login_enabled` | `false` | Call the `login` callback from the login form |
| `registration_enabled` | `false` | Call the `register` callback from the registration form |
| `lost_password_enabled` | `false` | Call the `lostPassword` callback from the lost password form |
| `change_password_enabled` | `false` | Call the `changePassword` callback from the change password form |
| `login_remember_me` | `false` | Show a "Remember me" checkbox in the login form, passed to `login` as `remember` |
| `locale` | `"en"` | Language of the generated texts (`en`, `hu`, or your own, see [Translations](#translations)) |
| `session_cookie` | `"athena_session"` | Name of the session cookie |
| `session_days` | `7` | Lifetime of a remembered session in days |
| `enable_encrypt_password` | `false` | SHA-256 hash the password before it is passed to `login` / `register` |
| `customLoader` | | URL of an extra classic script, loaded before the layout is generated |
| `container_class`, `header_class`, `header_menu_class`, `wrapper_class`, `footer_class`, `footer_menu_class`, `loginForm_class`, `registrationForm_class`, `lostPasswordForm_class`, `changePasswordForm_class` | | CSS classes of the generated blocks |

### API

Everything is exported from `athena-ui.js`:

| Export | Description |
| --- | --- |
| `init(options)` | Loads everything and generates the layout |
| `config` | The live configuration object |
| `generateBasicLayout()`, `generateHeader()`, `generateWrapper()`, `generateFooter()` | Layout generation |
| `clearHeader()`, `clearWrapper()`, `clearFooter()`, `clearHeaderMenu()`, `clearFooterMenu()` | Empty a block |
| `generateBasicMenu(options)` | Generate a menu into any parent |
| `generateLoginForm()`, `getLoginFormData()` | Login form into the wrapper, and its current values |
| `generateRegistrationForm(parent)`, `getRegistrationFormData()`, `validateRegistrationForm()` | Registration form (username, email, password, confirmation) into `parent` (default `wrapper`). Validated before the callback is called. |
| `generateLostPasswordForm(parent)`, `getLostPasswordFormData()` | Lost password form (email) |
| `generateChart(options)` | Draw a chart, see [Charts](#charts) |
| `generateTable(options)` | Draw a table, see [Tables](#tables) |
| `generateChangePasswordForm(parent)`, `getChangePasswordFormData()`, `validateChangePasswordForm()` | Change password form |
| `generateForm`, `generateField`, `generateButton` | Form builder, see [Forms](#forms) |
| `showToast`, `generateAlert`, `generateSpinner`, `generateProgress` | See [Feedback](#feedback) |
| `showDialog`, `alertDialog`, `confirmDialog`, `promptDialog` | See [Dialogs](#dialogs) |
| `generateTabs`, `generateBreadcrumbs`, `generatePagination`, `generateAccordion`, `generateDropdown`, `generateSidebar` | See [Navigation](#navigation) |
| `createRouter(options)` | See [Router](#router) |
| `generateMenu(options)`, `generateHeaderMenu({ items })` | See [Menu component](#menu-component) |
| `generateSignInForm`, `generateSignUpForm`, `generatePasswordResetForm`, `generatePasswordChangeForm`, `createAuthState` | See [Signing in](#signing-in-recommended) |
| `showFormDialog`, `showConfirm` | See [Dialogs](#dialogs) |
| `createThemeManager`, `generateThemePicker` | See [Themes and modes](#themes-and-modes-light--dark--like-the-system) |
| `generateDateTimeRange`, `toLocalInput`, `fromLocalInput` | See [Date and time range](#date-and-time-range) |
| `generatePageHeader`, `generateFacts`, `generateEmptyState`, `generateLoading`, `copyToClipboard` | See [Page parts and formatting](#page-parts-and-formatting) |
| `formatBytes`, `formatNumber`, `formatDuration`, `formatRelativeTime`, `formatDate` | Format helpers on top of `Intl`, in the current language |
| `el`, `setContent`, `resolveElement`, `asHandle`, `createSafeBuilder` | See [Safe DOM building](#safe-dom-building) |
| `generateCard`, `generateSection`, `generateGrid`, `generateBadge`, `generateAvatar`, `generateStat`, `generateLink`, `generateTooltip` | See [Components](#components) |
| `generateAutocomplete`, `generateMultiSelect`, `generateFileUpload`, `generateDropZone`, `generateStepper`, `generateDateRange`, `generateRichText`, `generateWysiwyg` | See [Inputs](#inputs) |
| `sanitizeHtml(html)`, `htmlToText(html)`, `isSafeUrl(url)` | The allow-list sanitizer behind the rich text editor |
| `setSession`, `getSession`, `isLoggedIn`, `logout`, `onSessionChange` | See [Session](#session) |
| `translate`, `setLocale`, `getLocale`, `addMessages` | See [Translations](#translations) |
| `validateValue`, `validateAll` | The validator behind the form builder |
| `toCsv(columns, rows)`, `downloadFile(name, text)` | CSV helpers |
| `setTheme({ id })` | Switch the theme at runtime |
| `openModal(id)`, `closeModal(id)` | Show / hide a `.modal` element (default id: `myModal`). Elements with the `close` class close their modal. |
| `loadScript(src)` | Load a classic script once, returns a Promise |
| `Cookies` | The [js-cookie](https://github.com/js-cookie/js-cookie) API |
| `HTMLElementGenerator(options)` | Generates a div, span, p, heading or img and appends it to the element with the id `parent` |
| `HTMLControlGenerator(options)`, `HTMLControlGenerator.create(options)`, `HTMLControlGenerator.register(type, factory)` | Generates inputs, selects and lists from an options object. `create` builds without appending and returns the element (a jQuery object when the page has jQuery). `registerHungarianInputControls()` adds the types `hunPIN`, `hunCRID` and `hunTID` |

HTMLElementGenerator and HTMLControlGenerator used to be projects of their own. They are part of Athena UI now (the calls and options are the
same, and HTMLControlGenerator no longer needs jQuery); the old repositories are no longer developed.

### Charts

```js
const chart = generateChart({
    type: "line",                // "bar" | "line" | "area" | "sparkline" | "pie" | "donut"
    parent: "wrapper",           // element, id or selector (default "wrapper")
    title: "Revenue",
    labels: ["Q1", "Q2", "Q3"],
    series: [
        { name: "2025", data: [12, 19, 8] },
        { name: "2026", data: [14, 17, 12], color: "#e15759" }
    ],
    table: true                  // adds "Show as table" with the values
});
```

Charts are inline SVG, nothing is styled inline (a strict Content-Security-Policy works), negative values are supported. `pie` and `donut` use the
first series, one slice per label. `sparkline` is a small line without axes (120 x 32 by default) for a table cell or a tile.
Other options: `id`, `width` (600), `height` (360), `legend`, `zero: false` (a line chart's value axis may start near the smallest value).

- **Colours** come from the theme: `--series-1` ... `--series-8` (see `appearance.css`), so every chart follows light / dark. `color` overrides one series.
- **Tooltips** show on hover and on keyboard focus (every point and bar is focusable and named). In a long line chart the tooltip follows the pointer.
- **Legend**: click (or Enter / Space) on an entry hides and shows that series.
- **Time axis**: `times: [Date | ms | "2026-11-19T10:00"]` (line and area). Ticks fall on round times, points sit at their real distance.
- **Zoom** (`zoom: true`, line and area): drag over the plot, double click or the reset button zoom out. On the plot, + and - zoom, the arrow keys pan,
  0 resets. `chart.zoom(from, to)`, `chart.resetZoom()`, `chart.getZoom()`, `onZoom(range)` and `zoomRange` (ms with `times`, otherwise the point index).
- **Long series** are thinned to the width of the plot (the lowest and the highest value of every slice stay, so peaks are not lost), and dots are only drawn up to 80 points in view.
- **Streaming**: `chart.push({ x: Date.now(), values: [12, 3] }, { maxPoints: 500 })` adds a point to every series, drops the oldest ones and redraws at most once per frame.
- `chart.update({ series })` redraws with changes, `chart.destroy()` removes the chart and its table. `generateChart` returns the `<svg>` element that carries these
  methods, or `null` when the options are invalid.

### Tables

```js
const { setRows } = generateTable({
    parent: "wrapper",
    caption: "Users",
    columns: [{ key: "name", label: "Name" }, { key: "age", label: "Age", format: v => `${v} y` }],
    rows: [{ name: "Anna", age: 31 }, { name: "Béla", age: 27 }],
    filter: true,                // text filter box
    pageSize: 10,                // 0 = no pagination
    onRowClick: row => console.log(row)
});
```

Click a header to sort (disable with `sortable: false`, or per column). Other options: `id`, `class`,
`emptyText`. Returns `{ element, setRows(rows), getSelected(), clearSelection(), toCsv(), exportCsv(filename) }`.

- `selectable: true` adds a checkbox column (the header checkbox selects every filtered row), `onSelectionChange(rows)` reports changes.
- A column with `editable: true` can be edited with a double click, or Enter / F2 on the focused cell. `onEdit(row, key, value, oldValue)` is called after the edit; return `false` to reject it. Numeric cells stay numbers.
- `resizableColumns: true` puts a drag handle on every header edge. The handle is focusable too: Left / Right resize by 10 px, Shift by 50 px, double click resets the column to its configured `width`. Columns take `width`, `minWidth` and `maxWidth`; `onColumnResize(key, width)` and `getColumnWidths()` let you persist the layout.
- `virtual: { height: 400, rowHeight: 36, overscan: 5 }` (or `virtual: true`) renders only the rows in view and keeps the scroll bar the size of the whole list, so 10 000+ rows stay fast. Rows have a fixed height (the theme enforces it, one line per cell), the table scrolls inside `height` and its header stays visible. It replaces pagination; filtering, sorting, selection, editing and CSV export work as usual.
- Hooks and looks: `cellClass(row, column)` and `rowClass(row)` return a class name (or a list) for a cell or a row. `focusableRows: true` makes rows reachable with Tab (`rowLabel(row)` is their aria-label); together with `onRowClick` they open with Enter and Space. `density: "compact"`, and `wrap: true | false` (long text wraps, or stays on one line with an ellipsis). The pager is hidden when there is only one page.
- Column extras: `render(row, value)` returns text or a Node (built by you, so it is safe by construction), `align: "left" | "center" | "right"`. Text longer than 24 characters gets its full text as a tooltip (`title: false` switches it off).
- A virtual table that starts empty draws a full window as soon as it gets rows, and measures again when the scroll area changes size.
- **Rows from a server**: `dataSource: async ({ page, pageSize, cursor, sort, filter }) => ({ rows, total })`. Sorting, the (debounced) filter box and the pager ask it again,
  a slow request shows a loading state, a failed one an error with a Retry button, and an answer that comes too late is ignored. Answer with `total` for numbered pages
  (`page` is 0-based), or with `nextCursor` for a "Load more" button (`cursor` is what the last answer gave). `table.reload()` asks again.
- **Rows from a server and virtual scrolling**: `dataSource` together with `virtual` (every answer needs `total`) scrolls through `total` rows. The rows in view are asked for in chunks of
  `chunkSize` (default 50, `page` is the chunk number), chunks you scroll past are skipped, rows that have not arrived yet show a placeholder, and a failed chunk can be retried.
  The select-all checkbox only selects the rows that have arrived.
- `rowActions: [{ label: "Delete", danger: true, onclick: row => remove(row), hidden: row => row.locked, ariaLabel: row => "Delete " + row.name }]` adds a column of buttons.
- `exportCsv()` downloads the filtered and sorted rows. Cells that start with `=`, `+`, `-` or `@` are prefixed with `'` so a spreadsheet does not run them as formulas.

### Forms

```js
const form = generateForm({
    parent: "wrapper",
    submitText: "Save",
    fields: [
        { name: "name", label: "Name", required: true, minLength: 2, help: "At least 2 characters" },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "password", label: "Password", type: "password", required: true },
        { name: "password2", label: "Repeat", type: "password", match: "password" },
        { name: "country", label: "Country", type: "select", placeholder: "Choose...", options: ["Hungary", "Italy"] },
        { name: "plan", type: "radio", label: "Plan", options: ["Free", "Pro"], value: "Free" },
        { name: "news", type: "switch", label: "Newsletter" }
    ],
    onSubmit: async values => { await save(values); }   // called when every field is valid
});
```

Field types: `text`, `password`, `email`, `number`, `date`, `datetime-local`, `time`, `month`, `week`, `url`, `tel`,
`search`, `color`, `range`, `file`, `hidden`, `textarea`, `select` (`multiple`), `checkbox`, `switch`, `radio`,
`checkboxes`, `autocomplete`, `multiselect`, `daterange` (value `{ from, to }`), `richtext` and `wysiwyg` (value: safe HTML).
The date, time and color types use the native pickers of the browser.

Rules (`required`, `email`, `minLength`, `maxLength`, `pattern`, `min`, `max`, `match`, `validate(value, values)`) can be
given on the field or in `rules`. A field is validated when it loses focus, then on every change. A rejected
`onSubmit` promise is shown as form message and the submit button shows a spinner while it runs.

The returned form has `getValues()`, `setValues()`, `setErrors({ name: "Taken" })` (server side errors),
`validate()`, `reset()`, `setMessage(text)`, `fields` and `submitButton`. `generateField(options)` builds a single field.

`generateButton({ text, variant, loading, disabled, onclick })` has the variants `primary`, `secondary`, `danger` and
`link`, and returns `{ element, setLoading, setDisabled, setText }`.

### Feedback

```js
showToast({ title: "Saved", message: "All good", type: "success", duration: 4000 });   // info | success | warning | error
generateAlert({ parent: "wrapper", type: "error", message: "Failed", dismissible: true });
generateSpinner({ parent: "wrapper", size: "large" });
const progress = generateProgress({ parent: "wrapper", label: "Upload", value: 20 });   // no value: indeterminate
progress.setValue(60);
```

### Dialogs

```js
await alertDialog("Saved");
if (await confirmDialog("Delete the item?", { title: "Delete", confirmText: "Delete", danger: true })) { /* ... */ }
const name = await promptDialog("Your name", { validate: v => v ? "" : "Required" });   // null when cancelled
const choice = await showDialog({ title: "Custom", content: "Pick one", buttons: [{ text: "A", value: "a" }, { text: "B", value: "b" }] });
```

Options: `size` ("small" 360 px, "medium" 480 px, "large" 720 px, "full") and `class` (extra class on the dialog).
`showDialog` returns a promise that also carries the open dialog: `const dialog = showDialog({ size: "large", ... }); dialog.element; dialog.close(value);`.
The dialog is shown by a CSS class, not by an inline style, so a strict Content-Security-Policy works.

**Form dialog** and **confirmation**:

```js
const saved = await showFormDialog({
    title: "Add host", intro: "The agent connects with this name.", size: "small", submitText: "Add",
    fields: [{ name: "name", label: "Name", required: true }],
    onSubmit: async (values, form) => {
        const answer = await api.addHost(values);                   // when this throws, the message shows in the dialog and it stays open
        if (answer.errors) throw Object.assign(new Error("Check the fields"), { fields: answer.errors });   // or form.setErrors({ name: "Already taken" })
    }
});                                                                    // true when saved, false when dismissed

if (await showConfirm({ title: "Delete host", message: "This cannot be undone.", confirmText: "Delete", danger: true, typeToConfirm: host.name })) { /* ... */ }
```

Dialogs trap the focus, close with Esc (resolving `null` / `false`) and restore the focus. Text content is
never parsed as HTML. `openModal` / `closeModal` got the same focus handling.

### Navigation

```js
generateTabs({ parent: "wrapper", tabs: [{ id: "a", label: "A", content: "First" }, { id: "b", label: "B", content: () => lazyNode() }] });
generateAccordion({ parent: "wrapper", items: [{ title: "Q", content: "A", open: true }], multiple: false });
generateDropdown({ parent: "wrapper", label: "Actions", items: [{ label: "Edit", onclick }, { divider: true }, { label: "Delete", onclick }] });
generateDropdown({ parent: "wrapper", icon: "⋮", ariaLabel: "More actions", items: [{ label: "Edit", onclick }] });   // icon only; also caret: true, toggleClass
generatePagination({ parent: "wrapper", total: 200, pageSize: 10, onChange: page => load(page) });
generateBreadcrumbs({ parent: "wrapper", items: [{ label: "Home", href: "#/" }, { label: "Users" }] });
generateSidebar({ parent: "wrapper", active: "home", onSelect: item => go(item.id),
    items: [{ id: "home", label: "Home" }, { id: "reports", label: "Reports", children: [{ id: "daily", label: "Daily" }] }] });
```

Tabs, dropdown and the combobox inputs follow the WAI-ARIA keyboard patterns (arrow keys, Home / End, Esc).
The sidebar collapses behind a toggle button on small screens.

### Menus with submenus

```js
init({
    menuItems: {
        headerMenu: [
            { id: "menu-home", class: "menu-item", text: "", inner_text: "Home" },
            { id: "menu-more", class: "menu-item", text: "", inner_text: "More", children: [{ inner_text: "Reports" }, { inner_text: "Archive", disabled: true }] }
        ],
        footerMenu: []
    },
    nav: name => router.navigate(`/${name.toLowerCase()}`)   // called with the entry's inner_text
});
```

A submenu opens with a click, Enter, Space or the Down arrow, closes with Esc, a click outside or by choosing an entry,
and supports the arrow keys, Home and End. The same works in the footer menu.

### Menu component

`generateMenu` is a navigation menu that does not use globals. Items are real links (`href`) or buttons, so Tab, Enter and Space work, and screen readers hear what they are.

```js
const menu = generateMenu({
    parent: "header",                              // an element, an id or a selector
    layout: "responsive",                          // "bar" | "bottom-tabs" | "responsive" (tabs at the bottom under 700px, groups open as sheets)
    followHash: true,                              // the item whose href equals location.hash is the active one
    onNavigate: (item, event) => console.log(item.id),   // only when a person uses an item, never from select() or while building
    items: [
        { id: "home", label: "Home", icon: "⌂", href: "#/" },
        { id: "inbox", label: "Inbox", href: "#/inbox", badge: 3, badgeLabel: "3 unread" },
        { id: "tools", label: "Tools", children: [
            { id: "export", label: "Export" },
            { id: "more", label: "More", children: [{ id: "csv", label: "CSV" }, { id: "json", label: "JSON" }] }
        ] },
        { id: "user", label: "Anna Kiss", avatar: { name: "Anna Kiss" }, align: "end", children: [{ id: "out", label: "Sign out" }] }
    ]
});
menu.select("inbox");                  // marks the current page (class is-active, aria-current="page", has-active on the groups around it)
menu.setBadge("inbox", { text: 12, tone: "bad" });   // a count, text, or { text, tone: "info" | "ok" | "warn" | "bad" }; 0 / null removes it
```

Groups nest to any depth: ArrowDown / ArrowUp open the first level, ArrowRight opens a deeper group and ArrowLeft closes it, Esc closes the innermost group
first, Home / End jump, a click outside closes everything. A badge above 99 shows "99+". `generateHeaderMenu({ items, onNavigate })` puts the same menu into the header.

### Router

```js
const router = createRouter({
    routes: {
        "/": () => renderHome(),
        "/users/:id": ({ params, query }) => renderUser(params.id),
        "/admin": { handler: renderAdmin, title: "Admin" }
    },
    outlet: "wrapper",                                     // emptied before every page
    beforeEach: ({ path }) => path === "/admin" && !isLoggedIn() ? "/login" : undefined,   // false cancels, a path redirects
    notFound: () => renderNotFound()
});
router.start();
router.navigate("/users/5?tab=info");
```

Routes can carry the sign-in rules, so a page does not check them itself:

```js
const router = createRouter({
    auth: auth.routerRules({ loginPath: "/login", homePath: "/", forbiddenPath: "/denied" }),   // { isSignedIn, hasRole, ... }
    focusContent: true, scrollTop: true,                    // after a page is shown: focus the outlet, scroll to the top
    onShown: ctx => menu.select(ctx.path),                  // also onRender (before the page function) and router.onChange(listener)
    routes: {
        "/login": { handler: renderLogin, guestOnly: true },                    // a signed-in person goes home
        "/account": { handler: renderAccount, auth: true },                     // not signed in: /login?next=%2Faccount
        "/admin": { handler: renderAdmin, auth: true, roles: ["admin"] },
        "/report": { handler: renderReport, guard: ctx => ctx.query.id ? undefined : "/reports" }   // false stays, a path redirects
    }
});
```

`mode: "history"` uses real paths instead of the hash, the server then has to answer every path with the page.
Pass `router.navigate` from your `nav` callback to route the menu clicks.

### Components

```js
const grid = generateGrid({ parent: "wrapper", columns: 3 });         // one column on small screens
generateStat({ parent: grid, label: "Revenue", value: "$12k", delta: 8.2 });
generateCard({ parent: grid, title: "Title", content: "Text or a Node", footer: "Footer", image: "a.jpg" });
generateBadge({ parent: "wrapper", text: "new", variant: "success", pill: true });
generateAvatar({ parent: "wrapper", name: "Ada Lovelace", src: "ada.png" });   // initials without a working image
generateTooltip(buttonElement, "Saves the form");
generateLink({ parent: "wrapper", text: "Docs", href: "https://example.com", external: true });
generateSection({ parent: "wrapper", title: "Section", level: 2, content: "..." });
```

`parent` is the id of an element or the element itself. String content is always inserted as text.

### Inputs

```js
generateAutocomplete({ parent: "wrapper", label: "Country", options: ["Hungary", "Italy"] });
generateAutocomplete({ parent: "wrapper", options: async query => fetchSuggestions(query), minChars: 2 });   // remote data
generateMultiSelect({ parent: "wrapper", options: [{ value: "h", text: "Hungary" }], value: ["h"] });         // getValue(): array
generateFileUpload({ parent: "wrapper", accept: ".png,.pdf", maxSize: 2 * 1024 * 1024, url: "/upload",
    onProgress: (file, percent) => {}, onComplete: (file, response) => {}, onError: (file, error) => {} });
generateStepper({ parent: "wrapper", onFinish: () => {}, steps: [
    { title: "Account", content: () => buildStep1(), validate: () => valid || "Fix the errors" },
    { title: "Done", content: "Finished" }
] });
```

```js
generateDateRange({ parent: "wrapper", label: "Stay", from: "2026-06-01", min: "2026-01-01", onChange: ({ from, to }) => {} });
const editor = generateRichText({ parent: "wrapper", label: "Description", placeholder: "Write...", value: "<p>Hello</p>",
    toolbar: ["bold", "italic", "|", "ul", "ol", "link"], onChange: html => {} });
editor.getValue();   // safe HTML, "" when empty
```

The date range uses the native date pickers; the end picker starts at the chosen start date and a reversed range typed by
hand is reported. The rich text editor produces a restricted set of HTML (paragraphs, headings, bold / italic / underline /
strike, lists, quotes, code, links). Everything else (scripts, styles, iframes, images, event attributes, `javascript:` and
`data:` links) is removed when the content is set, pasted, dropped and read, so the value is safe to store and show with
`innerHTML`; links get `rel="noopener noreferrer"`. Toolbar buttons: `bold`, `italic`, `underline`, `strike`, `h2`, `h3`,
`quote`, `ul`, `ol`, `link`, `unlink`, `clear`, `undo`, `redo`. The editor is built on `contenteditable` and
`document.execCommand`, which every browser still supports; sanitize on the server as well, as with any HTML you accept.

```js
generateDropZone({ parent: "wrapper", accept: "image/*", maxSize: 2 * 1024 * 1024, maxFiles: 3,
    onDrop: files => {}, onReject: rejected => rejected.forEach(({ file, reason }) => {}) });
const wysiwyg = generateWysiwyg({ parent: "wrapper", label: "Body", value: "<p>Hello</p>" });   // rich text + HTML source view
```

`generateDropZone` is a bare drag-and-drop area (also reachable with Enter / Space and the file dialog). Dropped files are
checked against `accept`, `maxSize` and `maxFiles`; valid ones go to `onDrop`, the others to `onReject` with a reason. It
reads and sends nothing, and `setDisabled(true)` turns it off. `generateWysiwyg` is the rich text editor plus a `source`
toolbar button that shows the sanitized HTML; what is typed there is sanitized again when you switch back.

Files are sent as a multipart POST (`fieldName`, `headers` are configurable). Without `url` the files are only collected,
read them with `getFiles()`.

### Session

```js
login: async ({ username, password, remember }) => {
    const user = await api.login(username, password);
    setSession({ user, token: user.token, remember });   // a session cookie, or `session_days` days when remembered
    router.navigate("/");
}
isLoggedIn(); getSession(); logout();
onSessionChange(session => updateMenu(session));
```

The session lives in a cookie written from script, so any script of the page can read it. Keep only what the UI needs in it
and let the server enforce authorization; a server set `HttpOnly` cookie is the safer place for real credentials.

### Translations

```js
init({ config: { locale: "hu" } });       // English and Hungarian are included
setLocale("en");                          // switch at runtime, texts of new components follow
addMessages("de", { login: "Anmelden", "validation.required": "Pflichtfeld" });
translate("login");
```

Missing texts fall back to English. See `src/libs/core/i18n.js` for all keys.

### Usage from classic scripts

The same API is available as globals (and as `AthenaUI`), so scripts written for earlier versions
keep working. Load `athena-ui.js` with `type="module"` and call the globals after the DOM is ready:

```html
<script>
    var appConfig = { header_title_text: "My App", customLoader: "js/app.js" };
</script>
<script type="module" src="athena-ui/src/athena-ui.js"></script>
<script>
    $(function () {
        init({ theme: { id: 0 } });
    });
</script>
```

The global `appConfig`, `menuItems`, `nav`, `login`, `register` and `lostPassword` are used when the matching `init` option is
not given. `appConfig.athenaUIFolder` is not needed anymore, paths are resolved relative to
`athena-ui.js`.

### Signing in (recommended)

`generateSignInForm`, `generateSignUpForm`, `generatePasswordResetForm` and `generatePasswordChangeForm` are real `<form>` elements with the autocomplete tokens
that password managers look for (`username`, `current-password`, `new-password`, `email`), so Enter submits and the browser can save and fill passwords.

```js
const auth = createAuthState({ restore: () => fetch("/api/me", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : null)) });
await auth.restore();                                   // after a reload: ask the server who is signed in

generateSignInForm({
    parent: "wrapper", remember: true,
    onSubmit: async ({ username, password, remember }) => {
        const response = await fetch("/api/login", { method: "POST", body: JSON.stringify({ username, password, remember }), credentials: "same-origin" });
        if (!response.ok) throw new Error("Wrong user name or password");        // shown in the form, which stays usable
        auth.signIn(await response.json());                                      // { name, roles: [...] }
    }
});
```

An error with a `fields` object (`{ username: "Already taken" }`) marks those fields as well. The password is sent as typed, over HTTPS: hash it on the server.
Hashing it in the browser (`enable_encrypt_password`) only turns the hash into the password, so that setting is **deprecated** and will be removed in 2.0.
`createAuthState` keeps who is signed in **in memory only**: nothing readable is written to a cookie or the storage, the session itself is a server set `HttpOnly` cookie,
and the server decides what a person may do. `auth.hasRole(role)`, `auth.onChange(listener)` and `auth.routerRules()` connect it to menus and the router.

## Themes

A theme is a single stylesheet. Register it in `src/res/themes/themes.js` and select it with
`theme: { id }`, or pass any stylesheet directly with `theme: { href: "css/my-theme.css" }`.
The default theme is in `src/res/themes/default/style.css`; `{ id: 1 }` is a dark theme. All colors are CSS variables
(`--athena-bg`, `--athena-fg`, `--athena-accent`, ...), so a custom theme can import the default one and override them:

```css
@import url("athena-ui/src/res/themes/default/style.css");
:root { --athena-accent: #8e44ad; }
```

Switch themes at runtime with `setTheme({ id: 1 })`.

### Themes and modes (light / dark / like the system)

A second system lets people choose a theme **and** a mode. It is just two attributes on `<html>` that `src/res/themes/appearance.css` reads:

```html
<link rel="stylesheet" href="athena-ui/src/res/themes/default/style.css">
<link rel="stylesheet" href="athena-ui/src/res/themes/appearance.css">
<script src="athena-ui/src/theme-boot.js" data-key="myapp.appearance" data-theme="athena"></script>   <!-- before the page is drawn: no flash of the wrong colours -->
```

```js
const manager = createThemeManager({ themes: [{ id: "athena", name: "Athena" }, { id: "contrast", name: "High contrast" }], storageKey: "myapp.appearance",
    themeColorVariable: "--athena-bg" });                  // <meta name="theme-color"> follows this variable
manager.setTheme("contrast"); manager.setMode("dark");    // "system" | "light" | "dark"; saved in localStorage, other tabs follow
manager.onChange(({ theme, mode, dark }) => redrawChartsOrWhatever());
generateThemePicker({ parent: "account-page", manager });  // radio groups with a small preview of every theme
```

**The contract of a theme** (also at the top of `appearance.css`): a theme is a pair of CSS blocks that set the tokens
`--athena-bg`, `-fg`, `-muted`, `-line`, `-border`, `-surface`, `-surface-alt`, `-hover`, `-overlay`, `-accent`, `-accent-fg`, `-focus`, `-danger`, `-success`, `-warning`, `-info`, `-shadow` and `--series-1` ... `--series-8`:

```css
[data-theme="ocean"][data-mode="light"] { --athena-bg: #f4f9fb; /* ... */ }
[data-theme="ocean"][data-mode="dark"]  { --athena-bg: #0b1c24; /* ... */ }
```

The selectors match any element with the two attributes, so a preview or a dark panel on a light page is just an element with `data-theme` and `data-mode`.
Athena and High contrast (light and dark) are included; without the script the page follows the system.

### Date and time range

```js
const range = generateDateTimeRange({ parent: "wrapper", label: "Time", preset: "24h", onChange: ({ from, to, preset }) => reload() });
range.getRange();     // { from: Date, to: Date }. A preset ("15m", "1h", "24h", "7d", "30d") is measured from NOW when this is called
range.getValue();     // { from: "2026-11-19T08:00", to: "...", preset: "24h" }, the values of the inputs
```

Two `datetime-local` inputs and a list of presets (your own with `presets: [{ id, label, minutes }]`). Typing in an input makes it a custom range.
`toLocalInput(date)` and `fromLocalInput(value)` convert between a Date and the value of such an input.

### Page parts and formatting

```js
generatePageHeader({ parent: "wrapper", title: "Hosts", description: "All monitored machines", breadcrumbs: [{ label: "Home", href: "#/" }, { label: "Hosts" }], actions: [addButton] });
generateFacts({ parent: "wrapper", items: [{ term: "System", description: "Linux" }, { term: "Seen", description: formatRelativeTime(host.lastSeen) }] });
generateEmptyState({ parent: "wrapper", title: "No hosts yet", message: "Install the agent.", action: { text: "Add host", onclick: add } });
generateLoading({ parent: "wrapper" });                                    // spinner + text, a live region
generateStat({ parent: "wrapper", label: "CPU", value: "91 %", tone: "bad", note: "of 4 cores" });   // tone: "ok" | "warn" | "bad" (colour + a word for screen readers)
await copyToClipboard(token);                                              // and says "Copied" in a toast
formatBytes(1536); formatNumber(1234567.891); formatDuration(7500000); formatRelativeTime(date); formatDate(date, { time: true });   // Intl, in the current language
```

### Safe DOM building

`el(tag, { class, id, text, attrs, on, prop }, ...children)` is the way Athena builds its own pages, and it is exported. Strings are only ever inserted as **text**, children can be
nested lists, listeners have to be functions, and `on*` attributes, `style` and `srcdoc`, unsafe addresses (`javascript:`, `data:`) in `href` / `src` / `action`, and properties that
parse HTML (`innerHTML`) are refused. `createSafeBuilder({ tags: [...], attributes: [...] })` returns an `el` that only allows what is on your lists, for pages built from data you
do not control (a plugin API).

### Moved into Athena: HTMLElementGenerator and HTMLControlGenerator

Both used to be projects of their own and are part of Athena UI since 1.3.0 (same calls and options, MIT, same author). `HTMLElementGenerator(options)` is in
`src/libs/core/elementGenerator.js`, `HTMLControlGenerator(options)` / `.create()` / `.register()` in `src/libs/core/controls.js`; both are exported and global as before.
`HTMLControlGenerator` no longer needs jQuery (`create` returns a jQuery object when the page has jQuery, otherwise the element).
`registerHungarianInputControls()` adds the `hunPIN`, `hunCRID` and `hunTID` input types of its old addon. The old repositories are no longer developed.

### Parents and handles

Every `parent` option takes an element, an id or a CSS selector (`"wrapper"`, `"#list"`, `".panel > ul"`; an id wins over a selector).
The components return the same kind of handle: `{ element, update(), destroy() }`, plus their own methods. `destroy()` removes the
component. `update()` redraws it where that makes sense (`table.update({ rows })`, `chart.update({ series })`, `stat.update({ value })`,
`progress.update({ value })`) and otherwise just returns the handle. `generateChart` still returns the SVG element, which also carries
`element`, `update(options)` and `destroy()`.

### Testing your application

```js
import { JSDOM } from "jsdom";
import { installDom, until, tick } from "athena-ui-js/testing";

const dom = installDom(JSDOM);                       // window, document, Node, Event, ... become global
generateDropdown({ parent: "#wrapper", icon: "x", ariaLabel: "More", items: [] });
await until(() => document.querySelector(".dropdown"), { message: "the dropdown" });
dom.uninstall();
```

`installDom` takes your own `JSDOM` class, so Athena UI has no dependency on jsdom. Athena creates its events from the element's own
window, so they work in jsdom without a global `Event`.

## Tests

```sh
npm test              # unit tests of the pure modules, run in Node
npm run test:browser  # the components in headless Chrome
```

The unit tests cover validation, translations, router matching, CSV, pagination, formatting, virtual scrolling math, date ranges and the URL check.
The browser tests start a small static server, open `tests/browser/index.html` in headless Chrome, Chromium or Edge and run every
component: forms, dialogs, navigation, submenus, inputs, rich text (sanitizing, toolbar, paste), tables (resizing, virtual scrolling), router,
session, themes. Set `CHROME_PATH` if the browser is not found, and `JQUERY_URL` to load jQuery from somewhere else than the CDN
(the machine needs internet access otherwise). `DEBUG=1` prints the browser log when the page does not report results.

A test run without jQuery is the default; `WITH_JQUERY=1 npm run test:browser` loads jQuery from its CDN to check that an application that still has it works too.

## Project structure

```
src/
  athena-ui.js              entry point, exports the whole API
  index.html, example.js    example page
  libs/
    config/                 default configuration, application hooks
    core/                   DOM / focus helpers, validation, translations, CSV, formatting, sanitizer, table math
    hephaestus/             script and theme loader, generators (layout, menu, forms, charts, tables, feedback,
                            dialogs, navigation, components, inputs), router, session
    crypto-js/, js-cookie/  submodules (third party)
    libs.js                 classic scripts loaded at runtime (only crypto-js, and only with the deprecated enable_encrypt_password)
  res/themes/               default and dark theme, appearance.css (themes and modes)
  theme-boot.js             classic script that sets the saved theme and mode before the page is drawn
  testing.js                installDom, until, tick for the tests of an application
tests/                      unit tests (Node) and browser tests (headless Chrome)
```

## Authors

* **Csaba Tóth** - *Initial work* - [csabatibortoth](https://github.com/csabatibortoth)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Releases

 ### 1.3.0
  #### Added:
   1. Dialogs: `showFormDialog` (async save, errors stay in the dialog, `form.setErrors`) and `showConfirm` (`danger`, `typeToConfirm`)
   2. Themes: `createThemeManager`, `generateThemePicker`, `theme-boot.js` and `appearance.css` (the contract: `data-theme` + `data-mode`, the tokens, Athena and High contrast in light and dark)
   3. `generateMenu`: real links and buttons, groups of any depth, badges, avatar user menu, active item, bar / bottom tabs / responsive; `generateHeaderMenu({ items })`
   4. Tables: `dataSource` (pages, cursor "Load more", loading / empty / error with Retry), `dataSource` together with `virtual`, `rowActions`, `reload()`
   5. Charts: `area` and `sparkline`, time axis, tooltips, clickable legend, table of values, theme colours, zoom, long series thinning, `push()` for streaming
   6. Router: `auth`, `guestOnly`, `roles`, `guard`, `onRender` / `onShown`, `focusContent`, `scrollTop`, `router.onChange`
   7. `generateSignInForm`, `generateSignUpForm`, `generatePasswordResetForm`, `generatePasswordChangeForm`, `createAuthState`
   8. `generateDateTimeRange` with presets, `generatePageHeader`, `generateFacts`, `generateEmptyState`, `generateLoading`, stat `tone` and `note`, `copyToClipboard`, format helpers
   9. `el`, `setContent`, `resolveElement`, `asHandle` and `createSafeBuilder` are exported
   10. HTMLElementGenerator and HTMLControlGenerator (and the Hungarian input addon) are part of Athena UI; no more submodules for them
  #### Changed:
   1. jQuery is optional: init() does not need it, the layout, modal, forms and menus use plain DOM, the browser tests run without it
   2. Only crypto-js can still be loaded as a classic script, and only with `enable_encrypt_password`
   3. `el()` refuses code attributes and unsafe addresses
  #### Deprecated:
   1. `enable_encrypt_password` and the hashing of the old login forms (removed in 2.0): send the password over HTTPS and hash it on the server

 ### 1.2.0
  #### Added:
   1. Dialogs: `size` and `class` options, and the open dialog (`element`, `backdrop`, `close()`) on the returned promise
   2. Tables: `cellClass`, `rowClass`, `focusableRows` / `rowLabel`, `density`, `wrap`, column `render` (text or Node), `align`, tooltip for cut text
   3. Dropdown: `icon`, `ariaLabel`, `caret`, `toggleClass`; the label is optional
   4. Every `parent` option takes an element, an id or a CSS selector; the components share the handle `{ element, update(), destroy() }`
   5. `athena-ui-js/testing`: `installDom`, `until`, `tick`
  #### Changed:
   1. The dialog backdrop is shown by a CSS class, not by an inline style (works with a strict Content-Security-Policy)
   2. Virtual tables: a list that starts empty draws a full window, the window is measured again when the scroll area changes size, and the cell padding no longer loses against the application's `td` padding
   3. The combobox creates its events from the element's own window (no more jsdom errors)
   4. The pager of a table with one page is hidden

 ### 1.1.0
  #### Added:
   1. `generateDropZone` / `createDropZone`: drag-and-drop area with file type, size and count checks
   2. `generateWysiwyg` / `createWysiwyg` and the `wysiwyg` form field: rich text editor with a sanitized HTML source view
  #### Changed:
   1. `generateFileUpload` is built on the drop zone; dragging over child elements no longer flickers

 ### 1.0.0
  #### Added:
   1. Stable public API (semantic versioning from this release on)
   2. README: status, known limits and quick links
  #### Changed:
   1. Version bumped to 1.0.0, no breaking changes since 0.7.0

 ### 0.7.0
  #### Added:
   1. Menus with submenus: `children` on a menu item, with keyboard support
   2. Tables: resizable columns (mouse and keyboard) and virtual scrolling (`virtual`) for thousands of rows
   3. `generateDateRange` and the `daterange` form field
   4. `generateRichText` / `createRichText` and the `richtext` form field, with an allow-list sanitizer (`sanitizeHtml`, `isSafeUrl`)
   5. Browser tests in headless Chrome (`npm run test:browser`), more unit tests
  #### Changed:
   1. English and Hungarian texts for the new components

 ### 0.6.0
  #### Added:
   1. Form builder (`generateForm`, `generateField`, `generateButton`) with validation, textarea, select, radio / checkbox groups, switch, autocomplete and multi select
   2. Feedback: `showToast`, `generateAlert`, `generateSpinner`, `generateProgress`; dialogs: `alertDialog`, `confirmDialog`, `promptDialog`, `showDialog`
   3. Navigation: tabs, accordion, dropdown, sidebar, breadcrumbs, pagination; `createRouter`
   4. Components: card, grid, section, badge, avatar, stat, tooltip, link
   5. `generateFileUpload` with progress, `generateStepper`
   6. Tables: row selection, inline editing, CSV export
   7. Session handling, change password form, "Remember me" in the login form
   8. Dark theme, `setTheme`, CSS variables, responsive styles
   9. Translations (English, Hungarian), `translate`, `setLocale`, `addMessages`
   10. Unit tests (`npm test`)
  #### Changed:
   1. Modals trap the focus, close with Esc and restore the focus
   2. The texts of the forms and of the table go through `translate`; the registration form checks its fields with the shared validator
   3. `init` accepts the `changePassword` callback

 ### 0.5.0
  #### Added:
   1. `generateChart`: bar, line, pie and donut charts as inline SVG
   2. `generateTable`: sortable, filterable, paginated tables
   3. `generateRegistrationForm` and `generateLostPasswordForm`, with the `register` / `lostPassword` callbacks and the `registration_enabled` / `lost_password_enabled` settings
   4. Example page shows all of them

 ### 0.4.1
  #### Changed:
   1. HTMLControlGenerator v0.4.0, HTMLElementGenerator v0.3.0, js-cookie updated to the latest master
   2. HTMLElementGenerator is imported as an ES module instead of being loaded as a classic script
   3. crypto-js follows the `master` branch, which holds the built release files
  #### Added:
   1. `HTMLElementGenerator` is exported from `athena-ui.js` (and stays available as a global)
  #### Bugfix:
   1. The label of a menu item without an `id` is not appended to the page body

 ### 0.4.0
  #### Changed:
   1. Rewritten as ES modules (no more chained `$.getScript` loading, no implicit globals)
   2. JQuery v4.0.0, js-cookie v3.0.8, crypto-js v4.2.0
   3. Libraries and theme load in parallel, the layout is generated when all of them are ready
   4. Theme CSS merged into a single file
   5. `init()` returns a Promise and accepts `config`, `nav`, `login`, `menuItems`
  #### Bugfix:
   1. Theme option (`theme` / `themes`) is respected, unknown theme falls back to the default
   2. Menu class does not start with "undefined"
   3. Modal script does not fail when the page has no modal
   4. Login data is not written to the console

 ### 0.3.6
  #### Added
   1. submodule update

 ### 0.3.4
  #### Added:
   1. support for custom JS loading
  #### Bugfix:
   1. Theme name fix

 ### 0.3.3
  #### Added:
   1. Modal support

 ### 0.3.2
  #### Added:
  1. title change
  2. copyright text change

 ### 0.3.1
  #### Added:
  1. Header element container added

 ### 0.3.0
  #### Added:
   1. Navigation Function call for menu

 ### 0.2.9
  #### Bugfix:
   1. Login form generation bugfix 2

 ### 0.2.8
  #### Bugfix:
   1. Login form generation bugfix

 ### 0.2.7
 #### Added:
  1. Basic layout div clear functions

 ### 0.2.6
 #### Added:
  1. Header Logo
  2. Updated Submodules

 ### 0.2.5
 #### Added
  1. JS-Cookie

 ### 0.2.4
 #### Added
  1. Crypto-JS
  2. Password encryption support

 #### Bugfixes
  1. Login form generation

 ### 0.2.3
 #### Bugfixes
  1. Bugfixes on login form generation

 ### 0.2.2
 #### Added:
  1. Login Form generation

 #### Bugfix:
  1. Config loading error fixed

 ### 0.2.1
 #### Bugfix:
  1. Some bugfixes on element generation

 ### 0.2.0
 #### Added:
  1. Element generation from external configuration

 ### 0.1.1
 #### Added:
  1. Fixes

 ### 0.1.0
 #### Added:
  1. basic html layout generation
  2. header generation
  3. footer generation
 
