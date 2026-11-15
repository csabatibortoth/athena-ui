//tableGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

import { downloadFile, toCsv } from "../../core/csv.js";
import { translate } from "../../core/i18n.js";

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
 * Generates a table (optional filter box, sortable headers, pagination, row selection, inline
 * editing, CSV export) and appends it to its parent.
 *
 * @param {object} options
 * @param {string|Element} [options.parent] id or element, defaults to "wrapper"
 * @param {string} [options.id] id of the table wrapper (default: "table")
 * @param {string} [options.class] extra CSS class of the table
 * @param {string} [options.caption]
 * @param {{key: string, label?: string, sortable?: boolean, editable?: boolean, format?: (value, row) => string}[]} options.columns
 * @param {object[]} [options.rows] row objects, read by column key
 * @param {boolean} [options.sortable=true] click on a header sorts by it
 * @param {boolean} [options.filter=false] show a text filter above the table
 * @param {number} [options.pageSize=0] rows per page, 0 disables pagination
 * @param {boolean} [options.selectable=false] checkbox column; the header checkbox selects every filtered row
 * @param {(rows: object[]) => void} [options.onSelectionChange]
 * @param {(row: object, key: string, value, oldValue) => (boolean|void)} [options.onEdit] called after an edit
 *        of an `editable` column (double click, or Enter / F2 on the focused cell). Return false to reject it.
 * @param {(row: object) => void} [options.onRowClick]
 * @param {string} [options.emptyText]
 * @returns {{element: HTMLElement, setRows: Function, getSelected: () => object[], clearSelection: Function,
 *            toCsv: () => string, exportCsv: (filename?: string) => void}}
 */
export function generateTable(options = {}) {
    const {
        parent = "wrapper", id = "table", columns = [], sortable = true,
        filter = false, pageSize = 0, selectable = false, onRowClick, onSelectionChange
    } = options;
    const host = (typeof parent === "string" ? document.getElementById(parent) : parent) ?? document.body;
    let rows = [...(options.rows ?? [])];
    const selected = new Set();
    const state = { sortKey: null, descending: false, page: 0, query: "" };

    const root = el("div", "athena-table-wrapper");
    root.id = id;
    const table = el("table", `athena-table ${options.class ?? ""}`.trim());
    if (filter) {
        const filterInput = el("input", "athena-table-filter");
        filterInput.type = "search";
        filterInput.placeholder = translate("filter");
        filterInput.setAttribute("aria-label", translate("filter"));
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

    const selectionChanged = () => onSelectionChange?.([...selected]);

    function renderHead(all) {
        const tr = el("tr");
        if (selectable) {
            const th = el("th", "athena-table-select");
            const box = el("input");
            box.type = "checkbox";
            box.setAttribute("aria-label", translate("selectAll"));
            const chosen = all.filter(row => selected.has(row)).length;
            box.checked = all.length > 0 && chosen === all.length;
            box.indeterminate = chosen > 0 && chosen < all.length;
            box.addEventListener("change", () => {
                all.forEach(row => (box.checked ? selected.add(row) : selected.delete(row)));
                selectionChanged();
                render();
            });
            th.append(box);
            tr.append(th);
        }
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

    // Replaces the cell content with an input until the edit is confirmed (Enter, blur) or cancelled (Esc).
    function startEdit(td, row, col) {
        if (td.querySelector("input")) return;
        const oldValue = row[col.key];
        const input = el("input", "athena-table-edit");
        input.type = typeof oldValue === "number" ? "number" : "text";
        input.value = oldValue ?? "";
        let finished = false;
        const finish = commit => {
            if (finished) return;
            finished = true;
            if (commit && input.value !== String(oldValue ?? "")) {
                const value = typeof oldValue === "number" && input.value !== "" ? Number(input.value) : input.value;
                row[col.key] = value;
                if (options.onEdit?.(row, col.key, value, oldValue) === false) row[col.key] = oldValue;
            }
            render();
        };
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") finish(true);
            else if (e.key === "Escape") {
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener("blur", () => finish(true));
        td.replaceChildren(input);
        input.focus();
        input.select();
    }

    function renderBody(pageRows) {
        const tbody = el("tbody");
        if (!pageRows.length) {
            const td = el("td", "athena-table-empty", options.emptyText ?? translate("noData"));
            td.colSpan = Math.max(columns.length + (selectable ? 1 : 0), 1);
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
            if (selectable) {
                const td = el("td", "athena-table-select");
                const box = el("input");
                box.type = "checkbox";
                box.checked = selected.has(row);
                tr.classList.toggle("selected", box.checked);
                box.addEventListener("click", e => e.stopPropagation());
                box.addEventListener("change", () => {
                    if (box.checked) selected.add(row);
                    else selected.delete(row);
                    selectionChanged();
                    render();
                });
                td.append(box);
                tr.append(td);
            }
            for (const col of columns) {
                const value = row[col.key];
                const td = el("td", null, col.format ? col.format(value, row) : (value ?? ""));
                if (col.editable) {
                    td.classList.add("editable");
                    td.tabIndex = 0;
                    td.addEventListener("dblclick", () => startEdit(td, row, col));
                    td.addEventListener("keydown", e => {
                        if ((e.key === "Enter" || e.key === "F2") && e.target === td) {
                            e.preventDefault();
                            startEdit(td, row, col);
                        }
                    });
                }
                tr.append(td);
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
            button(`‹ ${translate("previous")}`, state.page === 0, -1),
            el("span", null, ` ${translate("page", { page: state.page + 1, pages })} `),
            button(`${translate("next")} ›`, state.page >= pages - 1, 1)
        );
    }

    function render() {
        const all = visibleRows();
        renderPager(all.length);
        const pageRows = pageSize > 0 ? all.slice(state.page * pageSize, (state.page + 1) * pageSize) : all;
        const parts = [renderHead(all), renderBody(pageRows)];
        if (options.caption) parts.unshift(el("caption", null, options.caption));
        table.replaceChildren(...parts);
    }

    render();
    return {
        element: root,
        setRows(newRows) {
            rows = [...newRows];
            selected.clear();
            state.page = 0;
            render();
            selectionChanged();
        },
        getSelected: () => [...selected],
        clearSelection() {
            selected.clear();
            render();
            selectionChanged();
        },
        // The filtered and sorted rows as CSV text
        toCsv: () => toCsv(columns, visibleRows()),
        exportCsv(filename = "table.csv") {
            downloadFile(filename, toCsv(columns, visibleRows()));
        }
    };
}
