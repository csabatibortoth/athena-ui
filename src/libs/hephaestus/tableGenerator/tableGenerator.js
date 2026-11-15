//tableGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

const el = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
};

const compare = (a, b) =>
    typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });

/**
 * Generates a table (optional filter box, sortable headers, pagination) and appends it to its parent.
 *
 * @param {object} options
 * @param {string} [options.parent] id of the parent element, defaults to "wrapper"
 * @param {string} [options.id] id of the table wrapper (default: "table")
 * @param {string} [options.class] extra CSS class of the table
 * @param {string} [options.caption]
 * @param {{key: string, label?: string, sortable?: boolean, format?: (value, row) => string}[]} options.columns
 * @param {object[]} [options.rows] row objects, read by column key
 * @param {boolean} [options.sortable=true] click on a header sorts by it
 * @param {boolean} [options.filter=false] show a text filter above the table
 * @param {number} [options.pageSize=0] rows per page, 0 disables pagination
 * @param {(row: object) => void} [options.onRowClick]
 * @param {string} [options.emptyText]
 * @returns {{element: HTMLElement, setRows: (rows: object[]) => void}}
 */
export function generateTable(options = {}) {
    const {
        parent = "wrapper", id = "table", columns = [], sortable = true,
        filter = false, pageSize = 0, onRowClick, emptyText = "No data"
    } = options;
    const host = document.getElementById(parent) ?? document.body;
    let rows = [...(options.rows ?? [])];
    const state = { sortKey: null, descending: false, page: 0, query: "" };

    const root = el("div", "athena-table-wrapper");
    root.id = id;
    const table = el("table", `athena-table ${options.class ?? ""}`.trim());
    if (filter) {
        const filterInput = el("input", "athena-table-filter");
        filterInput.type = "search";
        filterInput.placeholder = "Filter...";
        filterInput.addEventListener("input", () => {
            state.query = filterInput.value.toLowerCase();
            state.page = 0;
            render();
        });
        root.append(filterInput);
    }
    root.append(table);
    const pager = pageSize > 0 ? el("div", "athena-table-pager") : null;
    if (pager) root.append(pager);
    host.append(root);

    function visibleRows() {
        let result = rows;
        if (state.query) {
            result = result.filter(row =>
                columns.some(col => String(row[col.key] ?? "").toLowerCase().includes(state.query)));
        }
        if (state.sortKey) {
            const dir = state.descending ? -1 : 1;
            result = [...result].sort((a, b) => dir * compare(a[state.sortKey], b[state.sortKey]));
        }
        return result;
    }

    function renderHead() {
        const tr = el("tr");
        for (const col of columns) {
            const th = el("th", null, col.label ?? col.key);
            th.scope = "col";
            if (sortable && col.sortable !== false) {
                th.classList.add("sortable");
                th.tabIndex = 0;
                const sort = () => {
                    state.descending = state.sortKey === col.key && !state.descending;
                    state.sortKey = col.key;
                    render();
                };
                th.addEventListener("click", sort);
                th.addEventListener("keydown", e => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        sort();
                    }
                });
                if (state.sortKey === col.key) {
                    th.append(el("span", "sort-indicator", state.descending ? " ▼" : " ▲"));
                    th.setAttribute("aria-sort", state.descending ? "descending" : "ascending");
                }
            }
            tr.append(th);
        }
        const thead = el("thead");
        thead.append(tr);
        return thead;
    }

    function renderBody(pageRows) {
        const tbody = el("tbody");
        if (!pageRows.length) {
            const td = el("td", "athena-table-empty", emptyText);
            td.colSpan = Math.max(columns.length, 1);
            const tr = el("tr");
            tr.append(td);
            tbody.append(tr);
            return tbody;
        }
        for (const row of pageRows) {
            const tr = el("tr");
            if (onRowClick) {
                tr.classList.add("clickable");
                tr.addEventListener("click", () => onRowClick(row));
            }
            for (const col of columns) {
                const value = row[col.key];
                tr.append(el("td", null, col.format ? col.format(value, row) : (value ?? "")));
            }
            tbody.append(tr);
        }
        return tbody;
    }

    function renderPager(total) {
        if (!pager) return;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        state.page = Math.min(state.page, pages - 1);
        const button = (text, disabled, delta) => {
            const b = el("button", null, text);
            b.type = "button";
            b.disabled = disabled;
            b.addEventListener("click", () => {
                state.page += delta;
                render();
            });
            return b;
        };
        pager.replaceChildren(
            button("‹ Prev", state.page === 0, -1),
            el("span", null, ` Page ${state.page + 1} / ${pages} `),
            button("Next ›", state.page >= pages - 1, 1)
        );
    }

    function render() {
        const all = visibleRows();
        renderPager(all.length);
        const pageRows = pageSize > 0 ? all.slice(state.page * pageSize, (state.page + 1) * pageSize) : all;
        const parts = [renderHead(), renderBody(pageRows)];
        if (options.caption) parts.unshift(el("caption", null, options.caption));
        table.replaceChildren(...parts);
    }

    render();
    return {
        element: root,
        setRows(newRows) {
            rows = [...newRows];
            state.page = 0;
            render();
        }
    };
}
